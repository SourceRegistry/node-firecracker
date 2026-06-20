from __future__ import annotations

import json
import sys
from pathlib import Path

from handler import handler


class Context:
    aws_request_id = "local-python-demo"
    function_name = "node-firecracker-python-demo"


event_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).with_name("event.json")
event = json.loads(event_path.read_text())

print(json.dumps(handler(event, Context()), indent=2))
