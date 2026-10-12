import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export const VERSION = "0.1.1";
export const PRODUCT = "@talocode/tokenlane";
export const OFFICIAL_TCODE_MINT = "6ptxwABxQz8zMhwhiPeVgRgWjGMdVcEBFBv8v8C3ory";
export const DISCLAIMER = "Not financial, legal, or investment advice. This receipt is a workflow record. It does not issue a token, transfer legal title, or clear a regulator.";

const KINDS = ["real_estate", "equity", "revenue_share", "invoice", "commodity", "other"];

export function homeDir(home) {
  return home || process.env.TOKENLANE_HOME || join(homedir(), ".talocode", "tokenlane");
}

function questionsFor(kind, jurisdiction) {
  const shared = [
    `Who owns this asset today, and in which registry is that ownership recorded in ${jurisdiction}?`,
    "What, exactly, does one unit represent? A claim, a share of revenue, or something else?",
    "Who is allowed to hold it, and who is refused?",
    "What document proves the valuation note is not an appraisal unless it says it is one?",
  ];
  const specific = {
    real_estate: ["Is the land title clean of charges?", "Which court would hear a dispute over the property?"],
    equity: ["Does the company register allow this class of shares?", "Has the existing cap table approved the record?"],
    revenue_share: ["Which revenue is in, and which is out?", "Who publishes the revenue number, and how often?"],
    invoice: ["Who is the debtor?", "Is this a sale of the invoice or a pledge against it?"],
    commodity: ["Where is the goods custody?", "What happens on delivery?"],
    other: ["Describe the asset in one sentence a stranger can check."],
  };
  return [...shared, ...(specific[kind] || specific.other)];
}

function representation(asset) {
  return {
    pattern: "offchain_claim_registry",
    tokenWouldRecord: "A unit count against this asset id in the TokenLane registry.",
    tokenWouldNot: [
      "Move legal title by itself",
      "Create an offer of securities",
      "Deploy or verify a contract",
    ],
    supplyCap: asset.supply,
    hooksNamedNotImplemented: ["identity_check", "pause", "transfer_restriction"],
    status: "spec_only",
  };
}

export function buildPlan(input = {}) {
  const errors = [];
  const name = String(input.name || "").trim();
  const kind = String(input.kind || "").trim();
  const jurisdiction = String(input.jurisdiction || "").trim();
  const documents = Array.isArray(input.documents) ? input.documents.map(String) : [];
  const supply = Number(input.supply);
  if (!name) errors.push("name is required");
  if (!KINDS.includes(kind)) errors.push(`kind must be one of: ${KINDS.join(", ")}`);
  if (!jurisdiction) errors.push("jurisdiction is required");
  if (!Number.isInteger(supply) || supply < 1) errors.push("supply must be a positive integer");
  const warnings = [];
  if (input.mint && input.mint === OFFICIAL_TCODE_MINT) {
    warnings.push("This mint is the official $TCODE utility mint. TokenLane will not treat it as a new asset issuance.");
  }
  if (errors.length) {
    return { ok: false, product: PRODUCT, version: VERSION, errors, warnings, disclaimer: DISCLAIMER };
  }
  const asset = {
    id: input.id || `asset_${randomUUID()}`,
    name,
    kind,
    jurisdiction,
    documents,
    valuationNote: String(input.valuationNote || ""),
    supply,
    oracleUrl: String(input.oracleUrl || ""),
    chain: String(input.chain || ""),
    mint: String(input.mint || ""),
  };
  const steps = [
    { name: "onboard", ok: true, documents: asset.documents.length },
    { name: "structure", ok: true, kind: asset.kind },
    { name: "questionnaire", ok: true, count: questionsFor(kind, jurisdiction).length },
    { name: "scaffold", ok: true, status: "spec_only" },
    { name: "registry", ok: true, status: "local_file" },
    { name: "audit", ok: true },
  ];
  return {
    ok: true,
    product: PRODUCT,
    version: VERSION,
    disclaimer: DISCLAIMER,
    warnings,
    asset,
    questionnaire: questionsFor(kind, jurisdiction),
    representation: representation(asset),
    integrations: {
      oracle: asset.oracleUrl ? { status: "recorded_not_called", url: asset.oracleUrl } : { status: "not_connected" },
      compliance: { status: "questionnaire_only" },
      settlement: { status: "local_registry", chain: asset.chain || null, mint: asset.mint || null },
    },
    steps,
  };
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return fallback; }
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function load(home) {
  const dir = homeDir(home);
  await mkdir(dir, { recursive: true });
  const assetsPath = join(dir, "assets.json");
  const holdingsPath = join(dir, "holdings.json");
  const receiptsPath = join(dir, "receipts.json");
  return {
    dir,
    assetsPath,
    holdingsPath,
    receiptsPath,
    assets: await readJson(assetsPath, {}),
    holdings: await readJson(holdingsPath, {}),
    receipts: await readJson(receiptsPath, []),
  };
}

async function persist(store) {
  await writeJson(store.assetsPath, store.assets);
  await writeJson(store.holdingsPath, store.holdings);
  await writeJson(store.receiptsPath, store.receipts.slice(-200));
}

function receipt(store, kind, ok, body) {
  const row = { id: `rcpt_${randomUUID()}`, kind, ok, at: new Date().toISOString(), ...body, disclaimer: DISCLAIMER };
  store.receipts.push(row);
  return row;
}

export async function savePlan(input, home) {
  const plan = buildPlan(input);
  if (!plan.ok) return plan;
  const store = await load(home);
  store.assets[plan.asset.id] = plan;
  const row = receipt(store, "plan", true, { assetId: plan.asset.id, name: plan.asset.name });
  await persist(store);
  return { ...plan, receiptId: row.id };
}

function issuedUnits(book) {
  return Object.values(book || {}).reduce((sum, n) => sum + n, 0);
}

export async function addHolding({ assetId, wallet, units, note = "" }, home) {
  const store = await load(home);
  const plan = store.assets[assetId];
  const walletId = String(wallet || "").trim();
  const amount = Number(units);
  const errors = [];
  if (!plan) errors.push("unknown asset");
  if (!walletId) errors.push("wallet is required");
  if (!Number.isInteger(amount) || amount < 1) errors.push("units must be a positive integer");
  if (errors.length) return { ok: false, product: PRODUCT, version: VERSION, errors, disclaimer: DISCLAIMER };
  const book = store.holdings[assetId] || {};
  const next = issuedUnits(book) + amount;
  if (next > plan.asset.supply) {
    return { ok: false, product: PRODUCT, version: VERSION, errors: [`supply cap is ${plan.asset.supply}`], disclaimer: DISCLAIMER };
  }
  book[walletId] = (book[walletId] || 0) + amount;
  store.holdings[assetId] = book;
  const row = receipt(store, "hold", true, { assetId, wallet: walletId, units: amount, balance: book[walletId], note: String(note || "") });
  await persist(store);
  return { ok: true, product: PRODUCT, version: VERSION, assetId, wallet: walletId, balance: book[walletId], issued: next, supply: plan.asset.supply, receiptId: row.id, disclaimer: DISCLAIMER };
}

export async function transferHolding({ assetId, from, to, units }, home) {
  const store = await load(home);
  const plan = store.assets[assetId];
  const source = String(from || "").trim();
  const dest = String(to || "").trim();
  const amount = Number(units);
  const errors = [];
  if (!plan) errors.push("unknown asset");
  if (!source || !dest) errors.push("from and to are required");
  if (source && source === dest) errors.push("from and to must differ");
  if (!Number.isInteger(amount) || amount < 1) errors.push("units must be a positive integer");
  if (errors.length) return { ok: false, product: PRODUCT, version: VERSION, errors, disclaimer: DISCLAIMER };
  const book = store.holdings[assetId] || {};
  if ((book[source] || 0) < amount) {
    return { ok: false, product: PRODUCT, version: VERSION, errors: ["insufficient units"], disclaimer: DISCLAIMER };
  }
  book[source] -= amount;
  if (book[source] === 0) delete book[source];
  book[dest] = (book[dest] || 0) + amount;
  store.holdings[assetId] = book;
  const row = receipt(store, "transfer", true, { assetId, from: source, to: dest, units: amount, fromBalance: book[source] || 0, toBalance: book[dest] });
  await persist(store);
  return { ok: true, product: PRODUCT, version: VERSION, assetId, from: source, to: dest, units: amount, fromBalance: book[source] || 0, toBalance: book[dest], receiptId: row.id, disclaimer: DISCLAIMER };
}

export async function listRegistry(assetId, home) {
  const store = await load(home);
  if (assetId) {
    const plan = store.assets[assetId];
    if (!plan) return { ok: false, product: PRODUCT, version: VERSION, errors: ["unknown asset"], disclaimer: DISCLAIMER };
    const book = store.holdings[assetId] || {};
    return { ok: true, product: PRODUCT, version: VERSION, assetId, supply: plan.asset.supply, issued: issuedUnits(book), holdings: book, disclaimer: DISCLAIMER };
  }
  const assets = Object.values(store.assets).map((plan) => ({
    id: plan.asset.id,
    name: plan.asset.name,
    kind: plan.asset.kind,
    supply: plan.asset.supply,
    issued: issuedUnits(store.holdings[plan.asset.id]),
  }));
  return { ok: true, product: PRODUCT, version: VERSION, assets, disclaimer: DISCLAIMER };
}

export async function getReceipt(id, home) {
  const store = await load(home);
  if (!id) return { ok: true, product: PRODUCT, version: VERSION, receipts: store.receipts, disclaimer: DISCLAIMER };
  const row = store.receipts.find((item) => item.id === id);
  if (!row) return { ok: false, product: PRODUCT, version: VERSION, errors: ["unknown receipt"], disclaimer: DISCLAIMER };
  return { ok: true, product: PRODUCT, version: VERSION, receipt: row, disclaimer: DISCLAIMER };
}
