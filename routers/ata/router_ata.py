from flask import Blueprint, request, jsonify
from controllers.ata.controller_ata import AtaController

ata_bp = Blueprint('ata', __name__)

@ata_bp.route("/gerar_ata", methods=["POST"])
def gerar_ata_route():
    """Endpoint para gerar ATA"""
    try:
        data = request.form.get("data")
        requerimento = request.form.get("requerimento")
        resumo = request.form.get("resumo")
        
        result = AtaController.processar_gerar_ata(data, requerimento, resumo)
        return jsonify(result)
        
    except Exception as e:
        print("Error generating ATA:", str(e))
        return jsonify({"error": str(e)}), 500