import json
import sys
from .prices import credit_prices

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "prices":
        json.dump(credit_prices(), sys.stdout, indent=2)
        sys.stdout.write("\n")
        return 0
    sys.stderr.write("Usage: tokenlane prices\nThe plan, hold, and transfer commands are in the Node package @talocode/tokenlane.\n")
    return 2 if cmd else 0
