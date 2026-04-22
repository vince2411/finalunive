export const ENDPOINTS = {
  bcv: {
    primary: "https://ve.dolarapi.com/v1/dolares/oficial",
    backup: "https://ve.dolarapi.com/v1/dolares"
  },
  channels: {
    web: {
      webhookPath: "/api/webhooks/web",
      pollingPath: "/api/channels/web/messages"
    },
    whatsapp: {
      webhookPath: "/api/webhooks/whatsapp",
      pollingPath: "/api/channels/whatsapp/messages"
    },
    instagram: {
      webhookPath: "/api/webhooks/instagram",
      pollingPath: "/api/channels/instagram/messages"
    },
    facebook: {
      webhookPath: "/api/webhooks/facebook",
      pollingPath: "/api/channels/facebook/messages"
    }
  }
};

export const API_KEYS = {
  bcvApiKey: "NO_REQUIERE_API_KEY_ACTUALMENTE",
  whatsappAccessToken: "REEMPLAZAR_CON_TOKEN_REAL",
  instagramAccessToken: "REEMPLAZAR_CON_TOKEN_REAL",
  facebookAccessToken: "REEMPLAZAR_CON_TOKEN_REAL"
};
