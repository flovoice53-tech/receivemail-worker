// Remote MCP server at /mcp (Streamable HTTP, stateless, JSON responses).
// Each tool replays the matching REST call through the Worker's own fetch
// handler, so limits, auth and response shapes stay identical to the API.
// A paid key sent as `Authorization: Bearer rmk_…` on the MCP request is
// passed to create_mailbox; mailbox secrets travel as tool arguments.

const SERVER_INFO = { name: "receivemail", title: "receivemail.dev", version: "1.0.0" };
const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const INSTRUCTIONS =
  "Disposable email inboxes for testing signup and verification-email flows. Call create_mailbox, give the address to the site under test, then wait_for_email with the returned address and secret. Plain-text bodies only; addresses expire (60 min free, 24 h with a paid key).";

type Dispatch = (req: Request) => Promise<Response>;
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const mailboxArgs = {
  address: { type: "string", description: "Address returned by create_mailbox." },
  secret: { type: "string", description: "Secret returned by create_mailbox." },
};

export const MCP_TOOLS = [
  {
    name: "create_mailbox",
    title: "Create a disposable mailbox",
    description:
      "Create a disposable receivemail.dev email address that receives real mail. Returns address, expiresAt and secret; keep the secret to read the mailbox. Free without a key (up to 60 minutes); with a paid key on the MCP connection, up to 1440 minutes and an extracted otp field on messages.",
    inputSchema: {
      type: "object",
      properties: { ttlMinutes: { type: "integer", minimum: 1, maximum: 1440, description: "Lifetime in minutes, default 15. Free tier caps at 60." } },
      additionalProperties: false,
    },
    annotations: { title: "Create a disposable mailbox", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "wait_for_email",
    title: "Wait for the next email",
    description:
      "Wait up to 25 seconds for an email to a mailbox made with create_mailbox. Returns {timed_out:false, message:{from_address, subject, body_text, received_at}} or {timed_out:true}; call again on timeout. Pass `since` (ISO 8601) to ignore mail you've already seen.",
    inputSchema: {
      type: "object",
      properties: {
        ...mailboxArgs,
        since: { type: "string", description: "Optional ISO 8601 timestamp; only newer mail counts." },
        timeout: { type: "integer", minimum: 1, maximum: 25, description: "Seconds to wait, default 25." },
      },
      required: ["address", "secret"],
      additionalProperties: false,
    },
    annotations: { title: "Wait for the next email", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "list_messages",
    title: "List received emails",
    description: "List the last 50 emails received by a mailbox made with create_mailbox, newest first.",
    inputSchema: { type: "object", properties: mailboxArgs, required: ["address", "secret"], additionalProperties: false },
    annotations: { title: "List received emails", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

export const MCP_SERVER_CARD = {
  $schema: "https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json",
  version: "1.0",
  protocolVersion: SUPPORTED_VERSIONS[0],
  serverInfo: SERVER_INFO,
  description: "Disposable email inboxes for agents and tests: create an address, wait for the verification email, read it. No signup.",
  documentationUrl: "https://receivemail.dev/developers",
  transport: { type: "streamable-http", endpoint: "https://receivemail.dev/mcp" },
  authentication: { required: false, schemes: ["bearer"], description: "Optional paid key (rmk_…) for 24h mailboxes and the otp field." },
  capabilities: { tools: { listChanged: false } },
  instructions: INSTRUCTIONS,
  tools: MCP_TOOLS,
};

function rpcResult(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function rpcError(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

async function callTool(name: string, args: Record<string, unknown>, request: Request, dispatch: Dispatch) {
  const origin = new URL(request.url).origin;
  // Carry the caller's IP so the free tier's per-IP limit applies per MCP client.
  const base: Record<string, string> = { "cf-connecting-ip": request.headers.get("cf-connecting-ip") ?? "unknown" };
  let res: Response;
  if (name === "create_mailbox") {
    const headers: Record<string, string> = { ...base, "content-type": "application/json" };
    const auth = request.headers.get("authorization") ?? "";
    if (/^Bearer rmk_/.test(auth)) headers.authorization = auth;
    const body = typeof args.ttlMinutes === "number" ? { ttlMinutes: args.ttlMinutes } : {};
    res = await dispatch(new Request(`${origin}/mailboxes`, { method: "POST", headers, body: JSON.stringify(body) }));
  } else if (name === "wait_for_email" || name === "list_messages") {
    const address = str(args.address);
    const secret = str(args.secret);
    if (!address || !secret) return toolError("address and secret are required (both come from create_mailbox)");
    const headers = { ...base, authorization: `Bearer ${secret}` };
    let path = `/mailboxes/${encodeURIComponent(address)}/messages`;
    if (name === "wait_for_email") {
      const q = new URLSearchParams({ timeout: String(typeof args.timeout === "number" ? args.timeout : 25) });
      if (str(args.since)) q.set("since", str(args.since));
      path = `/mailboxes/${encodeURIComponent(address)}/wait?${q}`;
    }
    res = await dispatch(new Request(`${origin}${path}`, { headers }));
  } else {
    return null;
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data,
    isError: !res.ok,
  };
}

function toolError(text: string) {
  return { content: [{ type: "text", text }], isError: true };
}

async function handleOne(msg: Rpc, request: Request, dispatch: Dispatch): Promise<object | null> {
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return rpcError(msg?.id, -32600, "Invalid Request");
  // Notifications (no id) get no response.
  const isNotification = msg.id === undefined;
  switch (msg.method) {
    case "initialize": {
      const asked = str(msg.params?.protocolVersion);
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return rpcResult(msg.id, {});
    case "tools/list":
      return rpcResult(msg.id, { tools: MCP_TOOLS });
    case "tools/call": {
      const name = str(msg.params?.name);
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      let result;
      try {
        result = await callTool(name, args, request, dispatch);
      } catch (err) {
        console.error("mcp tool failed", name, err);
        return rpcResult(msg.id, toolError("Internal error, try again."));
      }
      if (!result) return rpcError(msg.id, -32602, `Unknown tool: ${name}`);
      return rpcResult(msg.id, result);
    }
    default:
      if (isNotification) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function handleMcp(request: Request, dispatch: Dispatch): Promise<Response> {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
    "access-control-allow-methods": "POST, GET, OPTIONS",
  };
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  // Stateless server: no server-initiated stream to open.
  if (request.method !== "POST") {
    return new Response(JSON.stringify(rpcError(null, -32000, "Use POST for MCP requests")), {
      status: 405,
      headers: { ...cors, allow: "POST, OPTIONS", "content-type": "application/json" },
    });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: cors });
  }
  const messages = Array.isArray(body) ? body : [body];
  const replies = (await Promise.all(messages.map((m) => handleOne(m as Rpc, request, dispatch)))).filter((r) => r !== null);
  if (replies.length === 0) return new Response(null, { status: 202, headers: cors });
  return Response.json(Array.isArray(body) ? replies : replies[0], { headers: cors });
}
