// Panggil Claude lewat HTTP biasa (tanpa SDK). Tempel/ubah logikanya di sini.
import { cfg, fail } from './config.js';

export async function rapikanPrompt(text) {
  const key = cfg('ANTHROPIC_API_KEY');
  if (!key) throw fail('ANTHROPIC_API_KEY belum diisi (api/keys.local.js atau .env)', 501);
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: cfg('CLAUDE_MODEL') || 'claude-sonnet-5-5',
      max_tokens: 400,
      system: 'Kamu membantu menulis prompt gambar (bahasa Inggris, 1 paragraf) untuk desain sablon/DTF: garis tegas, warna terbatas, latar polos, tanpa teks acak. Balas hanya prompt-nya.',
      messages: [{ role: 'user', content: text }],
    }),
  });
  const j = await r.json();
  if (!r.ok) throw fail('Gagal memanggil Claude');
  return (j.content || []).map(c => c.text || '').join('');
}
