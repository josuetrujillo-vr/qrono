export const SLOT_SECONDS = 30;
const encoder = new TextEncoder();
async function signature(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 16);
}
export async function createQrToken(org: string, secret: string, now = Date.now()): Promise<string> {
  const message = `${org}.${Math.floor(now / 1000 / SLOT_SECONDS)}`;
  return `${message}.${await signature(secret, message)}`;
}
export async function verifyQrToken(token: string, org: string, secret: string, now = Date.now()): Promise<boolean> {
  if (token.length > 100) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== org || !/^\d{1,12}$/.test(parts[1]) || !/^[\w-]{16}$/.test(parts[2])) return false;
  const age = Math.floor(now / 1000 / SLOT_SECONDS) - Number(parts[1]);
  if (age !== 0 && age !== 1) return false;
  const expected = await signature(secret, `${org}.${parts[1]}`);
  let difference = 0;
  for (let i = 0; i < 16; i++) difference |= expected.charCodeAt(i) ^ parts[2].charCodeAt(i);
  return difference === 0;
}
