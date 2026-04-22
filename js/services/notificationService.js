import { STORAGE_KEYS } from "../config/appConfig.js";
import { isThreeDaysOverdue, generateId } from "../shared/utils.js";
import { loadFromStorage, saveToStorage } from "../shared/storage.js";

function getNotifications() {
  return loadFromStorage(STORAGE_KEYS.notifications, []);
}

function saveNotifications(notifications) {
  saveToStorage(STORAGE_KEYS.notifications, notifications);
}

export function areNotificationsEnabled() {
  return loadFromStorage(STORAGE_KEYS.notificationsEnabled, true);
}

export function setNotificationsEnabled(enabled) {
  saveToStorage(STORAGE_KEYS.notificationsEnabled, Boolean(enabled));
}

export function listNotifications() {
  return getNotifications().sort((a, b) => b.createdAt - a.createdAt);
}

export function addNotification(notification) {
  if (!areNotificationsEnabled()) {
    return getNotifications();
  }

  const notifications = getNotifications();

  if (notification.onceKey && notifications.some((item) => item.onceKey === notification.onceKey)) {
    return notifications;
  }

  const next = [
    {
      id: generateId("notif"),
      read: false,
      createdAt: Date.now(),
      ...notification
    },
    ...notifications
  ];

  saveNotifications(next);
  return next;
}

export function markNotificationAsRead(notificationId) {
  const next = getNotifications().map((item) =>
    item.id === notificationId
      ? {
          ...item,
          read: true
        }
      : item
  );

  saveNotifications(next);
  return next;
}

export function markAllNotificationsAsRead() {
  const next = getNotifications().map((item) => ({
    ...item,
    read: true
  }));

  saveNotifications(next);
  return next;
}

export function getUnreadNotificationsCount() {
  return getNotifications().filter((item) => !item.read).length;
}

export function generateCollectionAlerts(debtRecords) {
  debtRecords.forEach((record) => {
    if (record.status === "activo" && isThreeDaysOverdue(record.daysLate)) {
      addNotification({
        type: "collection",
        title: "Alerta de cobranza",
        message: `${record.representativeName} cumple 3 dias de retraso (${record.concept}).`,
        relatedId: record.id,
        onceKey: `collection_3d_${record.id}`
      });
    }
  });
}

export function generateSupportAlert(conversation) {
  addNotification({
    type: "support",
    title: "Solicitud de asesor humano",
    message: `${conversation.customerName} solicito escalar su conversacion por ${conversation.channel}.`,
    relatedId: conversation.id,
    onceKey: `support_${conversation.id}_${conversation.updatedAt}`
  });
}
