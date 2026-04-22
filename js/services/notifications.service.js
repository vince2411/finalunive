/**
 * Notification Service — Universitarios FC v2.0
 * Handles system notifications, browser notifications, and alerts
 */
import { addDocument, getCollection, updateDocument } from './firebase.service.js';

let notifications = [];
let listeners = [];
let notificationsEnabled = true;

/**
 * Initialize notification system
 */
export function initNotifications() {
  const saved = localStorage.getItem('ufc_notifications_enabled');
  notificationsEnabled = saved !== 'false';
  loadNotifications();
  
  // Request browser notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Create a notification
 */
export async function createNotification(type, title, message, data = {}) {
  const notification = {
    type,
    title,
    message,
    data,
    read: false,
    timestamp: Date.now()
  };
  
  const saved = await addDocument('notificaciones', notification);
  notifications.unshift(saved);
  notifyListeners();
  
  if (notificationsEnabled) {
    showBrowserNotification(title, message);
  }
  
  return saved;
}

/**
 * Notification types for common events
 */
export const NotificationTypes = {
  PAYMENT: 'payment',
  INSCRIPTION: 'inscription',
  ESCALATION: 'escalation',
  DEBT_ALERT: 'debt_alert',
  ATTENDANCE: 'attendance',
  NEW_CONVERSATION: 'new_conversation',
  INVOICE: 'invoice',
  SYSTEM: 'system'
};

/**
 * Pre-built notification creators
 */
export function notifyNewPayment(name, amount) {
  return createNotification(NotificationTypes.PAYMENT, 'Pago recibido',
    `${name} realizó un pago de $${amount}`, { name, amount });
}

export function notifyNewInscription(playerName, category) {
  return createNotification(NotificationTypes.INSCRIPTION, 'Nueva inscripción',
    `${playerName} se inscribió en ${category}`, { playerName, category });
}

export function notifyEscalation(customerName, channel) {
  return createNotification(NotificationTypes.ESCALATION, 'Escalamiento requerido',
    `${customerName} necesita atención humana (${channel})`, { customerName, channel });
}

export function notifyDebtAlert(name, amount, days) {
  return createNotification(NotificationTypes.DEBT_ALERT, 'Alerta de morosidad',
    `${name} tiene deuda de $${amount} con ${days} días de retraso`, { name, amount, days });
}

export function notifyNewConversation(customerName, channel) {
  return createNotification(NotificationTypes.NEW_CONVERSATION, 'Nueva conversación',
    `${customerName} inició una conversación por ${channel}`, { customerName, channel });
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
  await updateDocument('notificaciones', notificationId, { read: true });
  const idx = notifications.findIndex(n => n.id === notificationId);
  if (idx !== -1) {
    notifications[idx].read = true;
    notifyListeners();
  }
}

/**
 * Mark all as read
 */
export async function markAllAsRead() {
  for (const n of notifications) {
    if (!n.read) {
      n.read = true;
      await updateDocument('notificaciones', n.id, { read: true }).catch(() => {});
    }
  }
  notifyListeners();
}

/**
 * Get unread count
 */
export function getUnreadCount() {
  return notifications.filter(n => !n.read).length;
}

/**
 * Get all notifications
 */
export function getNotifications(limit = 20) {
  return notifications.slice(0, limit);
}

/**
 * Toggle notifications enabled
 */
export function toggleNotifications(enabled) {
  notificationsEnabled = enabled;
  localStorage.setItem('ufc_notifications_enabled', enabled.toString());
}

/**
 * Subscribe to notification changes
 */
export function onNotificationChange(callback) {
  listeners.push(callback);
  callback({ notifications, unreadCount: getUnreadCount() });
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

// ==================== INTERNAL ====================

async function loadNotifications() {
  try {
    const docs = await getCollection('notificaciones', {
      orderBy: ['timestamp', 'desc'],
      limit: 50
    });
    notifications = docs;
    notifyListeners();
  } catch {
    notifications = JSON.parse(localStorage.getItem('ufc_notifications') || '[]');
  }
}

function notifyListeners() {
  const data = { notifications, unreadCount: getUnreadCount() };
  listeners.forEach(cb => cb(data));
}

function showBrowserNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/assets/icons/icon-192.png',
        badge: '/assets/icons/icon-192.png',
        tag: 'ufc-notification'
      });
    } catch(e) {
      // Silent fail — service worker may not be available
    }
  }
}

/**
 * Get notification icon by type
 */
export function getNotificationIcon(type) {
  const icons = {
    [NotificationTypes.PAYMENT]: '💰',
    [NotificationTypes.INSCRIPTION]: '📋',
    [NotificationTypes.ESCALATION]: '🔔',
    [NotificationTypes.DEBT_ALERT]: '⚠️',
    [NotificationTypes.ATTENDANCE]: '📊',
    [NotificationTypes.NEW_CONVERSATION]: '💬',
    [NotificationTypes.INVOICE]: '🧾',
    [NotificationTypes.SYSTEM]: 'ℹ️'
  };
  return icons[type] || '📌';
}

/**
 * Get notification color by type
 */
export function getNotificationColor(type) {
  const colors = {
    [NotificationTypes.PAYMENT]: 'var(--color-success-light)',
    [NotificationTypes.INSCRIPTION]: 'var(--color-primary-light)',
    [NotificationTypes.ESCALATION]: 'var(--color-error-light)',
    [NotificationTypes.DEBT_ALERT]: 'var(--color-warning-light)',
    [NotificationTypes.ATTENDANCE]: 'var(--color-info-light)',
    [NotificationTypes.NEW_CONVERSATION]: 'var(--color-primary-light)',
    [NotificationTypes.INVOICE]: 'var(--color-success-light)',
    [NotificationTypes.SYSTEM]: 'var(--color-info-light)'
  };
  return colors[type] || 'var(--color-surface-muted)';
}
