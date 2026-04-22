/**
 * Facebook Messenger API Webhook — Universitarios FC v2.0
 * Prepared structure for Facebook Messenger integration
 */

export async function sendFacebookMessage(pageId, recipientId, message, accessToken) {
  const endpoint = `https://graph.facebook.com/v18.0/${pageId}/messages`;
  
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
    console.error('[Facebook] Send failed:', error);
    throw error;
  }
}

export function processFacebookWebhook(payload) {
  if (!payload?.entry) return null;
  
  const messages = [];
  
  for (const entry of payload.entry) {
    for (const messaging of (entry.messaging || [])) {
      if (messaging.message) {
        messages.push({
          channel: 'facebook',
          facebook_id: messaging.sender.id,
          page_scoped_user_id: messaging.sender.id,
          text: messaging.message.text || '',
          timestamp: messaging.timestamp
        });
      }
    }
  }
  
  return messages;
}
