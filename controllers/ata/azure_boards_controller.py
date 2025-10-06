import os
import base64
import requests
import re
from datetime import datetime

class AzureBoardsController:
    def __init__(self):
        # Usa perfil específico para ATA ou fallback para konia
        ata_profile = os.getenv("ATA_AZURE_PROFILE", "konia")
        
        # Configurações baseadas no perfil ATA
        if ata_profile == "konia":
            self.org = os.getenv("AZURE_DEVOPS_ORG_konia", "konia")
            self.project = os.getenv("AZURE_DEVOPS_PROJECT_konia", "Consultoria")
            self.team = os.getenv("AZURE_DEVOPS_TEAM_konia", "Consultoria Team")
            self.token = os.getenv("AZURE_DEVOPS_TOKEN_konia", "")
            self.user_name = os.getenv("USER_FULL_NAME_konia", "Helen Caroline da Silva Santos")
        else:
            # Fallback para configurações padrão
            self.org = os.getenv("AZURE_DEVOPS_ORG_DEFAULT", "koniasamples")
            self.project = os.getenv("AZURE_DEVOPS_PROJECT_DEFAULT", "POCS")
            self.team = os.getenv("AZURE_DEVOPS_TEAM_DEFAULT", "")
            self.token = os.getenv("AZURE_DEVOPS_TOKEN_DEFAULT", "")
            self.user_name = os.getenv("USER_FULL_NAME_DEFAULT", "")
        
        if not self.token:
            raise Exception(f"Token do Azure DevOps não configurado para perfil ATA: {ata_profile}")
        
        # Headers padrão para requisições
        auth_string = base64.b64encode(f':{self.token}'.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {auth_string}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
    
    def extract_company_from_title(self, title):
        """
        Extrai a empresa do título da ATA usando regex.
        Procura por padrão [ATA][EMPRESA] no início do título.
        """
        if not title:
            return None
        
        # Busca o padrão [ATA][EMPRESA][Nome] - empresa fica no segundo conjunto de colchetes
        pattern = r'^\[ATA\]\[([^\]]+)\]'
        match = re.search(pattern, title, re.IGNORECASE)
        
        if match:
            company = match.group(1).strip().upper()
            return company
        
        # Fallback: procura por qualquer empresa válida nos primeiros colchetes
        pattern = r'^\[([^\]]+)\]'
        excluded_terms = {'ATA', 'TASK', 'BUG', 'FEATURE', 'USER STORY'}
        
        # Buscar todos os matches de colchetes no início do título
        title_clean = title.strip()
        while True:
            match = re.match(pattern, title_clean)
            if not match:
                break
                
            captured_text = match.group(1).strip().upper()
            
            # Se não é um termo excluído, essa é a empresa
            if captured_text not in excluded_terms:
                return captured_text
            
            # Remove o primeiro colchete e continua procurando
            title_clean = title_clean[match.end():].strip()
        
        return None
    
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
    
    def get_all_sprints(self):
        """Busca todas as sprints do time ordenadas por data"""
        try:
            # URL para buscar todas as sprints do time
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/{self.team}/_apis/work/teamsettings/iterations"
            params = {
                "api-version": "7.0"
            }
            
            response = requests.get(api_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                iterations = data.get("value", [])
                
                # Ordenar por data de início (mais recente primeiro)
                sorted_iterations = sorted(iterations, 
                    key=lambda x: x.get("attributes", {}).get("startDate", ""), 
                    reverse=True)
                
                return sorted_iterations
                    
            else:
                raise Exception(f"Erro ao buscar sprints: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro ao buscar todas as sprints: {str(e)}")
        
        return []
    
    def get_last_three_sprints(self):
        """Busca as últimas 3 sprints (atual + 2 anteriores)"""
        try:
            all_sprints = self.get_all_sprints()
            current_sprint = self.get_current_sprint()
            
            if not current_sprint:
                # Se não há sprint atual, pegar as 3 mais recentes
                result_sprints = []
                for i, sprint in enumerate(all_sprints[:3]):
                    sprint_info = {
                        "id": sprint.get("id"),
                        "name": sprint.get("name"),
                        "path": sprint.get("path"),
                        "startDate": sprint.get("attributes", {}).get("startDate"),
                        "endDate": sprint.get("attributes", {}).get("finishDate"),
                        "isCurrent": i == 0
                    }
                    result_sprints.append(sprint_info)
                return result_sprints
            
            # Identificar a sprint atual
            current_sprint_id = current_sprint.get("id")
            current_start_date = current_sprint.get("attributes", {}).get("startDate")
            
            result_sprints = []
            
            # Adicionar a sprint atual primeiro
            current_sprint_info = {
                "id": current_sprint.get("id"),
                "name": current_sprint.get("name"),
                "path": current_sprint.get("path"),
                "startDate": current_start_date,
                "endDate": current_sprint.get("attributes", {}).get("finishDate"),
                "isCurrent": True
            }
            result_sprints.append(current_sprint_info)
            
            # Buscar sprints anteriores à atual (com data de início menor)
            previous_sprints = []
            for sprint in all_sprints:
                if sprint.get("id") == current_sprint_id:
                    continue  # Pular a sprint atual
                
                sprint_start_date = sprint.get("attributes", {}).get("startDate")
                if sprint_start_date and current_start_date and sprint_start_date < current_start_date:
                    previous_sprints.append(sprint)
            
            # Ordenar sprints anteriores por data (mais recente primeiro)
            previous_sprints_sorted = sorted(previous_sprints, 
                key=lambda x: x.get("attributes", {}).get("startDate", ""), 
                reverse=True)
            
            # Adicionar as 2 sprints anteriores mais recentes
            for sprint in previous_sprints_sorted[:2]:
                sprint_info = {
                    "id": sprint.get("id"),
                    "name": sprint.get("name"),
                    "path": sprint.get("path"),
                    "startDate": sprint.get("attributes", {}).get("startDate"),
                    "endDate": sprint.get("attributes", {}).get("finishDate"),
                    "isCurrent": False
                }
                result_sprints.append(sprint_info)
            
            return result_sprints
                
        except Exception as e:
            print(f"Erro ao buscar últimas 3 sprints: {str(e)}")
            return []

    def get_my_work_items_in_sprint(self, sprint_id=None, company_filter=None):
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
            work_items = self._get_work_items_by_query(sprint_path)
            
            # Aplicar filtro por empresa se especificado
            if company_filter:
                filtered_items = []
                for item in work_items:
                    item_company = item.get("company")
                    if item_company and item_company.upper() == company_filter.upper():
                        filtered_items.append(item)
                return filtered_items
            
            return work_items
                
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
                       [Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.Scheduling.Effort],
                       [System.Description], [Microsoft.VSTS.Common.AcceptanceCriteria],
                       [Microsoft.VSTS.CMMI.Comments], [Microsoft.VSTS.Common.Activity],
                       [System.Tags], [System.AreaPath], [System.IterationPath]
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
                excluded_terms = {'ATA', 'TASK', 'BUG', 'FEATURE', 'USER STORY'}  # Termos que não são empresas
                
                for item in work_items:
                    fields = item.get("fields", {})
                    title = fields.get("System.Title", "")
                    
                    # Extrair empresa do título
                    raw_company = self.extract_company_from_title(title)
                    
                    # Normalizar e filtrar empresa
                    company = None
                    if raw_company:
                        company_upper = raw_company.upper()
                        if company_upper not in excluded_terms:
                            company = company_upper
                    
                    # Manter a estrutura original do item e adicionar fields + empresa
                    formatted_item = {
                        "id": item.get("id"),
                        "url": item.get("url", ""),
                        "fields": fields,  # Manter fields para compatibilidade com o frontend
                        "company": company  # Adicionar informação de empresa normalizada
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
    
    def get_ata_details(self, work_item_id):
        """Busca detalhes completos de uma ATA do Azure DevOps"""
        try:
            # URL para buscar detalhes completos do work item
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/workitems/{work_item_id}"
            params = {
                "api-version": "7.0",
                "$expand": "all"  # Expandir todos os campos
            }
            
            response = requests.get(api_url, headers=self.headers, params=params)
            
            if response.status_code == 200:
                data = response.json()
                fields = data.get("fields", {})
                
                # Extrair informações específicas das ATAs baseado no script PowerShell
                result = {
                    "id": data.get("id"),
                    "title": fields.get("System.Title", ""),
                    "description": fields.get("System.Description", ""),
                    "state": fields.get("System.State", ""),
                    "workItemType": fields.get("System.WorkItemType", ""),
                    "assignedTo": self._extract_assigned_to(fields.get("System.AssignedTo", {})),
                    "createdDate": fields.get("System.CreatedDate", ""),
                    "changedDate": fields.get("System.ChangedDate", ""),
                    "tags": fields.get("System.Tags", ""),
                    
                    # Campos específicos das ATAs
                    "location": self._extract_location_from_fields(fields),
                    "startDateTime": self._extract_start_datetime_from_fields(fields),
                    "finishDateTime": self._extract_finish_datetime_from_fields(fields),
                    "meetingStave": self._extract_meeting_stave_from_fields(fields),
                    "meetingSubject": self._extract_meeting_subject_from_fields(fields),
                    "comments": self._extract_comments_from_fields(fields),
                    "nextSteps": self._extract_next_steps_from_fields(fields),
                    "template": fields.get("Custom.PrintingtemplatesATA", "ATA"),  # Default para ATA
                    
                    # Campos baseados no script PowerShell
                    "tribe": fields.get("Custom.Tribe", ""),
                    "originalEstimate": fields.get("Microsoft.VSTS.Scheduling.OriginalEstimate", ""),
                    "remainingWork": fields.get("Microsoft.VSTS.Scheduling.RemainingWork", ""),
                    "completedWork": fields.get("Microsoft.VSTS.Scheduling.CompletedWork", ""),
                    "iterationPath": fields.get("System.IterationPath", ""),
                    "areaPath": fields.get("System.AreaPath", ""),
                    
                    # Análise do título para extrair projeto e responsável
                    "projectInfo": self._extract_project_info_from_title(fields.get("System.Title", "")),
                    
                    # Todos os campos para debug
                    "allFields": fields
                }
                
                return result
            else:
                print(f"Erro ao buscar work item {work_item_id}: {response.status_code}")
                return {"error": f"HTTP {response.status_code}", "id": work_item_id}
                
        except Exception as e:
            print(f"Erro ao buscar detalhes da ATA {work_item_id}: {str(e)}")
            return {"error": str(e), "id": work_item_id}
    
    def save_ata_details(self, work_item_id, ata_data):
        """Salva detalhes atualizados de uma ATA no Azure DevOps"""
        try:
            # URL para atualizar o work item
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/workitems/{work_item_id}"
            params = {
                "api-version": "7.0"
            }
            
            # Preparar os campos a serem atualizados baseados nos dados recebidos
            updates = []
            skipped_fields = []
            
            # Mapear campos do frontend para campos do Azure DevOps que realmente existem
            if "location" in ata_data and ata_data["location"]:
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingLocation",
                    "value": ata_data["location"]
                })
            
            # Agora usar os campos corretos que existem no Azure DevOps
            if "startDateTime" in ata_data and ata_data["startDateTime"]:
                # Converter datetime-local para formato ISO
                start_datetime = self._convert_datetime_to_iso(ata_data["startDateTime"])
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingDateTimeStart",
                    "value": start_datetime
                })
            
            if "finishDateTime" in ata_data and ata_data["finishDateTime"]:
                # Converter datetime-local para formato ISO
                finish_datetime = self._convert_datetime_to_iso(ata_data["finishDateTime"])
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingDateTimeFinish",
                    "value": finish_datetime
                })
            
            if "meetingStave" in ata_data and ata_data["meetingStave"]:
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingStavesSubject1",
                    "value": ata_data["meetingStave"]
                })
            
            if "meetingSubject" in ata_data and ata_data["meetingSubject"]:
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingSubject1",
                    "value": ata_data["meetingSubject"]
                })
            
            if "comments" in ata_data and ata_data["comments"]:
                # Preservar quebras de linha convertendo \n para <br>
                comments_with_breaks = ata_data['comments'].replace('\n', '<br>\n')
                # Converter texto em negrito **texto** para <strong>texto</strong>
                comments_with_bold = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', comments_with_breaks)
                comments_html = f"<div>{comments_with_bold}</div>"
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.MeetingComments1",
                    "value": comments_html
                })
            
            # Atualizar template se fornecido
            if "template" in ata_data and ata_data["template"]:
                updates.append({
                    "op": "replace",
                    "path": "/fields/Custom.PrintingtemplatesATA",
                    "value": ata_data["template"]
                })
            
            # Atualizar Next Steps se fornecidos
            if "nextSteps" in ata_data and isinstance(ata_data["nextSteps"], list):
                # Criar um dicionário para rastrear quais campos serão atualizados
                next_steps_updates = {}
                
                # Inicializar todos os campos como vazios
                for step_num in range(1, 11):
                    next_steps_updates[f"Custom.MeetingAction{step_num}"] = ""
                    next_steps_updates[f"Custom.MeetingActionResponsible{step_num}"] = ""
                    next_steps_updates[f"Custom.MeetingActionDate{step_num}"] = ""
                
                # Preencher apenas os Next Steps que têm valores
                for step in ata_data["nextSteps"]:
                    step_num = step.get("number", 0)
                    if 1 <= step_num <= 10:  # Validar número do step
                        # Action
                        if "action" in step and step["action"]:
                            next_steps_updates[f"Custom.MeetingAction{step_num}"] = step["action"]
                        
                        # Responsible
                        if "responsible" in step and step["responsible"]:
                            next_steps_updates[f"Custom.MeetingActionResponsible{step_num}"] = step["responsible"]
                        
                        # Date
                        if "date" in step and step["date"]:
                            try:
                                # Usar a mesma função de conversão dos outros campos de datetime
                                utc_date_formatted = self._convert_datetime_to_iso(step["date"])
                                next_steps_updates[f"Custom.MeetingActionDate{step_num}"] = utc_date_formatted
                            except Exception as e:
                                print(f"Error converting date for step {step_num}: {e}")
                                pass
                
                # Adicionar as atualizações dos Next Steps ao updates
                for field_path, field_value in next_steps_updates.items():
                    updates.append({
                        "op": "replace",
                        "path": f"/fields/{field_path}",
                        "value": field_value
                    })
            
            # Se não há atualizações, retornar informação sobre campos ignorados
            if not updates:
                message = "Nenhuma alteração para salvar"
                if skipped_fields:
                    message += f". Campos ignorados: {', '.join(skipped_fields)}"
                return {"success": True, "message": message, "id": work_item_id}
            
            # Headers para a requisição PATCH
            headers = self.headers.copy()
            headers["Content-Type"] = "application/json-patch+json"
            
            print(f"Updating work item {work_item_id} with {len(updates)} field(s)")
            for update in updates:
                print(f"  - {update['path']}: {str(update['value'])[:50]}...")
            
            if skipped_fields:
                print(f"Skipped fields: {', '.join(skipped_fields)}")
            
            response = requests.patch(api_url, json=updates, headers=headers, params=params)
            
            if response.status_code == 200:
                print(f"Successfully updated work item {work_item_id}")
                message = "ATA salva com sucesso!"
                if skipped_fields:
                    message += f" (Campos de data/hora não foram salvos - campos não existem no Azure DevOps)"
                
                return {
                    "success": True, 
                    "message": message,
                    "id": work_item_id,
                    "updatedFields": len(updates),
                    "skippedFields": skipped_fields
                }
            else:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f": {error_detail}"
                except:
                    error_msg += f": {response.text}"
                
                print(f"Failed to update work item {work_item_id}: {error_msg}")
                return {"error": error_msg, "id": work_item_id}
                
        except Exception as e:
            print(f"Exception while saving ATA {work_item_id}: {str(e)}")
            return {"error": str(e), "id": work_item_id}
    
    def update_work_item_status(self, work_item_id, new_status):
        """Atualiza apenas o status de um work item no Azure DevOps"""
        try:
            # URL para atualização do work item
            api_url = f"https://dev.azure.com/{self.org}/{self.project}/_apis/wit/workitems/{work_item_id}"
            params = {"api-version": "7.0"}
            
            # Headers para PATCH (JSON Patch)
            headers = self.headers.copy()
            headers["Content-Type"] = "application/json-patch+json"
            
            # Preparar a atualização do status
            updates = [
                {
                    "op": "replace",
                    "path": "/fields/System.State",
                    "value": new_status
                }
            ]
            
            print(f"Updating work item {work_item_id} status to: {new_status}")
            
            response = requests.patch(api_url, json=updates, headers=headers, params=params)
            
            if response.status_code == 200:
                print(f"Successfully updated work item {work_item_id} status to {new_status}")
                return {
                    "success": True, 
                    "message": f"Status atualizado para {new_status}",
                    "id": work_item_id,
                    "new_status": new_status
                }
            else:
                error_msg = f"HTTP {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f": {error_detail}"
                except:
                    error_msg += f": {response.text}"
                
                print(f"Failed to update work item {work_item_id} status: {error_msg}")
                return {"error": error_msg, "id": work_item_id}
                
        except Exception as e:
            print(f"Exception while updating status for work item {work_item_id}: {str(e)}")
            return {"error": str(e), "id": work_item_id}

    def _convert_datetime_to_iso(self, datetime_local):
        """Converte datetime-local para formato ISO do Azure DevOps (adiciona 3h para UTC)"""
        try:
            from datetime import datetime, timedelta
            # datetime_local está no formato: "2025-09-30T14:30" (horário local Brasil)
            dt = datetime.fromisoformat(datetime_local)
            # Adicionar 3 horas para converter para UTC (Azure DevOps armazena em UTC)
            utc_dt = dt + timedelta(hours=3)
            # Converter para formato ISO com Z
            result = utc_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            print(f"DEBUG: Converting Local->UTC for save: {datetime_local} -> {result}")
            return result
        except Exception as e:
            print(f"Error converting datetime {datetime_local}: {e}")
            return datetime_local
    
    def _extract_location_from_fields(self, fields):
        """Extrai informação de local dos campos disponíveis"""
        # Primeiro tentar campos específicos de localização
        direct_location_fields = [
            "Custom.MeetingLocation",
            "Custom.Location"
        ]
        
        for field_name in direct_location_fields:
            field_value = fields.get(field_name, "")
            if field_value and isinstance(field_value, str):
                return field_value.strip()
        
        # Se não encontrou nos campos diretos, tentar outros campos que podem conter localização
        possible_fields = [
            "Microsoft.VSTS.Common.Activity",
            "Microsoft.VSTS.CMMI.Comments",
            "System.Tags",
            "System.Description"
        ]
        
        for field_name in possible_fields:
            field_value = fields.get(field_name, "")
            if field_value and isinstance(field_value, str):
                # Procurar por padrões que indiquem local
                if any(keyword in field_value.lower() for keyword in ["sala", "teams", "local", "location", "meeting", "reunião", "remoto"]):
                    return field_value
        
        return ""
    
    def _extract_start_datetime_from_fields(self, fields):
        """Extrai data/hora de início dos campos disponíveis"""
        # Primeiro tentar extrair do campo específico do Azure DevOps
        start_datetime = fields.get("Custom.MeetingDateTimeStart", "")
        if start_datetime:
            try:
                # Azure DevOps armazena em UTC, mas precisamos converter de volta para horário local BR (UTC-3)
                from datetime import datetime, timedelta
                
                # Parse do datetime UTC
                if start_datetime.endswith('Z'):
                    start_datetime = start_datetime[:-1]  # Remove 'Z'
                
                date_obj = datetime.fromisoformat(start_datetime)
                # Subtrair 3 horas para voltar ao horário local do Brasil
                local_date_obj = date_obj - timedelta(hours=3)
                result = local_date_obj.strftime("%Y-%m-%dT%H:%M")
                
                print(f"DEBUG: Start datetime UTC->Local: {fields.get('Custom.MeetingDateTimeStart')} -> {result}")
                return result
            except Exception as e:
                print(f"Error parsing start datetime: {e}")
                pass
        
        # Fallback: tentar extrair da data de atividade no título
        title = fields.get("System.Title", "")
        project_info = self._extract_project_info_from_title(title)
        
        if project_info.get("activityDate"):
            # Converter formato DD/MM/AAAA para AAAA-MM-DD
            try:
                from datetime import datetime
                activity_date = project_info["activityDate"]
                date_obj = datetime.strptime(activity_date, "%d/%m/%Y")
                # Adicionar horário padrão de 09:00 para início
                return date_obj.strftime("%Y-%m-%dT09:00")
            except:
                pass
        
        # Fallback para a data de criação
        created_date = fields.get("System.CreatedDate", "")
        if created_date:
            try:
                # Converter formato ISO para datetime-local
                from datetime import datetime
                date_obj = datetime.fromisoformat(created_date.replace('Z', '+00:00'))
                return date_obj.strftime("%Y-%m-%dT%H:%M")
            except:
                pass
        
        return ""
    
    def _extract_finish_datetime_from_fields(self, fields):
        """Extrai data/hora de fim dos campos disponíveis"""
        # Primeiro tentar extrair do campo específico do Azure DevOps
        finish_datetime = fields.get("Custom.MeetingDateTimeFinish", "")
        if finish_datetime:
            try:
                # Azure DevOps armazena em UTC, mas precisamos converter de volta para horário local BR (UTC-3)
                from datetime import datetime, timedelta
                
                # Parse do datetime UTC
                if finish_datetime.endswith('Z'):
                    finish_datetime = finish_datetime[:-1]  # Remove 'Z'
                
                date_obj = datetime.fromisoformat(finish_datetime)
                # Subtrair 3 horas para voltar ao horário local do Brasil
                local_date_obj = date_obj - timedelta(hours=3)
                result = local_date_obj.strftime("%Y-%m-%dT%H:%M")
                
                print(f"DEBUG: Finish datetime UTC->Local: {fields.get('Custom.MeetingDateTimeFinish')} -> {result}")
                return result
            except Exception as e:
                print(f"Error parsing finish datetime: {e}")
                pass
        
        # Fallback: usar data de início e adicionar 2 horas como padrão
        start_datetime = self._extract_start_datetime_from_fields(fields)
        if start_datetime:
            try:
                from datetime import datetime, timedelta
                start_obj = datetime.fromisoformat(start_datetime)
                finish_obj = start_obj + timedelta(hours=2)
                return finish_obj.strftime("%Y-%m-%dT%H:%M")
            except:
                pass
        
        return ""
    
    def _fix_encoding(self, text):
        """Corrige problemas de encoding UTF-8"""
        if not text or not isinstance(text, str):
            return text
        
        try:
            # Tentar corrigir encoding comum UTF-8 -> Latin-1 -> UTF-8
            return text.encode('latin-1').decode('utf-8')
        except:
            # Se não conseguir corrigir, retornar o texto original
            return text
    
    def _extract_meeting_stave_from_fields(self, fields):
        """Extrai assunto principal da reunião dos campos disponíveis"""
        # Tentar campos específicos de Meeting Staves
        stave_fields = [
            "Custom.MeetingStavesSubject1",
            "Custom.MeetingStaveSubject",
            "Microsoft.VSTS.Common.Activity"
        ]
        
        for field_name in stave_fields:
            field_value = fields.get(field_name, "")
            if field_value and isinstance(field_value, str):
                return self._fix_encoding(field_value.strip())
        
        return ""
    
    def _extract_meeting_subject_from_fields(self, fields):
        """Extrai assunto específico da reunião dos campos disponíveis"""
        # Tentar campos específicos de Meeting Subject
        subject_fields = [
            "Custom.MeetingSubject1",
            "Custom.MeetingSubject",
            "System.Description"
        ]
        
        for field_name in subject_fields:
            field_value = fields.get(field_name, "")
            if field_value and isinstance(field_value, str):
                return self._fix_encoding(field_value.strip())
        
        return ""
    
    def _extract_next_steps_from_fields(self, fields):
        """Extrai próximos passos dos campos disponíveis"""
        next_steps = []
        
        # Verificar até 10 possíveis next steps (baseado na estrutura da interface)
        for i in range(1, 11):
            action = fields.get(f"Custom.MeetingAction{i}", "").strip()
            responsible = fields.get(f"Custom.MeetingActionResponsible{i}", "").strip()
            date_raw = fields.get(f"Custom.MeetingActionDate{i}", "")
            
            # Se pelo menos um campo tem conteúdo, incluir o step
            if action or responsible or date_raw:
                # Converter data se existir
                date_formatted = ""
                if date_raw:
                    try:
                        from datetime import datetime, timedelta
                        if date_raw.endswith('Z'):
                            date_raw = date_raw[:-1]
                        date_obj = datetime.fromisoformat(date_raw)
                        # Subtrair 3 horas para converter UTC para horário local
                        local_date_obj = date_obj - timedelta(hours=3)
                        # Usar formato datetime-local (YYYY-MM-DDTHH:MM)
                        date_formatted = local_date_obj.strftime("%Y-%m-%dT%H:%M")
                        print(f"DEBUG: Next Step {i} date UTC->Local: {date_raw} -> {date_formatted}")
                    except Exception as e:
                        print(f"Error converting Next Step {i} date: {e}")
                        date_formatted = ""
                
                next_steps.append({
                    "number": i,
                    "action": action,
                    "responsible": responsible,
                    "date": date_formatted
                })
        
        return next_steps
    
    def _extract_assigned_to(self, assigned_to_field):
        """Extrai informação de quem está assignado"""
        if isinstance(assigned_to_field, dict):
            return assigned_to_field.get("displayName", "")
        return str(assigned_to_field) if assigned_to_field else ""
    
    def _extract_comments_from_fields(self, fields):
        """Extrai comentários dos campos disponíveis"""
        # O campo principal para ATAs é sempre Custom.MeetingComments1
        comment_value = fields.get("Custom.MeetingComments1", "")
        
        if comment_value and isinstance(comment_value, str):
            # Remover apenas as tags HTML, mantendo todo o conteúdo e espaçamento
            import re
            # Remove tags HTML mas preserva todo o texto e espaçamento interno
            clean_comments = re.sub(r'<[^>]+>', '', comment_value)
            return self._fix_encoding(clean_comments)
        
        # Fallback para outros campos se o principal não existir
        fallback_fields = [
            "Custom.MeetingComments",
            "System.Description",
            "Microsoft.VSTS.CMMI.Comments"
        ]
        
        for field_name in fallback_fields:
            field_value = fields.get(field_name, "")
            if field_value and isinstance(field_value, str):
                import re
                clean_comments = re.sub(r'<[^>]+>', '', field_value)
                return self._fix_encoding(clean_comments)
        
        return ""
    
    def _extract_project_info_from_title(self, title):
        """Extrai informações do projeto baseado no padrão do título"""
        import re
        
        # Padrão: [PROJETO][RESPONSAVEL] Descrição - Atividade do dia DD/MM/AAAA
        project_match = re.search(r'\[([^\]]+)\]', title)
        responsible_match = re.search(r'\]\[([^\]]+)\]', title)
        date_match = re.search(r'Atividade do dia (\d{2}/\d{2}/\d{4})', title)
        
        return {
            "project": project_match.group(1) if project_match else "",
            "responsible": responsible_match.group(1) if responsible_match else "",
            "activityDate": date_match.group(1) if date_match else "",
            "isTOTVS": "TOTVS" in title.upper()
        }