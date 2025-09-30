from flask import Blueprint, request, jsonify
from controllers.pipeline.controller_pipeline import PipelineController

pipeline_bp = Blueprint('pipeline', __name__)

@pipeline_bp.route("/get_pipeline_file", methods=["GET"])
def get_pipeline_file():
    """Obtém o conteúdo atual do arquivo cards.txt"""
    try:
        result = PipelineController.get_pipeline_file()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pipeline_bp.route("/save_pipeline_file", methods=["POST"])
def save_pipeline_file():
    """Salva o conteúdo do arquivo cards.txt no repositório Azure DevOps"""
    try:
        data = request.get_json()
        content = data.get("content", "")
        
        result = PipelineController.save_pipeline_file(content)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pipeline_bp.route("/run_pipeline", methods=["POST"])
def run_pipeline():
    """Executa a pipeline do Azure DevOps"""
    try:
        result = PipelineController.run_pipeline()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@pipeline_bp.route("/pipeline_status/<int:build_id>", methods=["GET"])
def pipeline_status(build_id):
    """Consulta o status atual de uma pipeline em execução"""
    try:
        result = PipelineController.pipeline_status(build_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500