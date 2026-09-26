const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const DATA_DIR = path.join(__dirname, 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, JSON.stringify({ posts: [] }, null, 2));

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function generateReadablePassword() {
  // evita caracteres ambíguos (0/O, 1/l/I) para digitar mais fácil
  const alphabet = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += alphabet[crypto.randomInt(alphabet.length)];
  return out;
}

function ensureConfig() {
  if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  // Senha inicial: usa ADMIN_PASSWORD do ambiente se definida, senão gera uma
  // aleatória — nunca fica hardcoded no código-fonte.
  const initialPassword = process.env.ADMIN_PASSWORD || generateReadablePassword();
  const salt = crypto.randomBytes(16).toString('hex');
  const config = { salt, passwordHash: hashPassword(initialPassword, salt) };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log('\n[PL Ambiental] Senha inicial do painel admin criada: "' + initialPassword + '"');
  console.log('[PL Ambiental] Guarde essa senha agora — ela não fica salva em nenhum lugar em texto puro.');
  console.log('[PL Ambiental] Troque em /admin (Configurações) assim que possível.\n');
  return config;
}

function readPosts() {
  return JSON.parse(fs.readFileSync(POSTS_FILE, 'utf8'));
}

function writePosts(data) {
  fs.writeFileSync(POSTS_FILE, JSON.stringify(data, null, 2));
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, crypto.randomBytes(10).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
    cb(ok ? null : new Error('Formato de imagem não suportado'), ok);
  },
});

const app = express();
// atrás do Traefik: 1 proxy confiável, para req.ip refletir o IP real do visitante
app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  secret: 'pl-ambiental-admin-' + crypto.randomBytes(8).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 1000 * 60 * 60 * 8 },
}));

// ---- Limite de tentativas de senha (por IP): 5 erros => bloqueio de 15 min ----
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const failures = new Map(); // ip -> { count, last, lockedUntil }

function lockRemainingSeconds(ip) {
  const rec = failures.get(ip);
  if (!rec || !rec.lockedUntil || rec.lockedUntil <= Date.now()) return 0;
  return Math.ceil((rec.lockedUntil - Date.now()) / 1000);
}

function registerFailure(ip) {
  const now = Date.now();
  let rec = failures.get(ip);
  if (!rec || now - rec.last > LOCK_MS || (rec.lockedUntil && rec.lockedUntil <= now)) {
    rec = { count: 0, last: now, lockedUntil: 0 };
  }
  rec.count += 1;
  rec.last = now;
  if (rec.count >= MAX_ATTEMPTS) rec.lockedUntil = now + LOCK_MS;
  failures.set(ip, rec);
  return rec;
}

function rejectIfLocked(req, res, next) {
  const retryAfter = lockRemainingSeconds(req.ip);
  if (retryAfter > 0) {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'too_many_attempts', retryAfter });
  }
  next();
}

function failureResponse(res, ip, errorCode) {
  const rec = registerFailure(ip);
  const retryAfter = lockRemainingSeconds(ip);
  if (retryAfter > 0) {
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({ error: 'too_many_attempts', retryAfter });
  }
  return res.status(401).json({ error: errorCode, remaining: MAX_ATTEMPTS - rec.count });
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of failures) if (now - rec.last > LOCK_MS && (!rec.lockedUntil || rec.lockedUntil <= now)) failures.delete(ip);
}, 5 * 60 * 1000).unref();

function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a), 'hex'), bb = Buffer.from(String(b), 'hex');
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'not_authenticated' });
}

// ---- Auth ----
app.post('/api/admin/login', rejectIfLocked, (req, res) => {
  const config = ensureConfig();
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'missing_password' });
  const hash = hashPassword(String(password), config.salt);
  if (safeEqualHex(hash, config.passwordHash)) {
    failures.delete(req.ip);
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  return failureResponse(res, req.ip, 'invalid_password');
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/admin/session', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

app.post('/api/admin/change-password', requireAuth, rejectIfLocked, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const config = ensureConfig();
  if (!safeEqualHex(hashPassword(String(currentPassword || ''), config.salt), config.passwordHash)) {
    return failureResponse(res, req.ip, 'invalid_current_password');
  }
  failures.delete(req.ip);
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'weak_password' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const updated = { salt, passwordHash: hashPassword(newPassword, salt) };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));
  res.json({ ok: true });
});

// ---- Public posts (só ativos, ordenados) ----
app.get('/api/posts', (req, res) => {
  const { posts } = readPosts();
  const active = posts
    .filter((p) => p.active)
    .sort((a, b) => a.order - b.order)
    .map(({ id, image, caption, link }) => ({ id, image, caption, link }));
  res.json({ posts: active });
});

// ---- Admin posts CRUD ----
app.get('/api/admin/posts', requireAuth, (req, res) => {
  const { posts } = readPosts();
  res.json({ posts: posts.sort((a, b) => a.order - b.order) });
});

app.post('/api/admin/posts', requireAuth, upload.single('image'), (req, res) => {
  const data = readPosts();
  const { caption = '', link = '' } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'missing_image' });
  const maxOrder = data.posts.reduce((m, p) => Math.max(m, p.order ?? 0), -1);
  const post = {
    id: crypto.randomBytes(8).toString('hex'),
    image: '/uploads/' + req.file.filename,
    caption: caption.trim(),
    link: link.trim(),
    active: true,
    order: maxOrder + 1,
    createdAt: new Date().toISOString(),
  };
  data.posts.push(post);
  writePosts(data);
  res.json({ ok: true, post });
});

app.put('/api/admin/posts/:id', requireAuth, upload.single('image'), (req, res) => {
  const data = readPosts();
  const post = data.posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'not_found' });
  const { caption, link, active } = req.body || {};
  if (caption !== undefined) post.caption = caption.trim();
  if (link !== undefined) post.link = link.trim();
  if (active !== undefined) post.active = active === 'true' || active === true;
  if (req.file) {
    const oldPath = path.join(UPLOADS_DIR, path.basename(post.image));
    post.image = '/uploads/' + req.file.filename;
    fs.unlink(oldPath, () => {});
  }
  writePosts(data);
  res.json({ ok: true, post });
});

app.delete('/api/admin/posts/:id', requireAuth, (req, res) => {
  const data = readPosts();
  const idx = data.posts.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const [removed] = data.posts.splice(idx, 1);
  writePosts(data);
  if (removed && removed.image) {
    fs.unlink(path.join(UPLOADS_DIR, path.basename(removed.image)), () => {});
  }
  res.json({ ok: true });
});

app.post('/api/admin/posts/reorder', requireAuth, (req, res) => {
  const { order } = req.body || {}; // array of ids in new order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'invalid_order' });
  const data = readPosts();
  order.forEach((id, i) => {
    const post = data.posts.find((p) => p.id === id);
    if (post) post.order = i;
  });
  writePosts(data);
  res.json({ ok: true });
});

app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));

ensureConfig();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[PL Ambiental] Site rodando em http://localhost:${PORT}`);
  console.log(`[PL Ambiental] Painel admin em http://localhost:${PORT}/admin`);
});
