export const WEBHOOK_PAYLOAD_SAMPLES = {
  web: {
    event: "new_message",
    conversationId: "web_2026_001",
    customer: {
      name: "Mariana Rojas",
      phone: "+58 4121234567"
    },
    message: {
      text: "Necesito informacion de horarios para sub-13",
      sentAt: "2026-04-19T10:15:00Z"
    }
  },
  whatsapp: {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: "584241112233",
                  text: { body: "Quiero saber costos de mensualidad" },
                  timestamp: "1713522000"
                }
              ]
            }
          }
        ]
      }
    ]
  },
  instagram: {
    object: "instagram",
    entry: [
      {
        messaging: [
          {
            sender: { id: "17890" },
            message: { text: "Tienen cupos disponibles?" },
            timestamp: 1713522200
          }
        ]
      }
    ]
  },
  facebook: {
    object: "page",
    entry: [
      {
        messaging: [
          {
            sender: { id: "user_001" },
            message: { text: "Como es el proceso de inscripcion?" },
            timestamp: 1713522400
          }
        ]
      }
    ]
  }
};
