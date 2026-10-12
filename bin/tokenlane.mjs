#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { addHolding, getReceipt, listRegistry, savePlan, transferHolding } from "../src/engine.mjs";
import { creditPrices } from "../src/prices.mjs";
import { startMcp } from "../src/mcp.mjs";
import { startServer } from "../src/server.mjs";

const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter((arg) => arg.startsWith("--")).map((arg) => {
  const [key, value] = arg.slice(2).split("=");
  return [key, value ?? true];
}));

function usage() {
  process.stderr.write(`Usage:
  tokenlane plan --file=examples/asset.json
  tokenlane plan --name= --kind= --jurisdiction= --supply=
  tokenlane hold --asset= --wallet= --units=
  tokenlane transfer --asset= --from= --to= --units=
  tokenlane registry [--asset=]
  tokenlane receipt [--id=]
  tokenlane prices
  tokenlane mcp
  tokenlane serve --port=8791
`);
}

if (cmd === "mcp") {
  startMcp();
} else if (cmd === "serve") {
  const server = startServer(Number(flags.port || 8791));
  server.on("listening", () => {
    const address = server.address();
    process.stderr.write(`tokenlane listening on ${address.port}\n`);
  });
} else if (cmd === "plan") {
  const input = flags.file ? JSON.parse(await readFile(flags.file, "utf8")) : {
    name: flags.name,
    kind: flags.kind,
    jurisdiction: flags.jurisdiction,
    documents: flags.documents ? String(flags.documents).split(",") : [],
    valuationNote: flags.valuationNote || flags.note || "",
    supply: flags.supply ? Number(flags.supply) : undefined,
    oracleUrl: flags.oracleUrl || flags.oracle || "",
    chain: flags.chain || "",
    mint: flags.mint || "",
  };
  const plan = await savePlan(input);
  process.stdout.write(JSON.stringify(plan, null, 2) + "\n");
  process.exit(plan.ok ? 0 : 1);
} else if (cmd === "hold") {
  const result = await addHolding({ assetId: flags.asset, wallet: flags.wallet, units: Number(flags.units), note: flags.note || "" });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
} else if (cmd === "transfer") {
  const result = await transferHolding({ assetId: flags.asset, from: flags.from, to: flags.to, units: Number(flags.units) });
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
} else if (cmd === "registry") {
  const result = await listRegistry(flags.asset);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
} else if (cmd === "receipt") {
  const result = await getReceipt(flags.id);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
} else if (cmd === "prices") {
  const result = await creditPrices();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  process.exit(result.ok ? 0 : 1);
} else {
  usage();
  process.exit(cmd ? 2 : 0);
}
