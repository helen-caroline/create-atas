FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instala dependências do sistema necessárias para compilar alguns pacotes
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       build-essential \
       git \
       curl \
       ca-certificates \
       libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copia apenas requirements primeiro para aproveitar cache do docker
COPY requirements.txt .

RUN pip install --upgrade pip setuptools wheel
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY . .

EXPOSE 5001

ENV PORT=5001

# Expor host para que Flask escute em todas as interfaces dentro do container
ENV HOST=0.0.0.0

# Comando padrão (usa o entrypoint em app.py quando executado diretamente)
CMD ["python", "app.py"]

# Healthcheck simples (verifica se a porta responde)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/ || exit 1
