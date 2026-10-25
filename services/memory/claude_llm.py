"""Native Claude adapter for Mem0 1.0 (without legacy sampling parameters)."""
import json
import os

from anthropic import Anthropic
from mem0.llms.base import LLMBase

FACT_SCHEMA = {
    "type": "object",
    "properties": {"facts": {"type": "array", "items": {"type": "string"}}},
    "required": ["facts"],
    "additionalProperties": False,
}
ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "memory": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "text": {"type": "string"},
                    "event": {"type": "string", "enum": ["ADD", "UPDATE", "DELETE", "NONE"]},
                    "old_memory": {"type": ["string", "null"]},
                },
                "required": ["id", "text", "event", "old_memory"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["memory"],
    "additionalProperties": False,
}


class ClaudeLLM(LLMBase):
    def __init__(self, config=None):
        super().__init__(config)
        self.client = Anthropic(
            api_key=self.config.api_key or os.environ["ANTHROPIC_API_KEY"],
            base_url="https://api.anthropic.com",
            timeout=45.0,
            max_retries=1,
        )

    def generate_response(self, messages, response_format=None, tools=None, tool_choice="auto", **kwargs):
        if tools:
            raise ValueError("Memory tool execution is not enabled")
        system = "\n".join(m["content"] for m in messages if m["role"] == "system")
        if response_format:
            system += "\nReturn only a valid JSON object, without markdown fences or commentary."
        # Mem0 1.0 calls extraction with a system prompt, and action planning
        # with a single user prompt. Constrain both contracts at the provider.
        extracting = any(m["role"] == "system" for m in messages)
        structured = {}
        if response_format:
            structured["output_config"] = {"format": {
                "type": "json_schema",
                "schema": FACT_SCHEMA if extracting else ACTION_SCHEMA,
            }}
        model = self.config.model or "claude-haiku-5-5"
        response = self.client.messages.create(
            model=model,
            max_tokens=self.config.max_tokens,
            thinking={"type": "between_tools" if model.startswith("claude-sonnet-5-5") else "disabled"},
            system=system,
            messages=[m for m in messages if m["role"] != "system"],
            **structured,
        )
        if response.stop_reason != "end_turn":
            raise ValueError("Claude did not complete memory processing")
        text = "".join(block.text for block in response.content if block.type == "text")
        if not text.strip():
            raise ValueError("Claude returned empty memory output")
        if response_format:
            data = json.loads(text)
            if not isinstance(data, dict):
                raise ValueError("Claude returned invalid memory JSON")
            if extracting:
                facts = data.get("facts")
                if not isinstance(facts, list) or not all(isinstance(fact, str) for fact in facts):
                    raise ValueError("Claude memory facts must be strings")
            else:
                actions = data.get("memory")
                if not isinstance(actions, list) or not all(
                    isinstance(action, dict)
                    and isinstance(action.get("id"), str)
                    and isinstance(action.get("text"), str)
                    and action.get("event") in ["ADD", "UPDATE", "DELETE", "NONE"]
                    and (action.get("old_memory") is None or isinstance(action["old_memory"], str))
                    for action in actions
                ):
                    raise ValueError("Claude returned invalid memory actions")
        return text
