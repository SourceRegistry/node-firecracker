from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    numbers = event.get("numbers") if isinstance(event.get("numbers"), list) else []
    total = sum(float(value or 0) for value in numbers)
    request_id = getattr(context, "aws_request_id", None) or event.get("requestId") or "local"

    return {
        "requestId": request_id,
        "message": f"Hello {event.get('name', 'microVM')}",
        "sum": total,
        "runtime": "python",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
