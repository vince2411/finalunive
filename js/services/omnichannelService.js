import { CHANNEL_LABELS } from "../config/appConfig.js";
import { ENDPOINTS } from "../config/endpoints.js";
import { WEBHOOK_PAYLOAD_SAMPLES } from "../data/payloadSamples.js";
import { addMessage, createInboundConversation, listConversations } from "./chatService.js";

export const channelAdapters = {
  web: {
    channel: "web",
    label: CHANNEL_LABELS.web,
    endpoint: ENDPOINTS.channels.web,
    mapPayload(payload) {
      return {
        customerName: payload.customer?.name || "Cliente Web",
        text: payload.message?.text || "Consulta web",
        externalId: payload.conversationId || "web_ext"
      };
    }
  },
  whatsapp: {
    channel: "whatsapp",
    label: CHANNEL_LABELS.whatsapp,
    endpoint: ENDPOINTS.channels.whatsapp,
    mapPayload(payload) {
      const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      return {
        customerName: `WA ${message?.from || "cliente"}`,
        text: message?.text?.body || "Consulta por WhatsApp",
        externalId: message?.from || "wa_ext"
      };
    }
  },
  instagram: {
    channel: "instagram",
    label: CHANNEL_LABELS.instagram,
    endpoint: ENDPOINTS.channels.instagram,
    mapPayload(payload) {
      const message = payload?.entry?.[0]?.messaging?.[0];
      return {
        customerName: `IG ${message?.sender?.id || "cliente"}`,
        text: message?.message?.text || "Consulta por Instagram",
        externalId: message?.sender?.id || "ig_ext"
      };
    }
  },
  facebook: {
    channel: "facebook",
    label: CHANNEL_LABELS.facebook,
    endpoint: ENDPOINTS.channels.facebook,
    mapPayload(payload) {
      const message = payload?.entry?.[0]?.messaging?.[0];
      return {
        customerName: `FB ${message?.sender?.id || "cliente"}`,
        text: message?.message?.text || "Consulta por Facebook",
        externalId: message?.sender?.id || "fb_ext"
      };
    }
  }
};

export function getInboxConversations() {
  return listConversations();
}

export function getChannelConfigCards() {
  return Object.values(channelAdapters).map((adapter) => ({
    channel: adapter.channel,
    label: adapter.label,
    webhookPath: adapter.endpoint.webhookPath,
    pollingPath: adapter.endpoint.pollingPath
  }));
}

export function simulateWebhookHandler(channel) {
  const adapter = channelAdapters[channel];
  if (!adapter) return null;

  const payload = WEBHOOK_PAYLOAD_SAMPLES[channel];
  return {
    channel,
    endpoint: adapter.endpoint.webhookPath,
    payload,
    parsed: adapter.mapPayload(payload)
  };
}

export function simulateInboundMessage(channel, conversationId) {
  const simulation = simulateWebhookHandler(channel);
  if (!simulation) return null;

  if (conversationId) {
    addMessage(conversationId, "customer", simulation.parsed.text);
    return {
      ...simulation,
      targetConversationId: conversationId
    };
  }

  const conversation = createInboundConversation(
    channel,
    simulation.parsed.customerName,
    simulation.parsed.text,
    "alta"
  );

  return {
    ...simulation,
    targetConversationId: conversation.id,
    conversation
  };
}
