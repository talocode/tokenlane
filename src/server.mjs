import { createServer } from "node:http";
import { addHolding, getReceipt, listRegistry, PRODUCT, savePlan, transferHolding, VERSION } from "./engine.mjs";
import { creditPrices } from "./prices.mjs";

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString() || "{}";
  return JSON.parse(raw);
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function startServer(port = 8791, options = {}) {
  const home = options.home;
  const requiredKey = options.apiKey ?? process.env.TOKENLANE_API_KEY ?? "";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/v1/tokenlane/health") {
        send(res, 200, { ok: true, product: PRODUCT, version: VERSION });
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/tokenlane/prices") {
        send(res, 200, await creditPrices());
        return;
      }
      if (requiredKey) {
        const header = req.headers.authorization || "";
        if (header !== `Bearer ${requiredKey}`) {
          send(res, 401, { ok: false, errors: ["unauthorized"] });
          return;
        }
      }
      if (req.method === "POST" && url.pathname === "/v1/tokenlane/plan") {
        const body = await readBody(req);
        const plan = await savePlan(body, home);
        send(res, plan.ok ? 200 : 422, plan);
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/tokenlane/registry") {
        send(res, 200, await listRegistry(url.searchParams.get("assetId") || undefined, home));
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/tokenlane/hold") {
        const result = await addHolding(await readBody(req), home);
        send(res, result.ok ? 200 : 422, result);
        return;
      }
      if (req.method === "POST" && url.pathname === "/v1/tokenlane/transfer") {
        const result = await transferHolding(await readBody(req), home);
        send(res, result.ok ? 200 : 422, result);
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/tokenlane/receipts") {
        send(res, 200, await getReceipt(undefined, home));
        return;
      }
      if (req.method === "GET" && url.pathname.startsWith("/v1/tokenlane/receipts/")) {
        const id = decodeURIComponent(url.pathname.slice("/v1/tokenlane/receipts/".length));
        const result = await getReceipt(id, home);
        send(res, result.ok ? 200 : 404, result);
        return;
      }
      send(res, 404, { ok: false, errors: [`Unknown endpoint: ${req.method} ${url.pathname}`] });
    } catch {
      send(res, 400, { ok: false, errors: ["invalid json"] });
    }
  });
  server.listen(port, "127.0.0.1");
  return server;
}
