// Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

function initializeDashboard() {
    // Initialize current date
    updateCurrentDate();
    
    // Initialize sidebar functionality
    initializeSidebar();
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Update date every minute
    setInterval(updateCurrentDate, 60000);
}

function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        dateElement.textContent = now.toLocaleDateString('pt-BR', options);
    }
}

function initializeSidebar() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', function(e) {
            e.preventDefault();
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Handle menu item clicks
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const link = item.querySelector('.menu-link');
        if (link && !link.getAttribute('href')) {
            // Only add click handler if it's not a real link
            item.addEventListener('click', function() {
                // Remove active class from all items
                menuItems.forEach(i => i.classList.remove('active'));
                // Add active class to clicked item
                this.classList.add('active');
            });
        }
    });
}

function initializeMobileMenu() {
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle && sidebar) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            sidebar.classList.toggle('open');
        });
        
        // Close sidebar when clicking outside
        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 1024) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            }
        });
        
        // Close sidebar when clicking on menu items on mobile
        const menuLinks = document.querySelectorAll('.menu-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 1024) {
                    sidebar.classList.remove('open');
                }
            });
        });
    }
}

// Handle window resize
window.addEventListener('resize', function() {
    const sidebar = document.querySelector('.sidebar');
    if (window.innerWidth > 1024 && sidebar) {
        sidebar.classList.remove('open');
    }
});

// Enhanced utility functions with animations
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} toast-enter`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to DOM with animation
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            closeNotification(notification.querySelector('.notification-close'));
        }
    }, 5000);
}

// Enhanced copy functionality with visual feedback
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        // Visual feedback
        const originalClass = button.className;
        const originalContent = button.innerHTML;
        
        button.className = originalClass + ' success';
        button.innerHTML = '<i class="fas fa-check"></i>';
        
        setTimeout(() => {
            button.className = originalClass;
            button.innerHTML = originalContent;
        }, 1500);
        
        showNotification('Copiado para a área de transferência!', 'success');
    }).catch(() => {
        showNotification('Erro ao copiar texto', 'error');
    });
}

// Loading state management
function setLoadingState(element, isLoading) {
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
        const originalContent = element.innerHTML;
        element.dataset.originalContent = originalContent;
        element.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
    } else {
        element.classList.remove('loading');
        element.disabled = false;
        element.innerHTML = element.dataset.originalContent || element.innerHTML;
    }
}

// Enhanced form validation with visual feedback
function validateFormField(field) {
    const value = field.value.trim();
    const isValid = value.length > 0;
    
    // Remove existing validation classes
    field.classList.remove('field-valid', 'field-invalid');
    
    // Add appropriate class with animation delay
    setTimeout(() => {
        field.classList.add(isValid ? 'field-valid' : 'field-invalid');
    }, 100);
    
    return isValid;
}

// Staggered animation for elements
function staggerElements(elements, delay = 100) {
    elements.forEach((element, index) => {
        element.style.animationDelay = `${index * delay}ms`;
        element.classList.add('fadeIn');
    });
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

function closeNotification(button) {
    const notification = button.closest('.notification');
    if (notification) {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
}

// Add notification styles if not already present
if (!document.querySelector('#notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'notification-styles';
    styles.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 1rem;
            border-radius: 0.5rem;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
            border-left: 4px solid var(--primary-color);
            display: flex;
            align-items: center;
            gap: 1rem;
            min-width: 300px;
            z-index: 9999;
            animation: slideIn 0.3s ease-out;
        }
        
        .notification-success {
            border-left-color: var(--success-color);
        }
        
        .notification-error {
            border-left-color: var(--danger-color);
        }
        
        .notification-warning {
            border-left-color: var(--warning-color);
        }
        
        .notification-content {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            flex: 1;
        }
        
        .notification-close {
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 0.25rem;
        }
        
        .notification-close:hover {
            background: #f1f5f9;
        }
        
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(styles);
}