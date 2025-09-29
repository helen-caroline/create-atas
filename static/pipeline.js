// ============================================
// PIPELINE CARDS - JAVASCRIPT
// ============================================

// Load current pipeline file content
async function loadPipelineFile() {
    const btn = event.target;
    const originalContent = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Carregando...';
    
    updateStatus('loading', 'Buscando conteúdo atual do arquivo cards.txt...');
    
    try {
        const response = await fetch('/get_pipeline_file');
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('cards-content').value = data.content || '';
            showSuccess('Arquivo carregado com sucesso!');
            updateStatus('loaded', 'Arquivo carregado do repositório', { 
                content: data.content ? `${data.content.split('\n').length} linhas` : 'Arquivo vazio' 
            });
        } else {
            showError(`Erro ao carregar arquivo: ${data.error}`);
            updateStatus('error', 'Erro ao carregar arquivo', data);
            
            // Se for erro de não encontrado, mostrar template
            if (response.status === 404) {
                document.getElementById('cards-content').value = `1 Helen Caroline da Silva Santos;Dailys - Sprint 236;4;;89016
2 Helen Caroline da Silva Santos;[Konia]_Review_(Sprint_235)_-_Planning_Sprint_236;1;;89017
3 Helen Caroline da Silva Santos;[Anima]_Levantamento_e_Extrações_GitLab;30;;89043`;
                showSuccess('Arquivo não encontrado. Template de exemplo carregado.');
            }
        }
    } catch (error) {
        showError('Erro de conexão: ' + error.message);
        updateStatus('error', 'Erro de conexão', { error: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

// Save pipeline file (cards.txt)
async function savePipelineFile() {
    const content = document.getElementById('cards-content').value;
    const btn = document.getElementById('savePipelineBtn');
    
    if (!content.trim()) {
        showError('Por favor, insira o conteúdo do arquivo cards.txt');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Salvando...';
    
    updateStatus('saving', 'Salvando arquivo no repositório...');
    
    try {
        const response = await fetch('/save_pipeline_file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess('Arquivo salvo com sucesso no repositório!');
            updateStatus('saved', 'Arquivo salvo com sucesso', data);
        } else {
            showError(data.error || 'Erro ao salvar arquivo');
            updateStatus('error', 'Erro ao salvar arquivo', { error: data.error });
        }
    } catch (error) {
        showError('Erro de conexão: ' + error.message);
        updateStatus('error', 'Erro de conexão', { error: error.message });
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-save"></i> Salvar no Repositório';
    }
}

// Run pipeline
async function runPipeline() {
    const btn = document.getElementById('runPipelineBtn');
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Executando...';
    
    updateStatus('running', 'Iniciando execução da pipeline...');
    
    try {
        const response = await fetch('/run_pipeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const data = await response.json();
        
        if (response.ok && data.buildId) {
            showSuccess('Pipeline iniciada com sucesso!');
            updateStatus('polling', 'Pipeline iniciada, acompanhando progresso...', {
                buildId: data.buildId,
                buildUrl: data.buildUrl
            });
            
            // Iniciar polling do status da pipeline
            startPipelinePolling(data.buildId);
            
        } else {
            showError(data.error || 'Erro ao executar pipeline');
            updateStatus('error', 'Erro ao executar pipeline', { error: data.error });
            btn.disabled = false;
            btn.innerHTML = '<i class="fa fa-play"></i> Executar Pipeline';
        }
    } catch (error) {
        showError('Erro de conexão: ' + error.message);
        updateStatus('error', 'Erro de conexão', { error: error.message });
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-play"></i> Executar Pipeline';
    }
}

// Start polling pipeline status
function startPipelinePolling(buildId) {
    let pollCount = 0;
    const maxPolls = 120; // 10 minutos máximo (5s * 120)
    
    const pollInterval = setInterval(async () => {
        pollCount++;
        
        try {
            const response = await fetch(`/pipeline_status/${buildId}`);
            const data = await response.json();
            
            if (response.ok) {
                const status = data.status;
                const result = data.result;
                const isCompleted = data.isCompleted;
                
                // Atualizar status na interface
                if (isCompleted) {
                    clearInterval(pollInterval);
                    
                    const btn = document.getElementById('runPipelineBtn');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa fa-play"></i> Executar Pipeline';
                    
                    if (result === 'sucesso') {
                        showSuccess('Pipeline concluída com sucesso!');
                        updateStatus('success', 'Pipeline concluída com sucesso', data);
                    } else {
                        showError(`Pipeline falhou: ${result}`);
                        updateStatus('error', `Pipeline falhou: ${result}`, data);
                    }
                } else {
                    // Pipeline ainda executando
                    updateStatus('polling', `Pipeline ${status}...`, data);
                }
            } else {
                console.warn('Erro ao consultar status:', data.error);
            }
        } catch (error) {
            console.warn('Erro no polling:', error.message);
        }
        
        // Parar polling se exceder limite de tempo
        if (pollCount >= maxPolls) {
            clearInterval(pollInterval);
            const btn = document.getElementById('runPipelineBtn');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa fa-play"></i> Executar Pipeline';
            
            showError('Timeout: Pipeline demorou mais que o esperado');
            updateStatus('error', 'Timeout na consulta do status da pipeline');
        }
        
    }, 5000); // Poll a cada 5 segundos
}

// Update status display
function updateStatus(type, message, data = {}) {
    const statusDiv = document.getElementById('pipelineStatus');
    
    let content = '';
    
    switch (type) {
        case 'loading':
            content = `
                <div class="status-item status-running">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </div>
            `;
            break;
            
        case 'loaded':
            content = `
                <div class="status-item status-success">
                    <i class="fa fa-download"></i>
                    <span>${message}</span>
                </div>
                <div class="status-details">
                    ${data.content ? `<div><strong>Conteúdo:</strong> ${data.content}</div>` : ''}
                    <div><small><i class="fa fa-clock"></i> ${new Date().toLocaleString()}</small></div>
                </div>
            `;
            break;
            
        case 'saving':
            content = `
                <div class="status-item status-running">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </div>
            `;
            break;
            
        case 'saved':
            content = `
                <div class="status-item status-success">
                    <i class="fa fa-check-circle"></i>
                    <span>${message}</span>
                </div>
                <div class="status-details">
                    <small><i class="fa fa-clock"></i> ${new Date().toLocaleString()}</small>
                </div>
            `;
            break;
            
        case 'running':
            content = `
                <div class="status-item status-running">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </div>
            `;
            break;
            
        case 'polling':
            content = `
                <div class="status-item status-running">
                    <i class="fa fa-spinner fa-spin"></i>
                    <span>${message}</span>
                </div>
                <div class="status-details">
                    ${data.buildId ? `<div><strong>Build ID:</strong> ${data.buildId}</div>` : ''}
                    ${data.status ? `<div><strong>Status atual:</strong> ${data.status}</div>` : ''}
                    ${data.buildNumber ? `<div><strong>Build:</strong> ${data.buildNumber}</div>` : ''}
                    ${data.startTime ? `<div><strong>Iniciado em:</strong> ${new Date(data.startTime).toLocaleString()}</div>` : ''}
                    ${data.buildUrl ? `<div><a href="${data.buildUrl}" target="_blank" class="status-link"><i class="fa fa-external-link"></i> Ver no Azure DevOps</a></div>` : ''}
                    <div><small><i class="fa fa-clock"></i> Última atualização: ${new Date().toLocaleString()}</small></div>
                </div>
            `;
            break;
            
        case 'success':
            content = `
                <div class="status-item status-success">
                    <i class="fa fa-check-circle"></i>
                    <span>${message}</span>
                </div>
                <div class="status-details">
                    ${data.buildId ? `<div><strong>Build ID:</strong> ${data.buildId}</div>` : ''}
                    ${data.status ? `<div><strong>Status:</strong> ${data.status}</div>` : ''}
                    ${data.buildUrl ? `<div><a href="${data.buildUrl}" target="_blank" class="status-link"><i class="fa fa-external-link"></i> Ver no Azure DevOps</a></div>` : ''}
                    <div><small><i class="fa fa-clock"></i> ${new Date().toLocaleString()}</small></div>
                </div>
            `;
            break;
            
        case 'error':
            content = `
                <div class="status-item status-error">
                    <i class="fa fa-exclamation-triangle"></i>
                    <span>${message}</span>
                </div>
                <div class="status-details error-details">
                    ${data.error ? `<div class="error-message">${data.error}</div>` : ''}
                    <div><small><i class="fa fa-clock"></i> ${new Date().toLocaleString()}</small></div>
                </div>
            `;
            break;
            
        default:
            content = `
                <div class="status-placeholder">
                    <i class="fa fa-info-circle"></i>
                    <p>${message}</p>
                </div>
            `;
    }
    
    statusDiv.innerHTML = content;
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('pipelineError');
    const successDiv = document.getElementById('pipelineSuccess');
    
    successDiv.style.display = 'none';
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 7000);
}

// Show success message
function showSuccess(message) {
    const errorDiv = document.getElementById('pipelineError');
    const successDiv = document.getElementById('pipelineSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    
    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

// Show toast notification
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 4000);
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    // Load current file content on page load
    loadPipelineFile();
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl+S to save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            savePipelineFile();
        }
        
        // Ctrl+Enter to run pipeline
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runPipeline();
        }
    });
    
    // Add auto-save every 30 seconds if content changed
    let lastContent = '';
    let hasChanges = false;
    
    const textarea = document.getElementById('cards-content');
    textarea.addEventListener('input', function() {
        const currentContent = this.value;
        if (currentContent !== lastContent) {
            hasChanges = true;
            lastContent = currentContent;
        }
    });
    
    // Auto-save functionality (commented out for now)
    // setInterval(() => {
    //     if (hasChanges && lastContent.trim()) {
    //         console.log('Auto-saving...');
    //         savePipelineFile();
    //         hasChanges = false;
    //     }
    // }, 30000);
});