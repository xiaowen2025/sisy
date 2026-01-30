import type { ChatSendRequest, ChatSendResponse } from '@/lib/types';

// Backend URL - change this for production
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function sendChatMessage(req: ChatSendRequest): Promise<ChatSendResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversation_id: req.conversation_id,
        tab: req.tab,
        text: req.text,
        imageUri: req.imageUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API] Backend error:', response.status, errorText);
      throw new Error(`Backend error: ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error('[API] Chat Error', e);
    throw e;
  }
}
