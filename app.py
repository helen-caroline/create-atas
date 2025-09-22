from flask import Flask, render_template, request, jsonify
import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN", "")
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

@app.route("/gerar_ata", methods=["POST"])
def gerar_ata_route():
    data = request.form.get("data")
    requerimento = request.form.get("requerimento")
    resumo = request.form.get("resumo")
    titulo = "Atividades do dia"  # Ou gere dinamicamente se quiser
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()
    ata = gerar_ata(resumo, template, data, requerimento, titulo)
    return jsonify({"ata": ata})

if __name__ == "__main__":
    # Allow overriding the port via PORT env var. Default to 5000 to avoid common macOS conflicts on 5000.
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Flask app on http://{host}:{port}")
    app.run(debug=True, host=host, port=port)