"""Regenerate synthetic, SDK-wire protocol examples; no API calls or secrets."""

import json
from pathlib import Path

ROOT = Path(__file__).parent


def response(message):
    return {
        "id": "protocol-example",
        "object": "chat.completion",
        "created": 0,
        "model": "deepseek-flash",
        "choices": [
            {"index": 0, "message": message, "finish_reason": "tool_calls" if message.get("tool_calls") else "stop"}
        ],
        "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120},
    }


def tool_message(stage):
    return {
        "role": "assistant",
        "reasoning_content": f"Read stage {stage}.",
        "tool_calls": [
            {
                "id": f"stage-{stage}",
                "type": "function",
                "function": {"name": "get_stage", "arguments": json.dumps({"stage": stage})},
            }
        ],
    }


def chunk(delta, finish=None):
    return {
        "id": "protocol-example",
        "object": "chat.completion.chunk",
        "created": 0,
        "model": "deepseek-flash",
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
    }


def write(name, exchanges):
    (ROOT / name).write_text(
        json.dumps(
            {
                "provenance": "Synthetic provider-shaped protocol example; not captured live; not model-quality evidence.",
                "exchanges": exchanges,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    write(
        "three_step.json",
        [
            *({"response": response(tool_message(i))} for i in (1, 2, 3)),
            {
                "response": response(
                    {"role": "assistant", "content": "Complete", "reasoning_content": "All stages read."}
                )
            },
        ],
    )
    write(
        "non_tool_then_tool.json",
        [
            {"response": response({"role": "assistant", "content": "Ready", "reasoning_content": "Wait for request."})},
            {"response": response(tool_message(1))},
            {"response": response({"role": "assistant", "content": "Complete", "reasoning_content": "Stage read."})},
        ],
    )
    message = tool_message(1)
    message["content"] = "Checking"
    write(
        "parity.json",
        [
            {"response": response(message)},
            {
                "chunks": [
                    chunk({"role": "assistant", "reasoning_content": "Read "}),
                    chunk({"reasoning_content": "stage 1.", "content": "Checking"}),
                    chunk(
                        {
                            "tool_calls": [
                                {
                                    "index": 0,
                                    "id": "stage-1",
                                    "type": "function",
                                    "function": {"name": "get_stage", "arguments": '{"stage":'},
                                }
                            ]
                        }
                    ),
                    chunk({"tool_calls": [{"index": 0, "function": {"arguments": " 1}"}}]}),
                    chunk({}, "tool_calls"),
                    {
                        "id": "protocol-example",
                        "object": "chat.completion.chunk",
                        "created": 0,
                        "model": "deepseek-flash",
                        "choices": [],
                        "usage": {"prompt_tokens": 100, "completion_tokens": 20, "total_tokens": 120},
                    },
                ]
            },
        ],
    )
    write(
        "missing_reasoning.json",
        [
            {
                "status": 400,
                "response": {
                    "error": {
                        "message": "The reasoning_content must be passed back in thinking mode.",
                        "type": "invalid_request_error",
                    }
                },
            }
        ],
    )
    write("router_timeout.json", [{"delay_s": 1, "response": response({"role": "assistant", "content": "unused"})}])
