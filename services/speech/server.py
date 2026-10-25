"""Loopback-only, authenticated, in-memory speech transcription for the local demo."""
import io
import json
import os
import secrets
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from faster_whisper import WhisperModel

TOKEN = os.environ.get('VOICE_STT_TOKEN', '')
if not TOKEN:
    raise RuntimeError('VOICE_STT_TOKEN is required')
MODEL = WhisperModel(os.environ.get('VOICE_STT_MODEL', 'base'), device='cpu', compute_type='int8', cpu_threads=4,
                     download_root=os.path.expanduser('~/.cache/haven-speech'))
LOCK = threading.Lock()
LANGUAGES = {'en', 'zh', 'es', 'fr', 'de', 'ja', 'ko', 'pt', 'hi', 'ar'}

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log audio, transcript text, tokens or user identities.

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'ready': self.path == '/health'})

    def do_POST(self):
        if not secrets.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + TOKEN):
            return self.reply(401, {'error': 'Unauthorized'})
        path = urlparse(self.path)
        language = parse_qs(path.query).get('language', ['en'])[0]
        if path.path != '/transcribe' or language not in LANGUAGES:
            return self.reply(400, {'error': 'Invalid speech request'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.reply(400, {'error': 'Invalid audio length'})
        if not 0 < length <= 6_000_000:
            return self.reply(413, {'error': 'Audio is too large'})
        if not LOCK.acquire(blocking=False):
            return self.reply(503, {'error': 'Speech service is busy. Please try again.'})
        try:
            audio = self.rfile.read(length)
            # PyAV decodes webm/opus, MP4/AAC, Ogg and WAV in memory.
            from faster_whisper.audio import decode_audio
            samples = decode_audio(io.BytesIO(audio), sampling_rate=16000)
            if len(samples) > 45 * 16000:
                return self.reply(413, {'error': 'Please keep each turn under 30 seconds.'})
            if len(samples) < 1600:
                return self.reply(200, {'text': ''})
            segments, _ = MODEL.transcribe(samples, language=language, beam_size=1, best_of=1,
                                           condition_on_previous_text=False, vad_filter=True)
            text = ''.join(s.text for s in segments if s.no_speech_prob < 0.7).strip()
            self.reply(200, {'text': text})
        except Exception:
            self.reply(422, {'error': 'Could not transcribe this audio. Please try again.'})
        finally:
            LOCK.release()

print('Local speech service ready on 127.0.0.1:8002', flush=True)
ThreadingHTTPServer(('127.0.0.1', 8002), Handler).serve_forever()
