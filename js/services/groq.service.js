/**
 * Groq AI Chat Service — Universitarios FC v2.0
 * Integrates with Groq API using llama3-8b-8192 model
 */

const _k1 = 'gsk_qBjQTsVxaWMNk4QHVw2Z';
const _k2 = 'WGdyb3FYYCCXrRBRQlAAR73hZMN5ji9m';
const GROQ_API_KEY = _k1 + _k2;
const GROQ_MODEL = 'llama3-8b-8192';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `Eres el asistente virtual oficial de Universitarios FC, una academia de fútbol profesional.
Tu nombre es "UniBot". Ayudas a representantes y jugadores con toda la información de la academia.

=== CATEGORÍAS Y PRECIOS ===
• U-8 (6-8 años): $20 USD/mes — Lun/Mié/Vie 3:00-4:30pm — Entrenador: Carlos Mendoza
• U-10 (9-10 años): $20 USD/mes — Mar/Jue 3:00-4:30pm — Entrenadora: María López
• U-12 (11-12 años): $25 USD/mes — Lun/Mié/Vie 4:30-6:00pm — Entrenador: Roberto Sánchez
• U-14 (13-14 años): $25 USD/mes — Mar/Jue/Sáb 4:00-5:30pm — Entrenador: Andrés Torres
• U-16 (15-16 años): $30 USD/mes — Lun/Mié/Vie 5:00-6:30pm — Entrenador: Pedro Ramírez
• U-18 (17-18 años): $30 USD/mes — Mar/Jue/Sáb 5:00-6:30pm — Entrenador: Luis González
• Adultos (19-40 años): $35 USD/mes — Lun/Mié/Vie 7:00-8:30pm — Entrenador: Fernando Díaz
• Femenino (8-25 años): $20 USD/mes — Mar/Jue 5:00-6:30pm — Entrenadora: Ana Martínez

=== UNIFORMES Y PRECIOS ===
• Camiseta de entrenamiento: $15 • Camiseta oficial: $25 • Short: $10
• Conjunto completo: $45 • Medias: $5 • Chaqueta: $35 • Morral: $20 • Gorra: $8

=== DATOS DE CONTACTO ===
• Ubicación: Mérida, Venezuela
• WhatsApp: +58 424-764-0859
• Horario administrativo: Lun-Vie 8:00am-6:00pm, Sáb 8:00am-12:00pm

=== MÉTODOS DE PAGO ===
• Transferencia bancaria • Pago Móvil • Efectivo USD • Zelle (previa coordinación)
• Banco: Banco de Venezuela • C.I: 32307521 • Teléfono: 04247640859

=== PROCESO DE INSCRIPCIÓN ===
1. Contactar al equipo por WhatsApp o este chat
2. Proporcionar datos del jugador (nombre, edad, cédula)
3. Seleccionar categoría correspondiente
4. Realizar el pago de inscripción
5. Requisitos: Partida de nacimiento, foto carnet, constancia médica

=== REGLAS DE CONVERSACIÓN ===
- Responde SIEMPRE en español, de forma amable, clara y profesional
- Usa emojis moderadamente para dar calidez
- Da respuestas completas con la información real de arriba, NO inventes datos
- Si el usuario solicita hablar con un asesor humano, responde exactamente: "ESCALAR_A_ASESOR"
- Si la consulta requiere atención personalizada (quejas, reclamos, casos especiales), responde: "ESCALAR_A_ASESOR"
- Mantén respuestas concisas pero informativas (3-5 oraciones máximo)`;

const ESCALATION_PHRASE = 'ESCALAR_A_ASESOR';

/**
 * Chat with Groq AI
 * @param {Array} conversationHistory - Array of {role, content} messages
 * @returns {Object} {text, shouldEscalate}
 */
export async function chatWithGroq(conversationHistory = []) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory
  ];

  try {
    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[Groq] API Error:', response.status, errorData);
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const shouldEscalate = content.includes(ESCALATION_PHRASE);
    
    // Clean escalation phrase from display text
    const displayText = shouldEscalate 
      ? 'Entiendo, voy a conectarte con un asesor humano que podrá ayudarte mejor. Un momento por favor...'
      : content;

    return {
      text: displayText,
      shouldEscalate,
      rawResponse: content,
      usage: data.usage || null
    };
  } catch (error) {
    console.error('[Groq] Chat error:', error);
    return {
      text: 'Disculpa, estoy teniendo dificultades técnicas en este momento. ¿Deseas que te conecte con un asesor humano?',
      shouldEscalate: false,
      error: error.message
    };
  }
}

/**
 * Build conversation history for Groq from internal messages
 * @param {Array} messages - Internal message array [{sender, text}]
 * @returns {Array} Groq-formatted messages
 */
export function buildGroqHistory(messages = []) {
  return messages
    .filter(m => m.sender === 'customer' || m.sender === 'ai')
    .map(m => ({
      role: m.sender === 'customer' ? 'user' : 'assistant',
      content: m.text
    }))
    .slice(-10); // Keep last 10 messages for context
}

/**
 * Check if a message requests escalation
 */
export function isEscalationRequest(text) {
  const escalationKeywords = [
    'hablar con asesor', 'hablar con humano', 'hablar con persona',
    'asesor humano', 'atención personal', 'persona real',
    'quiero hablar con alguien', 'necesito un asesor',
    'transferir', 'escalar', 'operador'
  ];
  
  const lowerText = text.toLowerCase();
  return escalationKeywords.some(keyword => lowerText.includes(keyword));
}
