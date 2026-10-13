# talocode-tokenlane

Python package for the TokenLane workflow.

TokenLane plans a real-world asset record, keeps a local ownership book, and writes a receipt. It does not issue a token, deploy a contract, move legal title, or clear a regulator.

## Commands

```bash
tokenlane plan --file=asset.json
tokenlane hold --asset=asset_... --wallet=wallet-a --units=100
tokenlane transfer --asset=asset_... --from=wallet-a --to=wallet-b --units=25
tokenlane registry --asset=asset_...
tokenlane receipt --id=rcpt_...
tokenlane prices
```

Records live in `~/.talocode/tokenlane/`. Set `TOKENLANE_HOME` to put them somewhere else.

## SDK

```python
from talocode_tokenlane import save_plan, add_holding

plan = save_plan({
    "name": "Example warehouse revenue share",
    "kind": "revenue_share",
    "jurisdiction": "NG",
    "documents": ["operator-note.md"],
    "valuationNote": "Operator estimate. Not an appraisal.",
    "supply": 1000000,
})
holding = add_holding(plan["asset"]["id"], "wallet-a", 100)
```

`kind` is one of `real_estate`, `equity`, `revenue_share`, `invoice`, `commodity`, `other`.

Local calls cost 0 credits. They do not call Talocode Cloud. 1 credit is $0.01. Credits are product usage, not cash.

Official $TCODE mint: `6ptxwABxQz8zMhwhiPeVgRgWjGMdVcEBFBv8v8C3ory`. TokenLane warns if a plan uses that mint. It will not treat it as a new issuance.

Repository: https://github.com/talocode/tokenlane
Node package: https://www.npmjs.com/package/@talocode/tokenlane
