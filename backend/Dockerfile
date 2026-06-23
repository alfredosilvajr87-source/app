FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY . .

# Northflank injects $PORT at runtime; fall back to 8000 locally
EXPOSE 8000
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
