"""TokenLane local registry. It does not issue a token."""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

VERSION = "0.1.2"
PRODUCT = "talocode-tokenlane"
OFFICIAL_TCODE_MINT = "6ptxwABxQz8zMhwhiPeVgRgWjGMdVcEBFBv8v8C3ory"
DISCLAIMER = (
    "Not financial, legal, or investment advice. This receipt is a workflow record. "
    "It does not issue a token, transfer legal title, or clear a regulator."
)
KINDS = ["real_estate", "equity", "revenue_share", "invoice", "commodity", "other"]


def home_dir(home=None):
    return Path(home or os.environ.get("TOKENLANE_HOME") or Path.home() / ".talocode" / "tokenlane")


def _questions(kind, jurisdiction):
    shared = [
        f"Who owns this asset today, and in which registry is that ownership recorded in {jurisdiction}?",
        "What, exactly, does one unit represent? A claim, a share of revenue, or something else?",
        "Who is allowed to hold it, and who is refused?",
        "What document proves the valuation note is not an appraisal unless it says it is one?",
    ]
    specific = {
        "real_estate": ["Is the land title clean of charges?", "Which court would hear a dispute over the property?"],
        "equity": ["Does the company register allow this class of shares?", "Has the existing cap table approved the record?"],
        "revenue_share": ["Which revenue is in, and which is out?", "Who publishes the revenue number, and how often?"],
        "invoice": ["Who is the debtor?", "Is this a sale of the invoice or a pledge against it?"],
        "commodity": ["Where is the goods custody?", "What happens on delivery?"],
        "other": ["Describe the asset in one sentence a stranger can check."],
    }
    return shared + specific.get(kind, specific["other"])


def build_plan(data=None):
    data = data or {}
    errors = []
    name = str(data.get("name") or "").strip()
    kind = str(data.get("kind") or "").strip()
    jurisdiction = str(data.get("jurisdiction") or "").strip()
    documents = [str(item) for item in data.get("documents") or []]
    try:
        supply = int(data.get("supply"))
    except (TypeError, ValueError):
        supply = 0
    if not name:
        errors.append("name is required")
    if kind not in KINDS:
        errors.append("kind must be one of: " + ", ".join(KINDS))
    if not jurisdiction:
        errors.append("jurisdiction is required")
    if supply < 1:
        errors.append("supply must be a positive integer")
    warnings = []
    if data.get("mint") == OFFICIAL_TCODE_MINT:
        warnings.append("This mint is the official $TCODE utility mint. TokenLane will not treat it as a new asset issuance.")
    if errors:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": errors, "warnings": warnings, "disclaimer": DISCLAIMER}
    asset = {
        "id": data.get("id") or f"asset_{uuid.uuid4()}",
        "name": name,
        "kind": kind,
        "jurisdiction": jurisdiction,
        "documents": documents,
        "valuationNote": str(data.get("valuationNote") or ""),
        "supply": supply,
        "oracleUrl": str(data.get("oracleUrl") or ""),
        "chain": str(data.get("chain") or ""),
        "mint": str(data.get("mint") or ""),
    }
    return {
        "ok": True,
        "product": PRODUCT,
        "version": VERSION,
        "disclaimer": DISCLAIMER,
        "warnings": warnings,
        "asset": asset,
        "questionnaire": _questions(kind, jurisdiction),
        "representation": {
            "pattern": "offchain_claim_registry",
            "tokenWouldRecord": "A unit count against this asset id in the TokenLane registry.",
            "tokenWouldNot": ["Move legal title by itself", "Create an offer of securities", "Deploy or verify a contract"],
            "supplyCap": supply,
            "hooksNamedNotImplemented": ["identity_check", "pause", "transfer_restriction"],
            "status": "spec_only",
        },
        "integrations": {
            "oracle": {"status": "recorded_not_called", "url": asset["oracleUrl"]} if asset["oracleUrl"] else {"status": "not_connected"},
            "compliance": {"status": "questionnaire_only"},
            "settlement": {"status": "local_registry", "chain": asset["chain"] or None, "mint": asset["mint"] or None},
        },
    }


def _load(home):
    path = home_dir(home)
    path.mkdir(parents=True, exist_ok=True)
    def read(name, fallback):
        file = path / name
        if not file.exists():
            return fallback
        return json.loads(file.read_text(encoding="utf-8"))
    return {
        "dir": path,
        "assets": read("assets.json", {}),
        "holdings": read("holdings.json", {}),
        "receipts": read("receipts.json", []),
    }


def _persist(store):
    (store["dir"] / "assets.json").write_text(json.dumps(store["assets"], indent=2), encoding="utf-8")
    (store["dir"] / "holdings.json").write_text(json.dumps(store["holdings"], indent=2), encoding="utf-8")
    (store["dir"] / "receipts.json").write_text(json.dumps(store["receipts"][-200:], indent=2), encoding="utf-8")


def _receipt(store, kind, ok, body):
    row = {"id": f"rcpt_{uuid.uuid4()}", "kind": kind, "ok": ok, "at": datetime.now(timezone.utc).isoformat(), **body, "disclaimer": DISCLAIMER}
    store["receipts"].append(row)
    return row


def save_plan(data, home=None):
    plan = build_plan(data)
    if not plan["ok"]:
        return plan
    store = _load(home)
    store["assets"][plan["asset"]["id"]] = plan
    row = _receipt(store, "plan", True, {"assetId": plan["asset"]["id"], "name": plan["asset"]["name"]})
    _persist(store)
    return {**plan, "receiptId": row["id"]}


def add_holding(asset_id, wallet, units, note="", home=None):
    store = _load(home)
    plan = store["assets"].get(asset_id)
    wallet_id = str(wallet or "").strip()
    try:
        amount = int(units)
    except (TypeError, ValueError):
        amount = 0
    errors = []
    if not plan:
        errors.append("unknown asset")
    if not wallet_id:
        errors.append("wallet is required")
    if amount < 1:
        errors.append("units must be a positive integer")
    if errors:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": errors, "disclaimer": DISCLAIMER}
    book = store["holdings"].get(asset_id) or {}
    issued = sum(book.values()) + amount
    if issued > plan["asset"]["supply"]:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": [f"supply cap is {plan['asset']['supply']}"], "disclaimer": DISCLAIMER}
    book[wallet_id] = book.get(wallet_id, 0) + amount
    store["holdings"][asset_id] = book
    row = _receipt(store, "hold", True, {"assetId": asset_id, "wallet": wallet_id, "units": amount, "balance": book[wallet_id], "note": str(note or "")})
    _persist(store)
    return {"ok": True, "product": PRODUCT, "version": VERSION, "assetId": asset_id, "wallet": wallet_id, "balance": book[wallet_id], "issued": issued, "supply": plan["asset"]["supply"], "receiptId": row["id"], "disclaimer": DISCLAIMER}


def transfer_holding(asset_id, source, dest, units, home=None):
    store = _load(home)
    plan = store["assets"].get(asset_id)
    source = str(source or "").strip()
    dest = str(dest or "").strip()
    try:
        amount = int(units)
    except (TypeError, ValueError):
        amount = 0
    errors = []
    if not plan:
        errors.append("unknown asset")
    if not source or not dest:
        errors.append("from and to are required")
    if source and source == dest:
        errors.append("from and to must differ")
    if amount < 1:
        errors.append("units must be a positive integer")
    if errors:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": errors, "disclaimer": DISCLAIMER}
    book = store["holdings"].get(asset_id) or {}
    if book.get(source, 0) < amount:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": ["insufficient units"], "disclaimer": DISCLAIMER}
    book[source] -= amount
    if book[source] == 0:
        del book[source]
    book[dest] = book.get(dest, 0) + amount
    store["holdings"][asset_id] = book
    row = _receipt(store, "transfer", True, {"assetId": asset_id, "from": source, "to": dest, "units": amount, "fromBalance": book.get(source, 0), "toBalance": book[dest]})
    _persist(store)
    return {"ok": True, "product": PRODUCT, "version": VERSION, "assetId": asset_id, "from": source, "to": dest, "units": amount, "fromBalance": book.get(source, 0), "toBalance": book[dest], "receiptId": row["id"], "disclaimer": DISCLAIMER}


def list_registry(asset_id=None, home=None):
    store = _load(home)
    if asset_id:
        plan = store["assets"].get(asset_id)
        if not plan:
            return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": ["unknown asset"], "disclaimer": DISCLAIMER}
        book = store["holdings"].get(asset_id) or {}
        return {"ok": True, "product": PRODUCT, "version": VERSION, "assetId": asset_id, "supply": plan["asset"]["supply"], "issued": sum(book.values()), "holdings": book, "disclaimer": DISCLAIMER}
    assets = [
        {"id": plan["asset"]["id"], "name": plan["asset"]["name"], "kind": plan["asset"]["kind"], "supply": plan["asset"]["supply"], "issued": sum((store["holdings"].get(plan["asset"]["id"]) or {}).values())}
        for plan in store["assets"].values()
    ]
    return {"ok": True, "product": PRODUCT, "version": VERSION, "assets": assets, "disclaimer": DISCLAIMER}


def get_receipt(receipt_id=None, home=None):
    store = _load(home)
    if not receipt_id:
        return {"ok": True, "product": PRODUCT, "version": VERSION, "receipts": store["receipts"], "disclaimer": DISCLAIMER}
    row = next((item for item in store["receipts"] if item["id"] == receipt_id), None)
    if not row:
        return {"ok": False, "product": PRODUCT, "version": VERSION, "errors": ["unknown receipt"], "disclaimer": DISCLAIMER}
    return {"ok": True, "product": PRODUCT, "version": VERSION, "receipt": row, "disclaimer": DISCLAIMER}
