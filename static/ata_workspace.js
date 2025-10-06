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

        // Store data globally with validation
        allWorkItems = Array.isArray(data.work_items) ? data.work_items : [];
        currentSprint = data.sprint || null;

        console.log('Raw API response:', data);
        console.log('Processed work items:', allWorkItems.length);
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
    document.getElementById('cardStatus').value = state;
    
    const priorityText = {
        1: 'Prioridade 1 (Alta)',
        2: 'Prioridade 2 (Média)', 
        3: 'Prioridade 3 (Baixa)',
        4: 'Prioridade 4 (Muito Baixa)'
    }[priority] || 'Prioridade 4 (Muito Baixa)';
    document.getElementById('cardPriority').value = priorityText;
    
    // ATA fields - load saved data if exists
    loadSavedATAData(card.id);
}

function loadSavedATAData(cardId) {
    // TODO: Load saved ATA data from backend/localStorage
    // For now, just set today's date as default
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('ataDate').value = today;
    
    // Clear other ATA fields
    document.getElementById('ataRequirement').value = '';
    document.getElementById('ataSummary').value = '';
    document.getElementById('ataNextSteps').value = '';
    document.getElementById('ataParticipants').value = '';
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
    const ataData = {
        card_id: currentEditingCard.id,
        ata_date: formData.get('ata_date'),
        ata_requirement: formData.get('ata_requirement'),
        ata_summary: formData.get('ata_summary'),
        ata_next_steps: formData.get('ata_next_steps'),
        ata_participants: formData.get('ata_participants')
    };
    
    try {
        // TODO: Implement API call to save ATA data
        // For now, just show success message
        console.log('Saving ATA data:', ataData);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        showToast('Informações da ATA salvas com sucesso!', 'success');
        showCardsList();
        
    } catch (error) {
        console.error('Erro ao salvar informações da ATA:', error);
        showToast('Erro ao salvar informações da ATA', 'error');
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