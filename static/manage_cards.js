/* ============================================
   MANAGE CARDS - DEDICATED JAVASCRIPT
   ============================================ */

// Global variables
let allWorkItems = [];
let currentSprint = null;

// Load cards on page load
document.addEventListener('DOMContentLoaded', function() {
    loadWorkItems();
    setupEventListeners();
});

function setupEventListeners() {
    // Search input
    document.getElementById('searchCards').addEventListener('input', filterCards);
    
    // Filter dropdowns
    document.getElementById('typeFilter').addEventListener('change', filterCards);
    document.getElementById('statusFilter').addEventListener('change', filterCards);
    document.getElementById('priorityFilter').addEventListener('change', filterCards);
}

async function loadWorkItems() {
    const loadingElement = document.getElementById('loadingCards');
    const cardsContainer = document.getElementById('cardsContainer');
    const noCardsMessage = document.getElementById('noCardsMessage');
    const errorMessage = document.getElementById('errorMessage');
    const sprintInfo = document.getElementById('sprintInfo');

    try {
        // Show loading state
        loadingElement.style.display = 'block';
        noCardsMessage.style.display = 'none';
        errorMessage.style.display = 'none';
        sprintInfo.style.display = 'none';

        const response = await fetch('/api/boards/my-work-items');
        
        // Check if response is ok
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get response text first to check if it's JSON
        const responseText = await response.text();
        let data;
        
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('Response is not valid JSON:', responseText);
            throw new Error('Resposta da API não é um JSON válido. Verifique o servidor.');
        }

        // Check if response contains error
        if (data.error) {
            throw new Error(data.error);
        }

        // Store data globally with validation
        allWorkItems = Array.isArray(data.work_items) ? data.work_items : [];
        currentSprint = data.sprint || null;

        // Hide loading
        loadingElement.style.display = 'none';

        if (allWorkItems.length > 0) {
            console.log('Loaded work items:', allWorkItems.length);
            displayWorkItems(allWorkItems);
            displaySprintInfo(currentSprint);
            updateCardsCount(allWorkItems.length, allWorkItems.length);
        } else {
            console.log('No work items found');
            noCardsMessage.style.display = 'block';
            updateCardsCount(0, 0);
        }

    } catch (error) {
        console.error('Erro ao carregar work items:', error);
        loadingElement.style.display = 'none';
        errorMessage.style.display = 'block';
        document.getElementById('errorText').textContent = `Erro: ${error.message}`;
        updateCardsCount(0, 0);
    }
}

function displayWorkItems(workItems) {
    const cardsContainer = document.getElementById('cardsContainer');
    
    console.log('displayWorkItems called with:', workItems);
    
    if (!workItems || workItems.length === 0) {
        console.log('No work items to display');
        cardsContainer.innerHTML = '<div class="no-cards-message" style="display: block;"><i class="fas fa-search"></i><p>Nenhum card corresponde aos filtros selecionados</p></div>';
        return;
    }

    // Filter out invalid items but be more lenient
    const validWorkItems = workItems.filter(item => {
        const isValid = item && (item.fields || item.id);
        if (!isValid) {
            console.warn('Invalid work item filtered out:', item);
        }
        return isValid;
    });
    
    console.log('Valid work items:', validWorkItems.length, 'out of', workItems.length);
    
    if (validWorkItems.length === 0) {
        console.error('No valid work items found after filtering');
        cardsContainer.innerHTML = '<div class="no-cards-message" style="display: block;"><i class="fas fa-exclamation-triangle"></i><p>Dados dos work items inválidos</p><small>Verifique o console para mais detalhes</small></div>';
        return;
    }

    const cardsHTML = validWorkItems.map((item, index) => {
        try {
            return createWorkItemCard(item);
        } catch (error) {
            console.error(`Erro ao criar card ${index}:`, error, item);
            return ''; // Return empty string for failed cards
        }
    }).filter(html => html !== ''); // Remove empty cards
    
    console.log('Generated', cardsHTML.length, 'card HTML elements');
    cardsContainer.innerHTML = cardsHTML.join('');
}

function createWorkItemCard(item) {
    // Validate item structure
    if (!item || !item.fields) {
        console.warn('Invalid work item:', item);
        return '';
    }

    const fields = item.fields;
    const workItemType = determineWorkItemType(item);
    const priority = fields['Microsoft.VSTS.Common.Priority'];
    const priorityText = getPriorityText(priority);
    const status = fields['System.State'] || 'N/A';
    const statusClass = getStatusClass(status);
    const priorityClass = getPriorityClass(priority);
    const typeClass = getTypeClass(workItemType);
    const title = fields['System.Title'] || 'Sem título';
    const description = fields['System.Description'];
    const createdDate = fields['System.CreatedDate'];
    const assignedTo = fields['System.AssignedTo'];
    
    return `
        <div class="work-item-card" data-id="${item.id || 'unknown'}">
            <div class="card-header">
                <span class="card-id">#${item.id || 'N/A'}</span>
                <a href="${item.url || '#'}" target="_blank" class="card-link">
                    <i class="fas fa-external-link-alt"></i> Abrir
                </a>
            </div>
            
            <h4 class="card-title">${escapeHtml(title)}</h4>
            
            <div class="card-description">
                ${description ? escapeHtml(stripHtml(description).substring(0, 150)) + '...' : 'Sem descrição'}
            </div>
            
            <div class="card-meta">
                <span class="card-tag card-type ${typeClass}">${workItemType}</span>
                <span class="card-tag status ${statusClass}">${status}</span>
                ${priority ? `<span class="card-tag priority ${priorityClass}">${priorityText}</span>` : ''}
            </div>
            
            <div class="card-footer">
                <div class="card-date">
                    <i class="fas fa-calendar-alt"></i>
                    ${formatDate(createdDate)}
                </div>
                <div class="card-assignee">
                    ${assignedTo ? escapeHtml(assignedTo.displayName || assignedTo.uniqueName || 'Usuário') : 'Não atribuído'}
                </div>
            </div>
        </div>
    `;
}

function determineWorkItemType(item) {
    if (!item || !item.fields) {
        return 'Task';
    }

    const title = (item.fields['System.Title'] || '').toLowerCase();
    const workItemType = (item.fields['System.WorkItemType'] || '').toLowerCase();
    
    // Check for ATA in title or work item type
    if (title.includes('ata') || title.includes('[ata]') || workItemType.includes('ata')) {
        return 'ATA';
    }
    
    // Check for Task
    if (title.includes('task') || title.includes('[task]') || workItemType.includes('task')) {
        return 'Task';
    }
    
    // Check for Bug
    if (title.includes('bug') || workItemType.includes('bug')) {
        return 'Bug';
    }
    
    // Check for Feature
    if (title.includes('feature') || workItemType.includes('feature')) {
        return 'Feature';
    }
    
    // Default based on work item type
    return capitalizeFirst(workItemType) || 'Task';
}

function getTypeClass(type) {
    const typeMap = {
        'ata': 'ata',
        'task': 'task',
        'bug': 'bug',
        'feature': 'feature'
    };
    return typeMap[type.toLowerCase()] || 'task';
}

function getStatusClass(status) {
    if (!status) return '';
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('active') || statusLower.includes('doing') || statusLower.includes('progress')) {
        return 'active';
    } else if (statusLower.includes('proposed') || statusLower.includes('new')) {
        return 'proposed';
    } else if (statusLower.includes('resolved') || statusLower.includes('done')) {
        return 'resolved';
    } else if (statusLower.includes('closed')) {
        return 'closed';
    }
    
    return statusLower.replace(/\s+/g, '-');
}

function getPriorityClass(priority) {
    if (!priority) return '';
    return `priority-${priority}`;
}

function getPriorityText(priority) {
    const priorityMap = {
        1: 'Prioridade 1 (Alta)',
        2: 'Prioridade 2 (Média)',
        3: 'Prioridade 3 (Baixa)',
        4: 'Prioridade 4 (Muito Baixa)'
    };
    return priorityMap[priority] || `Prioridade ${priority}`;
}

function displaySprintInfo(sprint) {
    if (!sprint) return;

    const sprintInfo = document.getElementById('sprintInfo');
    const sprintDetails = document.getElementById('sprintDetails');

    sprintDetails.innerHTML = `
        <h4>Sprint Ativa</h4>
        <p><strong>Nome:</strong> ${escapeHtml(sprint.name)}</p>
        <p><strong>Período:</strong> ${formatDate(sprint.startDate)} - ${formatDate(sprint.endDate)}</p>
        <p><strong>Caminho:</strong> ${escapeHtml(sprint.path)}</p>
    `;

    sprintInfo.style.display = 'block';
}

function filterCards() {
    const searchTerm = document.getElementById('searchCards').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value.toLowerCase();
    const priorityFilter = document.getElementById('priorityFilter').value;

    const filteredItems = allWorkItems.filter(item => {
        // Validate item structure
        if (!item || !item.fields) {
            return false;
        }

        // Search in title and description
        const title = (item.fields['System.Title'] || '').toLowerCase();
        const description = (item.fields['System.Description'] || '').toLowerCase();
        const matchesSearch = !searchTerm || title.includes(searchTerm) || description.includes(searchTerm);

        // Type filter
        const itemType = determineWorkItemType(item).toLowerCase();
        const matchesType = !typeFilter || itemType === typeFilter;

        // Status filter
        const itemStatus = (item.fields['System.State'] || '').toLowerCase();
        const matchesStatus = !statusFilter || itemStatus.includes(statusFilter);

        // Priority filter
        const itemPriority = item.fields['Microsoft.VSTS.Common.Priority'];
        const matchesPriority = !priorityFilter || itemPriority == priorityFilter;

        return matchesSearch && matchesType && matchesStatus && matchesPriority;
    });

    displayWorkItems(filteredItems);
    updateCardsCount(filteredItems.length, allWorkItems.length);
}

function updateCardsCount(visible, total) {
    document.getElementById('visibleCount').textContent = visible;
    document.getElementById('totalCount').textContent = total;
}

// Utility functions
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function capitalizeFirst(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export functions for potential future use
window.ManageCards = {
    loadWorkItems,
    filterCards,
    updateCardsCount
};