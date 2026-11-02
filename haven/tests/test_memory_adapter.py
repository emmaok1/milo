"""Boundary tests with explicit fake dependencies, not live Mem0 verification."""
import importlib.util
import os
import sqlite3
import sys
import tempfile
import types
import unittest
from uuid import UUID

class HttpError(Exception):
    def __init__(self, status, detail):
        self.status_code = status
        super().__init__(detail)
class App:
    def __init__(self, **kwargs): pass
    def get(self, *args): return lambda fn: fn
    def post(self, *args): return lambda fn: fn
class FakeMemory:
    def __init__(self): self.items = {}; self.deleted = []
    def get(self, mid): return self.items.get(mid)
    def get_all(self, user_id, **kwargs): return {'results': [v for v in self.items.values() if v['user_id'] == user_id]}
    def search(self, query, user_id, **kwargs): return self.get_all(user_id)
    def delete(self, mid): self.deleted.append(mid); del self.items[mid]
    def delete_all(self, user_id):
        raise AssertionError('Mem0 1.0 delete_all resets the shared collection; never call it')

class BoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        os.environ['MEMORY_DATA_DIR'] = self.temp.name
        os.environ['MEMORY_SERVICE_TOKEN'] = 'fictional-test-token'
        sys.modules['fastapi'] = types.SimpleNamespace(FastAPI=App, Header=lambda **kw: '', HTTPException=HttpError)
        sys.modules['pydantic'] = types.SimpleNamespace(BaseModel=object, Field=lambda **kw: None)
        sys.modules['mem0'] = types.SimpleNamespace(Memory=FakeMemory)
        spec = importlib.util.spec_from_file_location('haven_memory', 'services/memory/app.py')
        self.mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(self.mod)
        self.fake = FakeMemory(); self.mod.client = self.fake
        self.a = str(UUID(int=1)); self.b = str(UUID(int=2))
        self.fake.items = {'a': {'id': 'a', 'user_id': self.a}, 'b': {'id': 'b', 'user_id': self.b}}
    def tearDown(self): self.temp.cleanup()
    def op(self, user, operation, mid=None, token='Bearer fictional-test-token'):
        return self.mod.operation(types.SimpleNamespace(user_id=user,operation=operation,memory_id=mid,query='',text='',infer=False), token)
    def test_wrong_service_token_is_denied(self):
        with self.assertRaises(HttpError) as e: self.op(self.a, 'search', token='Bearer invalid')
        self.assertEqual(e.exception.status_code, 401)
    def test_cross_owner_delete_denied(self):
        with self.assertRaises(HttpError) as e: self.op(self.a, 'delete', 'b')
        self.assertEqual(e.exception.status_code, 404); self.assertIn('b', self.fake.items)
    def test_search_is_scoped_before_result(self):
        self.assertEqual(self.op(self.a, 'search')['results'], [{'id':'a','user_id':self.a}])
    def test_delete_purges_only_owned_history(self):
        with sqlite3.connect(self.mod.DATA_DIR / 'history.db') as db:
            db.execute('create table history(memory_id text, old_memory text)')
            db.executemany('insert into history values (?,?)', [('a','Fictional A'),('b','Fictional B')])
        self.mod.remember_owner(self.a, {'results':[{'id':'a'}]})
        self.op(self.a,'delete','a')
        with sqlite3.connect(self.mod.DATA_DIR / 'history.db') as db:
            self.assertEqual(db.execute('select memory_id from history').fetchall(), [('b',)])
        self.assertIn('b', self.fake.items)
    def test_delete_all_preserves_other_owner(self):
        self.op(self.a,'delete_all'); self.assertNotIn('a',self.fake.items); self.assertIn('b',self.fake.items)

if __name__ == '__main__': unittest.main()
