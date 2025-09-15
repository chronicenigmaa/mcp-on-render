FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=10000 \
    UVICORN_WORKERS=1

WORKDIR /app

# System deps (if you later need curl/openssl/etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

COPY app/requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ /app/

EXPOSE 10000

# For SSE, 1 worker is usually best; ChatGPT will connect via HTTPS on $PORT
CMD ["uvicorn", "mcp_server:app", "--host", "0.0.0.0", "--port", "10000", "--timeout-keep-alive", "120"]
