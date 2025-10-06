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

@boards_bp.route("/api/boards/sprints", methods=["GET"])
def get_sprints():
    """Busca as últimas 3 sprints (atual + 2 anteriores)"""
    try:
        boards_controller = AzureBoardsController()
        sprints = boards_controller.get_last_three_sprints()
        return jsonify({"sprints": sprints})
    except Exception as e:
        return jsonify({"error": str(e), "sprints": []}), 500

@boards_bp.route("/api/boards/my-work-items", methods=["GET"])
def get_my_work_items():
    """Busca os work items (cards) do usuário na sprint ativa - rota alternativa"""
    try:
        # Verificar se foi passado um sprint_id específico
        sprint_id = request.args.get('sprint_id')
        
        boards_controller = AzureBoardsController()
        
        if sprint_id:
            # Buscar work items de uma sprint específica
            work_items = boards_controller.get_my_work_items_in_sprint(sprint_id)
            # Buscar informações da sprint específica
            all_sprints = boards_controller.get_all_sprints()
            selected_sprint = next((s for s in all_sprints if s.get("id") == sprint_id), None)
            
            return jsonify({
                "sprint": {
                    "id": selected_sprint.get("id") if selected_sprint else sprint_id,
                    "name": selected_sprint.get("name") if selected_sprint else f"Sprint {sprint_id}",
                    "path": selected_sprint.get("path") if selected_sprint else "",
                    "startDate": selected_sprint.get("attributes", {}).get("startDate") if selected_sprint else "",
                    "endDate": selected_sprint.get("attributes", {}).get("finishDate") if selected_sprint else ""
                },
                "work_items": work_items,
                "total_items": len(work_items),
                "message": f"Encontrados {len(work_items)} work items na sprint selecionada"
            })
        else:
            # Comportamento padrão - sprint atual
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

@boards_bp.route("/api/ata/<work_item_id>/status", methods=["PUT"])
def update_ata_status(work_item_id):
    """Atualiza apenas o status de uma ATA específica"""
    try:
        print(f"API REQUEST: Updating status for work_item_id = {work_item_id}")
        data = request.get_json()
        new_status = data.get('status')
        
        if not new_status:
            return jsonify({"error": "Status is required"}), 400
        
        print(f"  - New status: {new_status}")
        
        boards_controller = AzureBoardsController()
        result = boards_controller.update_work_item_status(work_item_id, new_status)
        
        print(f"API RESPONSE: Successfully updated status for ATA {work_item_id}")
        return jsonify(result)
    except Exception as e:
        print(f"API ERROR: Failed to update status for {work_item_id}: {str(e)}")
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