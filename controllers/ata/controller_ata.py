import os
import re
from openai import OpenAI
from datetime import datetime

# Configurações do cliente OpenAI
HF_TOKEN = os.getenv("HF_TOKEN", "")
client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_TOKEN
)

TEMPLATE_PATH = "template.md"

class AtaController:
    @staticmethod
    def gerar_ata(resumo, template, data, requerimento, titulo):
        """Gera uma ATA usando o modelo de IA"""
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

    @staticmethod
    def processar_gerar_ata(data, requerimento, resumo):
        """Processa a solicitação de geração de ATA"""
        titulo = "Atividades do dia"
        
        try:
            with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
                template = f.read()
        except FileNotFoundError:
            raise Exception(f"Template não encontrado: {TEMPLATE_PATH}")
        
        try:
            ata = AtaController.gerar_ata(resumo, template, data, requerimento, titulo)
        except Exception as e:
            raise Exception(f"Erro ao gerar ATA: {str(e)}")
        
        # Extrair componentes da ATA
        titulo_extraido = AtaController._extrair_titulo_da_ata(ata)
        proximos = AtaController._extrair_proximos_passos_da_ata(ata)
        corpo = AtaController._extrair_corpo_principal_da_ata(ata)
        
        return {
            "ata": ata,
            "titulo": titulo_extraido,
            "proximos": proximos,
            "corpo": corpo
        }

    @staticmethod
    def _extrair_titulo_da_ata(text):
        """Extrai o título da ATA gerada"""
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

    @staticmethod
    def _extrair_proximos_passos_da_ata(text):
        """Extrai os próximos passos da ATA gerada"""
        if not text:
            return ""
        # capture label with or without colon until blank line
        m = re.search(r"(?:^|\n)\s*(pr[oó]ximos?\s+passo?s?)\s*:?[\s\n]*([\s\S]*?)(?=(\n\s*\n)|$)", text, re.I)
        if m:
            return m.group(2).strip()
        return ""

    @staticmethod
    def _extrair_corpo_principal_da_ata(text):
        """Extrai o corpo principal da ATA gerada"""
        if not text:
            return ""
        # Capture from 'Objetivo:' until the next 'Próximos' section (or end of text).
        # This will include 'Resumo', 'Conclusão' and other intermediate sections.
        m = re.search(r"(?:^|\n)\s*objetivo\s*:?\s*([\s\S]*?)(?=(?:\n\s*(?:pr[oó]ximos?\b)|$))", text, re.I)
        if m:
            return f"Objetivo:\n{m.group(1).strip()}"
        return ""