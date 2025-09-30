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

@boards_bp.route("/api/ata/<work_item_id>/details", methods=["GET"])
def get_ata_details(work_item_id):
    """Busca detalhes completos de uma ATA específica"""
    try:
        print(f"API REQUEST: Getting ATA details for work_item_id = {work_item_id}")
        boards_controller = AzureBoardsController()
        ata_details = boards_controller.get_ata_details(work_item_id)
        print(f"API RESPONSE: Retrieved ATA details for {work_item_id}")
        print(f"  - Title: {ata_details.get('title', 'Not found')}")
        print(f"  - Comments: {ata_details.get('comments', 'Not found')[:50]}...")
        return jsonify(ata_details)
    except Exception as e:
        print(f"API ERROR: Failed to get ATA details for {work_item_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500

@boards_bp.route("/api/ata/<work_item_id>/save", methods=["POST"])
def save_ata_details(work_item_id):
    """Salva detalhes atualizados de uma ATA específica"""
    try:
        print(f"API REQUEST: Saving ATA details for work_item_id = {work_item_id}")
        ata_data = request.get_json()
        print(f"  - Data received: {list(ata_data.keys()) if ata_data else 'None'}")
        
        boards_controller = AzureBoardsController()
        result = boards_controller.save_ata_details(work_item_id, ata_data)
        
        print(f"API RESPONSE: Successfully saved ATA {work_item_id}")
        return jsonify(result)
    except Exception as e:
        print(f"API ERROR: Failed to save ATA details for {work_item_id}: {str(e)}")
        return jsonify({"error": str(e)}), 500