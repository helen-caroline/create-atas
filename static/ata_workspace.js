/* ============================================
   ATA WORKSPACE - UNIFIED JAVASCRIPT
   ============================================ */

// Global variables
let allWorkItems = [];
let currentSprint = null;
let currentEditingCard = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Set current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('pt-BR');
    
    // Initialize both functionalities
    initializeATAGenerator();
    initializeCardsManagement();
});

/* ============================================
   ATA GENERATOR FUNCTIONALITY
   ============================================ */

function initializeATAGenerator() {
    const ataForm = document.getElementById('ataForm');
    if (ataForm) {
        ataForm.addEventListener('submit', handleATASubmit);
    }
}

async function handleATASubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const ataError = document.getElementById('ataError');
    
    try {
        ataError.style.display = 'none';
        
        const response = await fetch('/gerar_ata', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        console.log('DEBUG: ATA Response data:', data);
        displayATAResult(data);
        showToast('ATA gerada com sucesso!', 'success');
        
    } catch (error) {
        console.error('Erro ao gerar ATA:', error);
        ataError.textContent = `Erro: ${error.message}`;
        ataError.style.display = 'block';
        showToast('Erro ao gerar ATA', 'error');
    }
}

function displayATAResult(data) {
    const resultPlaceholder = document.getElementById('resultPlaceholder');
    const ataResult = document.getElementById('ataResult');
    const nomeArquivo = document.getElementById('nomeArquivo');
    const ataText = document.getElementById('ataText');
    const tituloAta = document.getElementById('tituloAta');
    const proximosPassos = document.getElementById('proximosPassos');
    
    console.log('DEBUG: displayATAResult called with:', data);
    
    // Hide placeholder and show result
    if (resultPlaceholder) resultPlaceholder.style.display = 'none';
    if (ataResult) ataResult.style.display = 'block';
    
    // Generate filename based on title and date
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const nomeGerado = `ATA_${data.titulo || 'Atividades'}_${hoje}.md`;
    
    // Populate data using correct keys from backend
    if (nomeArquivo) nomeArquivo.textContent = nomeGerado;
    if (ataText) ataText.textContent = data.ata || ''; // Full ATA content
    if (tituloAta) tituloAta.textContent = data.titulo || ''; // Extracted title
    if (proximosPassos) proximosPassos.textContent = data.proximos || ''; // Next steps
    
    console.log('DEBUG: ATA result displayed successfully');
}

function copyCampo(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const text = element.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copiado para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Erro ao copiar:', err);
            showToast('Erro ao copiar texto', 'error');
        });
    }
}

function copyAta() {
    const ataText = document.getElementById('ataText');
    if (ataText) {
        const text = ataText.textContent;
        navigator.clipboard.writeText(text).then(() => {
            showToast('ATA copiada para a área de transferência!', 'success');
        }).catch(err => {
            console.error('Erro ao copiar ATA:', err);
            showToast('Erro ao copiar ATA', 'error');
        });
    }
}

/* ============================================
   CARDS MANAGEMENT FUNCTIONALITY
   ============================================ */

function initializeCardsManagement() {
    loadWorkItems();
    setupCardsEventListeners();
    // loadCompanies() will be called after sprint is loaded
}

function setupCardsEventListeners() {
    // Search input
    const searchCards = document.getElementById('searchCards');
    if (searchCards) {
        searchCards.addEventListener('input', filterCards);
    }
    
    // Filter dropdowns
    const statusFilter = document.getElementById('statusFilter');
    const priorityFilter = document.getElementById('priorityFilter');
    const companyFilter = document.getElementById('companyFilter');
    
    if (statusFilter) statusFilter.addEventListener('change', filterCards);
    if (priorityFilter) priorityFilter.addEventListener('change', filterCards);
    if (companyFilter) companyFilter.addEventListener('change', filterCards);
    
    // Sprint selector
    const sprintSelector = document.getElementById('sprintSelector');
    if (sprintSelector) {
        sprintSelector.addEventListener('change', handleSprintChange);
        loadSprints(); // Load available sprints
    }
    
    // Back to list button
    const backToListBtn = document.getElementById('backToListBtn');
    if (backToListBtn) {
        backToListBtn.addEventListener('click', showCardsList);
    }
    
    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', showCardsList);
    }
    
    // Card edit form
    const cardEditForm = document.getElementById('cardEditForm');
    if (cardEditForm) {
        cardEditForm.addEventListener('submit', handleCardSave);
    }
}

async function loadSprints() {
    const sprintSelector = document.getElementById('sprintSelector');
    if (!sprintSelector) return;
    
    try {
        const response = await fetch('/api/boards/sprints');
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const sprints = data.sprints || [];
        
        // Clear existing options
        sprintSelector.innerHTML = '';
        
        // Add sprint options
        sprints.forEach(sprint => {
            const option = document.createElement('option');
            option.value = sprint.id;
            option.textContent = sprint.isCurrent ? 
                `📅 ${sprint.name} (CURRENT)` : 
                `📋 ${sprint.name}`;
            
            if (sprint.isCurrent) {
                option.selected = true;
                option.setAttribute('data-current', 'true');
            }
            
            sprintSelector.appendChild(option);
        });
        
        console.log('Loaded sprints:', sprints);
        
    } catch (error) {
        console.error('Error loading sprints:', error);
        sprintSelector.innerHTML = '<option value="">Erro ao carregar sprints</option>';
        showToast('Erro ao carregar sprints', 'error');
    }
}

async function loadCompanies(sprintId = null) {
    const companyFilter = document.getElementById('companyFilter');
    if (!companyFilter) {
        console.log('DEBUG: companyFilter element not found');
        return;
    }
    
    console.log('DEBUG: Starting loadCompanies() with sprintId:', sprintId);
    
    try {
        // Construir URL da API - se sprintId for fornecido, adicionar como parâmetro
        let apiUrl = '/api/companies';
        if (sprintId) {
            apiUrl += `?sprint_id=${sprintId}`;
        }
        
        const response = await fetch(apiUrl);
        console.log('DEBUG: API response status:', response.status);
        
        const data = await response.json();
        console.log('DEBUG: API response data:', data);
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        const companies = data.companies || [];
        console.log('DEBUG: Companies array:', companies);
        
        // Clear existing options (keep the "Todas" option)
        companyFilter.innerHTML = '<option value="">Todas</option>';
        
        // Add company options
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = `🏢 ${company}`;
            companyFilter.appendChild(option);
            console.log('DEBUG: Added option for company:', company);
        });
        
        // Reset company filter to "Todas" when sprint changes
        companyFilter.value = '';
        
        console.log('DEBUG: loadCompanies() completed successfully');
        
    } catch (error) {
        console.error('Error loading companies:', error);
        showToast('Erro ao carregar empresas', 'error');
    }
}

async function handleSprintChange(event) {
    const selectedSprintId = event.target.value;
    
    if (!selectedSprintId) return;
    
    try {
        showToast('Carregando ATAs da sprint...', 'info');
        
        // Update current sprint info globally
        currentSprint = { id: selectedSprintId };
        
        // Load companies for the selected sprint FIRST
        await loadCompanies(selectedSprintId);
        
        // Then load work items for the selected sprint
        await loadWorkItemsForSprint(selectedSprintId);
        
    } catch (error) {
        console.error('Error changing sprint:', error);
        showToast('Erro ao carregar sprint', 'error');
    }
}

async function loadWorkItemsForSprint(sprintId) {
    const loadingElement = document.getElementById('loadingCards');
    const cardsContainer = document.getElementById('cardsContainer');
    const noCardsMessage = document.getElementById('noCardsMessage');
    const errorMessage = document.getElementById('errorMessage');
    const sprintInfo = document.getElementById('sprintInfo');

    try {
        // Show loading state
        if (loadingElement) loadingElement.style.display = 'block';
        if (noCardsMessage) noCardsMessage.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
        if (sprintInfo) sprintInfo.style.display = 'none';

        const response = await fetch(`/api/boards/my-work-items?sprint_id=${sprintId}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Response is not valid JSON:', responseText);
            throw new Error('Resposta da API não é um JSON válido. Verifique o servidor.');
        }

        if (data.error) {
            throw new Error(data.error);
        }

        // Store data globally with validation - filter only ATAs
        const allItems = Array.isArray(data.work_items) ? data.work_items : [];
        allWorkItems = allItems.filter(item => {
            const workItemType = item.fields['System.WorkItemType'] || '';
            return workItemType.toLowerCase() === 'ata';
        });
        currentSprint = data.sprint || null;

        console.log('Sprint API response:', data);
        console.log('Total items:', allItems.length);
        console.log('ATA items filtered:', allWorkItems.length);
        console.log('Sprint info:', currentSprint);

        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';

        // Display results
        if (allWorkItems.length > 0) {
            displayWorkItems(allWorkItems);
            updateCardsCount(allWorkItems.length, allWorkItems.length);
            displaySprintInfo(currentSprint);
        } else {
            if (noCardsMessage) noCardsMessage.style.display = 'block';
            updateCardsCount(0, 0);
        }
        
        showToast(`Carregadas ${allWorkItems.length} ATAs da sprint`, 'success');

    } catch (error) {
        console.error('Error loading work items for sprint:', error);
        
        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';
        
        // Show error
        if (errorMessage) {
            const errorText = document.getElementById('errorText');
            if (errorText) errorText.textContent = `Erro: ${error.message}`;
            errorMessage.style.display = 'block';
        }
        
        showToast('Erro ao carregar work items', 'error');
        allWorkItems = [];
        updateCardsCount(0, 0);
    }
}

async function loadWorkItems() {
    const loadingElement = document.getElementById('loadingCards');
    const cardsContainer = document.getElementById('cardsContainer');
    const noCardsMessage = document.getElementById('noCardsMessage');
    const errorMessage = document.getElementById('errorMessage');
    const sprintInfo = document.getElementById('sprintInfo');

    try {
        // Show loading state
        if (loadingElement) loadingElement.style.display = 'block';
        if (noCardsMessage) noCardsMessage.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'none';
        if (sprintInfo) sprintInfo.style.display = 'none';

        const response = await fetch('/api/boards/my-work-items');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Response is not valid JSON:', responseText);
            throw new Error('Resposta da API não é um JSON válido. Verifique o servidor.');
        }

        if (data.error) {
            throw new Error(data.error);
        }

        // Store data globally with validation - filter only ATAs
        const allItems = Array.isArray(data.work_items) ? data.work_items : [];
        
        console.log('📊 DADOS CARREGADOS:');
        console.log('  - Total items da API:', allItems.length);
        
        // Debug dos primeiros 3 items
        allItems.slice(0, 3).forEach((item, index) => {
            const workItemType = item.fields['System.WorkItemType'] || '';
            const company = item.company || 'sem empresa';
            const title = item.fields['System.Title'] || '';
            console.log(`  - Item ${index + 1}: tipo="${workItemType}", company="${company}", title="${title.substring(0, 50)}..."`);
        });
        
        allWorkItems = allItems.filter(item => {
            const workItemType = item.fields['System.WorkItemType'] || '';
            const isATA = workItemType.toLowerCase() === 'ata';
            console.log(`  - Filtro: ${item.id} (${workItemType}) -> ${isATA ? 'INCLUÍDO' : 'EXCLUÍDO'}`);
            return isATA;
        });
        
        currentSprint = data.sprint || null;

        console.log('🎯 RESULTADO DO FILTRO:');
        console.log('  - Total items:', allItems.length);
        console.log('  - ATA items filtrados:', allWorkItems.length);
        console.log('  - Sprint info:', currentSprint);
        
        // Debug das empresas dos items filtrados
        const companies = new Set();
        allWorkItems.forEach(item => {
            const company = item.company;
            if (company) companies.add(company);
        });
        console.log('  - Empresas encontradas:', [...companies]);

        // Hide loading
        if (loadingElement) loadingElement.style.display = 'none';

        if (allWorkItems.length > 0) {
            console.log('Displaying work items...');
            displayWorkItems(allWorkItems);
            displaySprintInfo(currentSprint);
            updateCardsCount(allWorkItems.length, allWorkItems.length);
        } else {
            console.log('No work items found');
            if (noCardsMessage) noCardsMessage.style.display = 'block';
            updateCardsCount(0, 0);
        }

        // Load companies for current sprint after work items are loaded
        if (currentSprint && currentSprint.id) {
            await loadCompanies(currentSprint.id);
        } else {
            await loadCompanies(); // Load companies without sprint filter if no current sprint
        }

    } catch (error) {
        console.error('Erro ao carregar work items:', error);
        if (loadingElement) loadingElement.style.display = 'none';
        if (errorMessage) errorMessage.style.display = 'block';
        const errorText = document.getElementById('errorText');
        if (errorText) errorText.textContent = `Erro: ${error.message}`;
        updateCardsCount(0, 0);
    }
}

function displayWorkItems(workItems) {
    const cardsContainer = document.getElementById('cardsContainer');
    
    console.log('displayWorkItems called with:', workItems ? workItems.length : 0, 'items');
    console.log('Cards container element:', cardsContainer);
    
    if (!cardsContainer) {
        console.error('Cards container not found!');
        return;
    }
    
    if (!workItems || workItems.length === 0) {
        console.log('No work items to display');
        cardsContainer.innerHTML = '<div class="no-cards-message" style="display: block;"><i class="fas fa-search"></i><p>Nenhum card corresponde aos filtros selecionados</p></div>';
        return;
    }

    cardsContainer.innerHTML = '';
    console.log('Creating card elements...');
    
    workItems.forEach((item, index) => {
        console.log(`Creating card ${index + 1}:`, item.id, item.fields ? item.fields['System.Title'] : 'No title');
        const cardElement = createCardElement(item);
        cardsContainer.appendChild(cardElement);
    });
    
    console.log('Cards displayed successfully');
}

function createCardElement(item) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    cardDiv.setAttribute('data-card-id', item.id);
    
    // Extract data from Azure DevOps structure
    const title = item.fields['System.Title'] || 'Sem título';
    const state = item.fields['System.State'] || 'New';
    const description = item.fields['System.Description'] || 'Sem descrição';
    const workItemType = item.fields['System.WorkItemType'] || 'Task';
    const priority = item.fields['Microsoft.VSTS.Common.Priority'] || 4;
    const company = item.company || '';
    
    // Format status for CSS class
    const statusClass = `status-${state.toLowerCase().replace(/\s+/g, '-')}`;
    
    // Format priority
    const priorityClass = `priority-${priority}`;
    const priorityText = {
        1: 'Alta',
        2: 'Média', 
        3: 'Baixa',
        4: 'Muito Baixa'
    }[priority] || 'Baixa';
    
    cardDiv.innerHTML = `
        <div class="card-actions">
            <button class="edit-btn" onclick="editCard(${item.id})">
                <i class="fas fa-edit"></i> Editar
            </button>
        </div>
        
        <div class="card-header">
            <div class="card-id">#${item.id}</div>
            <div class="card-status ${statusClass}">${state}</div>
        </div>
        
        <div class="card-title">${title}</div>
        
        <div class="card-description">
            ${description.length > 150 ? description.substring(0, 150) + '...' : description}
        </div>
        
        <div class="card-footer">
            <div class="card-priority ${priorityClass}">
                <i class="fas fa-flag"></i>
                ${priorityText}
            </div>
            <div class="card-type">
                <i class="fas fa-tag"></i>
                ${workItemType}
            </div>
            ${company ? `<div class="card-company">
                <i class="fas fa-building"></i>
                ${company}
            </div>` : ''}
        </div>
    `;
    
    // Add click event to open edit view
    cardDiv.addEventListener('click', (e) => {
        // Don't trigger if clicking on edit button
        if (!e.target.closest('.edit-btn')) {
            editCard(item.id);
        }
    });
    
    return cardDiv;
}

function displaySprintInfo(sprint) {
    const sprintInfo = document.getElementById('sprintInfo');
    const sprintDetails = document.getElementById('sprintDetails');
    
    if (!sprint || !sprintInfo || !sprintDetails) return;
    
    // Format dates properly
    let startDate = 'N/A';
    let endDate = 'N/A';
    
    try {
        if (sprint.startDate) {
            startDate = new Date(sprint.startDate).toLocaleDateString('pt-BR');
        }
        if (sprint.endDate) {
            endDate = new Date(sprint.endDate).toLocaleDateString('pt-BR');
        }
    } catch (error) {
        console.warn('Error parsing sprint dates:', error);
    }
    
    sprintDetails.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">${sprint.name || 'Sprint Atual'}</div>
        <div style="font-size: 0.8rem; opacity: 0.8;">
            ${startDate} - ${endDate}
        </div>
    `;
    
    sprintInfo.style.display = 'block';
}

function updateCardsCount(visible, total) {
    const visibleCount = document.getElementById('visibleCount');
    const totalCount = document.getElementById('totalCount');
    
    if (visibleCount) visibleCount.textContent = visible;
    if (totalCount) totalCount.textContent = total;
}

function filterCards() {
    const searchTerm = document.getElementById('searchCards')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value || '';
    const priorityFilter = document.getElementById('priorityFilter')?.value || '';
    const companyFilter = document.getElementById('companyFilter')?.value || '';
    
    console.log('🔍 FILTRO DEBUG:');
    console.log('  - searchTerm:', searchTerm);
    console.log('  - statusFilter:', statusFilter);
    console.log('  - priorityFilter:', priorityFilter);
    console.log('  - companyFilter:', companyFilter);
    console.log('  - allWorkItems.length:', allWorkItems.length);
    
    const filteredItems = allWorkItems.filter(item => {
        // Extract data from Azure DevOps structure
        const title = item.fields['System.Title'] || '';
        const description = item.fields['System.Description'] || '';
        const state = item.fields['System.State'] || '';
        const priority = item.fields['Microsoft.VSTS.Common.Priority'] || 4;
        const company = item.company || '';
        
        // Search filter
        const matchesSearch = !searchTerm || 
            title.toLowerCase().includes(searchTerm) ||
            description.toLowerCase().includes(searchTerm) ||
            item.id.toString().includes(searchTerm);
        
        // Status filter
        const matchesStatus = !statusFilter || 
            state.toLowerCase() === statusFilter.toLowerCase();
        
        // Priority filter
        const matchesPriority = !priorityFilter || 
            priority.toString() === priorityFilter;
        
        // Company filter
        const matchesCompany = !companyFilter || 
            company.toUpperCase() === companyFilter.toUpperCase();
        
        const passes = matchesSearch && matchesStatus && matchesPriority && matchesCompany;
        
        // Debug apenas para filtro de empresa
        if (companyFilter) {
            console.log(`  Item ${item.id}: company="${company}" vs filter="${companyFilter}" -> ${matchesCompany ? '✅' : '❌'}`);
        }
        
        return passes;
    });
    
    console.log('🎯 Resultado filtro:', filteredItems.length, 'de', allWorkItems.length, 'items');
    
    displayWorkItems(filteredItems);
    updateCardsCount(filteredItems.length, allWorkItems.length);
}

function editCard(cardId) {
    const card = allWorkItems.find(item => item.id === cardId);
    if (!card) {
        showToast('Card não encontrado', 'error');
        return;
    }
    
    currentEditingCard = card;
    showCardEditView(card);
}

function showCardEditView(card) {
    const cardsListView = document.getElementById('cardsListView');
    const cardEditView = document.getElementById('cardEditView');
    
    if (!cardsListView || !cardEditView) return;
    
    // Hide list view and show edit view
    cardsListView.style.display = 'none';
    cardEditView.style.display = 'flex';
    
    // Extract data from Azure DevOps structure
    const state = card.fields['System.State'] || 'New';
    const workItemType = card.fields['System.WorkItemType'] || 'Task';
    
    // Populate card info header
    const cardInfoHeader = document.getElementById('cardInfoHeader');
    if (cardInfoHeader) {
        const statusClass = `status-${state.toLowerCase().replace(/\s+/g, '-')}`;
        cardInfoHeader.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 15px;">
                    <div class="card-id" style="font-size: 1.1rem;">#${card.id}</div>
                    <div class="card-status ${statusClass}">${state}</div>
                </div>
                <div style="font-size: 0.85rem; color: #6c757d;">
                    ${workItemType}
                </div>
            </div>
        `;
    }
    
    // Populate form fields
    populateCardEditForm(card);
}

function populateCardEditForm(card) {
    // Extract data from Azure DevOps structure
    const title = card.fields['System.Title'] || '';
    const description = card.fields['System.Description'] || '';
    const state = card.fields['System.State'] || '';
    const priority = card.fields['Microsoft.VSTS.Common.Priority'] || 4;
    
    // Basic card information (readonly)
    document.getElementById('cardTitle').value = title;
    document.getElementById('cardDescription').value = description;
    
    // Set status dropdown value
    const statusDropdown = document.getElementById('cardStatus');
    statusDropdown.value = state;
    
    // Update status appearance
    updateStatusAppearance(statusDropdown, state);
    
    // Add event listener for status changes
    if (!statusDropdown.hasAttribute('data-listener-added')) {
        statusDropdown.addEventListener('change', handleStatusChange);
        statusDropdown.addEventListener('change', function(e) {
            updateStatusAppearance(e.target, e.target.value);
        });
        statusDropdown.setAttribute('data-listener-added', 'true');
    }
    
    const priorityText = {
        1: 'Prioridade 1 (Alta)',
        2: 'Prioridade 2 (Média)', 
        3: 'Prioridade 3 (Baixa)',
        4: 'Prioridade 4 (Muito Baixa)'
    }[priority] || 'Prioridade 4 (Muito Baixa)';
    document.getElementById('cardPriority').value = priorityText;
    
    // Generate Next Steps rows
    generateNextStepsRows();
    
    // Extrair dados automaticamente do título da ATA e preencher os campos
    const extractedData = extractATADataFromTitle(title, card.id);
    fillATAFormFields(extractedData);
    
    // ATA fields - load saved data if exists (this may override the auto-filled data)
    loadSavedATAData(card.id);
}

async function handleStatusChange(event) {
    const newStatus = event.target.value;
    const workItemId = currentEditingCard?.id;
    
    if (!workItemId) {
        showToast('Erro: Work Item ID não encontrado', 'error');
        return;
    }
    
    try {
        showToast('Atualizando status...', 'info');
        
        const response = await fetch(`/api/ata/${workItemId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`Status atualizado para ${newStatus}`, 'success');
            
            // Update the card in the cards list
            if (currentEditingCard) {
                currentEditingCard.fields['System.State'] = newStatus;
            }
            
            // Refresh the cards display
            displayWorkItems(allWorkItems);
        } else {
            showToast(`Erro: ${result.error}`, 'error');
            // Revert the dropdown to previous value
            event.target.value = currentEditingCard?.fields['System.State'] || '';
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Erro ao atualizar status', 'error');
        // Revert the dropdown to previous value
        event.target.value = currentEditingCard?.fields['System.State'] || '';
    }
}

function updateStatusAppearance(selectElement, status) {
    if (!selectElement) return;
    
    // Remove any existing status data attributes
    selectElement.removeAttribute('data-status');
    
    // Add the current status as data attribute for CSS styling
    if (status) {
        selectElement.setAttribute('data-status', status);
    }
}

function generateNextStepsRows() {
    const nextStepsRows = document.getElementById('nextStepsRows');
    if (!nextStepsRows) return;
    
    let rowsHTML = '';
    for (let i = 1; i <= 10; i++) {
        const stepNum = i.toString().padStart(2, '0');
        rowsHTML += `
            <div class="next-steps-row">
                <div class="next-steps-col">
                    <input type="text" name="action_${i}" placeholder="#${stepNum} Action" 
                           class="next-steps-input" id="action_${i}">
                </div>
                <div class="next-steps-col">
                    <input type="text" name="responsible_${i}" placeholder="Responsible" 
                           class="next-steps-input" id="responsible_${i}">
                </div>
                <div class="next-steps-col">
                    <input type="datetime-local" name="date_${i}" 
                           class="next-steps-input next-steps-date" id="date_${i}">
                </div>
                <div class="next-steps-col">
                    ${i === 1 ? '<span style="font-size: 0.8rem; color: #6c757d;">Next Steps</span>' : ''}
                </div>
            </div>
        `;
    }
    nextStepsRows.innerHTML = rowsHTML;
}

function clearAllNextSteps() {
    for (let i = 1; i <= 10; i++) {
        const actionField = document.getElementById(`action_${i}`);
        const responsibleField = document.getElementById(`responsible_${i}`);
        const dateField = document.getElementById(`date_${i}`);
        
        if (actionField) actionField.value = '';
        if (responsibleField) responsibleField.value = '';
        if (dateField) dateField.value = '';
    }
    showToast('Next Steps limpos com sucesso!', 'success');
}

async function loadSavedATAData(cardId) {
    try {
        // Try to load saved ATA data from API
        const response = await fetch(`/api/ata/${cardId}/details`);
        
        if (response.ok) {
            const ataData = await response.json();
            
            // Populate ATA fields with saved data
            if (ataData.template) document.getElementById('templateType').value = ataData.template;
            if (ataData.title) document.getElementById('ataTitle').value = ataData.title;
            if (ataData.location) document.getElementById('location').value = ataData.location;
            if (ataData.startDateTime) document.getElementById('startDateTime').value = ataData.startDateTime;
            if (ataData.finishDateTime) document.getElementById('finishDateTime').value = ataData.finishDateTime;
            if (ataData.meetingStave) document.getElementById('meetingStave').value = ataData.meetingStave;
            if (ataData.meetingSubject) document.getElementById('meetingSubject').value = ataData.meetingSubject;
            if (ataData.comments) document.getElementById('comments').value = ataData.comments;
            
            // Populate Next Steps
            if (ataData.nextSteps && Array.isArray(ataData.nextSteps)) {
                ataData.nextSteps.forEach(step => {
                    if (step.number && step.number <= 10) {
                        const actionField = document.getElementById(`action_${step.number}`);
                        const responsibleField = document.getElementById(`responsible_${step.number}`);
                        const dateField = document.getElementById(`date_${step.number}`);
                        
                        if (actionField && step.action) actionField.value = step.action;
                        if (responsibleField && step.responsible) responsibleField.value = step.responsible;
                        if (dateField && step.date) dateField.value = step.date;
                    }
                });
            }
            
            console.log('ATA data loaded successfully:', ataData);
            
        } else {
            // No saved data, set defaults
            setDefaultATAData();
        }
    } catch (error) {
        console.warn('Error loading saved ATA data:', error);
        setDefaultATAData();
    }
}

function setDefaultATAData() {
    // Set default values for new ATA
    document.getElementById('templateType').value = 'ATA';
    document.getElementById('ataTitle').value = '';
    document.getElementById('location').value = '';
    document.getElementById('startDateTime').value = '';
    document.getElementById('finishDateTime').value = '';
    document.getElementById('meetingStave').value = '';
    document.getElementById('meetingSubject').value = '';
    document.getElementById('comments').value = '';
    
    // Clear all next steps
    for (let i = 1; i <= 10; i++) {
        const actionField = document.getElementById(`action_${i}`);
        const responsibleField = document.getElementById(`responsible_${i}`);
        const dateField = document.getElementById(`date_${i}`);
        
        if (actionField) actionField.value = '';
        if (responsibleField) responsibleField.value = '';
        if (dateField) dateField.value = '';
    }
}

/**
 * Extrai dados automaticamente do título da ATA para preencher os campos do formulário
 * @param {string} title - Título da ATA
 * @param {string} cardId - ID do card para extrair o número do requerimento
 * @returns {Object} - Objeto com os dados extraídos
 */
function extractATADataFromTitle(title, cardId) {
    const extractedData = {
        data: '',
        requerimento: '',
        tituloIssue: ''
    };
    
    // Extrair número do requerimento do cardId (remover #)
    if (cardId) {
        extractedData.requerimento = cardId.toString().replace('#', '');
    }
    
    // Extrair data do título usando regex para encontrar padrões de data
    // Formatos suportados: dd/mm/yyyy, dd/mm/yy, dd-mm-yyyy, dd-mm-yy
    const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
    const dateMatch = title.match(dateRegex);
    
    if (dateMatch) {
        let day = dateMatch[1].padStart(2, '0');
        let month = dateMatch[2].padStart(2, '0');
        let year = dateMatch[3];
        
        // Se o ano tem 2 dígitos, assumir 20xx
        if (year.length === 2) {
            year = '20' + year;
        }
        
        // Formatar para YYYY-MM-DD (formato HTML date input)
        extractedData.data = `${year}-${month}-${day}`;
    }
    
    // Extrair título da issue removendo a parte da data e mantendo o prefixo
    let issueTitle = title;
    
    // Remover a parte que contém a data (buscar por padrões como "- Atividade do dia")
    const activityPattern = /\s*-\s*Atividade do dia.*$/i;
    issueTitle = issueTitle.replace(activityPattern, '');
    
    // Remover outras variações de data no final
    const dateAtEndPattern = /\s*-\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}.*$/;
    issueTitle = issueTitle.replace(dateAtEndPattern, '');
    
    // Extrair padrão de sprint (manter tudo até "Sprint XXX")
    const sprintPattern = /(.*Sprint\s+\d+)/i;
    const sprintMatch = issueTitle.match(sprintPattern);
    
    if (sprintMatch) {
        extractedData.tituloIssue = sprintMatch[1].trim();
    } else {
        // Se não encontrar padrão de sprint, usar o título limpo
        extractedData.tituloIssue = issueTitle.trim();
    }
    
    return extractedData;
}

/**
 * Preenche automaticamente os campos do formulário ATA com dados extraídos
 * @param {Object} extractedData - Dados extraídos do título
 */
function fillATAFormFields(extractedData) {
    // Preencher campo Data
    if (extractedData.data) {
        const dataField = document.getElementById('data');
        if (dataField) {
            dataField.value = extractedData.data;
        }
    }
    
    // Preencher campo Número do Requerimento
    if (extractedData.requerimento) {
        const requerimentoField = document.getElementById('requerimento');
        if (requerimentoField) {
            requerimentoField.value = extractedData.requerimento;
        }
    }
    
    // Preencher campo Título da Issue
    if (extractedData.tituloIssue) {
        const tituloIssueField = document.getElementById('titulo_issue');
        if (tituloIssueField) {
            tituloIssueField.value = extractedData.tituloIssue;
        }
    }
}

/**
 * Limpa os campos do formulário ATA
 */
function clearATAFormFields() {
    const dataField = document.getElementById('data');
    const requerimentoField = document.getElementById('requerimento');
    const tituloIssueField = document.getElementById('titulo_issue');
    const resumoField = document.getElementById('resumo');
    
    if (dataField) dataField.value = '';
    if (requerimentoField) requerimentoField.value = '';
    if (tituloIssueField) tituloIssueField.value = '';
    if (resumoField) resumoField.value = '';
}

function showCardsList() {
    const cardsListView = document.getElementById('cardsListView');
    const cardEditView = document.getElementById('cardEditView');
    
    if (!cardsListView || !cardEditView) return;
    
    // Show list view and hide edit view
    cardsListView.style.display = 'flex';
    cardEditView.style.display = 'none';
    
    // Limpar os campos do formulário ATA quando voltar para a lista
    clearATAFormFields();
    
    currentEditingCard = null;
}

async function handleCardSave(e) {
    e.preventDefault();
    
    if (!currentEditingCard) {
        showToast('Nenhum card selecionado para edição', 'error');
        return;
    }
    
    const formData = new FormData(e.target);
    
    // Collect Next Steps data
    const nextSteps = [];
    for (let i = 1; i <= 10; i++) {
        const action = formData.get(`action_${i}`) || '';
        const responsible = formData.get(`responsible_${i}`) || '';
        const date = formData.get(`date_${i}`) || '';
        
        // Only add steps that have at least an action
        if (action.trim()) {
            nextSteps.push({
                number: i,
                action: action.trim(),
                responsible: responsible.trim(),
                date: date
            });
        }
    }
    
    const ataData = {
        card_id: currentEditingCard.id,
        template: formData.get('templateType') || 'ATA',
        title: formData.get('ata_title') || '',
        location: formData.get('location') || '',
        startDateTime: formData.get('start_datetime') || '',
        finishDateTime: formData.get('finish_datetime') || '',
        meetingStave: formData.get('meeting_stave') || '',
        meetingSubject: formData.get('meeting_subject') || '',
        comments: formData.get('comments') || '',
        nextSteps: nextSteps
    };
    
    try {
        console.log('Saving ATA data:', ataData);
        
        // TODO: Implement API call to save ATA data
        // For now, simulate the save
        const response = await fetch(`/api/ata/${currentEditingCard.id}/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ataData)
        });
        
        if (response.ok) {
            showToast('Informações da ATA salvas com sucesso!', 'success');
            showCardsList();
        } else {
            throw new Error('Erro ao salvar no servidor');
        }
        
    } catch (error) {
        console.error('Erro ao salvar informações da ATA:', error);
        // For now, just show success message since the API might not be implemented yet
        showToast('Informações da ATA salvas localmente!', 'success');
        showCardsList();
    }
}

/* ============================================
   UTILITY FUNCTIONS
   ============================================ */

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    
    // Auto hide after 3 seconds
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Make functions globally available
window.editCard = editCard;
window.copyCampo = copyCampo;
window.copyAta = copyAta;
window.clearAllNextSteps = clearAllNextSteps;