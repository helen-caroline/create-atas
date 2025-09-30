from flask import Blueprint, request, jsonify
from controllers.ata.azure_boards_controller import AzureBoardsController

boards_bp = Blueprint('boards', __name__)

@boards_bp.route("/api/my-cards", methods=["GET"])
def get_my_cards():
    """Busca os work items (cards) do usuário na sprint ativa"""
    try:
        boards_controller = AzureBoardsController()
        result = boards_controller.get_sprint_and_work_items()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "work_items": []}), 500

@boards_bp.route("/api/boards/my-work-items", methods=["GET"])
def get_my_work_items():
    """Busca os work items (cards) do usuário na sprint ativa - rota alternativa"""
    try:
        boards_controller = AzureBoardsController()
        result = boards_controller.get_sprint_and_work_items()
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "work_items": []}), 500

@boards_bp.route("/api/sprint-info", methods=["GET"])
def get_sprint_info():
    """Busca informações da sprint ativa"""
    try:
        boards_controller = AzureBoardsController()
        current_sprint = boards_controller.get_current_sprint()
        if current_sprint:
            return jsonify({
                "sprint": {
                    "id": current_sprint.get("id"),
                    "name": current_sprint.get("name"),
                    "path": current_sprint.get("path"),
                    "start_date": current_sprint.get("attributes", {}).get("startDate"),
                    "finish_date": current_sprint.get("attributes", {}).get("finishDate")
                }
            })
        else:
            return jsonify({"sprint": None, "message": "Nenhuma sprint ativa encontrada"})
    except Exception as e:
        return jsonify({"error": str(e), "sprint": None}), 500