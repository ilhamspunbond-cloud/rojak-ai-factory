import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import archiver from 'archiver';
import potrace from 'potrace';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendWA, rapikanPrompt, textToImage, submitVideoJob, cfg } from './api/index.js';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dir, 'data');
const AS = path.join(DATA, 'assets'), PR = path.join(DATA, 'proofs');
[AS, PR].forEach(d => fs.mkdirSync(d, { recursive: true }));
const { JWT_SECRET, ADMIN_MASTER_KEY, PORT = 3000 } = process.env;
if (!JWT_SECRET || !ADMIN_MASTER_KEY) { console.error('Isi JWT_SECRET dan ADMIN_MASTER_KEY di .env'); process.exit(1); }

const db = new Database(path.join(DATA, 'rojak.db'));
db.exec(`
create table if not exists users(id integer primary key, phone text unique, ref_code text unique, referred_by integer, balance integer default 0, created integer);
create table if not exists otps(phone text primary key, h text, exp integer, tries integer default 0);
create table if not exists settings(k text primary key, v text);
create table if not exists assets(id text primary key, user_id integer, kind text, ext text, created integer);
create table if not exists orders(id integer primary key, user_id integer, item text, price integer, status text, asset_id text, meta text, created integer, paid_at integer);
create table if not exists payouts(id integer primary key, user_id integer, amount integer, status text, created integer);
create table if not exists jobs(id integer primary key, order_id integer, user_id integer, type text, status text, meta text, output_url text, created integer);
create table if not exists hits(day text primary key, n integer);
`);

const DEF = { appName: 'Rojak Design', komisi: 10, minPayout: 50000, bank: 'Mandiri: -\nSeaBank: -',
  prices: { mockup: 5000, invoice: 5000, afdruk: 15000, video: 10000, paket: 30000, dtf: 55000, faceswap: 50000 } };
const getS = () => { const r = db.prepare('select v from settings where k=?').get('cfg'); const c = r ? JSON.parse(r.v) : {}; return { ...DEF, ...c, prices: { ...DEF.prices, ...(c.prices || {}) } }; };
const setS = o => db.prepare('insert into settings(k,v) values(?,?) on conflict(k) do update set v=excluded.v').run('cfg', JSON.stringify(o));
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const day = () => new Date().toISOString().slice(0, 10);
const KIND_ITEM = { mockup: 'mockup', afdruk: 'afdruk', dtf: 'dtf' };

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'script-src-attr': ["'unsafe-inline'"] } } }));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, n) => { if (req.path === '/') db.prepare('insert into hits(day,n) values(?,1) on conflict(day) do update set n=n+1').run(day()); n(); });

const up = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15e6 } });
const sign = p => jwt.sign(p, JWT_SECRET, { expiresIn: '30d' });
const auth = (req, res, n) => { try { req.u = jwt.verify((req.headers.authorization || '').slice(7) || req.query.t, JWT_SECRET); n(); } catch { res.status(401).json({ error: 'Belum login' }); } };
const adminOnly = (req, res, n) => auth(req, res, () => req.u.admin ? n() : res.status(403).json({ error: 'Khusus admin' }));
const wrap = f => (req, res) => Promise.resolve(f(req, res)).catch(e => { console.error(e); res.status(e.status || 500).json({ error: e.message || 'Error' }); });
const bad = (m, s = 400) => Object.assign(new Error(m), { status: s });

// ---------- AUTH ----------
const normPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); return /^628\d{7,12}$/.test(d) ? d : null; };
const otpLimit = rateLimit({ windowMs: 10 * 60e3, limit: 5, standardHeaders: true });
app.post('/api/auth/otp', otpLimit, wrap(async (req, res) => {
  const phone = normPhone(req.body.phone); if (!phone) throw bad('Nomor WhatsApp tidak valid');
  const code = String(crypto.randomInt(100000, 1000000));
  db.prepare('insert or replace into otps values(?,?,?,0)').run(phone, sha(code + phone), Date.now() + 5 * 60e3);
  await sendWA(phone, `Kode OTP Rojak Design: ${code}. Berlaku 5 menit. Jangan bagikan ke siapa pun.`);
  res.json({ ok: true, ...(!cfg('WA_API_URL') && process.env.NODE_ENV !== 'production' ? { devOtp: code } : {}) });
}));
app.post('/api/auth/verify', rateLimit({ windowMs: 10 * 60e3, limit: 20 }), wrap(async (req, res) => {
  const phone = normPhone(req.body.phone), o = db.prepare('select * from otps where phone=?').get(phone);
  if (!o || o.exp < Date.now() || o.tries >= 5) throw bad('OTP kedaluwarsa, minta kode baru');
  db.prepare('update otps set tries=tries+1 where phone=?').run(phone);
  if (sha(String(req.body.code) + phone) !== o.h) throw bad('Kode salah');
  db.prepare('delete from otps where phone=?').run(phone);
  let u = db.prepare('select * from users where phone=?').get(phone);
  if (!u) {
    const ref = db.prepare('select id from users where ref_code=?').get(String(req.body.ref || ''));
    const id = db.prepare('insert into users(phone,ref_code,referred_by,created) values(?,?,?,?)').run(phone, crypto.randomBytes(4).toString('hex'), ref?.id || null, Date.now()).lastInsertRowid;
    u = db.prepare('select * from users where id=?').get(id);
  }
  res.json({ token: sign({ id: u.id, phone }) });
}));
app.post('/api/auth/admin', rateLimit({ windowMs: 15 * 60e3, limit: 10 }), wrap(async (req, res) => {
  const a = Buffer.from(sha(String(req.body.key || ''))), b = Buffer.from(sha(ADMIN_MASTER_KEY));
  if (!crypto.timingSafeEqual(a, b)) throw bad('Kunci salah', 401);
  res.json({ token: sign({ id: 0, admin: true }) });
}));

// ---------- SETTINGS / BRANDING ----------
const LOGO = path.join(DATA, 'logo.png'), QRIS = path.join(DATA, 'qris.png');
const defLogo = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#d9480f"/><text x="32" y="43" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">R</text></svg>');
app.get('/api/settings', (req, res) => { const s = getS(); res.json({ appName: s.appName, prices: s.prices, bank: s.bank, minPayout: s.minPayout, hasQris: fs.existsSync(QRIS), v: fs.existsSync(LOGO) ? fs.statSync(LOGO).mtimeMs : 0 }); });
app.get('/api/icon/:size.png', wrap(async (req, res) => { const n = Math.min(Math.max(+req.params.size || 192, 48), 512); res.type('png').set('Cache-Control', 'no-cache').send(await sharp(fs.existsSync(LOGO) ? LOGO : defLogo, { density: 300 }).resize(n, n, { fit: 'cover' }).png().toBuffer()); }));
app.get('/api/qris', (req, res) => fs.existsSync(QRIS) ? res.type('png').sendFile(QRIS) : res.sendStatus(404));
app.get('/manifest.webmanifest', (req, res) => res.type('application/manifest+json').json({ name: getS().appName, short_name: getS().appName, start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#d9480f', icons: [192, 512].map(n => ({ src: `/api/icon/${n}.png`, sizes: `${n}x${n}`, type: 'image/png', purpose: 'any maskable' })) }));
app.put('/api/admin/settings', adminOnly, wrap((req, res) => {
  const c = getS(), b = req.body, num = v => Math.max(0, Math.round(+v) || 0);
  if (b.appName) c.appName = String(b.appName).slice(0, 40);
  if (b.bank !== undefined) c.bank = String(b.bank).slice(0, 500);
  if (b.komisi !== undefined) c.komisi = Math.min(100, num(b.komisi));
  if (b.minPayout !== undefined) c.minPayout = num(b.minPayout);
  for (const k of Object.keys(DEF.prices)) if (b.prices?.[k] !== undefined) c.prices[k] = num(b.prices[k]);
  setS(c); res.json(c);
}));
app.post('/api/admin/logo', adminOnly, up.single('image'), wrap(async (req, res) => { if (!req.file) throw bad('Gambar wajib'); fs.writeFileSync(LOGO, await sharp(req.file.buffer).resize(512, 512, { fit: 'cover' }).png().toBuffer()); res.json({ ok: true }); }));
app.post('/api/admin/qris', adminOnly, up.single('image'), wrap(async (req, res) => { if (!req.file) throw bad('Gambar wajib'); fs.writeFileSync(QRIS, await sharp(req.file.buffer).resize(800, 800, { fit: 'inside' }).png().toBuffer()); res.json({ ok: true }); }));

// ---------- IMAGE PROCESSING ----------
async function wm(png, heavy = false) {
  const b = await sharp(png).resize({ width: 900, withoutEnlargement: true }).png().toBuffer(), m = await sharp(b).metadata();
  const step = heavy ? 55 : 120; let t = '';
  for (let y = -m.height; y < m.height * 2; y += step) for (let x = -m.width; x < m.width * 2; x += 240) t += `<text x="${x + ((y / step) & 1) * 120}" y="${y}">ROJAK DESIGN - PREVIEW</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${m.width}" height="${m.height}"><g font-family="sans-serif" font-size="16" font-weight="bold" fill="#000" fill-opacity=".3" transform="rotate(-25 ${m.width / 2} ${m.height / 2})">${t}</g></svg>`;
  return sharp(b).composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}
async function removeBg(src, thr = 40) {
  const { data, info } = await src.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = (x, y) => (y * W + x) * 4;
  const cs = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)];
  const bg = [0, 1, 2].map(c => cs.reduce((a, i) => a + data[i + c], 0) / 4);
  for (let i = 0; i < data.length; i += 4) {
    const d = Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
    if (d < thr) data[i + 3] = 0; else if (d < thr * 1.6) data[i + 3] = Math.round(((d - thr) / (thr * .6)) * 255);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}
async function afdruk(src, lpi = 55, angle = 45, dpi = 300) {
  const { data, info } = await src.clone().flatten({ background: '#fff' }).grayscale().normalise().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height), cell = dpi / lpi, a = angle * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = y * info.width + x;
    if (lpi <= 0) { out[i] = data[i] < 128 ? 0 : 255; continue; }
    const u = (x * cs + y * sn) / cell, v = (-x * sn + y * cs) / cell, s = (Math.cos(2 * Math.PI * u) + Math.cos(2 * Math.PI * v)) / 4 + .5;
    out[i] = data[i] / 255 < s ? 0 : 255;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 1 } }).withMetadata({ density: dpi }).png({ colours: 2 }).toBuffer();
}
async function redraw(src, thr = 128) {
  const g = await src.clone().flatten({ background: '#fff' }).grayscale().normalise().median(3).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer();
  return new Promise((ok, no) => potrace.trace(g, { threshold: thr, turdSize: 20, optTolerance: .3 }, (e, svg) => e ? no(e) : ok(Buffer.from(svg))));
}
const zipBuf = files => new Promise((ok, no) => { const a = archiver('zip'), c = []; a.on('data', d => c.push(d)); a.on('end', () => ok(Buffer.concat(c))); a.on('error', no); files.forEach(([n, b]) => a.append(b, { name: n })); a.finalize(); });
async function separate(src) {
  const { data, info } = await src.clone().flatten({ background: '#fff' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height, ch = [0, 1, 2, 3].map(() => Buffer.alloc(n));
  for (let i = 0; i < n; i++) {
    const r = data[i * 3] / 255, g = data[i * 3 + 1] / 255, b = data[i * 3 + 2] / 255, k = 1 - Math.max(r, g, b), d = 1 - k || 1;
    ch[0][i] = Math.round(255 * (1 - (1 - r - k) / d)); ch[1][i] = Math.round(255 * (1 - (1 - g - k) / d)); ch[2][i] = Math.round(255 * (1 - (1 - b - k) / d)); ch[3][i] = Math.round(255 * (1 - k));
  }
  const files = []; let j = 0;
  for (const nm of ['C', 'M', 'Y', 'K']) files.push([`${nm}.tiff`, await sharp(ch[j++], { raw: { width: info.width, height: info.height, channels: 1 } }).withMetadata({ density: 300 }).tiff({ compression: 'lzw' }).toBuffer()]);
  return zipBuf(files);
}
async function saveAsset(user, kind, ext, buf, prev) {
  const id = crypto.randomUUID();
  fs.writeFileSync(path.join(AS, `${id}.${ext}`), buf); fs.writeFileSync(path.join(AS, `${id}.prev.png`), prev);
  db.prepare('insert into assets values(?,?,?,?,?)').run(id, user, kind, ext, Date.now());
  return { assetId: id, kind, preview: `/api/assets/${id}/preview` };
}
app.post('/api/process/:op', auth, up.single('image'), wrap(async (req, res) => {
  if (!req.file) throw bad('Gambar wajib');
  const src = sharp(req.file.buffer, { limitInputPixels: 60e6 }).rotate(), op = req.params.op, q = req.body, png = () => src.clone().png().toBuffer();
  let r;
  if (op === 'removebg') { const b = await removeBg(src, +q.thr || 40); r = await saveAsset(req.u.id, 'mockup', 'png', b, b); }
  else if (op === 'afdruk') { const b = await afdruk(src, q.lpi === undefined ? 55 : +q.lpi, +q.angle || 45); r = await saveAsset(req.u.id, 'afdruk', 'png', b, b); }
  else if (op === 'redraw') { const svg = await redraw(src, +q.thr || 128); r = await saveAsset(req.u.id, 'mockup', 'svg', svg, await sharp(svg, { density: 150 }).flatten({ background: '#fff' }).png().toBuffer()); }
  else if (op === 'separate') { const z = await separate(src); r = await saveAsset(req.u.id, 'dtf', 'zip', z, await png()); }
  else throw bad('Operasi tidak dikenal');
  res.json(r);
}));
const hasPaid = (u, a) => u.admin || (a.user_id === u.id && db.prepare("select 1 from orders where user_id=? and status='lunas' and (item='paket' or (item=? and asset_id=?))").get(u.id, KIND_ITEM[a.kind], a.id));
const asset = (req, res) => { const a = db.prepare('select * from assets where id=?').get(req.params.id); if (!a || (a.user_id !== req.u.id && !req.u.admin)) throw bad('Aset tidak ditemukan', 404); return a; };
app.get('/api/assets/:id/preview', auth, wrap(async (req, res) => { const a = asset(req); const b = fs.readFileSync(path.join(AS, `${a.id}.prev.png`)); res.type('png').send(req.u.admin ? b : await wm(b)); }));
app.get('/api/assets/:id/download', auth, wrap((req, res) => { const a = asset(req); if (!hasPaid(req.u, a)) throw bad('Belum lunas. Selesaikan pembayaran dulu.', 402); res.download(path.join(AS, `${a.id}.${a.ext}`), `rojak-${a.kind}.${a.ext}`); }));
const TEE = '<path d="M130 60L40 120L75 180L110 160L110 360L290 360L290 160L325 180L360 120L270 60Q200 110 130 60Z"';
app.post('/api/mockup', auth, wrap(async (req, res) => {
  const a = asset({ params: { id: req.body.assetId }, u: req.u }), b = req.body, color = /^#[0-9a-f]{6}$/i.test(b.color) ? b.color : '#e8e8e8';
  const design = await sharp(path.join(AS, `${a.id}.prev.png`)).resize({ width: Math.round(Math.min(Math.max(+b.s || 60, 10), 150) * 4) }).rotate(+b.r || 0, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const m = await sharp(design).metadata(), L = Math.round((200 + (+b.x || 0)) * 2 - m.width / 2), T = Math.round((210 + (+b.y || 0)) * 2 - m.height / 2);
  const ox = Math.max(0, -L), oy = Math.max(0, -T), w = Math.min(m.width - ox, 800 - Math.max(L, 0)), h = Math.min(m.height - oy, 800 - Math.max(T, 0));
  if (w < 1 || h < 1) throw bad('Desain di luar area produk');
  const base = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 400 400"><rect width="400" height="400" fill="#fff"/>${TEE} fill="${color}" stroke="#999"/></svg>`)).png().toBuffer();
  const out = await sharp(base).composite([{ input: await sharp(design).extract({ left: ox, top: oy, width: w, height: h }).toBuffer(), left: Math.max(L, 0), top: Math.max(T, 0) }]).png().toBuffer();
  res.json(await saveAsset(req.u.id, 'mockup', 'png', out, out));
}));

// ---------- AI ----------
app.post('/api/ai/prompt', auth, rateLimit({ windowMs: 60e3, limit: 10 }), wrap(async (req, res) => res.json({ prompt: await rapikanPrompt(String(req.body.text || '').slice(0, 1000)) })));
app.post('/api/ai/image', auth, rateLimit({ windowMs: 60e3, limit: 5 }), wrap(async (req, res) => { const b = await sharp(await textToImage(String(req.body.prompt || '').slice(0, 1000))).png().toBuffer(); res.json(await saveAsset(req.u.id, 'mockup', 'png', b, b)); }));

// ---------- ORDERS ----------
app.post('/api/orders', auth, wrap((req, res) => {
  if (req.u.admin) throw bad('Admin tidak perlu membayar');
  const s = getS(), { item, assetId } = req.body, meta = req.body.meta || {};
  if (!(item in s.prices)) throw bad('Item tidak dikenal');
  if (item === 'faceswap' && !(+meta.duration > 0 && +meta.duration <= 300)) throw bad('Durasi video maksimal 5 menit (300 detik)');
  if (assetId && !db.prepare('select 1 from assets where id=? and user_id=?').get(assetId, req.u.id)) throw bad('Aset tidak ditemukan', 404);
  const id = db.prepare('insert into orders(user_id,item,price,status,asset_id,meta,created) values(?,?,?,?,?,?,?)').run(req.u.id, item, s.prices[item], 'dibuat', assetId || null, JSON.stringify(meta).slice(0, 4000), Date.now()).lastInsertRowid;
  res.json({ id });
}));
app.post('/api/orders/:id/proof', auth, up.single('image'), wrap(async (req, res) => {
  const o = db.prepare('select * from orders where id=? and user_id=?').get(req.params.id, req.u.id); if (!o || !req.file) throw bad('Pesanan/bukti tidak valid');
  if (o.status === 'lunas') throw bad('Pesanan sudah lunas');
  fs.writeFileSync(path.join(PR, `${o.id}.jpg`), await sharp(req.file.buffer).rotate().resize(1400, 1400, { fit: 'inside' }).jpeg({ quality: 80 }).toBuffer());
  db.prepare("update orders set status='menunggu' where id=?").run(o.id); res.json({ ok: true });
}));
app.get('/api/me', auth, wrap((req, res) => {
  if (req.u.admin) return res.json({ admin: true, phone: 'admin' });
  const u = db.prepare('select * from users where id=?').get(req.u.id);
  res.json({ phone: u.phone, refCode: u.ref_code, balance: u.balance, orders: db.prepare('select id,item,price,status,asset_id from orders where user_id=? order by id desc limit 50').all(u.id), payouts: db.prepare('select amount,status from payouts where user_id=? order by id desc limit 20').all(u.id), jobs: db.prepare('select id,type,status,output_url from jobs where user_id=? order by id desc limit 20').all(u.id) });
}));
app.get('/api/orders/:id/invoice.pdf', auth, wrap((req, res) => {
  const o = db.prepare('select * from orders where id=?').get(req.params.id);
  if (!o || o.item !== 'invoice' || (o.user_id !== req.u.id && !req.u.admin)) throw bad('Invoice tidak ditemukan', 404);
  if (o.status !== 'lunas' && !req.u.admin) throw bad('Belum lunas', 402);
  const m = JSON.parse(o.meta || '{}'), items = Array.isArray(m.items) ? m.items.slice(0, 40) : [], d = new PDFDocument({ margin: 50 });
  res.type('pdf'); d.pipe(res);
  if (fs.existsSync(LOGO)) d.image(LOGO, 50, 45, { width: 60 });
  d.fontSize(22).text(m.brand || getS().appName, 125, 55).fontSize(10).text(m.brandAddress || '', 125);
  d.moveDown(3).fontSize(16).text(`INVOICE #${o.id}`, 50).fontSize(10).text(new Date().toLocaleDateString('id-ID')).moveDown().text(`Kepada: ${m.customer || '-'}`).text(m.address || '').moveDown();
  let total = 0; items.forEach(i => { const sub = (+i.qty || 0) * (+i.price || 0); total += sub; d.text(`${String(i.name || '').slice(0, 60)}   ${+i.qty || 0} x Rp${(+i.price || 0).toLocaleString('id-ID')} = Rp${sub.toLocaleString('id-ID')}`); });
  d.moveDown().fontSize(13).text(`TOTAL: Rp${total.toLocaleString('id-ID')}`); d.end();
}));

// ---------- VIDEO JOBS ----------
async function queueJob(o) {
  const type = o.item === 'faceswap' ? 'faceswap' : 'promo';
  const id = db.prepare('insert into jobs(order_id,user_id,type,status,meta,created) values(?,?,?,?,?,?)').run(o.id, o.user_id, type, 'menunggu_provider', o.meta, Date.now()).lastInsertRowid;
  try { if (await submitVideoJob({ jobId: id, type, assetId: o.asset_id, meta: JSON.parse(o.meta || '{}') })) db.prepare("update jobs set status='diproses' where id=?").run(id); } catch (e) { console.error('video provider', e.message); }
}
app.put('/api/admin/jobs/:id', adminOnly, wrap((req, res) => { db.prepare('update jobs set status=?, output_url=? where id=?').run(String(req.body.status || 'selesai'), String(req.body.output_url || ''), req.params.id); res.json({ ok: true }); }));

// ---------- ADMIN ----------
app.get('/api/admin/orders', adminOnly, wrap((req, res) => res.json(db.prepare("select o.id,o.item,o.price,o.status,u.phone from orders o left join users u on u.id=o.user_id where o.status in ('menunggu','lunas') order by (o.status='menunggu') desc, o.id desc limit 100").all())));
app.get('/api/admin/orders/:id/proof', adminOnly, (req, res) => { const f = path.join(PR, `${+req.params.id}.jpg`); fs.existsSync(f) ? res.type('jpeg').sendFile(f) : res.sendStatus(404); });
app.post('/api/admin/orders/:id/validate', adminOnly, wrap(async (req, res) => {
  const o = db.prepare('select * from orders where id=?').get(req.params.id); if (!o) throw bad('Tidak ada', 404); if (o.status === 'lunas') return res.json({ ok: true });
  db.transaction(() => {
    db.prepare("update orders set status='lunas', paid_at=? where id=?").run(Date.now(), o.id);
    const u = db.prepare('select referred_by from users where id=?').get(o.user_id);
    if (u?.referred_by) db.prepare('update users set balance=balance+? where id=?').run(Math.floor(o.price * getS().komisi / 100), u.referred_by);
  })();
  if (['video', 'faceswap', 'paket'].includes(o.item)) await queueJob(o);
  res.json({ ok: true });
}));
app.get('/api/admin/stats', adminOnly, wrap((req, res) => res.json({
  visitorsToday: db.prepare('select n from hits where day=?').get(day())?.n || 0, users: db.prepare('select count(*) c from users').get().c,
  omzetTotal: db.prepare("select coalesce(sum(price),0) s from orders where status='lunas'").get().s,
  omzetHarian: db.prepare("select date(paid_at/1000,'unixepoch') d, sum(price) s from orders where status='lunas' group by d order by d desc limit 30").all(),
  payouts: db.prepare("select p.id,p.amount,u.phone from payouts p join users u on u.id=p.user_id where p.status='diminta'").all(),
  jobs: db.prepare("select id,type,status from jobs where status!='selesai' order by id desc limit 30").all() })));
app.post('/api/admin/payouts/:id/paid', adminOnly, wrap((req, res) => { db.prepare("update payouts set status='dibayar' where id=?").run(req.params.id); res.json({ ok: true }); }));
app.post('/api/affiliate/payout', auth, wrap((req, res) => {
  const amt = Math.floor(+req.body.amount), min = getS().minPayout;
  if (!(amt >= min)) throw bad(`Minimal penarikan Rp${min.toLocaleString('id-ID')}`);
  const r = db.prepare('update users set balance=balance-? where id=? and balance>=?').run(amt, req.u.id, amt);
  if (!r.changes) throw bad('Saldo tidak cukup');
  db.prepare("insert into payouts(user_id,amount,status,created) values(?,?,'diminta',?)").run(req.u.id, amt, Date.now()); res.json({ ok: true });
}));

app.use(express.static(path.join(__dir, 'public')));
app.listen(PORT, () => console.log(`Rojak Design jalan di http://localhost:${PORT}`));
