# Script para gerar atas usando modelo open-source Hugging Face


import re
from datetime import datetime

import os
from openai import OpenAI
from dotenv import load_dotenv


# Para uso gratuito, crie uma conta em https://huggingface.co, acesse https://huggingface.co/settings/tokens e gere um token de acesso.
# O token será lido do arquivo .env
load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN", "")
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN
)

def extrair_data(resumo):
    match = re.search(r'Dia\s*(\d+)', resumo)
    if match:
        dia = match.group(1)
        hoje = datetime.now()
        return f"{dia.zfill(2)}-{hoje.month:02d}-{hoje.year}"
    return f"{datetime.now().day:02d}-{datetime.now().month:02d}-{datetime.now().year}"

def extrair_titulo(resumo):
    if 'copilot' in resumo.lower():
        return "Alterações no Copilot e Integração HTTPS"
    return "Atividades do dia"

def extrair_requerimento(resumo):
    match = re.search(r'(\d{5,})', resumo)
    if match:
        return match.group(1)
    return "87724"



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


def main():
    with open('resumo.txt', 'r', encoding='utf-8') as f:
        resumo = f.read()
    with open('template.md', 'r', encoding='utf-8') as f:
        template = f.read()

    data = extrair_data(resumo)
    requerimento = extrair_requerimento(resumo)
    titulo = extrair_titulo(resumo)

    print("Gerando ata via Hugging Face Inference API...")
    ata = gerar_ata(resumo, template, data, requerimento, titulo)

    pasta_atas = "ATAs"
    if not os.path.exists(pasta_atas):
        os.makedirs(pasta_atas)
    nome_arquivo = os.path.join(pasta_atas, f"{requerimento} - [ATA][Copilot] {titulo} - Atividade do dia {data}.md")
    with open(nome_arquivo, 'w', encoding='utf-8') as f:
        f.write(ata)
    print(f"Ata gerada: {nome_arquivo}")

if __name__ == "__main__":
    main()