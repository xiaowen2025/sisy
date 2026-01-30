import type { ChatSendRequest, ChatSendResponse } from '@/lib/types';

// Backend URL - change this for production
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function sendChatMessage(req: ChatSendRequest): Promise<ChatSendResponse> {
  try {
    const formData = new FormData();
    if (req.conversation_id) formData.append('conversation_id', req.conversation_id);
    formData.append('tab', req.tab);
    formData.append('text', req.text);
    if (req.user_context) formData.append('user_context', req.user_context);

    // TODO: handle imageUri -> actual file usage if needed, 
    // but main.py handles image uploads via separate logic usually or expects a file object.
    // For now we just pass text fields or if we had a blob we'd append it.
    // Since req.imageUri is a string uri, if we want to send it as a file we need to fetch it first.
    // For this task we focus on user_context.

    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      body: formData,
      // Do NOT set Content-Type header for FormData, browser does it with boundary
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
