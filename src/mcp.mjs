import { addHolding, getReceipt, listRegistry, savePlan, transferHolding, VERSION } from "./engine.mjs";
import { creditPrices } from "./prices.mjs";

const tools = [
  {
    name: "tokenlane_plan",
    description: "Build a TokenLane asset plan and store the receipt. Does not issue a token.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        kind: { type: "string", enum: ["real_estate", "equity", "revenue_share", "invoice", "commodity", "other"] },
        jurisdiction: { type: "string" },
        documents: { type: "array", items: { type: "string" } },
        valuationNote: { type: "string" },
        supply: { type: "integer" },
        oracleUrl: { type: "string" },
        chain: { type: "string" },
        mint: { type: "string" },
      },
      required: ["name", "kind", "jurisdiction", "supply"],
    },
  },
  {
    name: "tokenlane_hold",
    description: "Record units of an existing asset plan against a wallet. Refuses to pass the supply cap.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string" },
        wallet: { type: "string" },
        units: { type: "integer" },
        note: { type: "string" },
      },
      required: ["assetId", "wallet", "units"],
    },
  },
  {
    name: "tokenlane_transfer",
    description: "Move recorded units from one wallet to another. Refuses an insufficient balance.",
    inputSchema: {
      type: "object",
      properties: {
        assetId: { type: "string" },
        from: { type: "string" },
        to: { type: "string" },
        units: { type: "integer" },
      },
      required: ["assetId", "from", "to", "units"],
    },
  },
  {
    name: "tokenlane_registry",
    description: "List asset plans, or the holdings of one asset.",
    inputSchema: { type: "object", properties: { assetId: { type: "string" } } },
  },
  {
    name: "tokenlane_prices",
    description: "Read Talocode Cloud credit prices. Local TokenLane calls cost 0. The live pricing endpoint is returned beside the public page.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "tokenlane_receipt",
    description: "Read one receipt, or the latest receipts.",
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
  },
];

async function callTool(name, args = {}) {
  if (name === "tokenlane_plan") return savePlan(args);
  if (name === "tokenlane_hold") return addHolding(args);
  if (name === "tokenlane_transfer") return transferHolding(args);
  if (name === "tokenlane_registry") return listRegistry(args.assetId);
  if (name === "tokenlane_receipt") return getReceipt(args.id);
  if (name === "tokenlane_prices") return creditPrices();
  return { ok: false, errors: [`unknown tool: ${name}`] };
}

export function startMcp() {
  const send = (message) => process.stdout.write(JSON.stringify(message) + "\n");
  let buffer = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", async (chunk) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      if (msg.method === "initialize") {
        send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "talocode-tokenlane", version: VERSION } } });
      } else if (msg.method === "tools/list") {
        send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
      } else if (msg.method === "tools/call") {
        const result = await callTool(msg.params?.name, msg.params?.arguments || {});
        send({ jsonrpc: "2.0", id: msg.id, result: { content: [{ type: "text", text: JSON.stringify(result) }], isError: result.ok === false } });
      } else if (msg.id !== undefined) {
        send({ jsonrpc: "2.0", id: msg.id, result: {} });
      }
    }
  });
}
