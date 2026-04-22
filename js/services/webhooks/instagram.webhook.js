/**
 * Instagram Messaging API Webhook — Universitarios FC v2.0
 * Prepared structure for Instagram DM integration
 */

export async function sendInstagramMessage(pageId, recipientId, message, accessToken) {
  const endpoint = `https://graph.instagram.com/v18.0/${pageId}/messages`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message }
      })
    });
    
    return await response.json();
  } catch (error) {
    console.error('[Instagram] Send failed:', error);
    throw error;
  }
}

export function processInstagramWebhook(payload) {
  if (!payload?.entry) return null;
  
  const messages = [];
  
  for (const entry of payload.entry) {
    for (const messaging of (entry.messaging || [])) {
      if (messaging.message) {
        messages.push({
          channel: 'instagram',
          instagram_id: messaging.sender.id,
          conversation_id: entry.id,
          text: messaging.message.text || '',
          timestamp: messaging.timestamp
        });
      }
    }
  }
  
  return messages;
}
