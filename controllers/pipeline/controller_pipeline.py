import os
import base64
import requests

# Configurações do Azure DevOps
AZURE_DEVOPS_TOKEN = os.getenv("AZURE_DEVOPS_TOKEN", "")
AZURE_DEVOPS_ORG = os.getenv("AZURE_DEVOPS_ORG", "koniasamples")
AZURE_DEVOPS_PROJECT = os.getenv("AZURE_DEVOPS_PROJECT", "POCS")
AZURE_DEVOPS_REPO = os.getenv("AZURE_DEVOPS_REPO", "AutomacaoCards")
PIPELINE_ID = os.getenv("PIPELINE_ID", "556")

class PipelineController:
    @staticmethod
    def get_pipeline_file():
        """Obtém o conteúdo atual do arquivo cards.txt"""
        if not AZURE_DEVOPS_TOKEN:
            raise Exception("Token do Azure DevOps não configurado")
        
        try:
            # URL da API para obter conteúdo do arquivo
            api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/items"
            
            # Headers da requisição
            auth_string = base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()
            headers = {
                "Authorization": f"Basic {auth_string}",
                "Accept": "application/json"
            }
            
            # Parâmetros para obter o arquivo cards.txt da branch helen.santos.v2
            params = {
                "path": "/cards.txt",
                "version": "helen.santos.v2",
                "versionType": "branch",
                "api-version": "7.0",
                "$format": "text"
            }
            
            response = requests.get(api_url, headers=headers, params=params)
            
            if response.status_code == 200:
                # Solução robusta para problemas de encoding UTF-8
                try:
                    # Primeira tentativa: usar response.content (bytes) e decodificar como UTF-8
                    content = response.content.decode('utf-8')
                    
                    # Se ainda houver problemas de encoding (caracteres como Ã), tentar correção
                    if any(char in content for char in ['Ã§', 'Ã£', 'Ã¡', 'Ã©', 'Ã­', 'Ã³', 'Ãº', 'Ã']):
                        # O conteúdo foi mal decodificado, provavelmente como latin-1
                        # Recodificar: latin-1 -> bytes -> utf-8
                        content_bytes = content.encode('latin-1')
                        content = content_bytes.decode('utf-8')
                        
                except (UnicodeDecodeError, UnicodeEncodeError):
                    # Fallback: usar response.text com encoding explícito
                    response.encoding = 'utf-8'
                    content = response.text
                
                return {"content": content}
            elif response.status_code == 404:
                return {"content": ""}  # Arquivo não existe ainda
            else:
                # Retornar informações detalhadas do erro para debug
                raise Exception(f"Erro {response.status_code} da API do Azure DevOps: {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro interno: {str(e)}")

    @staticmethod
    def save_pipeline_file(content):
        """Salva o conteúdo do arquivo cards.txt no repositório Azure DevOps"""
        if not AZURE_DEVOPS_TOKEN:
            raise Exception("Token do Azure DevOps não configurado")
        
        if not content.strip():
            raise Exception("Conteúdo não pode estar vazio")
        
        try:
            # Azure DevOps Git API requires push operations, not direct file updates
            auth_string = base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Basic {auth_string}"
            }
            
            # First, get the current commit SHA of the branch
            branch_api = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/refs"
            params = {"filter": "heads/helen.santos.v2", "api-version": "7.0"}
            branch_response = requests.get(branch_api, headers=headers, params=params)
            
            if branch_response.status_code != 200:
                raise Exception(f"Erro ao buscar branch: {branch_response.status_code} - {branch_response.text}")
                
            branch_data = branch_response.json()
            if not branch_data.get("value"):
                raise Exception("Branch helen.santos.v2 não encontrada")
                
            old_object_id = branch_data["value"][0]["objectId"]
            
            # Create push operation to update the file
            push_api = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/git/repositories/{AZURE_DEVOPS_REPO}/pushes"
            push_params = {"api-version": "7.0"}
            
            # Encode content to base64
            content_b64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')
            
            push_payload = {
                "refUpdates": [
                    {
                        "name": "refs/heads/helen.santos.v2",
                        "oldObjectId": old_object_id
                    }
                ],
                "commits": [
                    {
                        "comment": "Atualizar cards.txt via painel web",
                        "changes": [
                            {
                                "changeType": "edit",
                                "item": {
                                    "path": "/cards.txt"
                                },
                                "newContent": {
                                    "content": content_b64,
                                    "contentType": "base64encoded"
                                }
                            }
                        ]
                    }
                ]
            }
            
            response = requests.post(push_api, json=push_payload, headers=headers, params=push_params)
            
            if response.status_code in [200, 201]:
                return {"success": True, "message": "Arquivo salvo com sucesso"}
            else:
                raise Exception(f"Erro da API: {response.status_code} - {response.text}")
                
        except Exception as e:
            raise Exception(f"Erro interno: {str(e)}")

    @staticmethod
    def run_pipeline():
        """Executa a pipeline do Azure DevOps"""
        if not AZURE_DEVOPS_TOKEN:
            raise Exception("Token do Azure DevOps não configurado")
        
        try:
            # URL da API do Azure DevOps para executar pipeline
            api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/pipelines/{PIPELINE_ID}/runs"
            
            # Headers da requisição
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Basic {base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()}"
            }
            
            # Parâmetros da API (incluindo api-version obrigatório)
            params = {
                "api-version": "7.0"
            }
            
            # Payload para executar a pipeline na branch helen.santos.v2
            payload = {
                "resources": {
                    "repositories": {
                        "self": {
                            "refName": "refs/heads/helen.santos.v2"
                        }
                    }
                }
            }
            
            response = requests.post(api_url, json=payload, headers=headers, params=params)
            
            if response.status_code == 200:
                build_data = response.json()
                return {
                    "success": True,
                    "buildId": build_data.get("id"),
                    "buildUrl": build_data.get("url"),
                    "status": build_data.get("state", "queued")
                }
            else:
                raise Exception(f"Erro ao executar pipeline: {response.text}")
                
        except Exception as e:
            raise Exception(str(e))

    @staticmethod
    def pipeline_status(build_id):
        """Consulta o status atual de uma pipeline em execução"""
        if not AZURE_DEVOPS_TOKEN:
            raise Exception("Token do Azure DevOps não configurado")
        
        try:
            # URL da API do Azure DevOps para consultar status da pipeline
            api_url = f"https://dev.azure.com/{AZURE_DEVOPS_ORG}/{AZURE_DEVOPS_PROJECT}/_apis/build/builds/{build_id}"
            
            # Headers da requisição
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Basic {base64.b64encode(f':{AZURE_DEVOPS_TOKEN}'.encode()).decode()}"
            }
            
            # Parâmetros da API
            params = {
                "api-version": "7.0"
            }
            
            response = requests.get(api_url, headers=headers, params=params)
            
            if response.status_code == 200:
                build_data = response.json()
                
                # Mapear status para português e adicionar informações úteis
                status_map = {
                    "notStarted": "na fila",
                    "inProgress": "executando", 
                    "completed": "concluída",
                    "cancelling": "cancelando",
                    "postponed": "adiada"
                }
                
                result_map = {
                    "succeeded": "sucesso",
                    "failed": "falhou",
                    "canceled": "cancelada",
                    "partiallySucceeded": "parcialmente bem-sucedida"
                }
                
                status = build_data.get("status", "unknown")
                result = build_data.get("result", None)
                
                return {
                    "success": True,
                    "buildId": build_data.get("id"),
                    "status": status_map.get(status, status),
                    "result": result_map.get(result, result) if result else None,
                    "buildUrl": build_data.get("_links", {}).get("web", {}).get("href", ""),
                    "startTime": build_data.get("startTime"),
                    "finishTime": build_data.get("finishTime"),
                    "queueTime": build_data.get("queueTime"),
                    "buildNumber": build_data.get("buildNumber"),
                    "isCompleted": status == "completed"
                }
            else:
                raise Exception(f"Erro ao consultar status: {response.text}")
                
        except Exception as e:
            raise Exception(str(e))