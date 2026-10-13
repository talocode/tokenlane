import json
import sys

from .engine import add_holding, get_receipt, list_registry, save_plan, transfer_holding
from .prices import credit_prices


def _flag(name, default=None):
    prefix = f"--{name}="
    for arg in sys.argv[2:]:
        if arg.startswith(prefix):
            return arg[len(prefix):]
    return default


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "prices":
        result = credit_prices()
    elif cmd == "plan":
        path = _flag("file")
        data = json.loads(open(path, encoding="utf-8").read()) if path else {}
        result = save_plan(data)
    elif cmd == "hold":
        result = add_holding(_flag("asset"), _flag("wallet"), _flag("units"), _flag("note", ""))
    elif cmd == "transfer":
        result = transfer_holding(_flag("asset"), _flag("from"), _flag("to"), _flag("units"))
    elif cmd == "registry":
        result = list_registry(_flag("asset"))
    elif cmd == "receipt":
        result = get_receipt(_flag("id"))
    else:
        sys.stderr.write("Usage: tokenlane plan|hold|transfer|registry|receipt|prices\n")
        return 2
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")
    return 0 if result.get("ok", True) else 1
