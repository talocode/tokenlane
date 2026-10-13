# TokenLane

Open-source workflow for planning a tokenized real-world asset and keeping the receipt.

The same call runs in the CLI, the SDK, the MCP server, and the API. A failed check returns the error. It does not pretend the asset was issued.

**Not financial, legal, or investment advice.** TokenLane does not issue a token, deploy a contract, move legal title, or clear a regulator.

## Why

Headlines about a tokenized-asset market are easy. The hard part is the workflow: what the asset is, who owns it today, what one unit means, who may hold it, and what was recorded.

TokenLane is that workflow. An agent can call it. A person can run it. The output is a plan and a local registry, not an offering.

## CLI

```bash
node bin/tokenlane.mjs plan --file=examples/asset.json
node bin/tokenlane.mjs hold --asset=asset_... --wallet=wallet-a --units=100
node bin/tokenlane.mjs transfer --asset=asset_... --from=wallet-a --to=wallet-b --units=25
node bin/tokenlane.mjs registry --asset=asset_...
node bin/tokenlane.mjs receipt --id=rcpt_...
```

`kind` is one of `real_estate`, `equity`, `revenue_share`, `invoice`, `commodity`, `other`.

Records live in `~/.talocode/tokenlane/`. Set `TOKENLANE_HOME` to put them somewhere else.

## MCP

```bash
node bin/tokenlane.mjs mcp
```

Tools: `tokenlane_plan`, `tokenlane_hold`, `tokenlane_transfer`, `tokenlane_registry`, `tokenlane_receipt`.

## SDK

```js
import { TokenLane } from "@talocode/tokenlane";

const lane = new TokenLane();
const plan = await lane.plan({
  name: "Example warehouse revenue share",
  kind: "revenue_share",
  jurisdiction: "NG",
  documents: ["operator-note.md"],
  valuationNote: "Operator estimate. Not an appraisal.",
  supply: 1000000,
});
```

Set `TALOCODE_TOKENLANE_URL` to call a hosted server instead of the local files. `TALOCODE_API_KEY` is sent as a bearer token when the server was started with `TOKENLANE_API_KEY`.

## Credit prices

```bash
node bin/tokenlane.mjs prices
```

`GET /v1/tokenlane/prices` and the MCP tool `tokenlane_prices` return the same catalog.

The public page at https://talocode.site/pricing.html has 43 product actions, the router, 100 free credits, and a 500 credit minimum top-up. The live `GET https://api.talocode.site/api/v1/cloud/pricing` response on 12 October 2026 is shorter: `tera_api`, `searchlane`, and `calclane` only. Both are in the file. TokenLane does not invent the missing rows.

Local `plan`, `hold`, `transfer`, `registry`, and `receipt` cost 0 credits. They do not call Talocode Cloud.

1 credit = $0.01. Hold-to-earn tiers are included from https://talocode.site/tcode.html. Credits are usage, not cash.

## API server


```bash
node bin/tokenlane.mjs serve --port=8791
```

| Method | Path | |
|---|---|---|
| GET | `/v1/tokenlane/health` | Open, even when a key is set |
| POST | `/v1/tokenlane/plan` | Validate and store a plan |
| GET | `/v1/tokenlane/registry` | All plans, or one book with `?assetId=` |
| POST | `/v1/tokenlane/hold` | Add units, refuse the supply cap |
| POST | `/v1/tokenlane/transfer` | Move units, refuse a short balance |
| GET | `/v1/tokenlane/receipts` | Latest receipts |
| GET | `/v1/tokenlane/receipts/:id` | One receipt |

Hosted on Talocode Cloud:

```
Authorization: Bearer $TALOCODE_API_KEY
POST https://api.talocode.site/v1/tokenlane/plan
POST https://api.talocode.site/v1/tokenlane/hold
POST https://api.talocode.site/v1/tokenlane/transfer
GET  https://api.talocode.site/v1/tokenlane/registry
GET  https://api.talocode.site/v1/tokenlane/receipts
```

Local CLI / SDK / MCP stay free. Hosted routes require a key and charge credits (plan 5, hold 2, transfer 5, registry 1, receipt 1). Registry is stored per-user in Netlify Blobs. No on-chain issuance or fake transfers.

## What a plan contains

- The asset record, or the list of fields that failed.
- A questionnaire for that kind and jurisdiction. Questions, not legal answers.
- A representation spec marked `spec_only`. It names hooks. It does not compile them.
- Integration slots. An oracle URL is stored and not called. Settlement is the local registry. No chain write.
- A receipt id.

If `mint` is `6ptxwABxQz8zMhwhiPeVgRgWjGMdVcEBFBv8v8C3ory`, the plan warns that this is the official $TCODE utility mint and will not treat it as a new issuance.

## What this is not

TokenLane 0.1.0 does not deploy a contract, pick a price, or tell you an asset is compliant. The registry is one local writer. It is the book of what you recorded, not a land registry and not a cap table at a commission.

## Status

0.1.2 ships the CLI, SDK, API server, and MCP server. The same plan, hold, transfer, registry, and receipt commands are in the Python package. Neither package issues a token.

Built by [Talocode](https://github.com/talocode).
