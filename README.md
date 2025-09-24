# Painel de Ferramentas

Este repositório contém uma aplicação Flask com duas funcionalidades principais:
1. **Gerador de Atas** - Gera atas usando a API da OpenAI/HuggingFace
2. **Pipeline Cards** - Gerencia o arquivo cards.txt e executa pipelines do Azure DevOps

## 🚀 Funcionalidades

### Gerador de Atas
- Interface web para gerar atas automaticamente
- Utiliza templates personalizados
- Integração com modelo de IA Kimi-K2-Instruct

### Pipeline Cards
- Editor web para o arquivo `cards.txt`
- Execução automática de pipelines do Azure DevOps
- Status em tempo real das execuções
- Link direto para o Azure DevOps

## ⚙️ Configuração

1. **Copie o arquivo de configuração:**
   ```bash
   cp .env.example .env
   ```

2. **Configure as variáveis de ambiente no arquivo `.env`:**
   ```bash
   # Token do Hugging Face (obrigatório para geração de atas)
   HF_TOKEN=your_huggingface_token_here
   
   # Token do Azure DevOps (obrigatório para pipeline)
   AZURE_DEVOPS_TOKEN=your_azure_devops_personal_access_token_here
   ```

3. **Para obter o token do Azure DevOps:**
   - Acesse: https://dev.azure.com/koniasamples/_usersSettings/tokens
   - Crie um novo token com permissões: `Build (read and execute)` e `Code (read and write)`

## 🐳 Como usar com Docker

1. **Build da imagem:**
   ```bash
   docker build -t create-atas:latest .
   # ou aplicando modificações
   docker-compose up --build -d
   ```

2. **Rodar o container:**
   ```bash
   docker run --name create-atas \
     -d \
     -p 5001:5001 \
     -e HF_TOKEN="$HF_TOKEN" \
     -e AZURE_DEVOPS_TOKEN="$AZURE_DEVOPS_TOKEN" \
     -e PORT=5001 \
     create-atas:latest
   ```

## 💻 Execução Local

1. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Execute a aplicação:**
   ```bash
   python app.py
   ```

3. **Acesse:** http://localhost:5001

## 📋 Estrutura do Projeto

```
├── app.py              # Aplicação Flask principal
├── templates/
│   └── index.html      # Interface web com sistema de abas
├── static/
│   ├── style.css       # Estilos da aplicação
│   └── ata.js         # JavaScript para funcionalidades
├── template.md         # Template para geração de atas
├── .env.example        # Exemplo de configuração
└── requirements.txt    # Dependências Python
```

## 🔗 Links Úteis

- **Pipeline Azure DevOps:** https://dev.azure.com/koniasamples/POCS/_build?definitionId=556
- **Repositório Cards:** https://dev.azure.com/koniasamples/POCS/_git/AutomacaoCards

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
