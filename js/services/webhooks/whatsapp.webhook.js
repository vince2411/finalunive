/**
 * WhatsApp Business API Webhook — Universitarios FC v2.0
 * Prepared structure for WhatsApp Business API integration
 * 
 * NOTE: This is a client-side preparation file.
 * For production, implement this as a Cloud Function or backend endpoint.
 */

const VERIFY_TOKEN = 'ufc_whatsapp_verify_token_2026';

/**
 * Send a WhatsApp message via the Business API
 * Requires: WHATSAPP_API_TOKEN and PHONE_NUMBER_ID from Meta Business
 */
export async function sendWhatsAppMessage(phoneNumber, message, apiToken, phoneNumberId) {
  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      })
    });
    
    const data = await response.json();
    console.log('[WhatsApp] Message sent:', data);
    return data;
  } catch (error) {
    console.error('[WhatsApp] Send failed:', error);
    throw error;
  }
}

/**
 * Send a template message (for notifications/reminders)
 */
export async function sendTemplateMessage(phoneNumber, templateName, languageCode, apiToken, phoneNumberId) {
  const endpoint = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode || 'es' }
        }
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('[WhatsApp] Template send failed:', error);
    throw error;
  }
}

/**
 * Process incoming WhatsApp webhook payload
 * This would typically run on a server (Cloud Function)
 */
export function processWebhookPayload(payload) {
  if (!payload?.entry) return null;
  
  const messages = [];
  
  for (const entry of payload.entry) {
    for (const change of (entry.changes || [])) {
      if (change.field !== 'messages') continue;
      
      const value = change.value;
      if (!value?.messages) continue;
      
      for (const message of value.messages) {
        messages.push({
          from: message.from,
          id: message.id,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text?.body || '',
          // For Firestore
          firestoreData: {
            channel: 'whatsapp',
            whatsapp_id: message.from,
            wam_id: message.id,
            customerName: value.contacts?.[0]?.profile?.name || message.from,
            text: message.text?.body || '',
            timestamp: parseInt(message.timestamp) * 1000
          }
        });
      }
    }
  }
  
  return messages;
}

/**
 * Verify webhook (for Meta setup)
 */
export function verifyWebhook(queryParams) {
  const mode = queryParams['hub.mode'];
  const token = queryParams['hub.verify_token'];
  const challenge = queryParams['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return { status: 200, body: challenge };
  }
  
  return { status: 403, body: 'Forbidden' };
}
