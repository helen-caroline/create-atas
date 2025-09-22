Create Atas - Docker

Este repositório contém uma aplicação Flask que gera atas usando a API da OpenAI/HuggingFace.

Como usar com Docker

1) Build da imagem:

   docker build -t create-atas:latest .

2) Rodar o container (expondo porta 5001):

   docker run --rm -p 5001:5001 \
     -e HF_TOKEN="<seu_token_hf>" \
     -v $(pwd)/templates:/app/templates:ro \
     create-atas:latest

3) Ou usar docker-compose:

   docker-compose up --build

Variáveis de ambiente importantes:
- HF_TOKEN: token para a API usada em `app.py` (lido via dotenv ou env)
- PORT (opcional): porta em que o Flask irá escutar (default 5001)

Notas:
- O `token.txt` e `.venv/` estão ignorados pelo `.dockerignore` para não vazar credenciais ou arquivos locais.
