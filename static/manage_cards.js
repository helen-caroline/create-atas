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
    const others = [];
    
    // Separate TOTVS items from others
    workItems.forEach(item => {
        const title = (item.fields['System.Title'] || '').toLowerCase();
        if (title.includes('totvs')) {
            totvs.push(item);
        } else {
            others.push(item);
        }
    });
    
    console.log('Grouped items - TOTVS:', totvs.length, 'Others:', others.length);
    
    const grouped = [];
    
    // Create TOTVS section header if there are TOTVS items
    if (totvs.length > 0) {
        // Group TOTVS items by matching titles (card + ATA relationship)
        const totvsGrouped = groupTOTVSItems(totvs);
        
        // Add TOTVS section header
        grouped.push({
            parent: {
                id: 'totvs-header',
                fields: {
                    'System.Title': '🏢 TOTVS',
                    'System.State': 'Agrupamento',
                    'System.WorkItemType': 'Group'
                },
                isGroupHeader: true
            },
            children: totvsGrouped
        });
    }
    
    // Add other work items as standalone groups
    others.forEach(other => {
        grouped.push({
            parent: other,
            children: []
        });
    });
    
    console.log('Final grouped structure:', grouped.length, 'groups');
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
        
        if (isGroupHeader && hasChildren) {
            // TOTVS Section Header with nested groups
            html += `
                <div class="work-item-group totvs-section">
                    <div class="work-item-parent has-children group-header" onclick="toggleGroup(${groupIndex})">
                        <div class="expand-indicator">
                            <i class="fas fa-chevron-right" id="chevron-${groupIndex}"></i>
                        </div>
                        <div class="totvs-header">
                            <h3><i class="fas fa-building"></i> ${group.parent.fields['System.Title']}</h3>
                            <span class="item-count">${group.children.length} grupos</span>
                        </div>
                    </div>
                    <div class="work-item-children totvs-children" id="children-${groupIndex}" style="display: none;">
                        ${group.children.map((subGroup, subIndex) => {
                            const subHasChildren = subGroup.children && subGroup.children.length > 0;
                            const subGroupId = `${groupIndex}-${subIndex}`;
                            
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