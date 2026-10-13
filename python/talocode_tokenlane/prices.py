import json
from importlib.resources import files

def credit_prices():
    raw = files("talocode_tokenlane").joinpath("credit-prices.json").read_text(encoding="utf-8")
    catalog = json.loads(raw)
    return {
        "ok": True,
        "product": "talocode-tokenlane",
        "version": "0.1.2",
        "catalog": catalog,
        "disclaimer": "Prices are copied from Talocode's public page and the live pricing endpoint. 1 credit = $0.01. Credits are product usage, not cash.",
    }
