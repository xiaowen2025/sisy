import type { ChatSendRequest, ChatSendResponse } from '@/lib/types';
import { getInstallId } from '@/lib/installId';

// Backend URL - change this for production
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:10001';

export async function sendChatMessage(req: ChatSendRequest): Promise<ChatSendResponse> {
  try {
    const formData = new FormData();
    if (req.conversation_id) formData.append('conversation_id', req.conversation_id);
    formData.append('tab', req.tab);
    formData.append('text', req.text);
    if (req.user_context) formData.append('user_context', req.user_context);
    if (req.message_history) formData.append('message_history', JSON.stringify(req.message_history));

    // Handle image file
    if (req.imageUri) {
      const resp = await fetch(req.imageUri);
      const blob = await resp.blob();
      // "image.jpg" is a placeholder name; the backend might ignore it or use it for extension detection
      formData.append('image', blob, 'image.jpg');
    }

    const installId = await getInstallId();

    const response = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      body: formData,
      headers: {
        'X-Install-Id': installId,
        // Do NOT set Content-Type header for FormData, browser does it with boundary
      },
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
