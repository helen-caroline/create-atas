#!/usr/bin/env python3

import sys
import os
sys.path.append('/Users/hcssantos/Desktop/Consultoria/Projects/create-atas')

from controllers.ata.azure_boards_controller import AzureBoardsController

def test_api():
    try:
        controller = AzureBoardsController()
        result = controller.get_sprint_and_work_items()
        
        print("=== RESULTADO DA API ===")
        print(f"Sprint: {result.get('sprint')}")
        print(f"Total work items: {len(result.get('work_items', []))}")
        
        if result.get('work_items'):
            print("\n=== PRIMEIRO WORK ITEM ===")
            first_item = result['work_items'][0]
            print(f"ID: {first_item.get('id')}")
            print(f"URL: {first_item.get('url')}")
            print(f"Fields keys: {list(first_item.get('fields', {}).keys())}")
            
            if 'fields' in first_item:
                fields = first_item['fields']
                print(f"Title: {fields.get('System.Title')}")
                print(f"State: {fields.get('System.State')}")
                print(f"WorkItemType: {fields.get('System.WorkItemType')}")
        
        if result.get('error'):
            print(f"Erro: {result['error']}")
            
    except Exception as e:
        print(f"Erro no teste: {e}")

if __name__ == "__main__":
    test_api()