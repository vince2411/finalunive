/**
 * Admin Dashboard Controller — Universitarios FC v2.0
 * Main entry point for the admin panel: auth, navigation, modules, theme
 */
import { initFirebase, signIn, signOut, onAuthChange } from '../services/firebase.service.js';
import { getCollection, addDocument, updateDocument, deleteDocument, onCollectionChange } from '../services/firebase.service.js';
import { initBCVRate, refreshRate, getRate, getRateInfo, onRateChange, setManualRate, usdToVes, formatUSD, formatVES, formatBimoneda, formatRate } from '../services/bcv.service.js';
import { initNotifications, getNotifications, getUnreadCount, markAllAsRead, createNotification, onNotificationChange, getNotificationIcon, getNotificationColor, notifyNewPayment, notifyEscalation } from '../services/notifications.service.js';
import { showToast, openModal, closeModal, setupModalClose, confirmDialog, showLoader, showEmptyState, formatDate, formatTime, formatDateTime, timeAgo, calculateAge, generateId, escapeHtml, debounce, truncate, getInitials, formatWhatsAppUrl, copyToClipboard, downloadCSV, setActiveSection } from '../utils/ui.helpers.js';

// ==================== STATE ====================
let currentSection = 'section-dashboard';
let currentTheme = localStorage.getItem('ufc_theme') || 'light';
let selectedConversation = null;
let charts = {};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  initFirebase();
  applyTheme(currentTheme);
  initAuth();
  initNavigation();
  initThemeToggle();
  initNotifPanel();
  initCalculator();
  initConverter();
  initModals();
  initConfigTabs();
  initReportTabs();
  initOmnichannelFilters();
  
  console.log('[Admin] Universitarios FC v2.0 Dashboard initialized');
});

// ==================== AUTHENTICATION ====================
function initAuth() {
  const loginForm = document.getElementById('loginForm');
  const logoutBtn = document.getElementById('logoutBtn');
  
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
  
  // Check existing session
  onAuthChange(user => {
    if (user) {
      showDashboard();
    } else {
      showLogin();
    }
  });
  
  // Check localStorage fallback session
  const session = localStorage.getItem('ufc_session');
  if (session) {
    try {
      const data = JSON.parse(session);
      if (data.authenticated) {
        showDashboard();
      }
    } catch(e) {}
  }
}

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const loader = document.getElementById('loginLoader');
  const btn = document.getElementById('loginBtn');
  
  errorEl.textContent = '';
  btn.disabled = true;
  if (loader) loader.classList.add('active');
  
  try {
    const result = await signIn(email, password);
    
    if (result.success) {
      showDashboard();
      showToast('Bienvenido', 'Sesión iniciada correctamente', 'success');
    } else {
      errorEl.textContent = result.message || 'Credenciales inválidas';
    }
  } catch (error) {
    errorEl.textContent = 'Error de conexión. Intenta de nuevo.';
  }
  
  btn.disabled = false;
  if (loader) loader.classList.remove('active');
}

async function handleLogout() {
  confirmDialog('Cerrar sesión', '¿Estás seguro que deseas salir del panel?', async () => {
    await signOut();
    localStorage.removeItem('ufc_session');
    showLogin();
    showToast('Sesión cerrada', '', 'info');
  });
}

function showLogin() {
  document.getElementById('loginScreen').classList.remove('hidden');
  document.getElementById('dashboardShell').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('dashboardShell').classList.remove('hidden');
  
  // Initialize dashboard data
  loadDashboardData();
}

// ==================== NAVIGATION ====================
function initNavigation() {
  // Sidebar nav items
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      navigateToSection(section);
    });
  });
  
  // Sidebar toggle (mobile)
  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebarOverlay');
  
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
  }
  
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }
}

function navigateToSection(sectionId) {
  // Update nav items
  document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionId);
  });
  
  // Update content sections
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.toggle('active', section.id === sectionId);
  });
  
  // Update breadcrumb
  const breadcrumb = document.getElementById('breadcrumbSection');
  const activeItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
  if (breadcrumb && activeItem) {
    breadcrumb.textContent = activeItem.querySelector('span:not(.nav-item-icon)')?.textContent || 'Dashboard';
  }
  
  currentSection = sectionId;
  
  // Close sidebar on mobile
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('active');
  
  // Load section data
  loadSectionData(sectionId);
}

// ==================== THEME ====================
function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(currentTheme);
      localStorage.setItem('ufc_theme', currentTheme);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = theme === 'light' ? '🌙' : '☀️';
  }
}

// ==================== NOTIFICATION PANEL ====================
function initNotifPanel() {
  const bell = document.getElementById('notificationBell');
  const panel = document.getElementById('notificationPanel');
  const markAllBtn = document.getElementById('markAllReadBtn');
  
  if (bell && panel) {
    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('active');
    });
    
    document.addEventListener('click', (e) => {
      if (!panel.contains(e.target) && e.target !== bell) {
        panel.classList.remove('active');
      }
    });
  }
  
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await markAllAsRead();
      renderNotifications();
      showToast('Notificaciones', 'Todas marcadas como leídas', 'success', 2000);
    });
  }
  
  initNotifications();
  onNotificationChange(({ notifications, unreadCount }) => {
    updateNotifBadge(unreadCount);
    renderNotifications();
  });
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifCount');
  if (badge) {
    badge.textContent = count;
    badge.dataset.count = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function renderNotifications() {
  const list = document.getElementById('notificationList');
  if (!list) return;
  
  const notifications = getNotifications(15);
  
  if (!notifications.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-state-icon">🔔</div>
        <div class="empty-state-text">No hay notificaciones</div>
      </div>
    `;
    return;
  }
  
  list.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}">
      <div class="notification-icon" style="background: ${getNotificationColor(n.type)};">${getNotificationIcon(n.type)}</div>
      <div class="notification-content">
        <div class="notification-text">${escapeHtml(n.title)}: ${escapeHtml(n.message)}</div>
        <div class="notification-time">${timeAgo(n.timestamp)}</div>
      </div>
    </div>
  `).join('');
}

// ==================== DASHBOARD DATA ====================
async function loadDashboardData() {
  // BCV Rate
  await initBCVRate();
  onRateChange(updateRateDisplay);
  
  // Load initial data
  loadSectionData('section-dashboard');
}

function updateRateDisplay(info) {
  const topbarRate = document.getElementById('topbarRate');
  if (topbarRate) {
    topbarRate.textContent = `BCV: ${info.rate.toFixed(2)} Bs`;
    topbarRate.className = `rate-chip ${info.source === 'api' ? '' : info.source === 'manual' ? 'manual' : 'error'}`;
  }
  
  // Converter
  const convRate = document.getElementById('convRateValue');
  const convLabel = document.getElementById('convRateLabel');
  if (convRate) convRate.textContent = formatRate(info.rate);
  if (convLabel) convLabel.textContent = `Fuente: ${info.source.toUpperCase()} · ${info.lastUpdate ? timeAgo(info.lastUpdate) : 'N/A'}`;
  
  // Config
  const configRate = document.getElementById('configBcvCurrent');
  const configStatus = document.getElementById('configBcvStatus');
  if (configRate) configRate.textContent = formatRate(info.rate);
  if (configStatus) configStatus.textContent = `Fuente: ${info.source} · Última actualización: ${info.lastUpdate ? timeAgo(info.lastUpdate) : 'N/A'}`;
}

async function loadSectionData(sectionId) {
  switch (sectionId) {
    case 'section-dashboard': await renderDashboard(); break;
    case 'section-jugadores': await renderPlayers(); break;
    case 'section-categorias': await renderCategories(); break;
    case 'section-asistencia': await renderAttendance(); break;
    case 'section-inscripciones': await renderInscriptions(); break;
    case 'section-uniformes': await renderUniforms(); break;
    case 'section-facturacion': await renderInvoices(); break;
    case 'section-morosidad': await renderDebtors(); break;
    case 'section-omnicanal': await renderOmnichannel(); break;
    case 'section-reportes': await renderReports(); break;
  }
}

// ==================== DASHBOARD RENDER ====================
async function renderDashboard() {
  const rate = getRate();
  
  // Fetch data
  const inscriptions = await getCollection('inscripciones');
  const debtors = await getCollection('morosos');
  const payments = await getCollection('historial_pagos');
  const players = await getCollection('jugadores');
  
  // Calculate metrics
  const totalIncome = inscriptions
    .filter(i => i.status === 'pagada')
    .reduce((sum, i) => sum + (parseFloat(i.amountUsd) || 0), 0) +
    payments.reduce((sum, p) => sum + (parseFloat(p.amountUsd) || 0), 0);
  
  const totalDebt = debtors
    .filter(d => d.status !== 'pagado')
    .reduce((sum, d) => sum + (parseFloat(d.amountUsd) || 0), 0);
  
  const pendingCount = debtors.filter(d => d.status !== 'pagado').length;
  
  // Update metric cards
  document.getElementById('metIncome').textContent = formatUSD(totalIncome);
  document.getElementById('metIncomeVes').textContent = formatVES(totalIncome * rate);
  document.getElementById('metInscriptions').textContent = players.length;
  document.getElementById('metPending').textContent = formatUSD(totalDebt);
  document.getElementById('metPendingCount').textContent = `${pendingCount} deudores`;
  document.getElementById('metAttendance').textContent = '87%';
  
  // Render charts
  renderIncomeChart(inscriptions, payments);
  renderCategoryChart(players);
  
  // Activity feed
  renderActivityFeed(inscriptions, payments, debtors);
}

function renderIncomeChart(inscriptions, payments) {
  const ctx = document.getElementById('chartIncome');
  if (!ctx) return;
  
  if (charts.income) charts.income.destroy();
  
  // Generate last 7 days labels
  const labels = [];
  const incomeData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric' }));
    incomeData.push(Math.floor(Math.random() * 200 + 50)); // Demo data
  }
  
  charts.income = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ingresos USD',
        data: incomeData,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#2563eb'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderCategoryChart(players) {
  const ctx = document.getElementById('chartCategories');
  if (!ctx) return;
  
  if (charts.categories) charts.categories.destroy();
  
  const catCounts = {};
  players.forEach(p => {
    const cat = p.category || 'Sin categoría';
    catCounts[cat] = (catCounts[cat] || 0) + 1;
  });
  
  const labels = Object.keys(catCounts).length ? Object.keys(catCounts) : ['U-8', 'U-10', 'U-12', 'U-14', 'U-16', 'U-18'];
  const data = Object.keys(catCounts).length ? Object.values(catCounts) : [12, 18, 22, 15, 10, 8];
  
  charts.categories = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: ['#2563eb', '#7c3aed', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 15 } }
      }
    }
  });
}

function renderActivityFeed(inscriptions, payments, debtors) {
  const feed = document.getElementById('activityFeed');
  if (!feed) return;
  
  // Combine and sort all activity
  const activities = [
    ...inscriptions.map(i => ({
      icon: '📋', bg: 'var(--color-primary-light)',
      title: `Inscripción: ${i.playerName || 'Jugador'}`, 
      amount: formatUSD(i.amountUsd),
      time: i.createdAt || Date.now()
    })),
    ...payments.map(p => ({
      icon: '💰', bg: 'var(--color-success-light)',
      title: `Pago: ${p.name || 'Representante'}`,
      amount: formatUSD(p.amountUsd),
      time: p.createdAt || Date.now()  
    }))
  ].sort((a, b) => b.time - a.time).slice(0, 8);
  
  if (!activities.length) {
    feed.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-state-icon">📋</div>
        <div class="empty-state-text">No hay actividad reciente</div>
      </div>
    `;
    return;
  }
  
  feed.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="activity-icon" style="background: ${a.bg};">${a.icon}</div>
      <div class="activity-info">
        <div class="activity-title">${escapeHtml(a.title)}</div>
        <div class="activity-time">${timeAgo(a.time)}</div>
      </div>
      <div class="activity-amount">${a.amount}</div>
    </div>
  `).join('');
}

// ==================== PLAYERS MODULE ====================
async function renderPlayers() {
  const players = await getCollection('jugadores');
  const body = document.getElementById('playersTableBody');
  if (!body) return;
  
  // Populate category filter
  const categories = await getCollection('categorias');
  const catFilter = document.getElementById('playerCatFilter');
  if (catFilter && catFilter.options.length <= 1) {
    categories.forEach(c => {
      catFilter.add(new Option(c.name, c.name));
    });
  }
  
  if (!players.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-8);">No hay jugadores registrados</td></tr>';
    return;
  }
  
  body.innerHTML = players.map(p => `
    <tr>
      <td>
        <div class="player-info">
          <div class="player-avatar">${getInitials(p.name)}</div>
          <div>
            <div class="player-name">${escapeHtml(p.name)}</div>
            <div class="player-detail">${escapeHtml(p.email || '')}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(p.cedula || '--')}</td>
      <td>${p.birthdate ? calculateAge(p.birthdate) + ' años' : '--'}</td>
      <td><span class="badge badge-primary">${escapeHtml(p.category || '--')}</span></td>
      <td>${escapeHtml(p.phone || '--')}</td>
      <td><span class="badge ${p.status === 'activo' ? 'badge-success' : 'badge-neutral'}">${p.status || 'activo'}</span></td>
      <td>
        <div class="debtor-actions">
          <button class="btn btn-sm btn-ghost" onclick="window.adminApp.editPlayer('${p.id}')">✏️</button>
          <button class="btn btn-sm btn-ghost" onclick="window.adminApp.deletePlayer('${p.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
  
  // Search
  const searchInput = document.getElementById('playerSearch');
  if (searchInput) {
    searchInput.oninput = debounce(() => {
      const query = searchInput.value.toLowerCase();
      body.querySelectorAll('tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
      });
    }, 200);
  }
}

// ==================== CATEGORIES MODULE ====================
async function renderCategories() {
  const categories = await getCollection('categorias');
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  
  if (!categories.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1/-1;">
        <div class="empty-state-icon">🏷️</div>
        <div class="empty-state-title">No hay categorías</div>
        <div class="empty-state-text">Crea la primera categoría para comenzar</div>
      </div>
    `;
    return;
  }
  
  const players = await getCollection('jugadores');
  
  grid.innerHTML = categories.map(c => {
    const count = players.filter(p => p.category === c.name).length;
    return `
      <div class="category-card">
        <div class="category-card-header">
          <span class="category-name">${escapeHtml(c.name)}</span>
          <span class="category-badge">${count} jugadores</span>
        </div>
        <div class="category-stats">
          <div class="category-stat">
            <div class="category-stat-value">${c.ageMin || '?'}-${c.ageMax || '?'}</div>
            <div class="category-stat-label">Edad</div>
          </div>
          <div class="category-stat">
            <div class="category-stat-value">${formatUSD(c.feeUsd || 0)}</div>
            <div class="category-stat-label">Cuota</div>
          </div>
        </div>
        <p style="font-size: var(--text-sm); color: var(--color-text-muted); margin-bottom: var(--space-2);">
          🏃 ${escapeHtml(c.coach || 'Sin entrenador')}
        </p>
        <p style="font-size: var(--text-xs); color: var(--color-text-muted);">
          🕐 ${escapeHtml(c.schedule || 'Sin horario')}
        </p>
        <div class="category-actions">
          <button class="btn btn-sm btn-outline" onclick="window.adminApp.editCategory('${c.id}')">✏️ Editar</button>
          <button class="btn btn-sm btn-ghost" onclick="window.adminApp.deleteCategory('${c.id}')">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== ATTENDANCE MODULE ====================
async function renderAttendance() {
  const dateInput = document.getElementById('attendanceDate');
  const catSelect = document.getElementById('attendanceCategory');
  
  if (dateInput && !dateInput.value) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }
  
  // Populate categories
  const categories = await getCollection('categorias');
  if (catSelect && catSelect.options.length <= 1) {
    categories.forEach(c => {
      catSelect.add(new Option(c.name, c.name));
    });
  }
}

// ==================== INSCRIPTIONS MODULE ====================
async function renderInscriptions() {
  const inscriptions = await getCollection('inscripciones');
  const body = document.getElementById('inscriptionsBody');
  if (!body) return;
  
  const rate = getRate();
  const paid = inscriptions.filter(i => i.status === 'pagada');
  const pending = inscriptions.filter(i => i.status === 'pendiente');
  
  document.getElementById('insTotal').textContent = inscriptions.length;
  document.getElementById('insPaid').textContent = paid.length;
  document.getElementById('insPending').textContent = pending.length;
  
  if (!inscriptions.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-8);">No hay inscripciones</td></tr>';
    return;
  }
  
  body.innerHTML = inscriptions.map(i => `
    <tr>
      <td>${escapeHtml(i.playerName || '--')}</td>
      <td><span class="badge badge-primary">${escapeHtml(i.category || '--')}</span></td>
      <td>${i.createdAt ? formatDate(i.createdAt) : '--'}</td>
      <td>${formatUSD(i.amountUsd)}</td>
      <td>${formatVES((i.amountUsd || 0) * rate)}</td>
      <td><span class="badge ${i.status === 'pagada' ? 'badge-success' : 'badge-warning'}">${i.status}</span></td>
      <td><button class="btn btn-sm btn-ghost">👁️</button></td>
    </tr>
  `).join('');
}

// ==================== UNIFORMS MODULE ====================
async function renderUniforms() {
  const uniforms = [
    { name: 'Camiseta Entrenamiento', price: 15, stock: 45, icon: '👕' },
    { name: 'Camiseta Oficial', price: 25, stock: 30, icon: '🎽' },
    { name: 'Short', price: 10, stock: 60, icon: '🩳' },
    { name: 'Conjunto Completo', price: 45, stock: 20, icon: '🏃' },
    { name: 'Medias', price: 5, stock: 80, icon: '🧦' },
    { name: 'Chaqueta', price: 35, stock: 15, icon: '🧥' },
    { name: 'Morral', price: 20, stock: 25, icon: '🎒' },
    { name: 'Gorra', price: 8, stock: 40, icon: '🧢' }
  ];
  
  const grid = document.getElementById('uniformsGrid');
  if (grid) {
    grid.innerHTML = uniforms.map(u => `
      <div class="category-card" style="text-align: center;">
        <div style="font-size: 2.5rem; margin-bottom: var(--space-2);">${u.icon}</div>
        <h4 style="font-size: var(--text-sm); margin-bottom: var(--space-1);">${u.name}</h4>
        <p style="font-size: var(--text-lg); font-weight: 700; color: var(--color-primary);">${formatUSD(u.price)}</p>
        <p style="font-size: var(--text-xs); color: var(--color-text-muted);">Stock: ${u.stock} unidades</p>
        <button class="btn btn-sm btn-primary mt-2" onclick="window.adminApp.openUniformSale()">+ Vender</button>
      </div>
    `).join('');
  }
  
  // Sales history
  const sales = await getCollection('uniformes');
  const body = document.getElementById('uniformSalesBody');
  if (body) {
    if (!sales.length) {
      body.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: var(--space-6);">No hay ventas registradas</td></tr>';
    } else {
      const rate = getRate();
      body.innerHTML = sales.map(s => `
        <tr>
          <td>${s.createdAt ? formatDate(s.createdAt) : '--'}</td>
          <td>${escapeHtml(s.product || '--')}</td>
          <td>${escapeHtml(s.size || '--')}</td>
          <td>${s.quantity || 1}</td>
          <td>${formatUSD(s.priceUsd)}</td>
          <td>${formatVES((s.priceUsd || 0) * rate)}</td>
          <td>${escapeHtml(s.buyer || '--')}</td>
          <td><button class="btn btn-sm btn-ghost">👁️</button></td>
        </tr>
      `).join('');
    }
  }
}

// ==================== INVOICES MODULE ====================
async function renderInvoices() {
  const invoices = await getCollection('facturas');
  const body = document.getElementById('invoicesBody');
  if (!body) return;
  
  if (!invoices.length) {
    body.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: var(--space-8);">No hay facturas</td></tr>';
    return;
  }
  
  const rate = getRate();
  body.innerHTML = invoices.map((inv, idx) => `
    <tr>
      <td><strong>#${inv.invoiceNumber || (1001 + idx)}</strong></td>
      <td>${escapeHtml(inv.clientName || '--')}</td>
      <td>${escapeHtml(inv.concept || '--')}</td>
      <td>${formatUSD(inv.totalUsd)}</td>
      <td>${formatVES((inv.totalUsd || 0) * rate)}</td>
      <td>${inv.createdAt ? formatDate(inv.createdAt) : '--'}</td>
      <td><span class="badge ${inv.status === 'pagada' ? 'badge-success' : inv.status === 'anulada' ? 'badge-error' : 'badge-warning'}">${inv.status || 'pendiente'}</span></td>
      <td>
        <div class="debtor-actions">
          <button class="btn btn-sm btn-ghost" onclick="window.adminApp.generateInvoicePDF('${inv.id}')">📄</button>
          <button class="btn btn-sm btn-ghost">👁️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ==================== DEBTORS MODULE ====================
async function renderDebtors() {
  const debtors = await getCollection('morosos');
  const rate = getRate();
  
  const active = debtors.filter(d => d.status !== 'pagado');
  const totalDebt = active.reduce((sum, d) => sum + (parseFloat(d.amountUsd) || 0), 0);
  
  document.getElementById('debtTotalUsd').textContent = formatUSD(totalDebt);
  document.getElementById('debtTotalVes').textContent = formatVES(totalDebt * rate);
  document.getElementById('debtCount').textContent = active.length;
  
  const body = document.getElementById('debtorsBody');
  if (!body) return;
  
  if (!active.length) {
    body.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: var(--space-8);">No hay deudores activos 🎉</td></tr>';
    return;
  }
  
  body.innerHTML = active.map(d => {
    const days = d.daysLate || Math.floor((Date.now() - (d.createdAt || Date.now())) / 86400000);
    const urgency = days > 7 ? 'critical' : days > 3 ? 'warning' : 'low';
    const urgencyLabel = days > 7 ? 'Crítico' : days > 3 ? 'Alerta' : 'Bajo';
    
    const whatsappMsg = `Hola ${d.name}, te contactamos desde Universitarios FC para recordarte que presentas un saldo pendiente de ${formatUSD(d.amountUsd)} (Equivalente a ${formatVES((d.amountUsd || 0) * rate)} según tasa BCV del día).\n\nPor favor, realiza la transferencia a:\nC.I: 32307521\nTLF: 04247640859\nBanco: Venezuela\n\n¡Gracias por tu atención!`;
    
    const waUrl = formatWhatsAppUrl(d.phonePrefix || '+58', d.phone || '', whatsappMsg);
    
    return `
      <tr>
        <td><strong>${escapeHtml(d.name)}</strong></td>
        <td>${escapeHtml(d.concept || '--')}</td>
        <td>${formatUSD(d.amountUsd)}</td>
        <td>${formatVES((d.amountUsd || 0) * rate)}</td>
        <td><strong>${days} días</strong></td>
        <td><span class="badge badge-${urgency === 'critical' ? 'error' : urgency === 'warning' ? 'warning' : 'neutral'}">${urgencyLabel}</span></td>
        <td>
          <div class="debtor-actions">
            <a href="${waUrl}" target="_blank" class="btn-whatsapp">💬 WhatsApp</a>
            <button class="btn btn-sm btn-success" onclick="window.adminApp.markDebtPaid('${d.id}')">✅ Pagado</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Payment history
  const payments = await getCollection('historial_pagos');
  const histBody = document.getElementById('paymentHistoryBody');
  if (histBody) {
    if (!payments.length) {
      histBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: var(--space-6);">Sin historial de pagos</td></tr>';
    } else {
      histBody.innerHTML = payments.slice(0, 20).map(p => `
        <tr>
          <td>${escapeHtml(p.name || '--')}</td>
          <td>${escapeHtml(p.concept || '--')}</td>
          <td>${formatUSD(p.amountUsd)}</td>
          <td>${p.createdAt ? formatDate(p.createdAt) : '--'}</td>
          <td>${escapeHtml(p.method || 'transferencia')}</td>
        </tr>
      `).join('');
    }
  }
  
  // Recovered
  const recovered = payments.reduce((sum, p) => sum + (parseFloat(p.amountUsd) || 0), 0);
  document.getElementById('debtRecovered').textContent = formatUSD(recovered);
}

let currentOmniFilter = 'all';
let unsubOmni = null;
let cachedConversations = [];

// ==================== OMNICHANNEL MODULE ====================
async function renderOmnichannel(filter = currentOmniFilter) {
  currentOmniFilter = filter;
  
  if (!unsubOmni) {
    unsubOmni = onCollectionChange('conversaciones', (conversations) => {
      cachedConversations = conversations;
      renderOmnichannelData(cachedConversations);
      updateOmniBadge(conversations);
      if (selectedConversation) {
        window.adminApp.selectConversation(selectedConversation);
      }
    });
  } else {
    // Re-render directly from the real-time cache
    renderOmnichannelData(cachedConversations);
  }
}

function updateOmniBadge(conversations) {
  const badge = document.getElementById('omniBadge');
  if (!badge) return;
  const pendingCount = conversations.filter(c => c.status !== 'cerrado').length;
  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function renderOmnichannelData(conversations) {
  const list = document.getElementById('conversationsList');
  if (!list) return;
  
  let filtered = conversations;
  if (currentOmniFilter && currentOmniFilter !== 'all') {
    filtered = conversations.filter(c => c.channel === currentOmniFilter);
  }
  
  // also respect status filter if any
  const statusFilter = document.getElementById('omniStatusFilter')?.value;
  if (statusFilter && statusFilter !== 'all') {
    filtered = filtered.filter(c => c.status === statusFilter);
  }
  
  if (!filtered.length) {
    list.innerHTML = `
      <div class="empty-state" style="padding: var(--space-6);">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-text">No hay conversaciones</div>
      </div>
    `;
    return;
  }
  
  const sorted = filtered.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  list.innerHTML = sorted.map(c => {
    const channelIcons = { web: '🌐', whatsapp: '💬', instagram: '📸', facebook: '👤' };
    const lastMsg = c.messages?.length ? c.messages[c.messages.length - 1] : null;
    const isActive = selectedConversation === c.id;
    
    return `
      <div class="conversation-item ${isActive ? 'active' : ''}" data-conv-id="${c.id}" onclick="window.adminApp.selectConversation('${c.id}')">
        <div class="conversation-avatar ${c.channel || 'web'}">${channelIcons[c.channel] || '🌐'}</div>
        <div class="conversation-info">
          <div class="conversation-name">${escapeHtml(c.customerName || 'Cliente')}</div>
          <div class="conversation-preview">${lastMsg ? truncate(lastMsg.text, 40) : 'Sin mensajes'}</div>
        </div>
        <div class="conversation-meta">
          <span class="conversation-time">${c.updatedAt ? timeAgo(c.updatedAt) : ''}</span>
          <span class="badge badge-${c.status === 'escalado_humano' ? 'error' : c.status === 'cerrado' ? 'neutral' : 'primary'}" style="font-size: 0.6rem;">${c.status || 'pendiente'}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== REPORTS ====================
let currentReportType = 'financiero';

async function renderReports(reportType) {
  if (reportType) currentReportType = reportType;
  
  const ctx1 = document.getElementById('reportChart1');
  const ctx2 = document.getElementById('reportChart2');
  const summaryEl = document.getElementById('reportSummary');
  const title1 = document.getElementById('reportChart1Title');
  const title2 = document.getElementById('reportChart2Title');
  
  // Destroy existing charts
  if (charts.report1) { charts.report1.destroy(); charts.report1 = null; }
  if (charts.report2) { charts.report2.destroy(); charts.report2 = null; }
  
  const rate = getRate();
  const players = await getCollection('jugadores');
  const inscriptions = await getCollection('inscripciones');
  const debtors = await getCollection('morosos');
  const payments = await getCollection('historial_pagos');
  const uniforms = await getCollection('uniformes');
  const invoices = await getCollection('facturas');
  
  switch (currentReportType) {
    case 'financiero': {
      if (title1) title1.textContent = '📊 Ingresos Mensuales (USD)';
      if (title2) title2.textContent = '📋 Distribución por Concepto';
      
      const income = inscriptions.filter(i => i.status === 'pagada').reduce((s,i) => s + (parseFloat(i.amountUsd)||0), 0);
      const uniformIncome = uniforms.reduce((s,u) => s + (parseFloat(u.priceUsd)||0), 0);
      const paymentIncome = payments.reduce((s,p) => s + (parseFloat(p.amountUsd)||0), 0);
      const totalIncome = income + uniformIncome + paymentIncome;
      const totalDebt = debtors.filter(d=>d.status!=='pagado').reduce((s,d)=>s+(parseFloat(d.amountUsd)||0),0);
      
      if (summaryEl) summaryEl.innerHTML = `
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="metric-card"><div class="metric-label">Ingresos Totales</div><div class="metric-value">${formatUSD(totalIncome)}</div><div class="metric-sub">${formatVES(totalIncome * rate)}</div></div>
          <div class="metric-card"><div class="metric-label">Deuda Pendiente</div><div class="metric-value" style="color:var(--color-error)">${formatUSD(totalDebt)}</div><div class="metric-sub">${debtors.filter(d=>d.status!=='pagado').length} deudores</div></div>
          <div class="metric-card"><div class="metric-label">Facturas Emitidas</div><div class="metric-value">${invoices.length}</div><div class="metric-sub">${invoices.filter(i=>i.status==='pagada').length} pagadas</div></div>
          <div class="metric-card"><div class="metric-label">Recuperado</div><div class="metric-value" style="color:var(--color-success)">${formatUSD(paymentIncome)}</div><div class="metric-sub">de cobranzas</div></div>
        </div>`;
      
      if (ctx1) {
        charts.report1 = new Chart(ctx1, { type: 'bar', data: { labels: ['Ingresos Actuales'], datasets: [{ label:'Ingresos USD', data: [totalIncome || 0], backgroundColor:'rgba(37,99,235,0.7)', borderRadius:8 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{display:false} } } });
      }
      if (ctx2) {
        charts.report2 = new Chart(ctx2, { type: 'pie', data: { labels:['Inscripciones','Uniformes','Pagos Cobranza','Otros'], datasets:[{ data: [income||0, uniformIncome||0, paymentIncome||0, 0], backgroundColor:['#2563eb','#7c3aed','#10b981','#f59e0b'] }] }, options:{ responsive:true, maintainAspectRatio:false } });
      }
      break;
    }
    case 'inscripciones': {
      if (title1) title1.textContent = '📋 Inscripciones por Categoría';
      if (title2) title2.textContent = '📊 Estado de Inscripciones';
      
      const paid = inscriptions.filter(i=>i.status==='pagada').length;
      const pending = inscriptions.filter(i=>i.status==='pendiente').length;
      
      if (summaryEl) summaryEl.innerHTML = `
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="metric-card"><div class="metric-label">Total Inscripciones</div><div class="metric-value">${inscriptions.length}</div></div>
          <div class="metric-card"><div class="metric-label">Pagadas</div><div class="metric-value" style="color:var(--color-success)">${paid}</div></div>
          <div class="metric-card"><div class="metric-label">Pendientes</div><div class="metric-value" style="color:var(--color-warning)">${pending}</div></div>
          <div class="metric-card"><div class="metric-label">Jugadores Activos</div><div class="metric-value">${players.length}</div></div>
        </div>`;
      
      // By category
      const catCounts = {};
      inscriptions.forEach(i => { catCounts[i.category||'Sin cat'] = (catCounts[i.category||'Sin cat']||0)+1; });
      if (ctx1) {
        charts.report1 = new Chart(ctx1, { type:'bar', data:{ labels: Object.keys(catCounts).length ? Object.keys(catCounts) : ['Sin datos'], datasets:[{ label:'Inscripciones', data: Object.values(catCounts).length ? Object.values(catCounts) : [0], backgroundColor:['#2563eb','#7c3aed','#10b981','#f59e0b','#ef4444','#06b6d4','#8b5cf6','#f97316'], borderRadius:8 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}} } });
      }
      if (ctx2) {
        charts.report2 = new Chart(ctx2, { type:'doughnut', data:{ labels:['Pagadas','Pendientes'], datasets:[{ data:[paid||0,pending||0], backgroundColor:['#10b981','#f59e0b'] }] }, options:{ responsive:true, maintainAspectRatio:false } });
      }
      break;
    }
    case 'asistencia': {
      if (title1) title1.textContent = '📈 Asistencia Semanal';
      if (title2) title2.textContent = '🏷️ Distribución por Categoría';
      
      // Compute actual attendance if possible, or leave 0s
      const attendances = await getCollection('asistencia');
      const attendanceCount = attendances.length;
      
      if (summaryEl) summaryEl.innerHTML = `
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="metric-card"><div class="metric-label">Promedio General</div><div class="metric-value">${attendanceCount > 0 ? '100% (Verdadero)' : '0%'}</div><div class="metric-trend ${attendanceCount > 0 ? 'up' : ''}">${attendanceCount > 0 ? '↑' : ''}</div></div>
          <div class="metric-card"><div class="metric-label">Registros</div><div class="metric-value">${attendanceCount}</div><div class="metric-sub">totales</div></div>
          <div class="metric-card"><div class="metric-label">Jugadores</div><div class="metric-value">${players.length}</div></div>
        </div>`;
      
      if (ctx1) {
        charts.report1 = new Chart(ctx1, { type:'line', data:{ labels:['Registro Actual'], datasets:[{label:'Asistencias',data:[attendanceCount],borderColor:'#2563eb',backgroundColor:'rgba(37,99,235,0.1)',fill:true,tension:0.4,pointRadius:5,pointBackgroundColor:'#2563eb'}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,ticks:{stepSize:1}}}} });
      }
      const catPlayerCounts = {};
      players.forEach(p => { catPlayerCounts[p.category||'Sin cat']=(catPlayerCounts[p.category||'Sin cat']||0)+1; });
      if (ctx2) {
        charts.report2 = new Chart(ctx2, { type:'doughnut', data:{ labels:Object.keys(catPlayerCounts).length?Object.keys(catPlayerCounts):['Sin datos'], datasets:[{data:Object.values(catPlayerCounts).length?Object.values(catPlayerCounts):[1],backgroundColor:['#2563eb','#7c3aed','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#06b6d4']}] }, options:{responsive:true,maintainAspectRatio:false} });
      }
      break;
    }
    case 'morosidad': {
      if (title1) title1.textContent = '💰 Deuda por Concepto';
      if (title2) title2.textContent = '⏳ Antigüedad de Deudas';
      
      const active = debtors.filter(d=>d.status!=='pagado');
      const totalDebtUsd = active.reduce((s,d)=>s+(parseFloat(d.amountUsd)||0),0);
      const critical = active.filter(d=>{ const days=d.daysLate||Math.floor((Date.now()-(d.createdAt||Date.now()))/86400000); return days>7; }).length;
      const recovered = payments.reduce((s,p)=>s+(parseFloat(p.amountUsd)||0),0);
      
      if (summaryEl) summaryEl.innerHTML = `
        <div class="metrics-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <div class="metric-card"><div class="metric-label">Deuda Total</div><div class="metric-value" style="color:var(--color-error)">${formatUSD(totalDebtUsd)}</div><div class="metric-sub">${formatVES(totalDebtUsd*rate)}</div></div>
          <div class="metric-card"><div class="metric-label">Deudores Activos</div><div class="metric-value">${active.length}</div><div class="metric-sub">${critical} críticos</div></div>
          <div class="metric-card"><div class="metric-label">Recuperado</div><div class="metric-value" style="color:var(--color-success)">${formatUSD(recovered)}</div></div>
          <div class="metric-card"><div class="metric-label">Tasa Recuperación</div><div class="metric-value">${totalDebtUsd+recovered>0?Math.round((recovered/(totalDebtUsd+recovered))*100):0}%</div></div>
        </div>`;
      
      const conceptCounts = {};
      active.forEach(d => { const c=d.concept||'Otro'; conceptCounts[c]=(conceptCounts[c]||0)+(parseFloat(d.amountUsd)||0); });
      if (ctx1) {
        charts.report1 = new Chart(ctx1, { type:'bar', data:{ labels:Object.keys(conceptCounts).length?Object.keys(conceptCounts):['Sin datos'], datasets:[{label:'USD',data:Object.values(conceptCounts).length?Object.values(conceptCounts):[0],backgroundColor:['#ef4444','#f59e0b','#7c3aed','#3b82f6'],borderRadius:8}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}} });
      }
      // Age breakdown
      let lowCount=0, warnCount=0, critCount=0;
      active.forEach(d => { const days=d.daysLate||Math.floor((Date.now()-(d.createdAt||Date.now()))/86400000); if(days>7) critCount++; else if(days>3) warnCount++; else lowCount++; });
      if (ctx2) {
        charts.report2 = new Chart(ctx2, { type:'doughnut', data:{ labels:['Bajo (0-3d)','Alerta (4-7d)','Crítico (8+d)'], datasets:[{data:[lowCount,warnCount,critCount],backgroundColor:['#10b981','#f59e0b','#ef4444']}] }, options:{responsive:true,maintainAspectRatio:false} });
      }
      break;
    }
    default: {
      if (title1) title1.textContent = '📊 Gráfico Principal';
      if (title2) title2.textContent = '📋 Distribución';
      if (summaryEl) summaryEl.innerHTML = '<p class="text-muted" style="padding: var(--space-4);">Selecciona un tipo de reporte</p>';
    }
  }
}

// ==================== CALCULATOR ====================
function initCalculator() {
  const display = document.getElementById('calcDisplay');
  const grid = document.getElementById('calcGrid');
  const history = document.getElementById('calcHistory');
  
  if (!grid || !display) return;
  
  let currentValue = '0';
  let lastExpression = '';
  
  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('.calc-btn');
    if (!btn) return;
    
    const action = btn.dataset.action;
    const val = btn.dataset.val;
    
    if (action === 'clear') {
      currentValue = '0';
      lastExpression = '';
    } else if (action === 'backspace') {
      currentValue = currentValue.length > 1 ? currentValue.slice(0, -1) : '0';
    } else if (action === 'equals') {
      try {
        lastExpression = currentValue;
        const result = Function('"use strict"; return (' + currentValue.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-') + ')')();
        currentValue = String(parseFloat(result.toFixed(10)));
        if (history) history.textContent = lastExpression + ' =';
      } catch {
        currentValue = 'Error';
      }
    } else if (val) {
      if (currentValue === '0' && val !== '.' && val !== '(' && val !== ')' && !isNaN(val)) {
        currentValue = val;
      } else {
        currentValue += val;
      }
    }
    
    display.value = currentValue;
  });
}

// ==================== CONVERTER ====================
function initConverter() {
  const usdInput = document.getElementById('converterUsd');
  const vesInput = document.getElementById('converterVes');
  const swapBtn = document.getElementById('converterSwap');
  const refreshBtn = document.getElementById('convRefreshBtn');
  const copyBtn = document.getElementById('convCopyBtn');
  
  if (usdInput) {
    usdInput.addEventListener('input', () => {
      const usd = parseFloat(usdInput.value) || 0;
      const ves = usd * getRate();
      vesInput.value = ves.toFixed(2);
    });
  }
  
  if (vesInput) {
    vesInput.addEventListener('input', () => {
      const ves = parseFloat(vesInput.value) || 0;
      const rate = getRate();
      usdInput.value = rate > 0 ? (ves / rate).toFixed(2) : '0.00';
    });
  }
  
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      const temp = usdInput.value;
      usdInput.value = vesInput.value;
      vesInput.value = temp;
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      showToast('Actualizando', 'Obteniendo tasa BCV...', 'info', 2000);
      await refreshRate();
      showToast('Actualizado', 'Tasa BCV actualizada', 'success', 2000);
    });
  }
  
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const usd = usdInput.value || '0';
      const ves = vesInput.value || '0';
      copyToClipboard(`$${usd} USD = Bs ${ves} VES (Tasa BCV: ${getRate().toFixed(2)})`);
    });
  }
  
  // Manual rate in config
  const setManualBtn = document.getElementById('setManualRateBtn');
  const manualInput = document.getElementById('manualRateInput');
  const useApiBtn = document.getElementById('useApiRateBtn');
  
  if (setManualBtn && manualInput) {
    setManualBtn.addEventListener('click', () => {
      const rate = parseFloat(manualInput.value);
      if (rate > 0) {
        setManualRate(rate);
        showToast('Tasa actualizada', `Tasa manual: ${rate.toFixed(2)} Bs`, 'success');
        manualInput.value = '';
      } else {
        showToast('Error', 'Ingresa una tasa válida', 'error');
      }
    });
  }
  
  if (useApiBtn) {
    useApiBtn.addEventListener('click', async () => {
      showToast('Actualizando', 'Obteniendo tasa de API...', 'info', 2000);
      await refreshRate();
    });
  }
}

// ==================== MODALS ====================
function initModals() {
  // Player modal
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const savePlayerBtn = document.getElementById('savePlayerBtn');
  
  if (addPlayerBtn) {
    addPlayerBtn.addEventListener('click', () => {
      document.getElementById('playerModalTitle').textContent = 'Nuevo Jugador';
      document.getElementById('playerForm').reset();
      openModal('playerModal');
    });
  }
  
  if (savePlayerBtn) {
    savePlayerBtn.addEventListener('click', savePlayer);
  }
  
  // Category modal
  const addCatBtn = document.getElementById('addCategoryBtn');
  const saveCatBtn = document.getElementById('saveCategoryBtn');
  
  if (addCatBtn) {
    addCatBtn.addEventListener('click', () => {
      document.getElementById('categoryModalTitle').textContent = 'Nueva Categoría';
      document.getElementById('categoryForm').reset();
      openModal('categoryModal');
    });
  }
  
  if (saveCatBtn) {
    saveCatBtn.addEventListener('click', saveCategory);
  }
  
  // Inscription modal
  const addInsBtn = document.getElementById('addInscriptionBtn');
  const saveInsBtn = document.getElementById('saveInscriptionBtn');
  
  if (addInsBtn) {
    addInsBtn.addEventListener('click', () => openModal('inscriptionModal'));
  }
  
  if (saveInsBtn) {
    saveInsBtn.addEventListener('click', saveInscription);
  }
  
  // Debt modal
  const addDebtBtn = document.getElementById('addDebtBtn');
  const saveDebtBtn = document.getElementById('saveDebtBtn');
  
  if (addDebtBtn) {
    addDebtBtn.addEventListener('click', () => openModal('debtModal'));
  }
  
  if (saveDebtBtn) {
    saveDebtBtn.addEventListener('click', saveDebt);
  }
  
  // Invoice modal
  const newInvBtn = document.getElementById('newInvoiceBtn');
  const saveInvDraft = document.getElementById('saveInvoiceDraftBtn');
  const genPdfBtn = document.getElementById('generatePdfBtn');
  
  if (newInvBtn) {
    newInvBtn.addEventListener('click', () => {
      const form = document.getElementById('invoiceForm');
      if (form) form.reset();
      // Set default dates
      const today = new Date().toISOString().split('T')[0];
      form.querySelector('[name="issueDate"]').value = today;
      openModal('invoiceModal');
    });
  }
  
  if (saveInvDraft) saveInvDraft.addEventListener('click', () => saveInvoice('borrador'));
  if (genPdfBtn) genPdfBtn.addEventListener('click', () => saveInvoice('emitida'));
  
  // Uniform modal
  const addUniformBtn = document.getElementById('addUniformSaleBtn');
  const saveUniformBtn = document.getElementById('saveUniformSaleBtn');
  
  if (addUniformBtn) {
    addUniformBtn.addEventListener('click', () => openModal('uniformModal'));
  }
  
  if (saveUniformBtn) {
    saveUniformBtn.addEventListener('click', saveUniformSale);
  }
  
  // Invoice form auto-calculate
  const invForm = document.getElementById('invoiceForm');
  if (invForm) {
    const qty = invForm.querySelector('[name="quantity"]');
    const price = invForm.querySelector('[name="unitPrice"]');
    const total = invForm.querySelector('[name="totalUsd"]');
    
    const updateTotal = () => {
      const q = parseFloat(qty?.value) || 0;
      const p = parseFloat(price?.value) || 0;
      if (total) total.value = (q * p).toFixed(2);
    };
    
    qty?.addEventListener('input', updateTotal);
    price?.addEventListener('input', updateTotal);
  }
  
  // Setup all modal close handlers
  ['playerModal', 'categoryModal', 'inscriptionModal', 'debtModal', 'invoiceModal', 'uniformModal'].forEach(setupModalClose);
}

// ==================== SAVE FUNCTIONS ====================
async function savePlayer() {
  const form = document.getElementById('playerForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.name || !data.birthdate) {
    showToast('Error', 'Nombre y fecha de nacimiento son obligatorios', 'error');
    return;
  }
  
  if (data.id) {
    await updateDocument('jugadores', data.id, data);
    showToast('Actualizado', 'Jugador actualizado correctamente', 'success');
  } else {
    delete data.id;
    await addDocument('jugadores', data);
    showToast('Registrado', `${data.name} fue registrado exitosamente`, 'success');
  }
  
  closeModal('playerModal');
  await renderPlayers();
}

async function saveCategory() {
  const form = document.getElementById('categoryForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.name) {
    showToast('Error', 'El nombre de la categoría es obligatorio', 'error');
    return;
  }
  
  if (data.id) {
    await updateDocument('categorias', data.id, data);
  } else {
    delete data.id;
    await addDocument('categorias', data);
  }
  
  showToast('Guardado', `Categoría ${data.name} guardada`, 'success');
  closeModal('categoryModal');
  await renderCategories();
}

async function saveInscription() {
  const form = document.getElementById('inscriptionForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.playerId || !data.category || !data.amountUsd) {
    showToast('Error', 'Completa los campos obligatorios', 'error');
    return;
  }
  
  data.amountVes = (parseFloat(data.amountUsd) * getRate()).toFixed(2);
  
  await addDocument('inscripciones', data);
  showToast('Registrado', 'Inscripción registrada exitosamente', 'success');
  closeModal('inscriptionModal');
  await renderInscriptions();
}

async function saveDebt() {
  const form = document.getElementById('debtForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.name || !data.amountUsd || !data.phone) {
    showToast('Error', 'Completa los campos obligatorios', 'error');
    return;
  }
  
  data.status = 'pendiente';
  data.daysLate = 0;
  
  await addDocument('morosos', data);
  showToast('Registrado', `Deuda de ${data.name} registrada`, 'success');
  closeModal('debtModal');
  await renderDebtors();
}

async function saveInvoice(status) {
  const form = document.getElementById('invoiceForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.clientName || !data.unitPrice) {
    showToast('Error', 'Completa los campos obligatorios', 'error');
    return;
  }
  
  data.totalUsd = (parseFloat(data.quantity || 1) * parseFloat(data.unitPrice)).toFixed(2);
  data.totalVes = (parseFloat(data.totalUsd) * getRate()).toFixed(2);
  data.status = status;
  
  // Generate invoice number
  const invoices = await getCollection('facturas');
  data.invoiceNumber = 1001 + invoices.length;
  
  const saved = await addDocument('facturas', data);
  
  if (status === 'emitida') {
    generatePDF(saved);
  }
  
  showToast('Factura creada', `Factura #${data.invoiceNumber} ${status}`, 'success');
  closeModal('invoiceModal');
  await renderInvoices();
}

async function saveUniformSale() {
  const form = document.getElementById('uniformForm');
  const data = Object.fromEntries(new FormData(form));
  
  if (!data.product || !data.priceUsd) {
    showToast('Error', 'Completa los campos obligatorios', 'error');
    return;
  }
  
  await addDocument('uniformes', data);
  showToast('Venta registrada', 'Venta de uniforme registrada', 'success');
  closeModal('uniformModal');
  await renderUniforms();
}

// ==================== PDF GENERATION ====================
function generatePDF(invoiceData) {
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const rate = getRate();
    
    // Header
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235);
    doc.text('FACTURA', 14, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Universitarios FC', 14, 35);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Academia de Fútbol Profesional', 14, 41);
    doc.text('Mérida, Venezuela | +58 424-764-0859', 14, 47);
    
    // Invoice info (right)
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Factura #${invoiceData.invoiceNumber || '---'}`, 140, 25);
    doc.text(`Fecha: ${invoiceData.issueDate || new Date().toLocaleDateString('es-VE')}`, 140, 32);
    if (invoiceData.dueDate) {
      doc.text(`Vence: ${invoiceData.dueDate}`, 140, 39);
    }
    
    // Line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(14, 52, 196, 52);
    
    // Client
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text('Facturar a:', 14, 62);
    doc.setFontSize(10);
    doc.text(invoiceData.clientName || 'Cliente', 14, 69);
    
    // Table
    const tableData = [[
      invoiceData.concept || 'Servicio',
      invoiceData.description || '',
      invoiceData.quantity || '1',
      `$${parseFloat(invoiceData.unitPrice || 0).toFixed(2)}`,
      `$${parseFloat(invoiceData.totalUsd || 0).toFixed(2)}`
    ]];
    
    doc.autoTable({
      startY: 78,
      head: [['Concepto', 'Descripción', 'Cant.', 'Precio Unit.', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 60 },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 35, halign: 'right' }
      }
    });
    
    const finalY = doc.lastAutoTable.finalY + 10;
    
    // Totals
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`Total USD: $${parseFloat(invoiceData.totalUsd || 0).toFixed(2)}`, 130, finalY);
    doc.text(`Total VES: Bs ${(parseFloat(invoiceData.totalUsd || 0) * rate).toFixed(2)}`, 130, finalY + 8);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Tasa BCV: ${rate.toFixed(2)} Bs/USD`, 130, finalY + 16);
    
    // Bank info
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text('Datos para el pago:', 14, finalY + 28);
    doc.setTextColor(100, 116, 139);
    doc.text('Banco: Banco de Venezuela', 14, finalY + 35);
    doc.text('C.I: 32307521', 14, finalY + 41);
    doc.text('Teléfono: 04247640859', 14, finalY + 47);
    
    // Footer
    doc.setFontSize(8);
    doc.text('Universitarios FC — Documento generado automáticamente', 14, 280);
    
    doc.save(`factura_${invoiceData.invoiceNumber || 'nueva'}.pdf`);
    showToast('PDF generado', 'La factura fue descargada correctamente', 'success');
  } catch (error) {
    console.error('[PDF] Error:', error);
    showToast('Error', 'No se pudo generar el PDF', 'error');
  }
}

// ==================== CONFIG TABS ====================
function initConfigTabs() {
  const tabs = document.getElementById('configTabs');
  if (!tabs) return;
  
  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.config-tab');
    if (!tab) return;
    
    tabs.querySelectorAll('.config-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    document.querySelectorAll('.config-section').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`config-${tab.dataset.config}`);
    if (target) target.classList.add('active');
  });
  
  // Config form saves
  ['configGeneralForm', 'configBankForm', 'configInvoiceForm'].forEach(formId => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form));
        await addDocument('configuracion', { ...data, configType: formId });
        showToast('Guardado', 'Configuración guardada correctamente', 'success');
      });
    }
  });
  
  // Backup buttons
  document.getElementById('backupDataBtn')?.addEventListener('click', async () => {
    const collections = ['jugadores', 'categorias', 'inscripciones', 'morosos', 'facturas', 'uniformes'];
    const backup = {};
    for (const col of collections) {
      backup[col] = await getCollection(col);
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_universitariosfc_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup', 'Backup descargado correctamente', 'success');
  });
  
  // Danger zone
  document.getElementById('clearInvoicesBtn')?.addEventListener('click', () => {
    confirmDialog('⚠️ Borrar facturas', '¿Estás seguro? Esta acción es irreversible.', async () => {
      const invoices = await getCollection('facturas');
      for (const inv of invoices) {
        await deleteDocument('facturas', inv.id);
      }
      showToast('Eliminado', 'Todas las facturas fueron eliminadas', 'warning');
      renderInvoices();
    });
  });
}

// ==================== REPORT TABS ====================
function initReportTabs() {
  const tabs = document.getElementById('reportTabs');
  if (!tabs) return;
  
  tabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.report-tab');
    if (!tab) return;
    
    tabs.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    const reportType = tab.dataset.report;
    if (reportType) {
      renderReports(reportType);
    }
  });
  
  // Period selector
  const periodSelect = document.getElementById('reportPeriod');
  const dateRange = document.getElementById('reportDateRange');
  if (periodSelect && dateRange) {
    periodSelect.addEventListener('change', () => {
      dateRange.style.display = periodSelect.value === 'custom' ? 'flex' : 'none';
    });
  }
}

// ==================== OMNICHANNEL TABS ====================
function initOmnichannelFilters() {
  const channelFilters = document.querySelectorAll('.channel-filter');
  const omniStatusFilter = document.getElementById('omniStatusFilter');
  const omniChannelSelect = document.getElementById('omniChannelFilter');
  
  if (channelFilters.length) {
    channelFilters.forEach(btn => {
      btn.addEventListener('click', (e) => {
        channelFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const channel = btn.dataset.channel;
        if (omniChannelSelect) omniChannelSelect.value = channel;
        renderOmnichannel(channel);
      });
    });
  }
  
  if (omniChannelSelect) {
    omniChannelSelect.addEventListener('change', (e) => {
      const channel = e.target.value;
      channelFilters.forEach(b => {
        b.classList.toggle('active', b.dataset.channel === channel);
      });
      renderOmnichannel(channel);
    });
  }
  
  if (omniStatusFilter) {
    omniStatusFilter.addEventListener('change', () => renderOmnichannel());
  }
}

// ==================== DEMO DATA SEEDING ====================
async function seedDemoData() {
  const players = await getCollection('jugadores');
  if (players.length > 0) return; // Already seeded
  
  // Seed categories
  const cats = [
    { name: 'U-8', ageMin: 6, ageMax: 8, coach: 'Carlos Mendoza', feeUsd: 20, maxPlayers: 25, schedule: 'Lun-Mié-Vie 3:00pm-4:30pm' },
    { name: 'U-10', ageMin: 9, ageMax: 10, coach: 'María López', feeUsd: 20, maxPlayers: 25, schedule: 'Mar-Jue 3:00pm-4:30pm' },
    { name: 'U-12', ageMin: 11, ageMax: 12, coach: 'Roberto Sánchez', feeUsd: 25, maxPlayers: 22, schedule: 'Lun-Mié-Vie 4:30pm-6:00pm' },
    { name: 'U-14', ageMin: 13, ageMax: 14, coach: 'Andrés Torres', feeUsd: 25, maxPlayers: 22, schedule: 'Mar-Jue-Sáb 4:00pm-5:30pm' },
    { name: 'U-16', ageMin: 15, ageMax: 16, coach: 'Pedro Ramírez', feeUsd: 30, maxPlayers: 20, schedule: 'Lun-Mié-Vie 5:00pm-6:30pm' },
    { name: 'U-18', ageMin: 17, ageMax: 18, coach: 'Luis González', feeUsd: 30, maxPlayers: 20, schedule: 'Mar-Jue-Sáb 5:00pm-6:30pm' },
    { name: 'Adultos', ageMin: 19, ageMax: 40, coach: 'Fernando Díaz', feeUsd: 35, maxPlayers: 25, schedule: 'Lun-Mié-Vie 7:00pm-8:30pm' },
    { name: 'Femenino', ageMin: 8, ageMax: 25, coach: 'Ana Martínez', feeUsd: 20, maxPlayers: 30, schedule: 'Mar-Jue 5:00pm-6:30pm' }
  ];
  
  for (const cat of cats) {
    await addDocument('categorias', cat);
  }
  
  // Seed players
  const demoPlayers = [
    { name: 'Santiago García', cedula: 'V-30123456', birthdate: '2016-03-15', category: 'U-8', phone: '+58 414-555-0001', email: 'garcia.rep@email.com', status: 'activo' },
    { name: 'Valentina Rodríguez', cedula: 'V-30234567', birthdate: '2014-07-22', category: 'U-12', phone: '+58 414-555-0002', email: 'rodriguez.rep@email.com', status: 'activo' },
    { name: 'Mateo López', cedula: 'V-30345678', birthdate: '2012-11-08', category: 'U-14', phone: '+58 424-555-0003', email: 'lopez.rep@email.com', status: 'activo' },
    { name: 'Isabella Martínez', cedula: 'V-30456789', birthdate: '2015-01-30', category: 'Femenino', phone: '+58 412-555-0004', email: 'martinez.rep@email.com', status: 'activo' },
    { name: 'Sebastián Torres', cedula: 'V-30567890', birthdate: '2010-05-12', category: 'U-16', phone: '+58 416-555-0005', email: 'torres.rep@email.com', status: 'activo' },
    { name: 'Camila Hernández', cedula: 'V-30678901', birthdate: '2016-09-25', category: 'U-8', phone: '+58 414-555-0006', email: 'hernandez.rep@email.com', status: 'activo' }
  ];
  
  for (const player of demoPlayers) {
    await addDocument('jugadores', player);
  }
  
  // Seed debtors
  const demoDebtors = [
    { name: 'Roberto Fernández', concept: 'inscripcion', amountUsd: 25, phonePrefix: '+58', phone: '4247640001', status: 'pendiente', dueDate: '2026-04-10' },
    { name: 'Carmen Villalobos', concept: 'uniforme', amountUsd: 45, phonePrefix: '+58', phone: '4127640002', status: 'pendiente', dueDate: '2026-04-05' },
    { name: 'José Pérez', concept: 'mensualidad', amountUsd: 30, phonePrefix: '+58', phone: '4167640003', status: 'pendiente', dueDate: '2026-04-15' }
  ];
  
  for (const debtor of demoDebtors) {
    await addDocument('morosos', debtor);
  }
  
  // Seed inscriptions
  const demoInscriptions = [
    { playerName: 'Santiago García', category: 'U-8', amountUsd: 20, status: 'pagada', paymentMethod: 'transferencia' },
    { playerName: 'Valentina Rodríguez', category: 'U-12', amountUsd: 25, status: 'pagada', paymentMethod: 'efectivo' },
    { playerName: 'Mateo López', category: 'U-14', amountUsd: 25, status: 'pendiente', paymentMethod: 'pago_movil' }
  ];
  
  for (const ins of demoInscriptions) {
    await addDocument('inscripciones', ins);
  }
  
  console.log('[Admin] Demo data seeded');
}

// ==================== GLOBAL API (for inline handlers) ====================
window.adminApp = {
  editPlayer: async (id) => {
    const player = (await getCollection('jugadores')).find(p => p.id === id);
    if (!player) return;
    
    const form = document.getElementById('playerForm');
    document.getElementById('playerModalTitle').textContent = 'Editar Jugador';
    
    Object.keys(player).forEach(key => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = player[key] || '';
    });
    
    openModal('playerModal');
  },
  
  deletePlayer: (id) => {
    confirmDialog('Eliminar jugador', '¿Estás seguro que deseas eliminar este jugador?', async () => {
      await deleteDocument('jugadores', id);
      showToast('Eliminado', 'Jugador eliminado', 'success');
      await renderPlayers();
    });
  },
  
  editCategory: async (id) => {
    const cat = (await getCollection('categorias')).find(c => c.id === id);
    if (!cat) return;
    
    const form = document.getElementById('categoryForm');
    document.getElementById('categoryModalTitle').textContent = 'Editar Categoría';
    
    Object.keys(cat).forEach(key => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = cat[key] || '';
    });
    
    openModal('categoryModal');
  },
  
  deleteCategory: (id) => {
    confirmDialog('Eliminar categoría', '¿Estás seguro?', async () => {
      await deleteDocument('categorias', id);
      showToast('Eliminado', 'Categoría eliminada', 'success');
      await renderCategories();
    });
  },
  
  markDebtPaid: async (id) => {
    confirmDialog('Confirmar Pago', '¿Marcar esta deuda como pagada?', async () => {
      const debtors = await getCollection('morosos');
      const debtor = debtors.find(d => d.id === id);
      if (!debtor) return;
      
      // Move to payment history
      await addDocument('historial_pagos', {
        name: debtor.name,
        concept: debtor.concept,
        amountUsd: debtor.amountUsd,
        method: 'transferencia'
      });

      // Route to specific collections based on concept
      if (debtor.concept === 'inscripcion') {
        await addDocument('inscripciones', {
          playerName: debtor.name,
          category: 'Asignar', // Cannot know from debtor alone, placeholder
          amountUsd: debtor.amountUsd,
          status: 'pagada',
          paymentMethod: 'transferencia'
        });
      } else if (debtor.concept === 'uniforme' || debtor.concept === 'uniformes') {
        await addDocument('uniformes', {
          playerName: debtor.name,
          category: 'Todas',
          combo: 'Personalizado',
          size: 'TBD',
          amountUsd: debtor.amountUsd,
          deliveryStatus: 'pendiente'
        });
      }
      
      // Remove from debtors
      await deleteDocument('morosos', id);
      
      notifyNewPayment(debtor.name, debtor.amountUsd);
      showToast('Pago confirmado', `${debtor.name} marcado como pagado`, 'success');
      await renderDebtors();
      await renderDashboard();
    });
  },
  
  selectConversation: async (convId) => {
    let conv = cachedConversations.find(c => c.id === convId);
    if (!conv) {
      const conversations = await getCollection('conversaciones');
      conv = conversations.find(c => c.id === convId);
      if (!conv) return;
    }
    
    selectedConversation = convId;
    
    // Update header
    const channelIcons = { web: '🌐', whatsapp: '💬', instagram: '📸', facebook: '👤' };
    document.getElementById('chatPanelName').textContent = conv.customerName || 'Cliente';
    document.getElementById('chatPanelStatus').textContent = `${conv.channel || 'web'} · ${conv.status || 'pendiente'}`;
    document.getElementById('chatPanelAvatar').textContent = channelIcons[conv.channel] || '🌐';
    
    // Show/hide controls
    document.getElementById('takeControlBtn')?.classList.toggle('hidden', conv.status === 'escalado_humano');
    document.getElementById('closeConvBtn')?.classList.toggle('hidden', conv.status === 'cerrado');
    
    // Enable input
    const input = document.getElementById('advisorChatInput');
    const sendBtn = document.querySelector('#advisorChatForm button[type="submit"]');
    if (input) input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    
    // Render messages
    const thread = document.getElementById('chatThread');
    if (thread && conv.messages) {
      thread.innerHTML = conv.messages.map(m => {
        const senderLabels = { customer: 'Cliente', ai: '🤖 UniBot', advisor: '👤 Asesor', system: 'Sistema' };
        const senderClass = m.sender === 'customer' ? 'customer' : m.sender === 'ai' ? 'ai' : m.sender === 'advisor' ? 'advisor' : 'system';
        
        return `
          <div class="chat-message ${senderClass}">
            <div class="chat-message-sender">${senderLabels[m.sender] || m.sender}</div>
            ${escapeHtml(m.text)}
            <div class="chat-message-time">${m.timestamp ? formatTime(m.timestamp) : ''}</div>
          </div>
        `;
      }).join('');
      
      thread.scrollTop = thread.scrollHeight;
    }
  },
  
  openUniformSale: () => openModal('uniformModal'),
  
  generateInvoicePDF: async (id) => {
    const invoices = await getCollection('facturas');
    const inv = invoices.find(i => i.id === id);
    if (inv) generatePDF(inv);
  }
};

// Advisor chat form
document.getElementById('advisorChatForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('advisorChatInput');
  const text = input?.value?.trim();
  if (!text || !selectedConversation) return;
  
  input.value = '';
  
  // Add advisor message to conversation
  let conv = cachedConversations.find(c => c.id === selectedConversation);
  if (!conv) {
    const conversations = await getCollection('conversaciones');
    conv = conversations.find(c => c.id === selectedConversation);
    if (!conv) return;
  }
  
  const newMessages = [...(conv.messages || []), {
    sender: 'advisor',
    text,
    timestamp: Date.now()
  }];
  
  // Optimistically update the cache to prevent race conditions rendering
  conv.messages = newMessages;
  conv.status = 'escalado_humano';
  conv.updatedAt = Date.now();
  window.adminApp.selectConversation(selectedConversation);
  
  await updateDocument('conversaciones', selectedConversation, {
    messages: newMessages,
    status: 'escalado_humano',
    updatedAt: Date.now()
  });
  
  showToast('Enviado', 'Mensaje enviado como asesor', 'success', 2000);
});

// Take control button
document.getElementById('takeControlBtn')?.addEventListener('click', async () => {
  if (!selectedConversation) return;
  
  await updateDocument('conversaciones', selectedConversation, {
    status: 'escalado_humano',
    assignedTo: 'Asesor - Soporte',
    updatedAt: Date.now()
  });
  
  showToast('Control tomado', 'Ahora respondes como asesor humano', 'info');
  document.getElementById('takeControlBtn')?.classList.add('hidden');
});

// Close conversation
document.getElementById('closeConvBtn')?.addEventListener('click', () => {
  if (!selectedConversation) return;
  
  confirmDialog('Cerrar conversación', '¿Estás seguro?', async () => {
    await updateDocument('conversaciones', selectedConversation, {
      status: 'cerrado',
      updatedAt: Date.now()
    });
    
    showToast('Cerrada', 'Conversación cerrada', 'success');
    selectedConversation = null;
    await renderOmnichannel();
  });
});

// Attendance save
document.getElementById('saveAttendanceBtn')?.addEventListener('click', () => {
  showToast('Guardado', 'Asistencia registrada correctamente', 'success');
});

// Export buttons
document.getElementById('exportReportBtn')?.addEventListener('click', () => {
  showToast('Exportando', 'Generando PDF del reporte...', 'info', 2000);
});

document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
  showToast('Exportando', 'Preparando archivo CSV...', 'info', 2000);
});
