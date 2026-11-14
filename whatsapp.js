// Kirim OTP WhatsApp. Sesuaikan body/header dengan gateway Anda di sini.
import { cfg, fail } from './config.js';

export async function sendWA(phone, message) {
  const url = cfg('WA_API_URL');
  if (!url) { console.log(`[WA dev] ${phone}: ${message}`); return; } // mode dev: OTP tampil di console
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: cfg('WA_API_TOKEN'), 'Content-Type': 'application/json' },
    body: JSON.stringify({ target: phone, message }),
  });
  if (!r.ok) throw fail('Gagal kirim WhatsApp');
}
