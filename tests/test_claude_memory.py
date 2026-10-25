"""Exercise native memory requests with explicit fake provider dependencies."""
import importlib.util
import sys
import types
import unittest
from unittest.mock import patch


class FakeBase:
    def __init__(self, config=None):
        self.config = config


class ClaudeMemoryTests(unittest.TestCase):
    def setUp(self):
        self.requests = []
        self.response = types.SimpleNamespace(
            stop_reason='end_turn',
            content=[types.SimpleNamespace(type='thinking'), types.SimpleNamespace(type='text', text='{"facts": []}')],
        )
        def create(**kwargs):
            self.requests.append(kwargs)
            return self.response
        provider = types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
        modules = {
            'anthropic': types.SimpleNamespace(Anthropic=lambda **kw: provider),
            'mem0.llms.base': types.SimpleNamespace(LLMBase=FakeBase),
        }
        with patch.dict(sys.modules, modules):
            spec = importlib.util.spec_from_file_location('claude_llm_test', 'services/memory/claude_llm.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
        self.config = types.SimpleNamespace(api_key='fictional-key', model='claude-haiku-5-5', max_tokens=2048)
        self.adapter = module.ClaudeLLM(self.config)
        self.messages = [{'role': 'system', 'content': 'Fictional extraction'}, {'role': 'user', 'content': 'I prefer short replies'}]

    def test_native_request_omits_legacy_parameters_and_selects_text(self):
        self.assertEqual(self.adapter.generate_response(self.messages, response_format={'type': 'json_object'}), '{"facts": []}')
        request = self.requests[0]
        self.assertEqual(request['model'], 'claude-haiku-5-5')
        self.assertEqual(request['thinking'], {'type': 'disabled'})
        self.assertEqual(request['messages'], [self.messages[1]])
        for name in ['temperature', 'top_p', 'top_k', 'store']:
            self.assertNotIn(name, request)

    def test_extraction_schema_rejects_object_facts_before_embedding(self):
        self.response.content = [types.SimpleNamespace(type='text', text='{"facts": [{"fact": "short replies"}]}')]
        with self.assertRaisesRegex(ValueError, 'must be strings'):
            self.adapter.generate_response(self.messages, response_format={'type': 'json_object'})
        schema = self.requests[0]['output_config']['format']['schema']
        self.assertEqual(schema['properties']['facts']['items']['type'], 'string')

    def test_action_schema_and_validation(self):
        self.response.content = [types.SimpleNamespace(type='text', text='{"memory": [{"id":"0","text":"short replies","event":"ADD","old_memory":null}]}')]
        self.adapter.generate_response([self.messages[1]], response_format={'type': 'json_object'})
        schema = self.requests[0]['output_config']['format']['schema']
        self.assertIn('memory', schema['properties'])
        self.response.content = [types.SimpleNamespace(type='text', text='{"memory": [{"id":"0","text":{},"event":"ADD"}]}')]
        with self.assertRaisesRegex(ValueError, 'invalid memory actions'):
            self.adapter.generate_response([self.messages[1]], response_format={'type': 'json_object'})

    def test_sonnet_uses_supported_thinking_setting(self):
        self.config.model = 'claude-sonnet-5-5'
        self.adapter.generate_response(self.messages)
        self.assertEqual(self.requests[0]['thinking'], {'type': 'between_tools'})

    def test_incomplete_and_invalid_json_are_rejected(self):
        self.response.stop_reason = 'max_tokens'
        with self.assertRaises(ValueError):
            self.adapter.generate_response(self.messages)
        self.response.stop_reason = 'end_turn'
        self.response.content = [types.SimpleNamespace(type='text', text='not JSON')]
        with self.assertRaises(ValueError):
            self.adapter.generate_response(self.messages, response_format={'type': 'json_object'})


if __name__ == '__main__':
    unittest.main()
