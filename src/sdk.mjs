import { addHolding, getReceipt, listRegistry, savePlan, transferHolding } from "./engine.mjs";

export class TokenLane {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || process.env.TALOCODE_TOKENLANE_URL || "";
    this.apiKey = options.apiKey || process.env.TALOCODE_API_KEY || "";
    this.home = options.home;
  }

  async request(path, { method = "GET", body } = {}) {
    const response = await fetch(new URL(path, this.baseUrl), {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok && payload.ok !== false) throw new Error(`tokenlane ${response.status}`);
    return payload;
  }

  plan(asset) {
    if (!this.baseUrl) return savePlan(asset, this.home);
    return this.request("/v1/tokenlane/plan", { method: "POST", body: asset });
  }

  registry(assetId) {
    if (!this.baseUrl) return listRegistry(assetId, this.home);
    const path = assetId ? `/v1/tokenlane/registry?assetId=${encodeURIComponent(assetId)}` : "/v1/tokenlane/registry";
    return this.request(path);
  }

  hold(input) {
    if (!this.baseUrl) return addHolding(input, this.home);
    return this.request("/v1/tokenlane/hold", { method: "POST", body: input });
  }

  transfer(input) {
    if (!this.baseUrl) return transferHolding(input, this.home);
    return this.request("/v1/tokenlane/transfer", { method: "POST", body: input });
  }

  receipt(id) {
    if (!this.baseUrl) return getReceipt(id, this.home);
    const path = id ? `/v1/tokenlane/receipts/${encodeURIComponent(id)}` : "/v1/tokenlane/receipts";
    return this.request(path);
  }
}

export { addHolding, buildPlan, getReceipt, listRegistry, savePlan, transferHolding, DISCLAIMER, OFFICIAL_TCODE_MINT, VERSION } from "./engine.mjs";
