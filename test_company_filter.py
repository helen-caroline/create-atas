#!/usr/bin/env python3
"""
Teste da funcionalidade de filtro por empresa no ATA WORKSPACE

Este script demonstra como a nova funcionalidade funciona:
1. Extração de empresa do título das ATAs
2. Filtro por empresa nas listagens
3. Exibição da empresa nos cards

Autor: GitHub Copilot
Data: 06/10/2025
"""

import re
import json

def extract_company_from_title(title):
    """
    Extrai a empresa do título da ATA usando regex.
    Procura por padrão [EMPRESA] no início do título.
    """
    if not title:
        return None
    
    # Padrão regex para capturar texto entre colchetes no início do título
    pattern = r'^\[([^\]]+)\]'
    match = re.match(pattern, title.strip())
    
    if match:
        return match.group(1).strip()
    
    return None

def simulate_work_items():
    """Simula work items como retornados pela API do Azure DevOps"""
    return [
        {
            "id": 12345,
            "fields": {
                "System.Title": "[TOTVS] Implementação do módulo financeiro",
                "System.State": "Active",
                "System.WorkItemType": "ATA",
                "System.Description": "Desenvolvimento do módulo de gestão financeira",
                "Microsoft.VSTS.Common.Priority": 1
            }
        },
        {
            "id": 12346,
            "fields": {
                "System.Title": "[ECAD] Configuração do sistema de pagamentos",
                "System.State": "Proposed",
                "System.WorkItemType": "ATA",
                "System.Description": "Setup inicial do sistema de pagamentos automáticos",
                "Microsoft.VSTS.Common.Priority": 2
            }
        },
        {
            "id": 12347,
            "fields": {
                "System.Title": "[KONIA] Desenvolvimento da API REST",
                "System.State": "Closed",
                "System.WorkItemType": "ATA",
                "System.Description": "Criação de endpoints para integração",
                "Microsoft.VSTS.Common.Priority": 1
            }
        },
        {
            "id": 12348,
            "fields": {
                "System.Title": "[TOTVS] Manutenção do banco de dados",
                "System.State": "Active",
                "System.WorkItemType": "ATA",
                "System.Description": "Otimização de queries e índices",
                "Microsoft.VSTS.Common.Priority": 3
            }
        },
        {
            "id": 12349,
            "fields": {
                "System.Title": "Reunião de alinhamento geral",
                "System.State": "Proposed",
                "System.WorkItemType": "ATA",
                "System.Description": "Reunião sem empresa específica",
                "Microsoft.VSTS.Common.Priority": 4
            }
        }
    ]

def process_work_items(work_items):
    """Processa work items adicionando informação de empresa"""
    processed_items = []
    
    for item in work_items:
        title = item["fields"]["System.Title"]
        company = extract_company_from_title(title)
        
        # Adiciona company ao item
        processed_item = {
            **item,
            "company": company
        }
        processed_items.append(processed_item)
    
    return processed_items

def filter_by_company(work_items, company_filter=None):
    """Filtra work items por empresa"""
    if not company_filter:
        return work_items
    
    filtered_items = []
    for item in work_items:
        item_company = item.get("company")
        if item_company and item_company.upper() == company_filter.upper():
            filtered_items.append(item)
    
    return filtered_items

def get_available_companies(work_items):
    """Extrai todas as empresas disponíveis"""
    companies = set()
    for item in work_items:
        company = item.get("company")
        if company:
            companies.add(company)
    
    return sorted(list(companies))

def main():
    print("🚀 DEMONSTRAÇÃO: Filtro por Empresa no ATA WORKSPACE")
    print("=" * 60)
    
    # 1. Simular work items
    raw_work_items = simulate_work_items()
    print(f"📊 Work Items originais: {len(raw_work_items)}")
    
    # 2. Processar work items (adicionar company)
    processed_work_items = process_work_items(raw_work_items)
    print(f"✅ Work Items processados: {len(processed_work_items)}")
    
    # 3. Mostrar empresas disponíveis
    companies = get_available_companies(processed_work_items)
    print(f"🏢 Empresas disponíveis: {companies}")
    
    print("\n" + "=" * 60)
    print("📋 LISTAGEM COMPLETA (sem filtro):")
    print("=" * 60)
    
    for item in processed_work_items:
        title = item["fields"]["System.Title"]
        company = item.get("company", "N/A")
        state = item["fields"]["System.State"]
        priority = item["fields"]["Microsoft.VSTS.Common.Priority"]
        
        print(f"#{item['id']} - {title}")
        print(f"   🏢 Empresa: {company}")
        print(f"   📊 Status: {state} | Prioridade: {priority}")
        print("-" * 40)
    
    # 4. Demonstrar filtros
    for company in companies:
        print(f"\n🔍 FILTRO POR EMPRESA: {company}")
        print("=" * 40)
        
        filtered_items = filter_by_company(processed_work_items, company)
        print(f"📊 Total encontrado: {len(filtered_items)} ATA(s)")
        
        for item in filtered_items:
            title = item["fields"]["System.Title"]
            state = item["fields"]["System.State"]
            print(f"  #{item['id']} - {title} ({state})")
    
    # 5. Demonstrar resposta da API
    print(f"\n🌐 EXEMPLO DE RESPOSTA DA API /api/companies:")
    print("=" * 50)
    api_response = {
        "companies": companies
    }
    print(json.dumps(api_response, indent=2, ensure_ascii=False))
    
    print(f"\n🌐 EXEMPLO DE RESPOSTA DA API /api/boards/my-work-items?company=TOTVS:")
    print("=" * 70)
    totvs_items = filter_by_company(processed_work_items, "TOTVS")
    api_response = {
        "work_items": totvs_items,
        "total_items": len(totvs_items),
        "message": f"Encontrados {len(totvs_items)} work items filtrados por empresa: TOTVS"
    }
    print(json.dumps(api_response, indent=2, ensure_ascii=False))
    
    print(f"\n✅ IMPLEMENTAÇÃO CONCLUÍDA!")
    print("=" * 30)
    print("🎯 Funcionalidades implementadas:")
    print("   • Extração automática de empresa do título")
    print("   • API /api/companies para listar empresas")
    print("   • Filtro por empresa nas APIs existentes")
    print("   • Interface web com select de empresa")
    print("   • Exibição de empresa nos cards")
    print("   • Filtro JavaScript em tempo real")

if __name__ == "__main__":
    main()