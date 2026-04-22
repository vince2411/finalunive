/**
 * UI Helpers — Universitarios FC v2.0
 * Toast notifications, modals, loaders, and common UI utilities
 */

// ==================== TOAST NOTIFICATIONS ====================

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

/**
 * Show a toast notification
 * @param {string} title
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 * @param {number} duration - ms before auto-dismiss
 */
export function showToast(title, message = '', type = 'info', duration = 4000) {
  const container = ensureToastContainer();
  
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  };
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close" aria-label="Cerrar">&times;</button>
  `;
  
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismissToast(toast));
  
  container.appendChild(toast);
  
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
  
  return toast;
}

function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 300);
}

// ==================== MODALS ====================

/**
 * Open a modal
 * @param {string} modalId - ID of the modal overlay
 */
export function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    
    // Focus first input
    setTimeout(() => {
      const firstInput = overlay.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  }
}

/**
 * Close a modal
 */
export function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
}

/**
 * Close modal on overlay click
 */
export function setupModalClose(modalId) {
  const overlay = document.getElementById(modalId);
  if (!overlay) return;
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(modalId);
  });
  
  // Handle [data-modal-close] buttons inside this modal
  overlay.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(modalId));
  });
  
  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      closeModal(modalId);
    }
  });
}

/**
 * Confirm dialog
 */
export function confirmDialog(title, message, onConfirm, onCancel) {
  // Create inline confirm modal
  const modalId = 'confirmModal_' + Date.now();
  const overlay = document.createElement('div');
  overlay.id = modalId;
  overlay.className = 'modal-overlay active';
  overlay.innerHTML = `
    <div class="modal" style="max-width: 440px;">
      <div class="modal-header">
        <h3>${escapeHtml(title)}</h3>
        <button class="btn-icon btn-ghost modal-close-btn" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal-body">
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline cancel-btn">Cancelar</button>
        <button class="btn btn-primary confirm-btn">Confirmar</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  
  const cleanup = () => {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => overlay.remove(), 300);
  };
  
  overlay.querySelector('.confirm-btn').addEventListener('click', () => {
    cleanup();
    if (onConfirm) onConfirm();
  });
  
  overlay.querySelector('.cancel-btn').addEventListener('click', () => {
    cleanup();
    if (onCancel) onCancel();
  });
  
  overlay.querySelector('.modal-close-btn').addEventListener('click', cleanup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });
}

// ==================== LOADERS ====================

/**
 * Show loading spinner
 */
export function showLoader(container, size = '') {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) return;
  
  const sizeClass = size ? `spinner-${size}` : '';
  container.innerHTML = `
    <div class="empty-state" style="padding: var(--space-8);">
      <div class="spinner ${sizeClass}"></div>
      <p style="margin-top: var(--space-4); font-size: var(--text-sm); color: var(--color-text-muted);">Cargando...</p>
    </div>
  `;
}

/**
 * Show skeleton loading
 */
export function showSkeleton(container, count = 3) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) return;
  
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `
      <div style="padding: var(--space-3); display: flex; gap: var(--space-3); align-items: center;">
        <div class="skeleton" style="width: 40px; height: 40px; border-radius: 50%;"></div>
        <div style="flex: 1;">
          <div class="skeleton" style="width: 60%; height: 14px; margin-bottom: 8px;"></div>
          <div class="skeleton" style="width: 80%; height: 12px;"></div>
        </div>
      </div>
    `;
  }
  container.innerHTML = html;
}

/**
 * Show empty state
 */
export function showEmptyState(container, icon, title, text) {
  if (typeof container === 'string') {
    container = document.getElementById(container);
  }
  if (!container) return;
  
  container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <div class="empty-state-title">${escapeHtml(title)}</div>
      <div class="empty-state-text">${escapeHtml(text)}</div>
    </div>
  `;
}

// ==================== FORMATTERS ====================

/**
 * Format timestamp to readable date/time
 */
export function formatDate(timestamp, options = {}) {
  const date = new Date(timestamp);
  const defaults = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };
  return date.toLocaleDateString('es-VE', defaults);
}

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(timestamp) {
  return `${formatDate(timestamp)} ${formatTime(timestamp)}`;
}

/**
 * Relative time (e.g., "hace 5 min")
 */
export function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'Justo ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
  return formatDate(timestamp);
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth) {
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Generate unique ID
 */
export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

/**
 * Debounce function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncate text
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get initials from name
 */
export function getInitials(name) {
  if (!name) return '?';
  return name.split(' ')
    .map(word => word.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Format phone number for WhatsApp
 */
export function formatWhatsAppUrl(prefix, phone, message = '') {
  const cleanPhone = phone.replace(/\D/g, '');
  const cleanPrefix = prefix.replace(/\+/g, '');
  const fullNumber = cleanPrefix + cleanPhone;
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${fullNumber}${message ? `?text=${encodedMessage}` : ''}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copiado', 'Texto copiado al portapapeles', 'success', 2000);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('Copiado', 'Texto copiado al portapapeles', 'success', 2000);
    return true;
  }
}

/**
 * Download as CSV
 */
export function downloadCSV(data, filename = 'export.csv') {
  if (!data || !data.length) return;
  
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Set active section (show/hide content sections)
 */
export function setActiveSection(sectionId) {
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  
  const target = document.getElementById(sectionId);
  if (target) {
    target.classList.add('active');
  }
  
  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.section === sectionId) {
      item.classList.add('active');
    }
  });
}
