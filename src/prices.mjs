import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "credit-prices.json");

export async function creditPrices() {
  const catalog = JSON.parse(await readFile(file, "utf8"));
  let live = null;
  let liveError = null;
  try {
    const response = await fetch(catalog.sources.live, { headers: { "user-agent": "talocode-tokenlane/0.1.1" } });
    if (!response.ok) throw new Error(String(response.status));
    live = await response.json();
  } catch (error) {
    liveError = error.message;
  }
  return {
    ok: true,
    product: "@talocode/tokenlane",
    version: "0.1.1",
    catalog,
    live,
    liveError,
    disclaimer: "Prices are copied from Talocode's public page and the live pricing endpoint. 1 credit = $0.01. Credits are product usage, not cash.",
  };
}
