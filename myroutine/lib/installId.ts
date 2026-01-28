import { getJson, setJson } from '@/lib/storage';

const INSTALL_ID_KEY = 'sisy.install_id.v1';

function makeId(): string {
  // Not a security boundary; just stable scoping for “no-auth MVP”.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function getInstallId(): Promise<string> {
  const existing = await getJson<string>(INSTALL_ID_KEY);
  if (existing) return existing;

  const created = makeId();
  await setJson(INSTALL_ID_KEY, created);
  return created;
}
