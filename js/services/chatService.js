import { APP_CONFIG, STORAGE_KEYS } from "../config/appConfig.js";
import { getDemoConversations } from "../data/demoData.js";
import { loadFromStorage, saveToStorage } from "../shared/storage.js";
import { generateId, sanitizeText } from "../shared/utils.js";

function ensureSeedConversations() {
  const existing = loadFromStorage(STORAGE_KEYS.conversations, null);
  if (Array.isArray(existing) && existing.length > 0) return;
  saveToStorage(STORAGE_KEYS.conversations, getDemoConversations());
}

function readConversations() {
  ensureSeedConversations();
  return loadFromStorage(STORAGE_KEYS.conversations, []);
}

function saveConversations(conversations) {
  saveToStorage(STORAGE_KEYS.conversations, conversations);
  return conversations;
}

export function listConversations() {
  return readConversations().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getConversationById(conversationId) {
  return readConversations().find((item) => item.id === conversationId) || null;
}

export function getOrCreateWebConversation(customerName = "Usuario Web") {
  const existingId = loadFromStorage(STORAGE_KEYS.webConversationId, null);
  if (existingId) {
    const existing = getConversationById(existingId);
    if (existing) return existing;
  }

  const conversation = {
    id: generateId("conv_web"),
    channel: "web",
    customerName,
    topic: "Atencion general",
    priority: "media",
    status: "pendiente",
    assignedTo: "IA",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: generateId("msg"),
        sender: "ai",
        text: "Hola, soy tu asistente virtual de Universitarios FC. En que puedo ayudarte hoy?",
        timestamp: Date.now()
      }
    ]
  };

  const next = [conversation, ...readConversations()];
  saveConversations(next);
  saveToStorage(STORAGE_KEYS.webConversationId, conversation.id);
  return conversation;
}

export function createInboundConversation(channel, customerName, messageText, priority = "media") {
  const safeCustomerName = sanitizeText(customerName || "Cliente");
  const safeMessageText = sanitizeText(messageText || "Consulta entrante");

  const conversation = {
    id: generateId(`conv_${channel}`),
    channel,
    customerName: safeCustomerName,
    topic: `Consulta por ${channel}`,
    priority,
    status: "pendiente",
    assignedTo: "IA",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [
      {
        id: generateId("msg"),
        sender: "customer",
        text: safeMessageText,
        timestamp: Date.now()
      }
    ]
  };

  saveConversations([conversation, ...readConversations()]);
  return conversation;
}

export function addMessage(conversationId, sender, text) {
  const cleanText = sanitizeText(text);
  const conversations = readConversations().map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    const message = {
      id: generateId("msg"),
      sender,
      text: cleanText,
      timestamp: Date.now()
    };

    const isHuman = sender === "advisor";
    const updatedStatus = isHuman
      ? "escalado_humano"
      : conversation.status === "pendiente"
      ? "atendido_ia"
      : conversation.status;

    return {
      ...conversation,
      status: updatedStatus,
      assignedTo: isHuman ? APP_CONFIG.advisorName : conversation.assignedTo,
      updatedAt: Date.now(),
      messages: [...conversation.messages, message]
    };
  });

  saveConversations(conversations);
  return getConversationById(conversationId);
}

export function escalateConversation(conversationId) {
  const conversations = readConversations().map((conversation) => {
    if (conversation.id !== conversationId) return conversation;

    return {
      ...conversation,
      status: "escalado_humano",
      assignedTo: APP_CONFIG.advisorName,
      updatedAt: Date.now(),
      messages: [
        ...conversation.messages,
        {
          id: generateId("msg"),
          sender: "system",
          text: "La conversacion fue escalada para atencion humana.",
          timestamp: Date.now()
        }
      ]
    };
  });

  saveConversations(conversations);
  return getConversationById(conversationId);
}

export function assignConversationToAdvisor(conversationId, advisorName = APP_CONFIG.advisorName) {
  const conversations = readConversations().map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          status: "escalado_humano",
          assignedTo: advisorName,
          updatedAt: Date.now()
        }
      : conversation
  );

  saveConversations(conversations);
  return getConversationById(conversationId);
}

export function closeConversation(conversationId) {
  const conversations = readConversations().map((conversation) =>
    conversation.id === conversationId
      ? {
          ...conversation,
          status: "cerrado",
          updatedAt: Date.now()
        }
      : conversation
  );

  saveConversations(conversations);
  return getConversationById(conversationId);
}

export function countMessagesBySender(conversationId, sender) {
  const conversation = getConversationById(conversationId);
  if (!conversation) return 0;
  return conversation.messages.filter((item) => item.sender === sender).length;
}
