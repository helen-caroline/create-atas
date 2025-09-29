from flask import Flask, render_template, request, jsonify
import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
import re
import requests
import base64

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN", "")
AZURE_DEVOPS_TOKEN = os.getenv("AZURE_DEVOPS_TOKEN", "")
AZURE_DEVOPS_ORG = os.getenv("AZURE_DEVOPS_ORG", "koniasamples")
AZURE_DEVOPS_PROJECT = os.getenv("AZURE_DEVOPS_PROJECT", "POCS")
AZURE_DEVOPS_REPO = os.getenv("AZURE_DEVOPS_REPO", "AutomacaoCards")
PIPELINE_ID = os.getenv("PIPELINE_ID", "556")

client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN
)

app = Flask(__name__)

TEMPLATE_PATH = "template.md"

def gerar_ata(resumo, template, data, requerimento, titulo):
    prompt = f"""
Você é um agente que gera atas conforme o template abaixo. 
Resumo do usuário: {resumo}
Data: {data}
Requerimento da ATA: {requerimento}
Título: {titulo}
Template: {template}
Gere a ata preenchida conforme as regras do template, com tópicos e contexto descritivo.
"""
    completion = client.chat.completions.create(
        model="moonshotai/Kimi-K2-Instruct",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=512,
        temperature=0.7
    )
    return completion.choices[0].message.content

@app.route("/")
def index():
    hoje = datetime.now().strftime("%d-%m-%Y")
    return render_template("index.html", hoje=hoje)

@app.route("/pipeline")
def pipeline():
    """Página separada para gerenciar pipeline"""
    return render_template("pipeline.html")

@app.route("/gerar_ata", methods=["POST"])
def gerar_ata_route():
    data = request.form.get("data")
    requerimento = request.form.get("requerimento")
    resumo = request.form.get("resumo")
    titulo = "Atividades do dia"  # Ou gere dinamicamente se quiser
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()
    try:
        ata = gerar_ata(resumo, template, data, requerimento, titulo)
    except Exception as e:
        # Log the error server-side and return JSON so frontend can show it
        print("Error generating ATA:", str(e))
        return jsonify({"error": str(e)}), 500
    # Extrair título, próximos passos e corpo principal no backend para maior confiabilidade
    def extrair_titulo_da_ata(text):
        if not text:
            return ""
        # 1) "Título: ..."
        m = re.search(r"(?:^|\n)\s*(t[ií]tulo|title)\s*:\s*(.+)", text, re.I)
        if m:
            return m.group(2).splitlines()[0].strip()
        # 2) heading 'Título da ATA' followed by title on next line
        m = re.search(r"(?:^|\n)\s*(t[ií]tulo(?:\s+da\s+ata)?)\s*(?:\n)+\s*(.+)", text, re.I)
        if m:
            return m.group(2).splitlines()[0].strip()
        # 3) fallback: find a line 'Título' then next non-empty line
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        for i, l in enumerate(lines):
            if re.match(r"^t[ií]tulo(?:\s+da\s+ata)?$", l, re.I) and i + 1 < len(lines):
                return lines[i+1]
        return ""

    def extrair_proximos_passos_da_ata(text):
        if not text:
            return ""
        # capture label with or without colon until blank line
        m = re.search(r"(?:^|\n)\s*(pr[oó]ximos?\s+passo?s?)\s*:?[\s\n]*([\s\S]*?)(?=(\n\s*\n)|$)", text, re.I)
        if m:
            return m.group(2).strip()
        return ""

    def extrair_corpo_principal_da_ata(text):
        if not text:
            return ""
        # Capture from 'Objetivo:' until the next 'Próximos' section (or end of text).
        # This will include 'Resumo', 'Conclusão' and other intermediate sections.
        m = re.search(r"(?:^|\n)\s*objetivo\s*:?\s*([\s\S]*?)(?=(?:\n\s*(?:pr[oó]ximos?\b)|$))", text, re.I)
        if m:
            return f"Objetivo:\n{m.group(1).strip()}"
        return ""

    titulo_extraido = extrair_titulo_da_ata(ata)
    proximos = extrair_proximos_passos_da_ata(ata)
    corpo = extrair_corpo_principal_da_ata(ata)

    return jsonify({"ata": ata, "titulo": titulo_extraido, "proximos": proximos, "corpo": corpo})

@app.route("/get_pipeline_file", methods=["GET"])
def get_pipeline_file():
    """Obtém o conteúdo atual do arquivo cards.txt"""
    if not AZURE_DEVOPS_TOKEN:
        return jsonify({"error": "Token do Azure DevOps não configurado"}), 500
    
    try:
        # URL da API para obter conteúdo do arquivo
        api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/items"
        
        # Headers da requisição
        auth_string = base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_string}",
            "Accept": "application/json"
        }
        
        # Parâmetros para obter o arquivo cards.txt da branch helen.santos.v2
        params = {
            "path": "/cards.txt",
            "version": "helen.santos.v2",
            "versionType": "branch",
            "api-version": "7.0",
            "$format": "text"
        }
        
        response = requests.get(api_url, headers=headers, params=params)
        
        if response.status_code == 200:
            return jsonify({"content": response.text})
        elif response.status_code == 404:
            return jsonify({"content": ""})  # Arquivo não existe ainda
        else:
            # Retornar informações detalhadas do erro para debug
            return jsonify({
                "error": f"Erro {response.status_code} da API do Azure DevOps",
                "details": response.text,
                "url": f"{api_url}?{requests.compat.urlencode(params)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "error": f"Erro interno: {str(e)}",
            "type": type(e).__name__
        }), 500

@app.route("/save_pipeline_file", methods=["POST"])
def save_pipeline_file():
    """Salva o conteúdo do arquivo cards.txt no repositório Azure DevOps"""
    if not AZURE_DEVOPS_TOKEN:
        return jsonify({"error": "Token do Azure DevOps não configurado"}), 500
    
    try:
        data = request.get_json()
        content = data.get("content", "")
        
        if not content.strip():
            return jsonify({"error": "Conteúdo não pode estar vazio"}), 400
        
        # Azure DevOps Git API requires push operations, not direct file updates
        auth_string = base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {auth_string}"
        }
        
        # First, get the current commit SHA of the branch
        branch_api = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/refs"
        params = {"filter": "heads/helen.santos.v2", "api-version": "7.0"}
        branch_response = requests.get(branch_api, headers=headers, params=params)
        
        if branch_response.status_code != 200:
            return jsonify({"error": f"Erro ao buscar branch: {branch_response.status_code} - {branch_response.text}"}), 500
            
        branch_data = branch_response.json()
        if not branch_data.get("value"):
            return jsonify({"error": "Branch helen.santos.v2 não encontrada"}), 404
            
        old_object_id = branch_data["value"][0]["objectId"]
        
        # Create push operation to update the file
        push_api = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/pushes"
        push_params = {"api-version": "7.0"}
        
        # Encode content to base64
        content_b64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        
        push_payload = {
            "refUpdates": [
                {
                    "name": "refs/heads/helen.santos.v2",
                    "oldObjectId": old_object_id
                }
            ],
            "commits": [
                {
                    "comment": "Atualizar cards.txt via painel web",
                    "changes": [
                        {
                            "changeType": "edit",
                            "item": {
                                "path": "/cards.txt"
                            },
                            "newContent": {
                                "content": content_b64,
                                "contentType": "base64encoded"
                            }
                        }
                    ]
                }
            ]
        }
        
        response = requests.post(push_api, json=push_payload, headers=headers, params=push_params)
        
        if response.status_code in [200, 201]:
            return jsonify({"success": True, "message": "Arquivo salvo com sucesso"})
        else:
            return jsonify({"error": f"Erro da API: {response.status_code} - {response.text}"}), 500
            
    except Exception as e:
        return jsonify({"error": f"Erro interno: {str(e)}"}), 500

@app.route("/run_pipeline", methods=["POST"])
def run_pipeline():
    """Executa a pipeline do Azure DevOps"""
    if not AZURE_DEVOPS_TOKEN:
        return jsonify({"error": "Token do Azure DevOps não configurado"}), 500
    
    try:
        # URL da API do Azure DevOps para executar pipeline
        api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/pipelines/{PIPELINE_ID}/runs"
        
        # Headers da requisição
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()}"
        }
        
        # Parâmetros da API (incluindo api-version obrigatório)
        params = {
            "api-version": "7.0"
        }
        
        # Payload para executar a pipeline na branch helen.santos.v2
        payload = {
            "resources": {
                "repositories": {
                    "self": {
                        "refName": "refs/heads/helen.santos.v2"
                    }
                }
            }
        }
        
        response = requests.post(api_url, json=payload, headers=headers, params=params)
        
        if response.status_code == 200:
            build_data = response.json()
            return jsonify({
                "success": True,
                "buildId": build_data.get("id"),
                "buildUrl": build_data.get("url"),
                "status": build_data.get("state", "queued")
            })
        else:
            return jsonify({"error": f"Erro ao executar pipeline: {response.text}"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/pipeline_status/<int:build_id>", methods=["GET"])
def pipeline_status(build_id):
    """Consulta o status atual de uma pipeline em execução"""
    if not AZURE_DEVOPS_TOKEN:
        return jsonify({"error": "Token do Azure DevOps não configurado"}), 500
    
    try:
        # URL da API do Azure DevOps para consultar status da pipeline
        api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/build/builds/{build_id}"
        
        # Headers da requisição
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Basic {base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()}"
        }
        
        # Parâmetros da API
        params = {
            "api-version": "7.0"
        }
        
        response = requests.get(api_url, headers=headers, params=params)
        
        if response.status_code == 200:
            build_data = response.json()
            
            # Mapear status para português e adicionar informações úteis
            status_map = {
                "notStarted": "na fila",
                "inProgress": "executando", 
                "completed": "concluída",
                "cancelling": "cancelando",
                "postponed": "adiada"
            }
            
            result_map = {
                "succeeded": "sucesso",
                "failed": "falhou",
                "canceled": "cancelada",
                "partiallySucceeded": "parcialmente bem-sucedida"
            }
            
            status = build_data.get("status", "unknown")
            result = build_data.get("result", None)
            
            return jsonify({
                "success": True,
                "buildId": build_data.get("id"),
                "status": status_map.get(status, status),
                "result": result_map.get(result, result) if result else None,
                "buildUrl": build_data.get("_links", {}).get("web", {}).get("href", ""),
                "startTime": build_data.get("startTime"),
                "finishTime": build_data.get("finishTime"),
                "queueTime": build_data.get("queueTime"),
                "buildNumber": build_data.get("buildNumber"),
                "isCompleted": status == "completed"
            })
        else:
            return jsonify({"error": f"Erro ao consultar status: {response.text}"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Allow overriding the port via PORT env var. Default to 5000 to avoid common macOS conflicts on 5000.
    port = int(os.environ.get("PORT", "5001"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Flask app on http://{host}:{port}")
    app.run(debug=True, host=host, port=port)