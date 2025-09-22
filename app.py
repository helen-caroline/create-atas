from flask import Flask, render_template, request, jsonify
import os
from openai import OpenAI
from dotenv import load_dotenv
from datetime import datetime
import re

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

if __name__ == "__main__":
    # Allow overriding the port via PORT env var. Default to 5000 to avoid common macOS conflicts on 5000.
    port = int(os.environ.get("PORT", "5001"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"Starting Flask app on http://{host}:{port}")
    app.run(debug=True, host=host, port=port)