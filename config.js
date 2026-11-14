// Baca kunci dari environment dulu (.env / Secrets hosting), lalu dari api/keys.local.js
let local = {};
try { local = (await import('./keys.local.js')).default || {}; } catch { /* belum dibuat, tidak apa-apa */ }
export const cfg = k => process.env[k] || local[k] || '';
export const fail = (m, status = 502) => Object.assign(new Error(m), { status });
