Create Atas - Docker

Este repositório contém uma aplicação Flask que gera atas usando a API da OpenAI/HuggingFace.

Como usar com Docker

1) Build da imagem:

   docker build -t create-atas:latest .
   # aplicando modificações
   docker-compose up --build -d

2) Rodar o container (expondo porta 5001):

   docker run --name create-atas \
  -d \
  -p 5001:5001 \
  -e HF_TOKEN="$HF_TOKEN" \
  -e PORT=5001 \
  create-atas:local

  docker rename create-atas-debug create-atas-debug-old
# agora o nome fica livre
docker run --name create-atas-debug -p 5001:5001 -e HF_TOKEN="$HF_TOKEN" create-atas:local

3) Ou usar docker-compose:

   docker-compose up --build

Variáveis de ambiente importantes:
- HF_TOKEN: token para a API usada em `app.py` (lido via dotenv ou env)
- PORT (opcional): porta em que o Flask irá escutar (default 5001)

Notas:
- O `token.txt` e `.venv/` estão ignorados pelo `.dockerignore` para não vazar credenciais ou arquivos locais.
