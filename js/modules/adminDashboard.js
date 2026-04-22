import {
  CHANNEL_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  STORAGE_KEYS,
  APP_CONFIG
} from "../config/appConfig.js";
import { loadFromStorage, saveToStorage } from "../shared/storage.js";
import {
  formatCurrency,
  formatDateTime,
  formatNumber,
  parseNumber,
  sanitizeText
} from "../shared/utils.js";
import { evaluateExpression } from "./calculator.js";
import { getStoredRate, getRateMeta, refreshBCVRate } from "../services/bcvService.js";
import {
  addInscription,
  addUniformSale,
  addDebtRecord,
  getFinanceMetrics,
  getFinanceState,
  markDebtAsPaid
} from "../services/financeService.js";
import {
  addMessage,
  assignConversationToAdvisor,
  closeConversation,
  getConversationById,
  listConversations
} from "../services/chatService.js";
import {
  areNotificationsEnabled,
  generateCollectionAlerts,
  getUnreadNotificationsCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  setNotificationsEnabled
} from "../services/notificationService.js";
import {
  getChannelConfigCards,
  simulateInboundMessage,
  simulateWebhookHandler
} from "../services/omnichannelService.js";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mapStatusBadge(status) {
  return `<span class="status-pill ${status}">${STATUS_LABELS[status] || status}</span>`;
}

function mapPriorityBadge(priority) {
  let badgeClass = "info";
  if (priority === "alta") badgeClass = "danger";
  if (priority === "media") badgeClass = "warning";
  if (priority === "baja") badgeClass = "success";
  return `<span class="badge ${badgeClass}">${PRIORITY_LABELS[priority] || priority}</span>`;
}

export class AdminDashboard {
  constructor() {
    this.rate = getStoredRate();
    this.rateMeta = getRateMeta();
    this.selectedConversationId = null;
    this.notificationsEnabled = areNotificationsEnabled();
    this.lastWebhookSimulation = null;
    this.calculatorExpression = "0";
    this.converterLock = false;
    this.pollingTimer = null;
    this.realtimeTimer = null;
    this.lastConversationSignature = "";
    this.lastNotificationSignature = "";

    this.refs = {
      root: document.getElementById("dashboardView"),
      adminShell: document.getElementById("adminShell"),
      sidebar: document.getElementById("sidebar"),
      sidebarToggle: document.getElementById("sidebarToggle"),
      navItems: [...document.querySelectorAll(".nav-item")],
      sections: [...document.querySelectorAll(".content-section")],
      quickSectionButtons: [...document.querySelectorAll("[data-go-to]")],

      themeToggle: document.getElementById("themeToggle"),
      settingsButton: document.getElementById("settingsButton"),
      settingsMenu: document.getElementById("settingsMenu"),
      notificationsToggle: document.getElementById("notificationsToggle"),
      refreshRateBtn: document.getElementById("refreshRateBtn"),

      notificationBell: document.getElementById("notificationBell"),
      notificationCount: document.getElementById("notificationCount"),
      notificationPanel: document.getElementById("notificationPanel"),
      notificationList: document.getElementById("notificationList"),
      markAllReadBtn: document.getElementById("markAllReadBtn"),

      topbarRate: document.getElementById("topbarRate"),
      bcvRateValue: document.getElementById("bcvRateValue"),
      bcvRateStatus: document.getElementById("bcvRateStatus"),
      bcvRateMessage: document.getElementById("bcvRateMessage"),
      financeRateInline: document.getElementById("financeRateInline"),

      metricIncomeUsd: document.getElementById("metricIncomeUsd"),
      metricIncomeVes: document.getElementById("metricIncomeVes"),
      metricDebtUsd: document.getElementById("metricDebtUsd"),
      metricDebtVes: document.getElementById("metricDebtVes"),
      metricRecoveredUsd: document.getElementById("metricRecoveredUsd"),
      metricRecoveredVes: document.getElementById("metricRecoveredVes"),
      metricOpenCases: document.getElementById("metricOpenCases"),
      metricEscalatedCases: document.getElementById("metricEscalatedCases"),

      channelConfigGrid: document.getElementById("channelConfigGrid"),
      webhookChannelSelect: document.getElementById("webhookChannelSelect"),
      simulateWebhookBtn: document.getElementById("simulateWebhookBtn"),
      webhookPayloadPreview: document.getElementById("webhookPayloadPreview"),
      omnichannelDetail: document.getElementById("omnichannelDetail"),

      inboxList: document.getElementById("inboxList"),
      chatConversationList: document.getElementById("chatConversationList"),
      chatThread: document.getElementById("chatThread"),
      chatHeaderMeta: document.getElementById("chatHeaderMeta"),
      advisorMessageForm: document.getElementById("advisorMessageForm"),
      advisorMessageInput: document.getElementById("advisorMessageInput"),
      takeControlBtn: document.getElementById("takeControlBtn"),
      closeConversationBtn: document.getElementById("closeConversationBtn"),

      inscriptionForm: document.getElementById("inscriptionForm"),
      uniformForm: document.getElementById("uniformForm"),
      debtForm: document.getElementById("debtForm"),

      inscriptionTableBody: document.getElementById("inscriptionTableBody"),
      uniformTableBody: document.getElementById("uniformTableBody"),
      debtTableBody: document.getElementById("debtTableBody"),
      debtHistoryBody: document.getElementById("debtHistoryBody"),

      calcDisplay: document.getElementById("calcDisplay"),
      calcGrid: document.getElementById("calcGrid"),
      converterUsd: document.getElementById("converterUsd"),
      converterVes: document.getElementById("converterVes"),
      converterRateHint: document.getElementById("converterRateHint"),

      toastContainer: document.getElementById("toastContainer")
    };
  }

  async init() {
    this.applyStoredTheme();
    this.bindSectionNavigation();
    this.bindTopbarControls();
    this.bindForms();
    this.bindChatEvents();
    this.bindDebtActions();
    this.bindCalculator();
    this.bindConverter();

    this.refs.notificationsToggle.checked = this.notificationsEnabled;

    this.renderChannelConfigCards();
    this.refreshTablesAndMetrics();
    this.renderConversations();
    this.renderNotifications();
    this.renderConverterHint();

    await this.refreshRate(false);
    this.startRealtimeSimulation();
    this.startPollingSync();
  }

  applyStoredTheme() {
    const savedTheme = loadFromStorage(STORAGE_KEYS.theme, APP_CONFIG.defaultTheme);
    this.setTheme(savedTheme, false);
  }

  setTheme(theme, persist = true) {
    const resolvedTheme = theme === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = resolvedTheme;
    this.refs.themeToggle.textContent = resolvedTheme === "dark" ? "D" : "L";
    if (persist) {
      saveToStorage(STORAGE_KEYS.theme, resolvedTheme);
    }
  }

  bindSectionNavigation() {
    this.refs.navItems.forEach((item) => {
      item.addEventListener("click", () => {
        const sectionId = item.dataset.target;
        this.activateSection(sectionId);
      });
    });

    this.refs.quickSectionButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.activateSection(button.dataset.goTo);
      });
    });

    this.refs.sidebarToggle.addEventListener("click", () => {
      this.refs.adminShell.classList.toggle("sidebar-open");
    });
  }

  activateSection(sectionId) {
    this.refs.sections.forEach((section) => {
      section.classList.toggle("active", section.id === sectionId);
    });

    this.refs.navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.target === sectionId);
    });

    this.refs.adminShell.classList.remove("sidebar-open");
  }

  bindTopbarControls() {
    this.refs.themeToggle.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      this.setTheme(nextTheme, true);
    });

    this.refs.notificationBell.addEventListener("click", (event) => {
      event.stopPropagation();
      this.refs.settingsMenu.classList.add("hidden");
      this.refs.notificationPanel.classList.toggle("hidden");
    });

    this.refs.settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.refs.notificationPanel.classList.add("hidden");
      this.refs.settingsMenu.classList.toggle("hidden");
    });

    this.refs.markAllReadBtn.addEventListener("click", () => {
      markAllNotificationsAsRead();
      this.renderNotifications();
      this.showToast("Notificaciones marcadas como leidas.");
    });

    this.refs.notificationList.addEventListener("click", (event) => {
      const targetButton = event.target.closest("button[data-notification-id]");
      if (!targetButton) return;
      const notificationId = targetButton.dataset.notificationId;
      this.handleNotificationClick(notificationId);
    });

    this.refs.notificationsToggle.addEventListener("change", (event) => {
      this.notificationsEnabled = event.target.checked;
      setNotificationsEnabled(this.notificationsEnabled);
      this.renderNotifications();
      this.showToast(
        this.notificationsEnabled
          ? "Notificaciones del sistema activadas."
          : "Notificaciones del sistema desactivadas."
      );
    });

    this.refs.refreshRateBtn.addEventListener("click", async () => {
      await this.refreshRate(true);
    });

    document.addEventListener("click", (event) => {
      if (!event.target.closest(".topbar-menu-wrap")) {
        this.refs.notificationPanel.classList.add("hidden");
        this.refs.settingsMenu.classList.add("hidden");
      }
    });
  }

  bindForms() {
    this.refs.inscriptionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(this.refs.inscriptionForm);
      const studentName = sanitizeText(formData.get("studentName"));
      const concept = sanitizeText(formData.get("concept"));
      const amount = parseNumber(formData.get("amount"));
      const currency = formData.get("currency");

      if (!studentName || !concept || amount <= 0) {
        this.showToast("Verifica datos de inscripcion.", "warning");
        return;
      }

      addInscription(
        {
          studentName,
          concept,
          amount,
          currency
        },
        this.rate
      );

      this.refs.inscriptionForm.reset();
      this.refreshTablesAndMetrics();
      this.showToast("Inscripcion registrada con exito.", "success");
    });

    this.refs.uniformForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(this.refs.uniformForm);
      const product = sanitizeText(formData.get("product"));
      const quantity = parseNumber(formData.get("quantity"));
      const amount = parseNumber(formData.get("amount"));
      const currency = formData.get("currency");

      if (!product || quantity <= 0 || amount <= 0) {
        this.showToast("Verifica datos de venta de uniforme.", "warning");
        return;
      }

      addUniformSale(
        {
          product,
          quantity,
          amount,
          currency
        },
        this.rate
      );

      this.refs.uniformForm.reset();
      this.refreshTablesAndMetrics();
      this.showToast("Venta de uniforme registrada.", "success");
    });

    this.refs.debtForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(this.refs.debtForm);

      const payload = {
        representativeName: sanitizeText(formData.get("representativeName")),
        concept: sanitizeText(formData.get("concept")),
        amount: parseNumber(formData.get("amount")),
        currency: formData.get("currency"),
        daysLate: parseNumber(formData.get("daysLate")),
        phonePrefix: formData.get("phonePrefix"),
        phoneNumber: sanitizeText(formData.get("phoneNumber"))
      };

      if (
        !payload.representativeName ||
        !payload.concept ||
        payload.amount <= 0 ||
        payload.daysLate < 0 ||
        !payload.phoneNumber
      ) {
        this.showToast("Verifica datos del modulo de morosidad.", "warning");
        return;
      }

      addDebtRecord(payload, this.rate);
      this.refs.debtForm.reset();
      this.refreshTablesAndMetrics();
      this.renderNotifications();
      this.showToast("Registro de morosidad guardado.", "success");
    });
  }

  bindDebtActions() {
    this.refs.debtTableBody.addEventListener("click", (event) => {
      const trigger = event.target.closest("button[data-action]");
      if (!trigger) return;

      const debtId = trigger.dataset.debtId;
      const action = trigger.dataset.action;
      const state = getFinanceState();
      const record = state.debtRecords.find((item) => item.id === debtId);
      if (!record) return;

      if (action === "whatsapp") {
        this.openWhatsappDebtReminder(record);
      }

      if (action === "paid") {
        markDebtAsPaid(debtId);
        this.refreshTablesAndMetrics();
        this.showToast("Deuda liquidada y movida al historial.", "success");
      }
    });
  }

  openWhatsappDebtReminder(record) {
    const cleanPhone = `${record.phonePrefix}${record.phoneNumber}`.replace(/[^0-9]/g, "");
    const message = `Hola ${record.representativeName}, te contactamos para recordarte que presentas un saldo pendiente de ${formatNumber(
      record.amountUSD
    )}$ (Equivalente a ${formatNumber(
      record.amountVES
    )} Bs segun tasa BCV del dia). Por favor, realizar la transferencia a los siguientes datos:\nC.I: 32307521\nTLF: 04247640859\nBanco: Venezuela`;

    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  bindChatEvents() {
    const handleConversationSelection = (event) => {
      const target = event.target.closest("button[data-conversation-id]");
      if (!target) return;
      this.selectedConversationId = target.dataset.conversationId;
      this.renderConversations();
    };

    this.refs.inboxList.addEventListener("click", handleConversationSelection);
    this.refs.chatConversationList.addEventListener("click", handleConversationSelection);

    this.refs.advisorMessageForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const text = sanitizeText(this.refs.advisorMessageInput.value);
      if (!text || !this.selectedConversationId) return;

      assignConversationToAdvisor(this.selectedConversationId);
      addMessage(this.selectedConversationId, "advisor", text);
      this.refs.advisorMessageInput.value = "";
      this.renderConversations();
      this.showToast("Respuesta enviada por Asesor - Soporte.", "success");
    });

    this.refs.takeControlBtn.addEventListener("click", () => {
      if (!this.selectedConversationId) return;
      assignConversationToAdvisor(this.selectedConversationId);
      addMessage(
        this.selectedConversationId,
        "system",
        "Asesor - Soporte tomo control de la conversacion."
      );
      this.renderConversations();
      this.showToast("Control humano activado.", "info");
    });

    this.refs.closeConversationBtn.addEventListener("click", () => {
      if (!this.selectedConversationId) return;
      closeConversation(this.selectedConversationId);
      this.renderConversations();
      this.refreshMetrics();
      this.showToast("Conversacion cerrada.", "success");
    });

    this.refs.simulateWebhookBtn.addEventListener("click", () => {
      const channel = this.refs.webhookChannelSelect.value;
      const simulation = simulateWebhookHandler(channel);
      if (!simulation) return;

      const inbound = simulateInboundMessage(channel, null);
      if (inbound?.targetConversationId) {
        this.selectedConversationId = inbound.targetConversationId;
      }

      this.lastWebhookSimulation = simulation;
      this.renderConversations();
      this.showToast(`Webhook simulado para canal ${CHANNEL_LABELS[channel]}.`, "info");
    });
  }

  bindCalculator() {
    this.refs.calcGrid.addEventListener("click", (event) => {
      const button = event.target.closest("button");
      if (!button) return;

      const action = button.dataset.action;
      const value = button.dataset.val;

      if (action === "clear") {
        this.calculatorExpression = "0";
        this.renderCalculatorDisplay();
        return;
      }

      if (action === "back") {
        this.calculatorExpression = this.calculatorExpression.slice(0, -1) || "0";
        this.renderCalculatorDisplay();
        return;
      }

      if (action === "equals") {
        try {
          const result = evaluateExpression(this.calculatorExpression);
          this.calculatorExpression = String(result);
          this.renderCalculatorDisplay();
        } catch (error) {
          this.showToast("Expresion matematica invalida.", "warning");
        }
        return;
      }

      if (value) {
        this.calculatorExpression = this.calculatorExpression === "0" ? value : this.calculatorExpression + value;
        this.renderCalculatorDisplay();
      }
    });

    this.renderCalculatorDisplay();
  }

  bindConverter() {
    this.refs.converterUsd.addEventListener("input", () => {
      if (this.converterLock) return;
      this.converterLock = true;
      const usd = parseNumber(this.refs.converterUsd.value);
      const ves = usd * this.rate;
      this.refs.converterVes.value = Number.isFinite(ves) ? ves.toFixed(2) : "";
      this.converterLock = false;
    });

    this.refs.converterVes.addEventListener("input", () => {
      if (this.converterLock) return;
      this.converterLock = true;
      const ves = parseNumber(this.refs.converterVes.value);
      const usd = this.rate ? ves / this.rate : 0;
      this.refs.converterUsd.value = Number.isFinite(usd) ? usd.toFixed(2) : "";
      this.converterLock = false;
    });
  }

  renderCalculatorDisplay() {
    this.refs.calcDisplay.value = this.calculatorExpression;
  }

  renderConverterHint() {
    this.refs.converterRateHint.textContent = `Tasa actual: 1 USD = ${formatNumber(this.rate)} Bs`;
  }

  async refreshRate(showFeedback) {
    const result = await refreshBCVRate();
    this.rate = result.rate;
    this.rateMeta = getRateMeta();
    this.renderRateCards();
    this.renderConverterHint();

    if (showFeedback) {
      this.showToast(result.message, result.status === "fallback" ? "warning" : "success");
    }
  }

  renderRateCards() {
    this.refs.topbarRate.textContent = `BCV: 1 USD = ${formatNumber(this.rate)} Bs`;
    this.refs.bcvRateValue.textContent = `${formatNumber(this.rate)} Bs`;
    this.refs.financeRateInline.textContent = `${formatNumber(this.rate)} Bs`;

    this.refs.bcvRateStatus.className = "badge";
    if (this.rateMeta.status === "ok") {
      this.refs.bcvRateStatus.classList.add("success");
      this.refs.bcvRateStatus.textContent = `Fuente: ${this.rateMeta.source}`;
    } else {
      this.refs.bcvRateStatus.classList.add("warning");
      this.refs.bcvRateStatus.textContent = "Modo fallback demo";
    }

    const providerUpdateLabel = this.rateMeta.providerUpdatedAt
      ? formatDateTime(this.rateMeta.providerUpdatedAt)
      : "N/D";

    this.refs.bcvRateMessage.textContent = `${this.rateMeta.message} | API: ${providerUpdateLabel} | Panel: ${formatDateTime(
      this.rateMeta.updatedAt
    )}`;
  }

  refreshTablesAndMetrics() {
    const financeState = getFinanceState();
    generateCollectionAlerts(financeState.debtRecords);

    this.renderFinanceTables(financeState);
    this.renderDebtTables(financeState);
    this.refreshMetrics();
  }

  refreshMetrics() {
    const metrics = getFinanceMetrics();
    const conversations = listConversations();
    const openCases = conversations.filter((item) => item.status !== "cerrado").length;
    const escalatedCases = conversations.filter((item) => item.status === "escalado_humano").length;

    this.refs.metricIncomeUsd.textContent = formatCurrency(metrics.incomeUSD, "USD");
    this.refs.metricIncomeVes.textContent = formatCurrency(metrics.incomeVES, "VES");

    this.refs.metricDebtUsd.textContent = formatCurrency(metrics.debtUSD, "USD");
    this.refs.metricDebtVes.textContent = formatCurrency(metrics.debtVES, "VES");

    this.refs.metricRecoveredUsd.textContent = formatCurrency(metrics.recoveredUSD, "USD");
    this.refs.metricRecoveredVes.textContent = formatCurrency(metrics.recoveredVES, "VES");

    this.refs.metricOpenCases.textContent = String(openCases);
    this.refs.metricEscalatedCases.textContent = `${escalatedCases} escalados`;
  }

  renderFinanceTables(state) {
    this.refs.inscriptionTableBody.innerHTML = state.inscriptions
      .slice(0, 12)
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.studentName)}</td>
            <td>${escapeHtml(item.concept)}</td>
            <td>${formatCurrency(item.amountUSD, "USD")}</td>
            <td>${formatCurrency(item.amountVES, "VES")}</td>
          </tr>
        `
      )
      .join("");

    this.refs.uniformTableBody.innerHTML = state.uniforms
      .slice(0, 12)
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.product)}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.amountUSD, "USD")}</td>
            <td>${formatCurrency(item.amountVES, "VES")}</td>
          </tr>
        `
      )
      .join("");

    if (!state.inscriptions.length) {
      this.refs.inscriptionTableBody.innerHTML = '<tr><td colspan="4">Sin registros de inscripcion.</td></tr>';
    }

    if (!state.uniforms.length) {
      this.refs.uniformTableBody.innerHTML = '<tr><td colspan="4">Sin ventas registradas.</td></tr>';
    }
  }

  renderDebtTables(state) {
    this.refs.debtTableBody.innerHTML = state.debtRecords
      .map(
        (record) => `
          <tr>
            <td>${escapeHtml(record.representativeName)}</td>
            <td>${escapeHtml(record.concept)}</td>
            <td>
              ${formatCurrency(record.amountUSD, "USD")}<br />
              <small>${formatCurrency(record.amountVES, "VES")}</small>
            </td>
            <td>${record.daysLate} dias</td>
            <td>
              <div class="section-actions">
                <button class="btn btn-outline" data-action="whatsapp" data-debt-id="${record.id}">WhatsApp</button>
                <button class="btn btn-outline" data-action="paid" data-debt-id="${record.id}">Pagado</button>
              </div>
            </td>
          </tr>
        `
      )
      .join("");

    this.refs.debtHistoryBody.innerHTML = state.debtHistory
      .map(
        (record) => `
          <tr>
            <td>${escapeHtml(record.representativeName)}</td>
            <td>${escapeHtml(record.concept)}</td>
            <td>${formatCurrency(record.amountUSD, "USD")} / ${formatCurrency(record.amountVES, "VES")}</td>
            <td>${formatDateTime(record.paidAt || record.createdAt)}</td>
          </tr>
        `
      )
      .join("");

    if (!state.debtRecords.length) {
      this.refs.debtTableBody.innerHTML = '<tr><td colspan="5">No hay deudas activas.</td></tr>';
    }

    if (!state.debtHistory.length) {
      this.refs.debtHistoryBody.innerHTML = '<tr><td colspan="4">Sin historial de pagos.</td></tr>';
    }
  }

  renderChannelConfigCards() {
    const cards = getChannelConfigCards();
    this.refs.channelConfigGrid.innerHTML = cards
      .map(
        (card) => `
          <article class="channel-config-item">
            <strong>${card.label}</strong>
            <p>Webhook: ${escapeHtml(card.webhookPath)}</p>
            <p>Polling: ${escapeHtml(card.pollingPath)}</p>
          </article>
        `
      )
      .join("");
  }

  renderConversations() {
    const conversations = listConversations();

    if (!conversations.length) {
      this.refs.inboxList.innerHTML = "<p>No hay conversaciones activas.</p>";
      this.refs.chatConversationList.innerHTML = "<p>No hay hilos activos.</p>";
      this.refs.chatThread.innerHTML = "<p>Selecciona una conversacion para responder.</p>";
      this.refs.omnichannelDetail.innerHTML = "<p>Sin detalle disponible.</p>";
      return;
    }

    const stillExists = conversations.some((item) => item.id === this.selectedConversationId);
    if (!this.selectedConversationId || !stillExists) {
      this.selectedConversationId = conversations[0].id;
    }

    const renderConversationItem = (conversation, compact = false) => {
      const previewMessage = conversation.messages.at(-1)?.text || "Sin mensajes";
      return `
        <button
          class="${compact ? "chat-conversation-item" : "inbox-item"} ${
            conversation.id === this.selectedConversationId ? "active" : ""
          }"
          data-conversation-id="${conversation.id}"
        >
          <div class="item-head">
            <strong>${escapeHtml(conversation.customerName)}</strong>
            <span class="channel-chip ${conversation.channel}">${CHANNEL_LABELS[conversation.channel]}</span>
          </div>
          <div class="item-sub">
            ${mapStatusBadge(conversation.status)}
            ${mapPriorityBadge(conversation.priority)}
          </div>
          <p>${escapeHtml(previewMessage.slice(0, compact ? 45 : 75))}</p>
        </button>
      `;
    };

    this.refs.inboxList.innerHTML = conversations.map((item) => renderConversationItem(item, false)).join("");
    this.refs.chatConversationList.innerHTML = conversations.map((item) => renderConversationItem(item, true)).join("");

    this.renderOmnichannelDetail();
    this.renderChatThread();
    this.refreshMetrics();

    this.lastConversationSignature = conversations.map((item) => `${item.id}_${item.updatedAt}`).join("|");
  }

  renderOmnichannelDetail() {
    const conversation = getConversationById(this.selectedConversationId);
    if (!conversation) return;

    this.refs.omnichannelDetail.innerHTML = `
      <div class="omnichannel-detail-row"><strong>Cliente</strong><span>${escapeHtml(conversation.customerName)}</span></div>
      <div class="omnichannel-detail-row"><strong>Canal</strong><span>${CHANNEL_LABELS[conversation.channel]}</span></div>
      <div class="omnichannel-detail-row"><strong>Tema</strong><span>${escapeHtml(conversation.topic)}</span></div>
      <div class="omnichannel-detail-row"><strong>Estado</strong><span>${STATUS_LABELS[conversation.status]}</span></div>
      <div class="omnichannel-detail-row"><strong>Asignado</strong><span>${escapeHtml(conversation.assignedTo)}</span></div>
      <div class="omnichannel-detail-row"><strong>Ultima actividad</strong><span>${formatDateTime(
        conversation.updatedAt
      )}</span></div>
    `;

    const payloadToShow = this.lastWebhookSimulation
      ? this.lastWebhookSimulation.payload
      : {
          channel: conversation.channel,
          customerName: conversation.customerName,
          lastMessage: conversation.messages.at(-1)?.text,
          status: conversation.status
        };

    this.refs.webhookPayloadPreview.textContent = JSON.stringify(payloadToShow, null, 2);
  }

  renderChatThread() {
    const conversation = getConversationById(this.selectedConversationId);
    if (!conversation) {
      this.refs.chatThread.innerHTML = "<p>Sin conversacion seleccionada.</p>";
      return;
    }

    this.refs.chatHeaderMeta.innerHTML = `
      <strong>${escapeHtml(conversation.customerName)}</strong>
      <p>
        ${CHANNEL_LABELS[conversation.channel]} - ${STATUS_LABELS[conversation.status]} - ${escapeHtml(
          conversation.assignedTo
        )}
      </p>
    `;

    this.refs.chatThread.innerHTML = conversation.messages
      .map((message) => {
        let label = "";
        if (message.sender === "ai") label = '<span class="thread-label">IA</span>';
        if (message.sender === "advisor") label = '<span class="thread-label">Asesor - Soporte</span>';
        if (message.sender === "system") label = '<span class="thread-label">Sistema</span>';

        return `
          <article class="thread-row ${message.sender}">
            <div class="thread-bubble">
              ${label}
              ${escapeHtml(message.text)}
              <span class="thread-time">${formatDateTime(message.timestamp)}</span>
            </div>
          </article>
        `;
      })
      .join("");

    this.refs.chatThread.scrollTop = this.refs.chatThread.scrollHeight;

    this.refs.takeControlBtn.disabled = conversation.status === "cerrado";
    this.refs.closeConversationBtn.disabled = conversation.status === "cerrado";
  }

  renderNotifications() {
    if (!this.notificationsEnabled) {
      this.refs.notificationCount.textContent = "0";
      this.refs.notificationList.innerHTML =
        '<article class="notification-item"><strong>Notificaciones desactivadas</strong><small>Puedes activarlas desde configuracion.</small></article>';
      return;
    }

    const notifications = listNotifications();
    const unreadCount = getUnreadNotificationsCount();

    this.refs.notificationCount.textContent = String(unreadCount);

    if (!notifications.length) {
      this.refs.notificationList.innerHTML =
        '<article class="notification-item"><strong>Sin alertas pendientes</strong><small>Todo al dia por ahora.</small></article>';
      return;
    }

    this.refs.notificationList.innerHTML = notifications
      .map(
        (notification) => `
          <button
            class="notification-item ${notification.read ? "" : "unread"}"
            data-notification-id="${notification.id}"
          >
            <strong>${escapeHtml(notification.title)}</strong>
            <p>${escapeHtml(notification.message)}</p>
            <small>${formatDateTime(notification.createdAt)} - ${notification.read ? "Leida" : "No leida"}</small>
          </button>
        `
      )
      .join("");

    this.lastNotificationSignature = notifications
      .map((item) => `${item.id}_${item.read ? "1" : "0"}`)
      .join("|");
  }

  handleNotificationClick(notificationId) {
    const allNotifications = listNotifications();
    const notification = allNotifications.find((item) => item.id === notificationId);
    if (!notification) return;

    markNotificationAsRead(notificationId);
    this.renderNotifications();

    if (notification.type === "support" && notification.relatedId) {
      this.selectedConversationId = notification.relatedId;
      this.activateSection("section-chat");
      this.renderConversations();
    }

    if (notification.type === "collection") {
      this.activateSection("section-debts");
    }
  }

  startRealtimeSimulation() {
    clearInterval(this.realtimeTimer);

    const customerTemplates = [
      "Necesito confirmar disponibilidad para categoria sub-11.",
      "Pueden atenderme hoy por un asesor?",
      "Ya hice el pago, como lo notifico?",
      "Quiero conocer los horarios de entrenamiento.",
      "Tienen uniforme talla S?"
    ];

    const aiTemplates = [
      "Con gusto. Te envio detalles y te acompano en el proceso.",
      "Perfecto, te comparto la informacion de forma inmediata.",
      "Puedo ayudarte con eso y escalar con un asesor si lo prefieres."
    ];

    this.realtimeTimer = window.setInterval(() => {
      const candidates = listConversations().filter((item) => item.status !== "cerrado");
      if (!candidates.length) return;

      const selected = candidates[Math.floor(Math.random() * candidates.length)];
      const customerMessage = customerTemplates[Math.floor(Math.random() * customerTemplates.length)];
      addMessage(selected.id, "customer", customerMessage);

      if (selected.status !== "escalado_humano") {
        const aiReply = aiTemplates[Math.floor(Math.random() * aiTemplates.length)];
        window.setTimeout(() => {
          addMessage(selected.id, "ai", aiReply);
          this.renderConversations();
        }, 850);
      }

      this.renderConversations();
    }, 18000);
  }

  startPollingSync() {
    clearInterval(this.pollingTimer);

    this.pollingTimer = window.setInterval(() => {
      const conversationSignature = listConversations()
        .map((item) => `${item.id}_${item.updatedAt}`)
        .join("|");

      if (conversationSignature !== this.lastConversationSignature) {
        this.renderConversations();
      }

      const notificationSignature = listNotifications()
        .map((item) => `${item.id}_${item.read ? "1" : "0"}`)
        .join("|");

      if (notificationSignature !== this.lastNotificationSignature) {
        this.renderNotifications();
      }
    }, 4500);
  }

  showToast(message, kind = "info") {
    const toast = document.createElement("article");
    toast.className = "toast";
    const titleMap = {
      info: "Info",
      success: "Exito",
      warning: "Atencion"
    };

    toast.innerHTML = `<strong>${titleMap[kind] || "Info"}</strong><p>${escapeHtml(message)}</p>`;

    if (kind === "success") {
      toast.style.borderLeft = "4px solid var(--success)";
    } else if (kind === "warning") {
      toast.style.borderLeft = "4px solid var(--accent)";
    } else {
      toast.style.borderLeft = "4px solid var(--primary)";
    }

    this.refs.toastContainer.appendChild(toast);
    window.setTimeout(() => {
      toast.remove();
    }, 3200);
  }
}
