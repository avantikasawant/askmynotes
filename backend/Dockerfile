FROM python:3.11-slim

WORKDIR /app

# Install system deps required by chromadb/pypdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Persist Chroma DB and uploads outside the image via volumes (see docker-compose.yml)
RUN mkdir -p chroma_db uploaded_pdfs

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]
