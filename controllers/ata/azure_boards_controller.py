import os
import base64
import requests
from datetime import datetime

class AzureBoardsController:
    def __init__(self):
        # Configurações do perfil Konia
        self.org = os.getenv("AZURE_DEVOPS_ORG_konia", "konia")
        self.project = os.getenv("AZURE_DEVOPS_PROJECT_konia", "Consultoria")
        self.team = os.getenv("AZURE_DEVOPS_TEAM_konia", "Consultoria Team")
        self.token = os.getenv("AZURE_DEVOPS_TOKEN_konia", "")
        self.user_name = os.getenv("USER_FULL_NAME_konia", "Helen Caroline da Silva Santos")
        
        if not self.token:
            raise Exception("Token do Azure DevOps Konia não configurado")
        
        # Headers padrão para requisições
        auth_string = base64.b64encode(f':{self.token}'.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {auth_string}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def get_current_sprint(self):
        """Busca a sprint ativa/atual do time"""
        try:
            # URL para buscar sprints do time
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/{self.team}/_apis/work/teamsettings/iterations"
            params = {
                "api-version": "7.0",
                "$timeframe": "current"  # Apenas sprints atuais
            }
            
            response = requests.get(api_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                iterations = data.get("value", [])
                
                # Buscar a sprint ativa (atual)
                for iteration in iterations:
                    # Verificar se a sprint está ativa baseada nas datas
                    start_date = iteration.get("attributes", {}).get("startDate")
                    finish_date = iteration.get("attributes", {}).get("finishDate")
                    
                    if start_date and finish_date:
                        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                        finish = datetime.fromisoformat(finish_date.replace('Z', '+00:00'))
                        now = datetime.now(start.tzinfo)
                        
                        if start <= now <= finish:
                            return iteration
                
                # Se não encontrou por data, pegar a primeira disponível
                if iterations:
                    return iterations[0]
                    
            else:
                raise Exception(f"Erro ao buscar sprints: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro ao buscar sprint atual: {str(e)}")
        
        return None
    
    def get_my_work_items_in_sprint(self, sprint_id=None):
        """Busca work items (cards) atribuídos ao usuário na sprint ativa usando WIQL"""
        try:
            # Se não foi fornecido sprint_id, buscar sprint atual
            if not sprint_id:
                current_sprint = self.get_current_sprint()
                if not current_sprint:
                    return []
                sprint_path = current_sprint.get("path")
            else:
                # Se temos o sprint_id, precisamos buscar o path
                sprint_path = self._get_sprint_path(sprint_id)
            
            if not sprint_path:
                return []
            
            # Usar WIQL para buscar apenas work items atribuídos ao usuário na sprint
            return self._get_work_items_by_query(sprint_path)
                
        except Exception as e:
            raise Exception(f"Erro ao buscar work items: {str(e)}")
    
    def _get_sprint_path(self, sprint_id):
        """Busca o path da sprint pelo ID"""
        try:
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/{self.team}/_apis/work/teamsettings/iterations/{sprint_id}"
            params = {"api-version": "7.0"}
            
            response = requests.get(api_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                return data.get("path")
            return None
                
        except Exception:
            return None
    
    def _get_work_items_by_query(self, sprint_path):
        """Busca work items usando WIQL (Work Item Query Language)"""
        try:
            # Query WIQL para buscar work items atribuídos ao usuário na sprint específica
            wiql_query = {
                "query": f"""
                SELECT [System.Id], [System.Title], [System.State], [System.WorkItemType], 
                       [System.AssignedTo], [System.CreatedDate], [System.ChangedDate],
                       [Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.Scheduling.Effort]
                FROM WorkItems 
                WHERE [System.TeamProject] = '{self.project}'
                AND [System.IterationPath] = '{sprint_path}'
                AND [System.AssignedTo] = '{self.user_name}'
                ORDER BY [System.ChangedDate] DESC
                """
            }
            
            # URL para executar query WIQL
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/wiql"
            params = {"api-version": "7.0"}
            
            response = requests.post(api_url, headers=self.headers, params=params, json=wiql_query)
            
            if response.status_code == 200:
                data = response.json()
                work_items = data.get("workItems", [])
                
                if not work_items:
                    return []
                
                # Extrair IDs dos work items
                work_item_ids = [item["id"] for item in work_items]
                
                # Buscar detalhes dos work items (já filtrados pela query)
                return self._get_work_items_details_direct(work_item_ids)
                
            else:
                raise Exception(f"Erro na query WIQL: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro ao executar query WIQL: {str(e)}")
    
    def _get_work_items_details_direct(self, work_item_ids):
        """Busca detalhes dos work items (já filtrados por usuário)"""
        try:
            if not work_item_ids:
                return []
            
            # Dividir em chunks de 200 (limite da API)
            chunk_size = 200
            all_work_items = []
            
            for i in range(0, len(work_item_ids), chunk_size):
                chunk_ids = work_item_ids[i:i + chunk_size]
                chunk_items = self._get_work_items_chunk_direct(chunk_ids)
                all_work_items.extend(chunk_items)
            
            return all_work_items
                
        except Exception as e:
            raise Exception(f"Erro ao buscar detalhes dos work items: {str(e)}")
    
    def _get_work_items_chunk_direct(self, work_item_ids):
        """Busca um chunk de work items (máximo 200) - já filtrados"""
        try:
            # Converter lista de IDs para string separada por vírgulas
            ids_string = ",".join(map(str, work_item_ids))
            
            # URL para buscar detalhes dos work items
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/workitems"
            params = {
                "ids": ids_string,
                "api-version": "7.0",
                "$expand": "fields"
            }
            
            response = requests.get(api_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                work_items = data.get("value", [])
                
                # Retornar work items no formato esperado pelo frontend
                formatted_work_items = []
                for item in work_items:
                    fields = item.get("fields", {})
                    
                    # Manter a estrutura original do item e adicionar fields
                    formatted_item = {
                        "id": item.get("id"),
                        "url": item.get("url", ""),
                        "fields": fields  # Manter fields para compatibilidade com o frontend
                    }
                    formatted_work_items.append(formatted_item)
                
                return formatted_work_items
                
            else:
                raise Exception(f"Erro ao buscar detalhes dos work items: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro ao buscar chunk de work items: {str(e)}")
    
    def get_sprint_and_work_items(self):
        """Método principal que retorna sprint atual e work items do usuário"""
        try:
            current_sprint = self.get_current_sprint()
            if not current_sprint:
                return {
                    "sprint": None,
                    "work_items": [],
                    "message": "Nenhuma sprint ativa encontrada"
                }
            
            # Usar a nova implementação otimizada
            work_items = self.get_my_work_items_in_sprint()
            
            return {
                "sprint": {
                    "id": current_sprint.get("id"),
                    "name": current_sprint.get("name"),
                    "path": current_sprint.get("path"),
                    "startDate": current_sprint.get("attributes", {}).get("startDate"),
                    "endDate": current_sprint.get("attributes", {}).get("finishDate")
                },
                "work_items": work_items,
                "total_items": len(work_items),
                "message": f"Encontrados {len(work_items)} work items na sprint ativa"
            }
            
        except Exception as e:
            return {
                "sprint": None,
                "work_items": [],
                "error": str(e),
                "message": f"Erro ao buscar dados: {str(e)}"
            }