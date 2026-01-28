import { getInstallId } from '@/lib/installId';
import type { ChatSendRequest, ChatSendResponse } from '@/lib/types';

function getApiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export async function sendChatMessage(req: ChatSendRequest): Promise<ChatSendResponse> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  }

  const installId = await getInstallId();
  const res = await fetch(`${baseUrl}/api/v0/chat/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-install-id': installId,
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Chat request failed: ${res.status} ${text}`);
  }

  return (await res.json()) as ChatSendResponse;
}
