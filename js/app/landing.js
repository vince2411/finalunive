/**
 * Landing Page Controller — Universitarios FC v2.0
 * Handles chat widget, Groq AI integration, quick replies, and mobile navigation
 */
import { initFirebase } from '../services/firebase.service.js';
import { setDocument, getCollection, updateDocument, onCollectionChange } from '../services/firebase.service.js';
import { chatWithGroq, buildGroqHistory, isEscalationRequest } from '../services/groq.service.js';
import { showToast, escapeHtml, formatTime, generateId, timeAgo } from '../utils/ui.helpers.js';

// ==================== STATE ====================
let chatOpen = false;
let messages = [];
let conversationId = null;
let isEscalated = false;
let isTyping = false;
let aiMessageCount = 0;

// ==================== PREDEFINED RESPONSES ====================
const PREDEFINED_RESPONSES = {
  'categorías disponibles': '📋 **Categorías disponibles:**\n\n• U-8 (6-8 años) — Lun/Mié/Vie 3:00-4:30pm\n• U-10 (9-10 años) — Mar/Jue 3:00-4:30pm\n• U-12 (11-12 años) — Lun/Mié/Vie 4:30-6:00pm\n• U-14 (13-14 años) — Mar/Jue/Sáb 4:00-5:30pm\n• U-16 (15-16 años) — Lun/Mié/Vie 5:00-6:30pm\n• U-18 (17-18 años) — Mar/Jue/Sáb 5:00-6:30pm\n• Adultos (19-40 años) — Lun/Mié/Vie 7:00-8:30pm\n• Femenino (8-25 años) — Mar/Jue 5:00-6:30pm\n\n¿Quieres más información sobre alguna categoría?',
  
  'horarios de entrenamiento': '🕐 Horarios de entrenamiento:\n\n• U-8: Lun-Mié-Vie 3:00pm - 4:30pm\n• U-10: Mar-Jue 3:00pm - 4:30pm\n• U-12: Lun-Mié-Vie 4:30pm - 6:00pm\n• U-14: Mar-Jue-Sáb 4:00pm - 5:30pm\n• U-16: Lun-Mié-Vie 5:00pm - 6:30pm\n• U-18: Mar-Jue-Sáb 5:00pm - 6:30pm\n• Adultos: Lun-Mié-Vie 7:00pm - 8:30pm\n• Femenino: Mar-Jue 5:00pm - 6:30pm\n\nAtención administrativa: Lun-Vie 8:00am-6:00pm, Sáb 8:00am-12:00pm',
  
  'cuestan las inscripciones': '💰 Precios de inscripción mensual:\n\n• U-8 y U-10: $20 USD\n• U-12 y U-14: $25 USD\n• U-16 y U-18: $30 USD\n• Adultos: $35 USD\n• Femenino: $20 USD\n\nLos montos se pueden pagar en bolívares a la tasa BCV del día. ¿Deseas conocer los métodos de pago?',
  
  'métodos de pago': '💳 Métodos de pago aceptados:\n\n• ✅ Transferencia bancaria\n• ✅ Pago Móvil\n• ✅ Efectivo en USD\n• ✅ Zelle (previa coordinación)\n\n🏦 Datos bancarios:\n• Banco: Banco de Venezuela\n• C.I: 32307521\n• Teléfono: 04247640859\n\nEl pago se realiza mensualmente.',
  
  'dónde están ubicados': '📍 Ubicación:\n\nNos encontramos en Mérida, Venezuela.\n\n📞 Contacto:\n• WhatsApp: +58 424-764-0859\n• Horario de atención: Lun-Vie 8:00am-6:00pm, Sáb 8:00am-12:00pm\n\n¿Quieres que te contacte un asesor por WhatsApp?',
  
  'información sobre uniformes': '👕 Uniformes y equipamiento:\n\n• Camiseta de entrenamiento: $15 USD\n• Camiseta oficial: $25 USD\n• Short: $10 USD\n• Conjunto completo: $45 USD\n• Medias: $5 USD\n• Chaqueta: $35 USD\n• Morral: $20 USD\n• Gorra: $8 USD\n\nLos uniformes están disponibles en todas las tallas.',
  
  'inscribir a mi hijo': '✍️ Para inscribir a tu hijo/a:\n\n1️⃣ Contactar a nuestro equipo por WhatsApp o este chat\n2️⃣ Proporcionar datos del jugador (nombre, edad, documento)\n3️⃣ Seleccionar la categoría correspondiente\n4️⃣ Realizar el pago de inscripción\n5️⃣ ¡Listo! Tu hijo/a comienza en el próximo entrenamiento\n\n📋 Requisitos: Partida de nacimiento, foto carnet, constancia médica\n\n¿Deseas iniciar el proceso? Puedo conectarte con un asesor.',
  
  'hablar con un asesor': null // Will trigger escalation
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();
  initNavigation();
  initChatWidget();
  initSmoothScroll();
  initHeaderScroll();
  
  console.log('[Landing] Universitarios FC v2.0 initialized');
});

// ==================== NAVIGATION ====================
function initNavigation() {
  const toggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  
  if (toggle && mobileNav) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
      mobileNav.classList.toggle('active');
    });
    
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        toggle.classList.remove('active');
        mobileNav.classList.remove('active');
      });
    });
  }
}

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function initHeaderScroll() {
  const header = document.getElementById('landingHeader');
  if (!header) return;
  
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    header.style.boxShadow = scrollY > 50 ? 'var(--shadow-md)' : 'none';
  });
}

// ==================== CHAT WIDGET ====================
function initChatWidget() {
  const bubble = document.getElementById('chatWidgetBubble');
  const closeBtn = document.getElementById('chatCloseBtn');
  const chatForm = document.getElementById('chatForm');
  const escalateBtn = document.getElementById('chatEscalateBtn');
  const heroCtaChat = document.getElementById('heroCtaChat');
  const ctaOpenChat = document.getElementById('ctaOpenChat');
  
  if (bubble) bubble.addEventListener('click', openChat);
  if (heroCtaChat) heroCtaChat.addEventListener('click', openChat);
  if (ctaOpenChat) ctaOpenChat.addEventListener('click', openChat);
  if (closeBtn) closeBtn.addEventListener('click', closeChat);
  if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);
  if (escalateBtn) escalateBtn.addEventListener('click', handleEscalation);
  
  const toggleQuickBtn = document.getElementById('toggleQuickRepliesBtn');
  if (toggleQuickBtn) {
    toggleQuickBtn.addEventListener('click', () => {
      const qr = document.getElementById('chatQuickReplies');
      if (qr) qr.classList.toggle('hidden');
    });
  }
  
  // Quick reply buttons
  initQuickReplies();
  
  // Session menu buttons
  const btnNew = document.getElementById('btnNewChat');
  const btnContinue = document.getElementById('btnContinueChat');
  if (btnNew) btnNew.addEventListener('click', window.startNewChat);
  if (btnContinue) btnContinue.addEventListener('click', window.continueChat);
  
  // Load existing conversation
  loadConversation();
}

function initQuickReplies() {
  const container = document.getElementById('chatQuickReplies');
  if (!container) return;
  
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-reply-btn');
    if (!btn) return;
    
    const msg = btn.dataset.msg;
    if (!msg) return;
    
    const input = document.getElementById('chatInput');
    if (input) {
      input.value = msg;
      const form = document.getElementById('chatForm');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
    }
  });
}

function hideQuickReplies() {
  const container = document.getElementById('chatQuickReplies');
  if (container) container.classList.add('hidden');
}

function showQuickReplies() {
  // We no longer aggressively auto-show quick replies.
  // The '3 dots' button manages the toggle now.
}

function openChat() {
  const bubble = document.getElementById('chatWidgetBubble');
  const chatWindow = document.getElementById('chatWindow');
  const sessionMenu = document.getElementById('chatSessionMenu');
  
  if (bubble) bubble.classList.add('hidden');
  if (chatWindow) chatWindow.classList.add('open');
  
  chatOpen = true;
  
  if (messages.length === 0) {
    if (sessionMenu) sessionMenu.classList.add('hidden');
    addBotMessage('¡Hola! 👋 Soy UniBot, tu asistente virtual de Universitarios FC.\n\n¿En qué puedo ayudarte hoy? Usa las opciones rápidas de abajo o escribe tu consulta.');
    showQuickReplies();
  } else if (!window.sessionMenuShown) {
    if (sessionMenu) sessionMenu.classList.remove('hidden');
    hideQuickReplies();
    // Only show once per page load to avoid annoyance
    window.sessionMenuShown = true;
  } else {
    if (sessionMenu) sessionMenu.classList.add('hidden');
    showQuickReplies();
  }
  
  setTimeout(() => {
    const input = document.getElementById('chatInput');
    if (input) input.focus();
  }, 400);
  
  scrollChatToBottom();
}

window.startNewChat = function() {
  const sessionMenu = document.getElementById('chatSessionMenu');
  if (sessionMenu) sessionMenu.classList.add('hidden');
  
  // Clear conversation state
  messages = [];
  conversationId = null;
  isEscalated = false;
  aiMessageCount = 0;
  localStorage.removeItem('ufc_web_conversation');
  
  // Clear UI
  const msgContainer = document.getElementById('chatMessages');
  if (msgContainer) msgContainer.innerHTML = '';
  
  const escalationBanner = document.getElementById('chatEscalationBanner');
  if (escalationBanner) escalationBanner.classList.add('hidden');
  
  addBotMessage('¡Hola! 👋 Soy UniBot, tu asistente virtual de Universitarios FC.\n\n¿En qué puedo ayudarte hoy? Usa las opciones rápidas de abajo o escribe tu consulta.');
  showQuickReplies();
};

window.continueChat = function() {
  const sessionMenu = document.getElementById('chatSessionMenu');
  if (sessionMenu) sessionMenu.classList.add('hidden');
  showQuickReplies();
  scrollChatToBottom();
};

function closeChat() {
  const bubble = document.getElementById('chatWidgetBubble');
  const chatWindow = document.getElementById('chatWindow');
  const sessionMenu = document.getElementById('chatSessionMenu');
  
  if (sessionMenu) sessionMenu.classList.add('hidden');
  if (chatWindow) chatWindow.classList.remove('open');
  
  setTimeout(() => {
    if (bubble) bubble.classList.remove('hidden');
  }, 400);
  
  chatOpen = false;
}

// ==================== MESSAGE HANDLING ====================
function findPredefinedResponse(text) {
  const lowerText = text.toLowerCase();
  
  // 1. Direct key matching from PREDEFINED_RESPONSES
  for (const [keyword, response] of Object.entries(PREDEFINED_RESPONSES)) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return response;
    }
  }
  
  // 2. Fallback robust regex matching
  if (lowerText.match(/hola|buenas|saludos|buen d|buena/)) {
    return '¡Hola! 👋 Soy UniBot, tu asistente virtual de Universitarios FC.\n\n¿En qué puedo ayudarte hoy? Usa las opciones rápidas de abajo o escribe tu consulta.';
  }
  if (lowerText.match(/precio|costo|pagar|mensualidad|cuesta|cuanto/)) {
    return PREDEFINED_RESPONSES['cuestan las inscripciones'];
  }
  if (lowerText.match(/hora|cuando|tiempo|dia|día/)) {
    return PREDEFINED_RESPONSES['horarios de entrenamiento'];
  }
  if (lowerText.match(/edad|categoria|categoría|año/)) {
    return PREDEFINED_RESPONSES['categorías disponibles'];
  }
  if (lowerText.match(/ubic|donde|dónde|lugar|direccion|sede/)) {
    return PREDEFINED_RESPONSES['dónde están ubicados'];
  }
  if (lowerText.match(/uniforme|ropa|camisa|short|gorra/)) {
    return PREDEFINED_RESPONSES['información sobre uniformes'];
  }
  if (lowerText.match(/inscribir|requisito|ingreso|entrar/)) {
    return PREDEFINED_RESPONSES['inscribir a mi hijo'];
  }
  if (lowerText.match(/metodo|pago|pago movil|transferencia|efectivo|zelle/)) {
    return PREDEFINED_RESPONSES['métodos de pago'];
  }
  if (lowerText.match(/asesor|humano|persona/)) {
     return null; // Will trigger escalation
  }
  
  return undefined; // No match — use AI
}

async function handleChatSubmit(e) {
  e.preventDefault();
  
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text || isTyping) return;
  
  input.value = '';
  hideQuickReplies();
  addUserMessage(text);
  
  // Check for escalation request
  if (isEscalationRequest(text)) {
    handleEscalation();
    return;
  }
  
  // If already escalated, don't use AI
  if (isEscalated) {
    saveConversation();
    return;
  }
  
  // Check predefined responses first
  const predefined = findPredefinedResponse(text);
  if (predefined === null) {
    handleEscalation();
    return;
  }
  
  if (predefined) {
    showTypingIndicator();
    setTimeout(() => {
      hideTypingIndicator();
      addBotMessage(predefined);
      aiMessageCount++;
      if (aiMessageCount >= 3) showEscalationBanner();
      saveConversation();
      showQuickReplies();
    }, 500 + Math.random() * 700);
    return;
  }
  
  // No predefined match — use Groq AI
  showTypingIndicator();
  
  try {
    const history = buildGroqHistory(messages);
    const response = await chatWithGroq(history);
    
    hideTypingIndicator();
    
    if (response.shouldEscalate) {
      addBotMessage(response.text);
      handleEscalation();
    } else {
      addBotMessage(response.text);
      aiMessageCount++;
      
      if (aiMessageCount >= 3) {
        showEscalationBanner();
      }
    }
  } catch (error) {
    hideTypingIndicator();
    addBotMessage('Disculpa, estoy teniendo dificultades técnicas. ¿Deseas hablar con un asesor?');
    showEscalationBanner();
  }
  
  saveConversation();
  showQuickReplies();
}

function addUserMessage(text) {
  const msg = { id: generateId('msg'), sender: 'customer', text, timestamp: Date.now() };
  messages.push(msg);
  renderMessage(msg);
  scrollChatToBottom();
}

function addBotMessage(text) {
  const msg = { id: generateId('msg'), sender: 'ai', text, timestamp: Date.now() };
  messages.push(msg);
  renderMessage(msg);
  scrollChatToBottom();
}

function addSystemMessage(text) {
  const msg = { id: generateId('msg'), sender: 'system', text, timestamp: Date.now() };
  messages.push(msg);
  renderMessage(msg);
  scrollChatToBottom();
}

function renderMessage(msg) {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const bubble = document.createElement('div');
  
  if (msg.sender === 'system') {
    bubble.className = 'chat-bubble system';
    bubble.innerHTML = `${escapeHtml(msg.text)}`;
  } else {
    const senderClass = msg.sender === 'customer' ? 'user' : 'bot';
    const senderLabel = msg.sender === 'customer' ? '' : 
      `<div class="chat-bubble-sender">${msg.sender === 'ai' ? '🤖 UniBot' : '👤 Asesor'}</div>`;
    
    // Format text: convert \n to <br> for better display
    const formattedText = escapeHtml(msg.text).replace(/\n/g, '<br>');
    
    bubble.className = `chat-bubble ${senderClass}`;
    bubble.innerHTML = `
      ${senderLabel}
      ${formattedText}
      <span class="chat-bubble-time">${formatTime(msg.timestamp)}</span>
    `;
  }
  
  container.appendChild(bubble);
}

function renderAllMessages() {
  const container = document.getElementById('chatMessages');
  if (!container) return;
  container.innerHTML = '';
  messages.forEach(msg => renderMessage(msg));
}

function scrollChatToBottom() {
  const container = document.getElementById('chatMessages');
  if (container) {
    setTimeout(() => { container.scrollTop = container.scrollHeight; }, 100);
  }
}

// ==================== TYPING INDICATOR ====================
function showTypingIndicator() {
  isTyping = true;
  const container = document.getElementById('chatMessages');
  if (!container) return;
  
  const indicator = document.createElement('div');
  indicator.id = 'typingIndicator';
  indicator.className = 'typing-indicator';
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  container.appendChild(indicator);
  scrollChatToBottom();
}

function hideTypingIndicator() {
  isTyping = false;
  const indicator = document.getElementById('typingIndicator');
  if (indicator) indicator.remove();
}

// ==================== ESCALATION ====================
function handleEscalation() {
  if (isEscalated) return;
  
  isEscalated = true;
  hideQuickReplies();
  addSystemMessage('La conversación fue escalada para atención humana. Un asesor te atenderá en breve.');
  
  const banner = document.getElementById('chatEscalationBanner');
  if (banner) banner.classList.add('hidden');
  
  const headerText = document.querySelector('.chat-header-text span');
  if (headerText) {
    headerText.innerHTML = '<span class="online-dot" style="background: var(--color-warning);"></span> Esperando asesor...';
  }
  
  saveEscalation();
  saveConversation();
}

function showEscalationBanner() {
  const banner = document.getElementById('chatEscalationBanner');
  if (banner && !isEscalated) {
    banner.classList.remove('hidden');
  }
}

// ==================== PERSISTENCE ====================
let unsubConv = null;

function startRealtimeListener() {
  if (unsubConv || !conversationId) return;
  
  if (!window.dbInstance) {
    // Wait for Firebase to initialize before setting up the listener
    setTimeout(startRealtimeListener, 500);
    return;
  }
  
  // Listen to the entire collection and filter for our conversation
  // This is more reliable than onDocumentChange when doc ID might not match
  unsubConv = onCollectionChange('conversaciones', (allConversations) => {
    // Find our conversation - match by the 'id' field inside the document data
    const myConv = allConversations.find(c => c.id === conversationId);
    if (!myConv || !myConv.messages) return;
    
    if (myConv.messages.length > messages.length) {
      const newMsgs = myConv.messages.slice(messages.length);
      messages = myConv.messages;
      newMsgs.forEach(msg => renderMessage(msg));
      scrollChatToBottom();
      localStorage.setItem('ufc_web_conversation', JSON.stringify(myConv));
    }
  });
}

function saveConversation() {
  const data = {
    id: conversationId || generateId('conv_web'),
    channel: 'web',
    customerName: 'Usuario Web',
    status: isEscalated ? 'escalado_humano' : (aiMessageCount > 0 ? 'atendido_ia' : 'pendiente'),
    messages,
    updatedAt: Date.now()
  };
  
  const isNew = !conversationId;
  
  if (isNew) {
    conversationId = data.id;
    data.createdAt = Date.now();
  }
  
  localStorage.setItem('ufc_web_conversation', JSON.stringify(data));
  
  // Use setDocument so the Firestore doc ID === conversationId
  // This is the critical fix: .doc(conversationId).set(data, {merge: true})
  try {
    setDocument('conversaciones', conversationId, data, true).catch(() => {});
    
    // Start real-time listener if not already active
    if (!unsubConv) {
      startRealtimeListener();
    }
  } catch (e) {
    console.warn('[Chat] Firestore save failed:', e);
  }
}

function loadConversation() {
  try {
    const saved = localStorage.getItem('ufc_web_conversation');
    if (saved) {
      const data = JSON.parse(saved);
      
      // Only restore if less than 24 hours old
      if (data.updatedAt && Date.now() - data.updatedAt < 86400000) {
        messages = data.messages || [];
        conversationId = data.id;
        isEscalated = data.status === 'escalado_humano';
        aiMessageCount = messages.filter(m => m.sender === 'ai').length;
        renderAllMessages();
        
        if (messages.length > 2) hideQuickReplies();
        
        // Start real-time listener for incoming advisor messages
        startRealtimeListener();
      } else {
        localStorage.removeItem('ufc_web_conversation');
      }
    }
  } catch {
    // Start fresh
  }
}

function saveEscalation() {
  saveConversation();
}

