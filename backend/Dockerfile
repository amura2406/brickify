# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Copy dependency files first for cache efficiency
COPY pyproject.toml ./

# Install dependencies (no dev, no cache)
RUN uv pip install --system --no-cache -r pyproject.toml 2>/dev/null || \
    uv pip install --system --no-cache \
        "fastapi>=0.115.0" \
        "uvicorn[standard]>=0.30.0" \
        "pillow>=11.0.0" \
        "numpy>=2.0.0" \
        "python-multipart>=0.0.9" \
        "firebase-admin>=6.5.0"

# Copy application code
COPY . .

# Cloud Run injects PORT=8080
ENV PORT=8080
EXPOSE 8080

# Start uvicorn
CMD uvicorn main:app --host 0.0.0.0 --port $PORT --workers 1
