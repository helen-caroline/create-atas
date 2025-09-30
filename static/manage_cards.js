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

    // Group work items hierarchically: Tasks as parents, ATAs as children
    const groupedItems = groupWorkItemsHierarchically(validWorkItems);
    
    // Generate hierarchical HTML
    const hierarchicalHTML = generateHierarchicalHTML(groupedItems);
    
    console.log('Generated hierarchical structure');
    cardsContainer.innerHTML = hierarchicalHTML;
}

function groupWorkItemsHierarchically(workItems) {
    const totvs = [];
    const rotinas = [];
    const others = [];
    
    // Separate items by category
    workItems.forEach(item => {
        const title = (item.fields['System.Title'] || '').toLowerCase();
        if (title.includes('totvs')) {
            totvs.push(item);
        } else if (title.includes('daily') || title.includes('planning') || title.includes('review')) {
            rotinas.push(item);
        } else {
            others.push(item);
        }
    });
    
    console.log('Grouped items - TOTVS:', totvs.length, 'Rotinas:', rotinas.length, 'Others:', others.length);
    
    const grouped = [];
    
    // Create TOTVS section if there are TOTVS items
    if (totvs.length > 0) {
        const totvsGrouped = groupTOTVSItems(totvs);
        
        grouped.push({
            parent: {
                id: 'totvs-header',
                fields: {
                    'System.Title': 'TOTVS',
                    'System.State': 'Agrupamento',
                    'System.WorkItemType': 'Group'
                },
                isGroupHeader: true
            },
            children: totvsGrouped
        });
    }
    
    // Create Rotinas section if there are routine items
    if (rotinas.length > 0) {
        const rotinasGrouped = groupRotinasItems(rotinas);
        
        grouped.push({
            parent: {
                id: 'rotinas-header',
                fields: {
                    'System.Title': 'Rotinas',
                    'System.State': 'Agrupamento',
                    'System.WorkItemType': 'Group'
                },
                isGroupHeader: true
            },
            children: rotinasGrouped
        });
    }
    
    // Group other work items (cards + ATAs relationship)
    if (others.length > 0) {
        const othersGrouped = groupOtherItems(others);
        grouped.push(...othersGrouped);
    }
    
    console.log('Final grouped structure:', grouped.length, 'groups');
    return grouped;
}

function groupRotinasItems(rotinasItems) {
    const grouped = [];
    
    // For rotinas, we'll group them simply as individual items
    // since they don't typically have ATAs associated
    rotinasItems.forEach(item => {
        grouped.push({
            parent: item,
            children: []
        });
    });
    
    console.log('Rotinas grouping:', grouped.length, 'items');
    return grouped;
}

function groupOtherItems(otherItems) {
    const grouped = [];
    const used = new Set();
    
    // First, separate tasks/cards from ATAs
    const tasks = otherItems.filter(item => {
        const itemType = determineWorkItemType(item);
        return itemType !== 'ATA';
    });
    
    const atas = otherItems.filter(item => {
        const itemType = determineWorkItemType(item);
        return itemType === 'ATA';
    });
    
    console.log('Other items separation - Tasks/Cards:', tasks.length, 'ATAs:', atas.length);
    
    // Group each task/card with its related ATAs
    tasks.forEach(task => {
        if (used.has(task.id)) return;
        
        const taskTitle = (task.fields['System.Title'] || '');
        console.log('Processing other task:', taskTitle);
        
        // Find ATAs that belong to this task
        const relatedATAs = atas.filter(ata => {
            if (used.has(ata.id)) return false;
            
            const ataTitle = (ata.fields['System.Title'] || '');
            
            // Remove [ATA] prefix and compare the rest
            const cleanTaskTitle = taskTitle.replace(/^\[.*?\]/, '').trim();
            const cleanAtaTitle = ataTitle.replace(/^\[ATA\]/, '').trim();
            
            console.log('Comparing other items:', cleanTaskTitle, 'vs', cleanAtaTitle);
            
            // Check if the ATA title contains the task title (without [ATA] prefix)
            const isMatch = cleanAtaTitle.includes(cleanTaskTitle) || 
                           cleanTaskTitle.includes(cleanAtaTitle) ||
                           areTitlesExactMatch(cleanTaskTitle, cleanAtaTitle);
            
            if (isMatch) {
                console.log('OTHER MATCH found:', ataTitle, 'belongs to', taskTitle);
            }
            
            return isMatch;
        });
        
        // Mark items as used
        used.add(task.id);
        relatedATAs.forEach(ata => {
            used.add(ata.id);
            console.log('Marking other ATA as used:', ata.fields['System.Title']);
        });
        
        // Create the group
        grouped.push({
            parent: task,
            children: relatedATAs
        });
        
        console.log(`Other task "${taskTitle}" grouped with ${relatedATAs.length} ATAs`);
    });
    
    // Add any remaining ATAs that weren't grouped
    atas.forEach(ata => {
        if (!used.has(ata.id)) {
            console.log('Other orphan ATA:', ata.fields['System.Title']);
            grouped.push({
                parent: ata,
                children: []
            });
        }
    });
    
    console.log('Final other items grouping:', grouped.length, 'groups');
    return grouped;
}

function groupTOTVSItems(totvsItems) {
    const grouped = [];
    const used = new Set();
    
    // First, separate tasks/cards from ATAs
    const tasks = totvsItems.filter(item => {
        const itemType = determineWorkItemType(item);
        return itemType !== 'ATA';
    });
    
    const atas = totvsItems.filter(item => {
        const itemType = determineWorkItemType(item);
        return itemType === 'ATA';
    });
    
    console.log('TOTVS separation - Tasks:', tasks.length, 'ATAs:', atas.length);
    
    // Group each task with its related ATAs
    tasks.forEach(task => {
        if (used.has(task.id)) return;
        
        const taskTitle = (task.fields['System.Title'] || '');
        console.log('Processing task:', taskTitle);
        
        // Find ATAs that belong to this task
        const relatedATAs = atas.filter(ata => {
            if (used.has(ata.id)) return false;
            
            const ataTitle = (ata.fields['System.Title'] || '');
            
            // Remove [ATA] prefix and compare the rest
            const cleanTaskTitle = taskTitle.replace(/^\[.*?\]/, '').trim();
            const cleanAtaTitle = ataTitle.replace(/^\[ATA\]/, '').trim();
            
            console.log('Comparing:', cleanTaskTitle, 'vs', cleanAtaTitle);
            
            // Check if the ATA title contains the task title (without [ATA] prefix)
            const isMatch = cleanAtaTitle.includes(cleanTaskTitle) || 
                           cleanTaskTitle.includes(cleanAtaTitle) ||
                           areTitlesExactMatch(cleanTaskTitle, cleanAtaTitle);
            
            if (isMatch) {
                console.log('MATCH found:', ataTitle, 'belongs to', taskTitle);
            }
            
            return isMatch;
        });
        
        // Mark items as used
        used.add(task.id);
        relatedATAs.forEach(ata => {
            used.add(ata.id);
            console.log('Marking ATA as used:', ata.fields['System.Title']);
        });
        
        // Create the group
        grouped.push({
            parent: task,
            children: relatedATAs
        });
        
        console.log(`Task "${taskTitle}" grouped with ${relatedATAs.length} ATAs`);
    });
    
    // Add any remaining ATAs that weren't grouped
    atas.forEach(ata => {
        if (!used.has(ata.id)) {
            console.log('Orphan ATA:', ata.fields['System.Title']);
            grouped.push({
                parent: ata,
                children: []
            });
        }
    });
    
    console.log('Final TOTVS grouping:', grouped.length, 'groups');
    return grouped;
}

function areTitlesExactMatch(title1, title2) {
    // Remove common prefixes and suffixes for exact matching
    const clean1 = title1.toLowerCase()
        .replace(/^\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    const clean2 = title2.toLowerCase()
        .replace(/^\[.*?\]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    
    // Check if they are essentially the same after cleaning
    return clean1 === clean2 || 
           clean1.includes(clean2) || 
           clean2.includes(clean1) ||
           // Check for date variations (29/09/2025 vs 10/10/2025 etc)
           clean1.replace(/\d{2}\/\d{2}\/\d{4}/, 'DATE') === clean2.replace(/\d{2}\/\d{2}\/\d{4}/, 'DATE');
}

function areTitlesRelated(title1, title2) {
    // Remove common words and compare significant words
    const commonWords = ['de', 'da', 'do', 'para', 'com', 'em', 'na', 'no', 'e', 'o', 'a', 'totvs'];
    
    const words1 = title1.split(/\s+/).filter(word => 
        word.length > 2 && !commonWords.includes(word.toLowerCase())
    );
    const words2 = title2.split(/\s+/).filter(word => 
        word.length > 2 && !commonWords.includes(word.toLowerCase())
    );
    
    // Check if at least 2 significant words match
    const matchCount = words1.filter(word1 => 
        words2.some(word2 => word2.includes(word1) || word1.includes(word2))
    ).length;
    
    return matchCount >= 2;
}

function generateHierarchicalHTML(groupedItems) {
    let html = '<div class="work-items-hierarchical">';
    
    groupedItems.forEach((group, groupIndex) => {
        const hasChildren = group.children && group.children.length > 0;
        const isGroupHeader = group.parent.isGroupHeader;
        const groupType = group.parent.id; // 'totvs-header' or 'rotinas-header'
        
        if (isGroupHeader && hasChildren) {
            // Determine section class and header class
            let sectionClass = 'work-item-group';
            let headerClass = 'totvs-header';
            let childrenClass = 'totvs-children';
            
            if (groupType === 'rotinas-header') {
                sectionClass = 'work-item-group rotinas-section';
                headerClass = 'rotinas-header';
                childrenClass = 'rotinas-children';
            } else if (groupType === 'totvs-header') {
                sectionClass = 'work-item-group totvs-section';
                headerClass = 'totvs-header';
                childrenClass = 'totvs-children';
            }
            
            // Section Header with nested groups
            html += `
                <div class="${sectionClass}">
                    <div class="work-item-parent has-children group-header" onclick="toggleGroup(${groupIndex})">
                        <div class="expand-indicator">
                            <i class="fas fa-chevron-right" id="chevron-${groupIndex}"></i>
                        </div>
                        <div class="${headerClass}">
                            <h3><i class="fas ${groupType === 'rotinas-header' ? 'fa-sync-alt' : 'fa-building'}"></i> ${group.parent.fields['System.Title']}</h3>
                            <span class="item-count">${group.children.length} ${groupType === 'rotinas-header' ? 'itens' : 'grupos'}</span>
                        </div>
                    </div>
                    <div class="work-item-children ${childrenClass}" id="children-${groupIndex}" style="display: none;">
                        ${group.children.map((subGroup, subIndex) => {
                            const subHasChildren = subGroup.children && subGroup.children.length > 0;
                            const subGroupId = `${groupIndex}-${subIndex}`;
                            
                            if (groupType === 'rotinas-header') {
                                // For rotinas, items are simple (no sub-children expected)
                                return `
                                    <div class="work-item-child rotinas-subgroup">
                                        <div class="work-item-single">
                                            ${createWorkItemCard(subGroup.parent)}
                                        </div>
                                    </div>
                                `;
                            } else {
                                // For TOTVS, handle nested structure
                                if (subHasChildren) {
                                    return `
                                        <div class="work-item-child totvs-subgroup">
                                            <div class="work-item-parent has-children" onclick="toggleGroup('${subGroupId}')">
                                                <div class="expand-indicator">
                                                    <i class="fas fa-chevron-right" id="chevron-${subGroupId}"></i>
                                                </div>
                                                ${createWorkItemCard(subGroup.parent)}
                                            </div>
                                            <div class="work-item-children" id="children-${subGroupId}" style="display: none;">
                                                ${subGroup.children.map(child => `
                                                    <div class="work-item-child">
                                                        ${createWorkItemCard(child)}
                                                    </div>
                                                `).join('')}
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div class="work-item-child totvs-subgroup">
                                            <div class="work-item-single">
                                                ${createWorkItemCard(subGroup.parent)}
                                            </div>
                                        </div>
                                    `;
                                }
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        } else if (hasChildren) {
            // Regular expandable group
            const parentCard = createWorkItemCard(group.parent);
            html += `
                <div class="work-item-group">
                    <div class="work-item-parent has-children" onclick="toggleGroup(${groupIndex})">
                        <div class="expand-indicator">
                            <i class="fas fa-chevron-right" id="chevron-${groupIndex}"></i>
                        </div>
                        ${parentCard}
                    </div>
                    <div class="work-item-children" id="children-${groupIndex}" style="display: none;">
                        ${group.children.map(child => `
                            <div class="work-item-child">
                                ${createWorkItemCard(child)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        } else {
            // Single item without children
            const parentCard = createWorkItemCard(group.parent);
            html += `
                <div class="work-item-group">
                    <div class="work-item-single">
                        ${parentCard}
                    </div>
                </div>
            `;
        }
    });
    
    html += '</div>';
    return html;
}

function toggleGroup(groupIndex) {
    const childrenContainer = document.getElementById(`children-${groupIndex}`);
    const chevron = document.getElementById(`chevron-${groupIndex}`);
    
    if (!childrenContainer || !chevron) {
        console.warn('Could not find group elements for index:', groupIndex);
        return;
    }
    
    if (childrenContainer.style.display === 'none') {
        childrenContainer.style.display = 'block';
        chevron.classList.remove('fa-chevron-right');
        chevron.classList.add('fa-chevron-down');
    } else {
        childrenContainer.style.display = 'none';
        chevron.classList.remove('fa-chevron-down');
        chevron.classList.add('fa-chevron-right');
    }
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
    
    // Determine if this is an ATA
    const isATA = workItemType === 'ATA';
    
    return `
        <div class="work-item-card" data-id="${item.id || 'unknown'}">
            <div class="card-header">
                <span class="card-id">#${item.id || 'N/A'}</span>
                <div class="card-actions">
                    ${isATA ? 
                        `<button class="card-button edit-ata-btn" onclick="openATAEditor('${item.id}', event)">
                            <i class="fas fa-edit"></i> Editar
                        </button>` :
                        `<a href="${item.url || '#'}" target="_blank" class="card-link">
                            <i class="fas fa-external-link-alt"></i> Abrir
                        </a>`
                    }
                </div>
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

// ATA Editor Functions
async function openATAEditor(workItemId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Opening ATA editor for:', workItemId);
    
    try {
        // Show loading
        const loadingMessage = document.createElement('div');
        loadingMessage.id = 'ataLoadingMessage';
        loadingMessage.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); 
                        background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                        z-index: 1001; display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-spinner fa-spin"></i>
                <span>Carregando dados da ATA...</span>
            </div>
        `;
        document.body.appendChild(loadingMessage);
        
        console.log('Fetching ATA details from API...');
        // Fetch ATA details from the API
        const response = await fetch(`/api/ata/${workItemId}/details`);
        
        console.log('API Response status:', response.status);
        if (!response.ok) {
            throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const ataDetails = await response.json();
        console.log('ATA Details received:', ataDetails);
        
        // Remove loading message
        document.body.removeChild(loadingMessage);
        
        // Create and show the modal with loaded data
        createATAEditorModal(ataDetails);
        
    } catch (error) {
        console.error('Error loading ATA details:', error);
        
        // Remove loading message if it exists
        const loadingMessage = document.getElementById('ataLoadingMessage');
        if (loadingMessage) {
            document.body.removeChild(loadingMessage);
        }
        
        // Fallback to basic work item data
        const workItem = allWorkItems.find(item => item.id.toString() === workItemId.toString());
        if (workItem) {
            console.log('Using fallback work item data:', workItem);
            createATAEditorModal(workItem);
        } else {
            alert('Erro ao carregar dados da ATA: ' + error.message);
        }
    }
}

function createATAEditorModal(ataData) {
    // Remove existing modal if any
    const existingModal = document.getElementById('ataEditorModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Extract data with fallbacks
    const workItemId = ataData.id || ataData.work_item_id;
    const fields = ataData.fields || {};
    const title = ataData.title || fields['System.Title'] || '';
    const description = fields['System.Description'] || '';
    const location = ataData.location || '';
    const startDateTime = ataData.startDateTime || '';
    const finishDateTime = ataData.finishDateTime || '';
    const meetingStave = ataData.meetingStave || '';
    const meetingSubject = ataData.meetingSubject || '';
    const comments = ataData.comments || '';
    const template = ataData.template || 'ATA';  // Default to ATA
    const nextSteps = ataData.nextSteps || [];  // Array de next steps
    
    console.log('Creating ATA editor with data:', ataData);
    console.log('Extracted values:');
    console.log('- workItemId:', workItemId);
    console.log('- title:', title);
    console.log('- location:', location);
    console.log('- startDateTime:', startDateTime);
    console.log('- finishDateTime:', finishDateTime);
    console.log('- meetingStave:', meetingStave);
    console.log('- meetingSubject:', meetingSubject);
    console.log('- comments:', comments);
    
    // Create modal HTML
    const modalHTML = `
        <div id="ataEditorModal" class="ata-modal-overlay">
            <div class="ata-modal">
                <div class="ata-modal-header">
                    <h2><i class="fas fa-edit"></i> Editar ATA #${workItemId}</h2>
                    <button class="ata-modal-close" onclick="closeATAEditor()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="ata-modal-content">
                    <form id="ataEditorForm">
                        <!-- Template Selection -->
                        <div class="ata-form-group">
                            <label for="templateType">Template:</label>
                            <select id="templateType" name="templateType">
                                <option value="ATA" ${template === 'ATA' ? 'selected' : ''}>ATA</option>
                                <option value="Activities Report" ${template === 'Activities Report' ? 'selected' : ''}>Activities Report</option>
                            </select>
                        </div>
                        
                        <!-- Title -->
                        <div class="ata-form-group">
                            <label for="ataTitle">Título da ATA:</label>
                            <input type="text" id="ataTitle" name="ataTitle" value="${escapeHtml(title)}" required>
                        </div>
                        
                        <!-- Location -->
                        <div class="ata-form-group">
                            <label for="location">Location:</label>
                            <input type="text" id="location" name="location" 
                                   placeholder="Ex: Sala de reuniões, Microsoft Teams, etc."
                                   value="${escapeHtml(location)}">
                        </div>
                        
                        <!-- Date and Time Row -->
                        <div class="ata-form-row">
                            <div class="ata-form-group">
                                <label for="startDateTime">Date and Time - Start:</label>
                                <input type="datetime-local" id="startDateTime" name="startDateTime" 
                                       value="${startDateTime}">
                            </div>
                            
                            <div class="ata-form-group">
                                <label for="finishDateTime">Date and Time - Finish:</label>
                                <input type="datetime-local" id="finishDateTime" name="finishDateTime"
                                       value="${finishDateTime}">
                            </div>
                        </div>
                        
                        <!-- Staves -->
                        <div class="ata-form-group">
                            <label for="meetingStave">Staves - #01 Meeting Stave Subject:</label>
                            <input type="text" id="meetingStave" name="meetingStave" 
                                   placeholder="Assunto principal da reunião"
                                   value="${escapeHtml(meetingStave)}">
                        </div>
                        
                        <!-- Meeting Subject -->
                        <div class="ata-form-group">
                            <label for="meetingSubject">Meeting - #01 Subject:</label>
                            <input type="text" id="meetingSubject" name="meetingSubject" 
                                   placeholder="Assunto específico discutido"
                                   value="${escapeHtml(meetingSubject)}">
                        </div>
                        
                        <!-- Comments -->
                        <div class="ata-form-group">
                            <label for="comments">Comments:</label>
                            <textarea id="comments" name="comments" rows="6" placeholder="Comentários detalhados, discussões e observações da reunião...">${comments}</textarea>
                        </div>
                        
                        <!-- Next Steps -->
                        <div class="ata-form-group">
                            <label for="nextSteps">Next Steps:</label>
                            <div class="next-steps-container">
                                <div class="next-steps-header">
                                    <div class="next-steps-col">Actions</div>
                                    <div class="next-steps-col">Responsible</div>
                                    <div class="next-steps-col">Date</div>
                                    <div class="next-steps-col">
                                        <button type="button" class="ata-btn ata-btn-warning btn-clear-next-steps" onclick="clearAllNextSteps()" title="Limpar todos os Next Steps">
                                            <i class="fas fa-trash"></i> Limpar Todos
                                        </button>
                                    </div>
                                </div>
                                <div class="next-steps-rows">
                                    ${Array.from({length: 10}, (_, i) => {
                                        const stepNum = i + 1;
                                        const step = nextSteps.find(s => s.number === stepNum) || {};
                                        return `
                                        <div class="next-steps-row">
                                            <div class="next-steps-col">
                                                <input type="text" name="action_${stepNum}" placeholder="#0${stepNum < 10 ? '0' + stepNum : stepNum}" 
                                                       class="next-steps-input" value="${escapeHtml(step.action || '')}">
                                            </div>
                                            <div class="next-steps-col">
                                                <input type="text" name="responsible_${stepNum}" placeholder="#0${stepNum < 10 ? '0' + stepNum : stepNum}" 
                                                       class="next-steps-input" value="${escapeHtml(step.responsible || '')}">
                                            </div>
                                            <div class="next-steps-col">
                                                <input type="datetime-local" name="date_${stepNum}" placeholder="Select a date..." 
                                                       class="next-steps-input next-steps-date" value="${step.date || ''}">
                                            </div>
                                        </div>
                                    `;
                                    }).join('')}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                
                <div class="ata-modal-footer">
                    <button type="button" class="ata-btn ata-btn-secondary" onclick="closeATAEditor()">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                    <button type="button" class="ata-btn ata-btn-primary" onclick="saveATA('${workItemId}')">
                        <i class="fas fa-save"></i> Salvar ATA
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Show modal with animation
    setTimeout(() => {
        document.getElementById('ataEditorModal').classList.add('show');
        
        // Focus on location field if empty
        if (!location) {
            document.getElementById('location').focus();
        }
    }, 10);
}

function clearAllNextSteps() {
    // Limpar todos os campos de Next Steps
    for (let i = 1; i <= 10; i++) {
        const actionField = document.querySelector(`input[name="action_${i}"]`);
        const responsibleField = document.querySelector(`input[name="responsible_${i}"]`);
        const dateField = document.querySelector(`input[name="date_${i}"]`);
        
        if (actionField) actionField.value = '';
        if (responsibleField) responsibleField.value = '';
        if (dateField) dateField.value = '';
    }
    
    // Mostrar mensagem de confirmação
    console.log('Todos os Next Steps foram limpos');
    
    // Opcional: mostrar um toast ou feedback visual
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = '<i class="fas fa-check"></i> Next Steps limpos com sucesso!';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 5px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    document.body.appendChild(toast);
    
    // Remover o toast após 3 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

function closeATAEditor() {
    const modal = document.getElementById('ataEditorModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

async function saveATA(workItemId) {
    try {
        const form = document.getElementById('ataEditorForm');
        if (!form) {
            alert('Formulário não encontrado!');
            return;
        }
        
        console.log('Saving ATA for work item:', workItemId);
        
        // Coletar dados do formulário com verificações de segurança
        const getElementValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value || '' : '';
        };
        
        // Coletar Next Steps
        const nextSteps = [];
        for (let i = 1; i <= 10; i++) {
            // Usar querySelector com name ao invés de getElementById
            const actionInput = document.querySelector(`input[name="action_${i}"]`);
            const responsibleInput = document.querySelector(`input[name="responsible_${i}"]`);
            const dateInput = document.querySelector(`input[name="date_${i}"]`);
            
            const action = actionInput ? actionInput.value.trim() : '';
            const responsible = responsibleInput ? responsibleInput.value.trim() : '';
            const date = dateInput ? dateInput.value.trim() : '';
            
            // Se pelo menos um campo está preenchido, incluir o step
            if (action || responsible || date) {
                nextSteps.push({
                    number: i,
                    action: action,
                    responsible: responsible,
                    date: date
                });
            }
        }
        
        const ataData = {
            template: getElementValue('templateType') || 'ATA',
            location: getElementValue('location'),
            startDateTime: getElementValue('startDateTime'),
            finishDateTime: getElementValue('finishDateTime'),
            meetingStave: getElementValue('meetingStave'),
            meetingSubject: getElementValue('meetingSubject'),
            comments: getElementValue('comments'),
            nextSteps: nextSteps
        };
        
        console.log('ATA data to save:', ataData);
        
        // Show loading state com verificação de segurança
        const saveBtn = document.querySelector('.ata-btn-primary');
        let originalText = '<i class="fas fa-save"></i> Salvar ATA'; // Default fallback
        
        if (saveBtn) {
            originalText = saveBtn.innerHTML;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
            saveBtn.disabled = true;
        }
            
            // Fazer a requisição para salvar
            const response = await fetch(`/api/ata/${workItemId}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(ataData)
            });
            
            const result = await response.json();
            
            if (response.ok && result.success) {
                console.log('ATA saved successfully:', result);
                
                // Build success message with details
                let message = result.message || 'ATA salva com sucesso!';
                
                if (result.updatedFields) {
                    message += ` ${result.updatedFields} campo(s) atualizado(s).`;
                }
                
                if (result.skippedFields && result.skippedFields.length > 0) {
                    message += `\n\nAtenção: Alguns campos não foram salvos:\n${result.skippedFields.join('\n')}`;
                }
                
                // Show success message
                alert(message);
                
                // Close modal
                closeATAEditor();
                
                // Reload work items to show updated data
                await loadWorkItems();
                
            } else {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            
            // Restore button state
            if (saveBtn) {
                saveBtn.innerHTML = originalText;
                saveBtn.disabled = false;
            }
            
    } catch (error) {
        console.error('Error saving ATA:', error);
        alert('Erro ao salvar ATA: ' + error.message);
        
        // Restore button com verificação de segurança
        const saveBtn = document.querySelector('.ata-btn-primary');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar ATA';
            saveBtn.disabled = false;
        }
    } finally {
        // Garantir que o botão seja restaurado em qualquer caso
        const saveBtn = document.querySelector('.ata-btn-primary');
        if (saveBtn && saveBtn.disabled) {
            saveBtn.disabled = false;
            if (saveBtn.innerHTML.includes('Salvando')) {
                saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar ATA';
            }
        }
    }
}

// Export functions for potential future use
window.ManageCards = {
    loadWorkItems,
    filterCards,
    updateCardsCount,
    openATAEditor,
    closeATAEditor,
    saveATA
};