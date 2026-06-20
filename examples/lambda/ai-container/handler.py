from __future__ import annotations

import json
from pathlib import Path
from typing import Any


LABELS = {
    "infrastructure": {"firecracker", "microvm", "kernel", "isolate", "isolated", "vm", "kvm"},
    "serverless": {"lambda", "function", "event", "runtime", "cold", "startup"},
    "ai": {"model", "prompt", "token", "embedding", "inference", "ai"},
}


def classify(text: str) -> dict[str, Any]:
    words = {word.strip(".,:;!?()[]{}\"'").lower() for word in text.split()}
    scores = {label: len(words & keywords) for label, keywords in LABELS.items()}
    label = max(scores, key=scores.get)

    return {
        "label": label if scores[label] else "general",
        "scores": scores,
        "tokens": len(words),
    }


def handler(event: dict[str, Any], context: Any = None) -> dict[str, Any]:
    text = str(event.get("text") or "")
    result = classify(text)

    return {
        "input": text,
        "prediction": result,
        "runtime": "lambda-container-python",
        "note": "Toy local classifier. Replace with a real local model for production experiments.",
    }


if __name__ == "__main__":
    with Path(__file__).with_name("event.json").open("r", encoding="utf8") as file:
        print(json.dumps(handler(json.load(file)), indent=2))
