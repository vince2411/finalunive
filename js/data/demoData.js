import { generateId } from "../shared/utils.js";

export function getDemoConversations() {
  const now = Date.now();
  return [
    {
      id: "conv_web_001",
      channel: "web",
      customerName: "Luis Perez",
      topic: "Inscripciones sub-15",
      priority: "alta",
      status: "atendido_ia",
      assignedTo: "IA",
      createdAt: now - 3600 * 1000 * 8,
      updatedAt: now - 3600 * 1000 * 2,
      messages: [
        {
          id: generateId("msg"),
          sender: "customer",
          text: "Hola, quiero saber el costo para sub-15",
          timestamp: now - 3600 * 1000 * 8
        },
        {
          id: generateId("msg"),
          sender: "ai",
          text: "El plan base inicia en 25 USD por mes. Te ayudo con requisitos?",
          timestamp: now - 3600 * 1000 * 8 + 240000
        }
      ]
    },
    {
      id: "conv_wa_002",
      channel: "whatsapp",
      customerName: "Daniela Suarez",
      topic: "Morosidad y metodos de pago",
      priority: "alta",
      status: "escalado_humano",
      assignedTo: "Asesor - Soporte",
      createdAt: now - 3600 * 1000 * 18,
      updatedAt: now - 3600 * 1000,
      messages: [
        {
          id: generateId("msg"),
          sender: "customer",
          text: "Mi hijo aparecio con deuda y ya pague la mitad",
          timestamp: now - 3600 * 1000 * 18
        },
        {
          id: generateId("msg"),
          sender: "advisor",
          text: "Perfecto, ya reviso su historial y le confirmo en breve.",
          timestamp: now - 3600 * 1000
        }
      ]
    },
    {
      id: "conv_ig_003",
      channel: "instagram",
      customerName: "Academia Aliada",
      topic: "Convenio institucional",
      priority: "media",
      status: "pendiente",
      assignedTo: "IA",
      createdAt: now - 3600 * 1000 * 26,
      updatedAt: now - 3600 * 1000 * 26,
      messages: [
        {
          id: generateId("msg"),
          sender: "customer",
          text: "Podemos agendar una reunion para alianza deportiva?",
          timestamp: now - 3600 * 1000 * 26
        }
      ]
    },
    {
      id: "conv_fb_004",
      channel: "facebook",
      customerName: "Pedro Molina",
      topic: "Uniformes disponibles",
      priority: "baja",
      status: "cerrado",
      assignedTo: "Asesor - Soporte",
      createdAt: now - 3600 * 1000 * 40,
      updatedAt: now - 3600 * 1000 * 30,
      messages: [
        {
          id: generateId("msg"),
          sender: "customer",
          text: "Tienen uniforme talla M?",
          timestamp: now - 3600 * 1000 * 40
        },
        {
          id: generateId("msg"),
          sender: "advisor",
          text: "Si, disponible en azul y blanco. Ya fue reservado.",
          timestamp: now - 3600 * 1000 * 30
        }
      ]
    }
  ];
}

export function getDemoFinanceRecords() {
  return {
    inscriptions: [
      {
        id: generateId("ins"),
        studentName: "Miguel Acosta",
        concept: "Inscripcion abril",
        amountUSD: 35,
        amountVES: 1382.5,
        createdAt: Date.now() - 3600 * 1000 * 72
      }
    ],
    uniforms: [
      {
        id: generateId("uni"),
        product: "Uniforme titular",
        quantity: 2,
        amountUSD: 48,
        amountVES: 1896,
        createdAt: Date.now() - 3600 * 1000 * 48
      }
    ],
    debts: [
      {
        id: generateId("debt"),
        representativeName: "Josefina Torres",
        amountUSD: 30,
        amountVES: 1185,
        concept: "Mensualidad marzo",
        daysLate: 3,
        phonePrefix: "+58",
        phoneNumber: "4146677889",
        status: "activo",
        createdAt: Date.now() - 3600 * 1000 * 90
      }
    ],
    debtHistory: []
  };
}
