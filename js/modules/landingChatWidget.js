import { APP_CONFIG } from "../config/appConfig.js";
import {
  addMessage,
  countMessagesBySender,
  escalateConversation,
  getConversationById,
  getOrCreateWebConversation
} from "../services/chatService.js";
import { generateSupportAlert } from "../services/notificationService.js";
import { formatDateTime, sanitizeText } from "../shared/utils.js";

function resolveAiReply(message) {
  const text = message.toLowerCase();

  if (/(horario|hora|turno)/.test(text)) {
    return "Manejamos turnos de tarde entre semana y sesiones tecnicas sabatinas. Te comparto los detalles por categoria si me indicas la edad.";
  }

  if (/(precio|costo|mensualidad|inscripcion)/.test(text)) {
    return "La mensualidad base parte desde 25 USD y la inscripcion desde 35 USD, con equivalencia en Bs segun BCV del dia.";
  }

  if (/(uniforme|camiseta|short)/.test(text)) {
    return "Tenemos kits oficiales en varias tallas. Si quieres, puedo escalarte con un asesor para disponibilidad inmediata.";
  }

  if (/(asesor|humano|agente|persona)/.test(text)) {
    return "Entendido, voy a escalar esta conversacion para atencion humana.";
  }

  return "Gracias por tu mensaje. Puedo ayudarte con costos, horarios, inscripciones, uniformes o escalarte con un asesor.";
}

function createMessageRow(message) {
  const row = document.createElement("article");
  row.className = `chat-row ${message.sender}`;

  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.innerHTML = `${message.text}<span class="chat-meta">${formatDateTime(message.timestamp)}</span>`;

  row.appendChild(bubble);
  return row;
}

export class LandingChatWidget {
  constructor() {
    this.bubble = document.getElementById("chatWidgetBubble");
    this.panel = document.getElementById("chatPanel");
    this.closeBtn = document.getElementById("chatCloseBtn");
    this.messagesContainer = document.getElementById("chatMessages");
    this.chatForm = document.getElementById("chatForm");
    this.chatInput = document.getElementById("chatInput");
    this.chatEscalateBtn = document.getElementById("chatEscalateBtn");
    this.openChatButtons = [
      document.getElementById("openChatFromHero"),
      document.getElementById("openChatFromCta")
    ].filter(Boolean);

    this.conversation = getOrCreateWebConversation();
    this.renderMessages();
    this.bindEvents();
  }

  bindEvents() {
    this.bubble?.addEventListener("click", () => this.openPanel());
    this.closeBtn?.addEventListener("click", () => this.closePanel());

    this.openChatButtons.forEach((button) => {
      button.addEventListener("click", () => this.openPanel());
    });

    this.chatForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = sanitizeText(this.chatInput.value);
      if (!text) return;
      this.chatInput.value = "";
      this.sendCustomerMessage(text);
    });

    this.chatEscalateBtn?.addEventListener("click", () => {
      this.escalateToHuman();
    });
  }

  openPanel() {
    this.bubble.classList.add("is-hidden");
    window.setTimeout(() => {
      this.panel.classList.add("is-open");
      this.panel.setAttribute("aria-hidden", "false");
      this.chatInput.focus();
    }, 180);
  }

  closePanel() {
    this.panel.classList.remove("is-open");
    this.panel.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      this.bubble.classList.remove("is-hidden");
    }, 220);
  }

  sendCustomerMessage(text) {
    this.conversation = addMessage(this.conversation.id, "customer", text);
    this.renderMessages();

    window.setTimeout(() => {
      const aiResponse = resolveAiReply(text);

      if (/(asesor|humano|agente|persona)/i.test(text)) {
        this.escalateToHuman();
        return;
      }

      this.conversation = addMessage(this.conversation.id, "ai", aiResponse);
      this.renderMessages();

      const aiCount = countMessagesBySender(this.conversation.id, "ai");
      if (aiCount >= APP_CONFIG.aiMessageLimit) {
        this.conversation = addMessage(
          this.conversation.id,
          "system",
          "Hemos alcanzado el limite de respuestas automatizadas para este caso. Puedes solicitar un asesor humano."
        );
        this.renderMessages();
      }
    }, 520);
  }

  escalateToHuman() {
    this.conversation = escalateConversation(this.conversation.id);
    generateSupportAlert(this.conversation);
    this.conversation = addMessage(
      this.conversation.id,
      "system",
      "Tu caso ya fue escalado. Un asesor te respondera en breve desde el panel de soporte."
    );
    this.renderMessages();
  }

  renderMessages() {
    this.conversation = getConversationById(this.conversation.id) || this.conversation;
    this.messagesContainer.innerHTML = "";

    this.conversation.messages.forEach((message) => {
      this.messagesContainer.appendChild(createMessageRow(message));
    });

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}
