import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { buildPlan, OFFICIAL_TCODE_MINT } from "../src/engine.mjs";
import { TokenLane } from "../src/sdk.mjs";
import { creditPrices } from "../src/prices.mjs";
import { startServer } from "../src/server.mjs";

const sample = {
  name: "Example warehouse revenue share",
  kind: "revenue_share",
  jurisdiction: "NG",
  documents: ["operator-note.md"],
  valuationNote: "Operator estimate. Not an appraisal.",
  supply: 1000,
};

test("a plan refuses a missing field and does not pretend it issued a token", () => {
  const plan = buildPlan({ name: "x" });
  assert.equal(plan.ok, false);
  assert.ok(plan.errors.includes("kind must be one of: real_estate, equity, revenue_share, invoice, commodity, other"));
  assert.match(plan.disclaimer, /does not issue a token/);
});

test("the official utility mint is a warning, not a new asset", () => {
  const plan = buildPlan({ ...sample, mint: OFFICIAL_TCODE_MINT });
  assert.equal(plan.ok, true);
  assert.match(plan.warnings[0], /official \$TCODE utility mint/);
  assert.equal(plan.representation.status, "spec_only");
});

test("hold, transfer, and the supply cap stay in the local registry", async () => {
  const home = await mkdtemp(join(tmpdir(), "tokenlane-"));
  try {
    const lane = new TokenLane({ home });
    const plan = await lane.plan(sample);
    assert.equal(plan.ok, true);
    const held = await lane.hold({ assetId: plan.asset.id, wallet: "wallet-a", units: 400 });
    assert.equal(held.ok, true);
    const moved = await lane.transfer({ assetId: plan.asset.id, from: "wallet-a", to: "wallet-b", units: 150 });
    assert.equal(moved.toBalance, 150);
    const refused = await lane.transfer({ assetId: plan.asset.id, from: "wallet-a", to: "wallet-b", units: 999 });
    assert.equal(refused.ok, false);
    const capped = await lane.hold({ assetId: plan.asset.id, wallet: "wallet-c", units: 800 });
    assert.equal(capped.ok, false);
    const book = await lane.registry(plan.asset.id);
    assert.equal(book.issued, 400);
    assert.equal(book.holdings["wallet-a"], 250);
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});

test("the API server is the same engine", async () => {
  const home = await mkdtemp(join(tmpdir(), "tokenlane-api-"));
  const server = startServer(0, { home, apiKey: "test-key" });
  await new Promise((resolve) => server.once("listening", resolve));
  const port = server.address().port;
  try {
    const open = await fetch(`http://127.0.0.1:${port}/v1/tokenlane/health`);
    assert.equal(open.status, 200);
    const denied = await fetch(`http://127.0.0.1:${port}/v1/tokenlane/plan`, { method: "POST", body: "{}" });
    assert.equal(denied.status, 401);
    const lane = new TokenLane({ home, baseUrl: `http://127.0.0.1:${port}`, apiKey: "test-key" });
    const plan = await lane.plan(sample);
    assert.equal(plan.ok, true);
    assert.equal(plan.asset.supply, 1000);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(home, { recursive: true, force: true });
  }
});

test("mcp lists the five tools", async () => {
  const home = await mkdtemp(join(tmpdir(), "tokenlane-mcp-"));
  const child = spawn(process.execPath, ["bin/tokenlane.mjs", "mcp"], { cwd: new URL("..", import.meta.url), env: { ...process.env, TOKENLANE_HOME: home } });
  let buffer = "";
  const lines = [];
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const parts = buffer.split("\n");
    buffer = parts.pop() || "";
    for (const line of parts) if (line.trim()) lines.push(JSON.parse(line));
  });
  const waitFor = (predicate) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mcp timeout")), 4000);
    const check = () => {
      const found = lines.find(predicate);
      if (found) { clearTimeout(timer); resolve(found); }
      else setTimeout(check, 20);
    };
    check();
  });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  try {
    const init = await waitFor((msg) => msg.id === 1);
    assert.equal(init.result.serverInfo.name, "talocode-tokenlane");
    const listed = await waitFor((msg) => msg.id === 2);
    assert.deepEqual(listed.result.tools.map((tool) => tool.name), [
      "tokenlane_plan", "tokenlane_hold", "tokenlane_transfer", "tokenlane_registry", "tokenlane_prices", "tokenlane_receipt",
    ]);
  } finally {
    child.kill();
    await rm(home, { recursive: true, force: true });
  }
});

test("prices keep the public page and the shorter live map apart", async () => {
  const result = await creditPrices();
  assert.equal(result.catalog.pageActions.length, 43);
  assert.equal(result.catalog.pageActions.find((row) => row.action === "video.render").credits, 200);
  assert.equal(result.catalog.liveApi.searchlane["searchlane.query"], 5);
  assert.equal(result.catalog.localTokenlane.credits, 0);
  assert.equal(result.catalog.creditUsd, 0.01);
});
