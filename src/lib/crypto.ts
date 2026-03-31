// Password hashing using Web Crypto API (SHA-256 with salt)
// NOTE: For production, use a proper backend with bcrypt/argon2
const SALT = 'POWAI_INTEGRITY_2026';

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(SALT + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
