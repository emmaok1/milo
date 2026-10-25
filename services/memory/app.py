"""Internal Mem0 OSS adapter. No public port or browser access.
Ownership is enforced before every Mem0 operation, including ID-targeted CRUD.
"""
import os
import secrets
import sqlite3
from pathlib import Path
from threading import RLock
from uuid import UUID
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field
from mem0 import Memory

app = FastAPI(docs_url=None, redoc_url=None)
client = None
operation_lock = RLock()
DATA_DIR = Path(os.getenv("MEMORY_DATA_DIR", "/data"))

def registry():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATA_DIR / "ownership.db")
    connection.execute("create table if not exists ownership(memory_id text primary key, user_id text not null)")
    return connection

def remember_owner(uid, results):
    with registry() as db:
        for item in results.get("results", []):
            db.execute("insert or ignore into ownership values (?,?)", (item["id"], uid))

def purge_history(ids):
    history = DATA_DIR / "history.db"
    if history.exists():
        with sqlite3.connect(history) as db:
            db.execute("PRAGMA secure_delete=ON")
            for mid in ids:
                db.execute("delete from history where memory_id=?", (mid,))
    with registry() as db:
        for mid in ids:
            db.execute("delete from ownership where memory_id=?", (mid,))

def memory():
    global client
    if client is None:
        from mem0.utils.factory import LlmFactory
        LlmFactory.register_provider("anthropic", "claude_llm.ClaudeLLM")
        client = Memory.from_config({
            'version': 'v1.1',
            'llm': {'provider': 'anthropic', 'config': {'model': os.getenv('ANTHROPIC_MEMORY_MODEL', 'claude-haiku-5-5'), 'max_tokens': 2048}},
            'embedder': {'provider': 'huggingface', 'config': {'model': 'sentence-transformers/all-MiniLM-L6-v2', 'embedding_dims': 384, 'model_kwargs': {'device': 'cpu'}}},
            'vector_store': {'provider': 'qdrant', 'config': {'host': 'qdrant', 'port': 6333, 'collection_name': 'haven_private_minilm_v1', 'embedding_model_dims': 384}},
            'history_db_path': str(DATA_DIR / 'history.db'),
            'custom_fact_extraction_prompt': 'Extract only explicit continuing preferences or important experiences stated by the user. Do not infer diagnoses, causes, or traits. Do not store AI suggestions. Return JSON with a facts array of plain strings, never objects. If uncertain return an empty facts array.',
        })
    return client

class Operation(BaseModel):
    operation: str
    user_id: UUID
    query: str = Field(default='', max_length=10000)
    text: str = Field(default='', max_length=10000)
    memory_id: str | None = None
    infer: bool = False

@app.get('/health')
def health():
    return {'status': 'ok', 'adapter': 'Mem0 OSS', 'provider_verified': False}

@app.post('/operation')
def operation(body: Operation, authorization: str = Header(default='')):
    token = os.getenv('MEMORY_SERVICE_TOKEN', '')
    if not token or not secrets.compare_digest(authorization, 'Bearer ' + token):
        raise HTTPException(401, 'Unauthorized')
    uid = str(body.user_id)
    with operation_lock:
        return execute(body, uid)

def execute(body, uid):
    m = memory()
    if body.operation == 'search':
        return m.search(body.query, user_id=uid, limit=12)
    if body.operation == 'all':
        return m.get_all(user_id=uid, limit=1000)
    if body.operation == 'add':
        result = m.add([{'role': 'user', 'content': body.text}], user_id=uid, infer=body.infer)
        remember_owner(uid, result)
        return result
    if body.operation in ('delete', 'update'):
        item = m.get(body.memory_id)
        with registry() as db:
            known = db.execute('select user_id from ownership where memory_id=?', (body.memory_id,)).fetchone()
        if (item and item.get('user_id') != uid) or (not item and (not known or known[0] != uid)):
            raise HTTPException(404, 'Memory not found')
        if body.operation == 'delete':
            if item:
                m.delete(body.memory_id)
            purge_history([body.memory_id])
            return {'deleted': True}
        return m.update(body.memory_id, body.text)
    if body.operation == 'delete_all':
        existing = m.get_all(user_id=uid, limit=100000).get('results', [])
        with registry() as db:
            known = [row[0] for row in db.execute('select memory_id from ownership where user_id=?', (uid,))]
        ids = list(set(known + [item['id'] for item in existing]))
        # Mem0 1.0 delete_all resets the entire vector collection after filtering.
        # Delete only verified owned IDs, preserving every other user's vectors.
        for mid in ids:
            item = m.get(mid)
            if item and item.get('user_id') != uid:
                raise HTTPException(404, 'Memory not found')
            if item:
                m.delete(mid)
        purge_history(ids)
        return {'deleted': True}
    raise HTTPException(400, 'Unknown operation')
