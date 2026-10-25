FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir -r requirements.txt
RUN useradd -m app && mkdir /data && chown app /data
USER app
ENV HF_HUB_DISABLE_TELEMETRY=1
# Download public weights at build time; inference stays inside this container.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2', device='cpu')"
COPY app.py claude_llm.py ./
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
