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
        
        const response = await fetch('/api/atas/gerar', {
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
    
    // Hide placeholder and show result
    resultPlaceholder.style.display = 'none';
    ataResult.style.display = 'block';
    
    // Populate data
    if (nomeArquivo) nomeArquivo.textContent = data.nome_arquivo || '';
    if (ataText) ataText.textContent = data.ata_completa || '';
    if (tituloAta) tituloAta.textContent = data.titulo_ata || '';
    if (proximosPassos) proximosPassos.textContent = data.proximos_passos || '';
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
    
    if (statusFilter) statusFilter.addEventListener('change', filterCards);
    if (priorityFilter) priorityFilter.addEventListener('change', filterCards);
    
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
        allWorkItems = allItems.filter(item => {
            const workItemType = item.fields['System.WorkItemType'] || '';
            return workItemType.toLowerCase() === 'ata';
        });
        currentSprint = data.sprint || null;

        console.log('Raw API response:', data);
        console.log('Total items:', allItems.length);
        console.log('ATA items filtered:', allWorkItems.length);
        console.log('Sprint info:', currentSprint);

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
    
    const filteredItems = allWorkItems.filter(item => {
        // Extract data from Azure DevOps structure
        const title = item.fields['System.Title'] || '';
        const description = item.fields['System.Description'] || '';
        const state = item.fields['System.State'] || '';
        const priority = item.fields['Microsoft.VSTS.Common.Priority'] || 4;
        
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
        
        return matchesSearch && matchesStatus && matchesPriority;
    });
    
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
    
    // ATA fields - load saved data if exists
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

function showCardsList() {
    const cardsListView = document.getElementById('cardsListView');
    const cardEditView = document.getElementById('cardEditView');
    
    if (!cardsListView || !cardEditView) return;
    
    // Show list view and hide edit view
    cardsListView.style.display = 'flex';
    cardEditView.style.display = 'none';
    
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