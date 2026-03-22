/* ═══════════════════════════════════════════════════════════
   app.js  —  ScriptVault (Firebase v12 ESM)
   Semua event listener dipasang di sini via addEventListener
   Tidak ada onclick di HTML — cara yang benar untuk type="module"
═══════════════════════════════════════════════════════════ */

import { initializeApp }   from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore,
         collection, doc,
         getDoc, getDocs,
         setDoc, updateDoc, deleteDoc,
         addDoc, arrayUnion,
         query, orderBy,
         Timestamp }        from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

/* ─────────────────────────────────────────────────────────
   FIREBASE INIT
───────────────────────────────────────────────────────── */
const app = initializeApp({
  apiKey:            'AIzaSyCU1q_FpcAyyipVwN6I9N4du8brKudpjTg',
  authDomain:        'vault-45632.firebaseapp.com',
  projectId:         'vault-45632',
  storageBucket:     'vault-45632.firebasestorage.app',
  messagingSenderId: '387874758450',
  appId:             '1:387874758450:web:7967214cbc4a0f81a9412b',
  measurementId:     'G-K3L94E8FM2'
});
const db = getFirestore(app);

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const ADMIN_USER = 'DinoIjoNPC';
const ADMIN_PASS = 'GABRIEL@12345';

/* ─────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────── */
const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const esc  = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const b64e = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return ''; } };
const b64d = (s) => { try { return decodeURIComponent(escape(atob(s))); } catch { return ''; } };

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1)  return 'baru saja';
  if (m < 60) return m + ' mnt lalu';
  const h = Math.floor(m/60);
  if (h < 24) return h + ' jam lalu';
  const dy = Math.floor(h/24);
  if (dy < 30) return dy + ' hari lalu';
  return d.toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'});
};

const readFile = (file, maxMB, cb) => {
  if (file.size > maxMB * 1024 * 1024) { alert('Foto terlalu besar! Maks ' + maxMB + 'MB.'); return; }
  const r = new FileReader();
  r.onload = (e) => cb(e.target.result);
  r.readAsDataURL(file);
};

const $ = (id) => document.getElementById(id);

/* ─────────────────────────────────────────────────────────
   SESSION
───────────────────────────────────────────────────────── */
const Session = {
  get:   () => { try { return localStorage.getItem('sv_sess') || null; } catch { return null; } },
  save:  (u) => { try { localStorage.setItem('sv_sess', u); } catch {} },
  clear: () =>  { try { localStorage.removeItem('sv_sess'); } catch {} }
};

/* ─────────────────────────────────────────────────────────
   DB  —  Firestore
───────────────────────────────────────────────────────── */
const DB = {
  async getUser(username) {
    try { const s = await getDoc(doc(db,'users',username)); return s.exists() ? s.data() : null; }
    catch { return null; }
  },
  async saveUser(u) {
    try { await setDoc(doc(db,'users',u.username), u); return true; }
    catch(e) { console.error(e); return false; }
  },
  async updateUser(username, data) {
    try { await updateDoc(doc(db,'users',username), data); return true; }
    catch(e) { console.error(e); return false; }
  },
  async deleteUser(username) {
    try { await deleteDoc(doc(db,'users',username)); } catch {}
  },
  async getUserCount() {
    try { return (await getDocs(collection(db,'users'))).size; } catch { return 0; }
  },
  async getScripts() {
    try {
      const q = query(collection(db,'scripts'), orderBy('createdAt','desc'));
      return (await getDocs(q)).docs.map(d => d.data());
    } catch { return []; }
  },
  async getScript(id) {
    try { const s = await getDoc(doc(db,'scripts',id)); return s.exists() ? s.data() : null; }
    catch { return null; }
  },
  async saveScript(obj) {
    try { await setDoc(doc(db,'scripts',obj.id), obj); return true; }
    catch(e) { console.error(e); return false; }
  },
  async deleteScript(id) {
    try { await deleteDoc(doc(db,'scripts',id)); return true; }
    catch { return false; }
  },
  async getComments(scriptId) {
    try {
      const q = query(collection(db,'comments',scriptId,'list'), orderBy('createdAt','asc'));
      return (await getDocs(q)).docs.map(d => d.data());
    } catch { return []; }
  },
  async addComment(scriptId, obj) {
    try { await setDoc(doc(db,'comments',scriptId,'list',obj.id), obj); return true; }
    catch { return false; }
  },
  async addReply(scriptId, commentId, reply) {
    try {
      await updateDoc(doc(db,'comments',scriptId,'list',commentId), { replies: arrayUnion(reply) });
      return true;
    } catch { return false; }
  },
  async seedAdmin() {
    const u = await DB.getUser(ADMIN_USER);
    if (!u) await DB.saveUser({ username:ADMIN_USER, password:ADMIN_PASS, isAdmin:true, avatar:'', createdAt:new Date().toISOString() });
    else if (!u.isAdmin) await DB.updateUser(ADMIN_USER, { isAdmin:true });
  }
};

/* ─────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────── */
let currentUser   = null;
let currentScript = null;
let itemCount     = 0;

/* ─────────────────────────────────────────────────────────
   HELPERS — Modal, Alert, Loading, Toast, Theme
───────────────────────────────────────────────────────── */
const openModal  = (id) => $(id).classList.remove('hidden');
const closeModal = (id) => $(id).classList.add('hidden');

const showAlert = (id, msg, type='err') => {
  const el = $(id); if (!el) return;
  el.textContent = msg;
  el.className = 'alert ' + (type==='ok' ? 'alert-success' : 'alert-error');
};
const hideAlert = (id) => {
  const el = $(id); if (!el) return;
  el.textContent = ''; el.className = 'alert hidden';
};
const clearAlerts = () => {
  document.querySelectorAll('.alert').forEach(el => { el.textContent=''; el.className='alert hidden'; });
};

let toastTimer = null;
const toast = (msg) => {
  const el = $('toast');
  el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
};

const loading = (show) => { const el=$('loadingOverlay'); if(el) el.classList.toggle('hidden',!show); };

const setTheme = (t) => {
  try { localStorage.setItem('sv_theme', t); } catch {}
  document.documentElement.setAttribute('data-theme', t);
  $('themeDark').classList.toggle('active',  t==='dark');
  $('themeLight').classList.toggle('active', t==='light');
};

/* ─────────────────────────────────────────────────────────
   NAV
───────────────────────────────────────────────────────── */
const updateNav = (user) => {
  currentUser = user;
  const guestEl  = $('guestNav');
  const userEl   = $('userNav');
  const nameEl   = $('navUsername');
  const badgeEl  = $('navBadge');
  const uploadEl = $('btnUpload');
  const avatarEl = $('navAvatar');

  if (user) {
    guestEl.setAttribute('style',  'display:none');
    userEl.setAttribute('style',   'display:flex;align-items:center;gap:10px');
    nameEl.textContent = user.username;
    badgeEl.setAttribute('style',  user.isAdmin ? 'display:inline-block' : 'display:none');
    uploadEl.setAttribute('style', user.isAdmin ? 'display:inline-block' : 'display:none');
    avatarEl.innerHTML = user.avatar
      ? `<img src="${user.avatar}" alt="av"/>`
      : esc(user.username[0].toUpperCase());
  } else {
    guestEl.setAttribute('style', 'display:flex;gap:8px');
    userEl.setAttribute('style',  'display:none');
  }
};

const updateStats = async () => {
  const scripts = await DB.getScripts();
  $('statScripts').textContent = scripts.length;
  $('statMembers').textContent = await DB.getUserCount();
};

/* ─────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────── */
const openAuth = (pane) => {
  clearAlerts();
  $('paneLogin').style.display    = pane==='login'    ? 'block' : 'none';
  $('paneRegister').style.display = pane==='register' ? 'block' : 'none';
  openModal('modalAuth');
};

const doLogin = async () => {
  hideAlert('errLogin');
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;
  if (!username || !password) { showAlert('errLogin','Isi username dan password!'); return; }

  loading(true);
  const user = await DB.getUser(username);
  loading(false);

  if (!user)                    { showAlert('errLogin','Username tidak ditemukan.'); return; }
  if (user.password !== password) { showAlert('errLogin','Password salah.'); return; }

  Session.save(user.username);
  updateNav(user);
  closeModal('modalAuth');
  toast('Selamat datang, ' + user.username + '!');
  await renderScripts();
  await updateStats();
};

const doRegister = async () => {
  hideAlert('errRegister');
  const username  = $('regUsername').value.replace(/\s/g,'');
  const password  = $('regPassword').value;
  const password2 = $('regPassword2').value;
  const avatar    = $('regAvatarData').value;

  if (!username||!password||!password2) { showAlert('errRegister','Isi semua field!'); return; }
  if (username.length < 3)  { showAlert('errRegister','Username minimal 3 karakter.'); return; }
  if (username.length > 30) { showAlert('errRegister','Username maksimal 30 karakter.'); return; }
  if (password.length < 6)  { showAlert('errRegister','Password minimal 6 karakter.'); return; }
  if (password !== password2) { showAlert('errRegister','Password tidak cocok!'); return; }

  loading(true);
  const existing = await DB.getUser(username);
  if (existing) { loading(false); showAlert('errRegister','Username sudah dipakai!'); return; }

  const newUser = { username, password, isAdmin:false, avatar, createdAt:new Date().toISOString() };
  const ok = await DB.saveUser(newUser);
  loading(false);

  if (!ok) { showAlert('errRegister','Gagal membuat akun, coba lagi.'); return; }

  Session.save(newUser.username);
  updateNav(newUser);
  closeModal('modalAuth');
  toast('Akun berhasil dibuat! Selamat datang, ' + username + '!');
  await renderScripts();
  await updateStats();
};

const doLogout = async () => {
  Session.clear();
  updateNav(null);
  toast('Sampai jumpa!');
  await renderScripts();
};

const doEditProfile = async () => {
  hideAlert('errEdit');
  const me = currentUser; if (!me) return;

  const newAvatar   = $('editAvatarData').value;
  const newUsername = $('editUsername').value.replace(/\s/g,'').trim();
  const newPassword = $('editPassword').value;

  if (newUsername && newUsername.length < 3) { showAlert('errEdit','Username minimal 3 karakter.'); return; }
  if (newPassword && newPassword.length < 6) { showAlert('errEdit','Password minimal 6 karakter.'); return; }

  loading(true);

  if (newUsername && newUsername !== me.username) {
    const ex = await DB.getUser(newUsername);
    if (ex) { loading(false); showAlert('errEdit','Username sudah dipakai!'); return; }
    const newObj = { username:newUsername, password:newPassword||me.password, isAdmin:me.isAdmin, avatar:newAvatar||me.avatar, createdAt:me.createdAt };
    await DB.saveUser(newObj);
    await DB.deleteUser(me.username);
    Session.save(newUsername);
    loading(false);
    updateNav(newObj);
  } else {
    const updates = {};
    if (newAvatar)   updates.avatar   = newAvatar;
    if (newPassword) updates.password = newPassword;
    if (Object.keys(updates).length) await DB.updateUser(me.username, updates);
    const updated = await DB.getUser(me.username);
    loading(false);
    if (updated) { Session.save(updated.username); updateNav(updated); }
  }

  await renderScripts();
  showAlert('okEdit','Profil berhasil diperbarui!','ok');
  setTimeout(() => closeModal('modalEdit'), 1200);
};

/* ─────────────────────────────────────────────────────────
   SCRIPTS  —  Render, Upload, Detail, Delete
───────────────────────────────────────────────────────── */
const renderScripts = async () => {
  const q   = $('searchInput').value.toLowerCase();
  const cat = $('filterCat').value;
  const grid = $('scriptsGrid');
  grid.innerHTML = '<div class="empty-state"><p style="color:var(--gray)">Memuat...</p></div>';

  let data = await DB.getScripts();
  if (q)   data = data.filter(s => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  if (cat) data = data.filter(s => s.category === cat);

  $('sectionTitle').textContent = (q||cat) ? `Hasil: ${data.length} Script` : 'Semua Script';

  if (!data.length) {
    grid.innerHTML = `<div class="empty-state"><h3>KOSONG</h3><p>Belum ada script${q||cat?' yang cocok':''}</p></div>`;
    return;
  }

  grid.innerHTML = '';
  data.forEach((s,i) => {
    const card = buildCard(s, i);
    grid.appendChild(card);
  });
};

const buildCard = (s, idx) => {
  const el = document.createElement('div');
  el.className = 'script-card';
  el.style.animationDelay = (idx*0.05)+'s';

  const thumbHtml = s.thumb
    ? `<img src="${s.thumb}" alt="thumb"/>`
    : '<div class="card-thumb-empty">🗂</div>';

  const scripts = s.scripts || [];
  const rows = scripts.map(sc =>
    `<div class="card-script-row">
      <span class="card-script-name">${esc(sc.name)}</span>
      <button class="copy-btn" data-code="${b64e(sc.code)}">📋 Salin</button>
    </div>`
  ).join('');

  const avHtml = s.authorAvatar
    ? `<img src="${s.authorAvatar}" alt="av"/>`
    : esc((s.author||'?')[0].toUpperCase());

  el.innerHTML = `
    <div class="card-thumb">${thumbHtml}</div>
    <div class="card-body">
      <div class="card-top">
        <span class="card-tag">${esc(s.category)}</span>
        <span class="card-count">${scripts.length} script</span>
      </div>
      <div class="card-title">${esc(s.title)}</div>
      <div class="card-desc">${esc(s.desc)}</div>
      <div class="card-script-list">${rows}</div>
      <div class="card-footer">
        <div class="card-avatar-sm">${avHtml}</div>
        <span class="card-author">${esc(s.author||'')}</span>
      </div>
    </div>`;

  /* Copy buttons */
  el.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); doCopy(btn.dataset.code, btn); });
  });

  /* Klik card → buka detail */
  el.addEventListener('click', () => openDetail(s.id));
  return el;
};

const doCopy = (b64, btn) => {
  navigator.clipboard.writeText(b64d(b64)).then(() => {
    btn.textContent = '✓ Disalin'; btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML='📋 Salin'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => toast('Gagal menyalin.'));
};

const openDetail = async (id) => {
  loading(true);
  const s = await DB.getScript(id);
  loading(false);
  if (!s) return;

  currentScript = id;

  $('detailThumb').innerHTML = s.thumb
    ? `<img src="${s.thumb}" alt="thumb"/>`
    : '<div class="detail-thumb-empty">🗂</div>';

  $('detailTag').textContent        = s.category;
  $('detailTitle').textContent      = s.title;
  $('detailDesc').textContent       = s.desc;
  $('detailAuthorName').textContent = s.author;
  $('detailDate').textContent       = timeAgo(s.createdAt);
  $('detailAvatar').innerHTML       = s.authorAvatar
    ? `<img src="${s.authorAvatar}" alt="av"/>`
    : esc((s.author||'?')[0].toUpperCase());

  const scriptEl = $('detailScripts');
  scriptEl.innerHTML = '';
  (s.scripts||[]).forEach((sc,i) => scriptEl.appendChild(buildScriptItem(sc,i)));

  $('adminActions').style.display = (currentUser && currentUser.isAdmin) ? 'block' : 'none';

  $('commentInput').innerHTML = '';
  $('commentList').innerHTML  = '';
  await renderComments(id);

  switchTab('script');
  openModal('modalDetail');
};

const buildScriptItem = (sc, idx) => {
  const wrap = document.createElement('div');
  wrap.className = 'detail-script-item';

  const header = document.createElement('div');
  header.className = 'detail-script-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'detail-script-name'; nameEl.textContent = sc.name;

  const acts = document.createElement('div');
  acts.className = 'detail-script-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn'; copyBtn.innerHTML = '📋 Salin';
  const enc = b64e(sc.code);
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); doCopy(enc,copyBtn); });

  const arr = document.createElement('span');
  arr.className = 'code-toggle'; arr.textContent = '▾';

  acts.appendChild(copyBtn); acts.appendChild(arr);
  header.append(document.createTextNode('📄 '), nameEl, acts);

  const codeWrap = document.createElement('div');
  codeWrap.className = 'code-wrap';
  const pre = document.createElement('pre');
  pre.className = 'code-block'; pre.textContent = sc.code;
  codeWrap.appendChild(pre);

  header.addEventListener('click', () => {
    codeWrap.classList.toggle('open');
    arr.textContent = codeWrap.classList.contains('open') ? '▴' : '▾';
  });

  wrap.append(header, codeWrap);
  return wrap;
};

const doUpload = async () => {
  hideAlert('errUpload');
  if (!currentUser || !currentUser.isAdmin) { showAlert('errUpload','Akses ditolak!'); return; }

  const title = $('upTitle').value.trim();
  const cat   = $('upCategory').value;
  const desc  = $('upDesc').value.trim();
  const thumb = $('thumbData').value;

  if (!title||!desc) { showAlert('errUpload','Judul dan deskripsi wajib diisi!'); return; }

  const items   = $('scriptItems').querySelectorAll('.script-item');
  const scripts = [];
  for (let i = 0; i < items.length; i++) {
    const nameEl = items[i].querySelector('[data-sname]');
    const codeEl = items[i].querySelector('[data-scode]');
    if (!nameEl||!codeEl) continue;
    const name = nameEl.value.trim();
    const code = codeEl.value.trim();
    if (!name && !code) continue;
    if (!name) { showAlert('errUpload',`Script #${i+1}: nama kosong!`); return; }
    if (!code) { showAlert('errUpload',`Script #${i+1}: kode kosong!`); return; }
    scripts.push({name,code});
  }
  if (!scripts.length) { showAlert('errUpload','Tambahkan minimal 1 script!'); return; }

  loading(true);
  const ok = await DB.saveScript({
    id:uid(), title, category:cat, desc, thumb, scripts,
    author:currentUser.username, authorAvatar:currentUser.avatar||'',
    createdAt:Timestamp.now()
  });
  loading(false);

  if (!ok) { showAlert('errUpload','Gagal upload, coba lagi.'); return; }
  closeModal('modalUpload');
  toast('Script berhasil dipublikasikan!');
  await renderScripts();
  await updateStats();
};

const doDeleteScript = async () => {
  if (!confirm('Yakin ingin menghapus script ini?')) return;
  loading(true);
  await DB.deleteScript(currentScript);
  loading(false);
  closeModal('modalDetail');
  toast('Script dihapus.');
  await renderScripts();
  await updateStats();
};

/* ─────────────────────────────────────────────────────────
   UPLOAD FORM  —  Script Items & Thumbnail
───────────────────────────────────────────────────────── */
const resetUploadForm = () => {
  $('upTitle').value = $('upDesc').value = $('thumbData').value = '';
  const area = $('thumbArea');
  area.style.backgroundImage = area.style.backgroundSize = area.style.backgroundPosition = '';
  $('thumbPlaceholder').style.display = 'flex';
  $('scriptItems').innerHTML = '';
  itemCount = 0;
  addScriptItem();
};

const addScriptItem = () => {
  itemCount++;
  const n    = itemCount;
  const wrap = document.createElement('div');
  wrap.className = 'script-item';

  const header = document.createElement('div');
  header.className = 'script-item-header';
  const lbl = document.createElement('span');
  lbl.className = 'script-item-num'; lbl.textContent = 'Script #'+n;
  const btnDel = document.createElement('button');
  btnDel.className = 'script-item-del'; btnDel.textContent = '✕';
  btnDel.addEventListener('click', () => wrap.remove());
  header.append(lbl, btnDel);

  const g1 = document.createElement('div');
  g1.className = 'form-group'; g1.style.marginBottom = '10px';
  const l1 = document.createElement('label'); l1.className='form-label'; l1.textContent='Nama Script';
  const inp = document.createElement('input');
  inp.className='form-input'; inp.type='text'; inp.placeholder='Contoh: Auto Farm v2';
  inp.setAttribute('data-sname','');
  g1.append(l1, inp);

  const g2 = document.createElement('div');
  g2.className = 'form-group'; g2.style.marginBottom = '0';
  const l2 = document.createElement('label'); l2.className='form-label'; l2.textContent='Kode Script';
  const ta = document.createElement('textarea');
  ta.className='form-input form-textarea'; ta.rows=5; ta.placeholder='-- Paste kode di sini...';
  ta.setAttribute('data-scode','');
  g2.append(l2, ta);

  wrap.append(header, g1, g2);
  $('scriptItems').appendChild(wrap);
};

/* ─────────────────────────────────────────────────────────
   TABS
───────────────────────────────────────────────────────── */
const switchTab = (tab) => {
  const isScript = tab === 'script';
  $('tabScript').classList.toggle('active',    isScript);
  $('tabComment').classList.toggle('active',   !isScript);
  $('tabBtnScript').classList.toggle('active',  isScript);
  $('tabBtnComment').classList.toggle('active', !isScript);
};

/* ─────────────────────────────────────────────────────────
   COMMENTS
───────────────────────────────────────────────────────── */
const renderComments = async (scriptId) => {
  const me   = currentUser;
  const wrap = $('commentInput');

  if (!wrap.hasChildNodes()) {
    if (me) {
      const avH = me.avatar ? `<img src="${me.avatar}" alt="av"/>` : esc(me.username[0].toUpperCase());
      const box = document.createElement('div');
      box.className = 'comment-input-box';
      box.innerHTML = `
        <div class="comment-input-header">
          <div class="comment-avatar">${avH}</div>
          <span class="comment-username">${esc(me.username)}</span>
          ${me.isAdmin ? '<span class="dev-badge">Developer</span>' : ''}
        </div>
        <textarea class="comment-textarea" id="cmtTA" rows="3" placeholder="Tulis komentar..."></textarea>
        <div class="comment-submit-row">
          <button class="btn-send" id="cmtSendBtn">Kirim →</button>
        </div>`;
      wrap.appendChild(box);
      $('cmtSendBtn').addEventListener('click', () => postComment(scriptId));
    } else {
      const p = document.createElement('div');
      p.className = 'login-prompt';
      p.innerHTML = '<p>Kamu harus login untuk berkomentar</p><button class="btn btn-primary" id="btnLoginFromComment">Login Sekarang</button>';
      wrap.appendChild(p);
      $('btnLoginFromComment').addEventListener('click', () => { closeModal('modalDetail'); openAuth('login'); });
    }
  }

  await refreshCommentList(scriptId);
};

const refreshCommentList = async (scriptId) => {
  const listEl = $('commentList');
  listEl.innerHTML = '<p style="color:var(--gray);font-size:11px;padding:8px 0">Memuat komentar...</p>';

  const list  = await DB.getComments(scriptId);
  const total = list.reduce((a,c) => a+1+(c.replies?.length||0), 0);
  const badge = $('detailCmtCount'); if (badge) badge.textContent = total;

  listEl.innerHTML = '';
  if (!list.length) {
    listEl.innerHTML = '<div class="no-comments">Belum ada komentar — jadilah yang pertama!</div>';
    return;
  }
  list.forEach(c => listEl.appendChild(buildCommentEl(c, scriptId)));
};

const buildCommentEl = (c, scriptId) => {
  const isAdm = c.author === ADMIN_USER;
  const me    = currentUser;
  const avH   = c.authorAvatar ? `<img src="${c.authorAvatar}" alt="av"/>` : esc((c.author||'?')[0].toUpperCase());

  const repsHtml = (c.replies||[]).map(r => {
    const rAdm = r.author === ADMIN_USER;
    const rAv  = r.authorAvatar ? `<img src="${r.authorAvatar}" alt="av"/>` : esc((r.author||'?')[0].toUpperCase());
    return `<div class="reply-item">
      <div class="comment-header">
        <div class="comment-avatar" style="width:24px;height:24px;font-size:10px">${rAv}</div>
        <span class="comment-name">${esc(r.author)}</span>
        ${rAdm?'<span class="comment-role">Developer</span>':''}
        <span class="comment-time">${timeAgo(r.createdAt)}</span>
      </div>
      <div class="comment-body">${esc(r.body)}</div>
    </div>`;
  }).join('');

  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = `
    <div class="comment-header">
      <div class="comment-avatar">${avH}</div>
      <span class="comment-name">${esc(c.author)}</span>
      ${isAdm?'<span class="comment-role">Developer</span>':''}
      <span class="comment-time">${timeAgo(c.createdAt)}</span>
    </div>
    <div class="comment-body">${esc(c.body)}</div>
    <div class="comment-actions">
      ${me?'<button class="btn-reply">↩ Balas</button>':''}
    </div>
    ${repsHtml?`<div class="replies">${repsHtml}</div>`:''}
    <div class="reply-input-wrap" id="riw_${c.id}"></div>`;

  if (me) {
    item.querySelector('.btn-reply').addEventListener('click', () => toggleReply(c.id, scriptId));
  }
  return item;
};

const postComment = async (scriptId) => {
  const me = currentUser; if (!me) return;
  const ta = $('cmtTA'); if (!ta) return;
  const body = ta.value.trim(); if (!body) return;

  const ok = await DB.addComment(scriptId, {
    id:uid(), author:me.username, authorAvatar:me.avatar||'',
    body, replies:[], createdAt:Timestamp.now()
  });
  if (!ok) { toast('Gagal kirim komentar.'); return; }
  ta.value = '';
  await refreshCommentList(scriptId);
};

const toggleReply = (cmtId, scriptId) => {
  const wrap = $('riw_'+cmtId); if (!wrap) return;
  if (wrap.hasChildNodes()) { wrap.innerHTML=''; return; }
  const me = currentUser; if (!me) return;

  const div = document.createElement('div');
  div.style.paddingTop = '10px';
  const ta = document.createElement('textarea');
  ta.className='comment-textarea'; ta.rows=2; ta.placeholder='Tulis balasan...';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';
  const btnC = document.createElement('button');
  btnC.className='btn-cancel-reply'; btnC.textContent='Batal';
  btnC.addEventListener('click', () => wrap.innerHTML='');
  const btnS = document.createElement('button');
  btnS.className='btn-send'; btnS.textContent='Kirim →';
  btnS.addEventListener('click', async () => {
    const body = ta.value.trim(); if (!body) return;
    const ok = await DB.addReply(scriptId, cmtId, {
      id:uid(), author:me.username, authorAvatar:me.avatar||'',
      body, createdAt:Timestamp.now()
    });
    if (!ok) { toast('Gagal kirim balasan.'); return; }
    await refreshCommentList(scriptId);
  });
  row.append(btnC, btnS);
  div.append(ta, row);
  wrap.appendChild(div);
};

/* ─────────────────────────────────────────────────────────
   INIT  —  Pasang semua event listener di sini
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {

  /* ── Tema ── */
  let savedTheme = 'dark';
  try { savedTheme = localStorage.getItem('sv_theme') || 'dark'; } catch {}
  setTheme(savedTheme);

  /* ── Session ── */
  const savedUser = Session.get();
  if (savedUser) {
    loading(true);
    const user = await DB.getUser(savedUser);
    loading(false);
    if (user) { updateNav(user); } else { Session.clear(); updateNav(null); }
  } else {
    updateNav(null);
  }

  /* ── Render awal ── */
  await renderScripts();
  await updateStats();

  /* ── Seed admin ── */
  DB.seedAdmin();

  /* ═══════ EVENT LISTENERS ═══════ */

  /* NAV */
  $('btnMasuk').addEventListener('click',  () => openAuth('login'));
  $('btnDaftar').addEventListener('click', () => openAuth('register'));
  $('btnSettings').addEventListener('click', () => {
    let t='dark'; try{t=localStorage.getItem('sv_theme')||'dark';}catch{}
    setTheme(t); openModal('modalSettings');
  });
  $('btnUpload').addEventListener('click', () => { resetUploadForm(); openModal('modalUpload'); });
  $('navProfile').addEventListener('click', (e) => {
    if (!e.target.closest('#dropdown')) $('dropdown').classList.toggle('open');
  });
  $('btnEditProfile').addEventListener('click', () => {
    $('dropdown').classList.remove('open');
    const u = currentUser; if (!u) return;
    $('editAvatarPreview').innerHTML = u.avatar ? `<img src="${u.avatar}"/>` : '👤';
    $('editAvatarData').value = u.avatar||'';
    $('editUsername').value = $('editPassword').value = '';
    clearAlerts(); openModal('modalEdit');
  });
  $('btnLogout').addEventListener('click', () => { $('dropdown').classList.remove('open'); doLogout(); });

  /* Tutup dropdown klik di luar */
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#navProfile')) $('dropdown').classList.remove('open');
  });

  /* AUTH MODAL */
  $('closeAuth').addEventListener('click',        () => closeModal('modalAuth'));
  $('switchToRegister').addEventListener('click', () => openAuth('register'));
  $('switchToLogin').addEventListener('click',    () => openAuth('login'));
  $('btnDoLogin').addEventListener('click',       doLogin);
  $('btnDoRegister').addEventListener('click',    doRegister);

  /* Login juga dengan Enter */
  ['loginUsername','loginPassword'].forEach(id => {
    $(id).addEventListener('keydown', (e) => { if (e.key==='Enter') doLogin(); });
  });

  /* Avatar register */
  $('btnPickAvatar').addEventListener('click', () => $('regAvatarFile').click());
  $('regAvatarFile').addEventListener('change', function() {
    const f = this.files[0]; if (!f) return;
    readFile(f, 2, (data) => {
      $('regAvatarPreview').innerHTML = `<img src="${data}"/>`;
      $('regAvatarData').value = data;
    });
  });
  /* Auto strip spasi username */
  $('regUsername').addEventListener('input', function() { this.value = this.value.replace(/\s/g,''); });
  $('editUsername').addEventListener('input', function() { this.value = this.value.replace(/\s/g,''); });

  /* EDIT MODAL */
  $('closeEdit').addEventListener('click', () => closeModal('modalEdit'));
  $('btnDoEdit').addEventListener('click', doEditProfile);
  $('btnPickEditAvatar').addEventListener('click', () => $('editAvatarFile').click());
  $('editAvatarFile').addEventListener('change', function() {
    const f = this.files[0]; if (!f) return;
    readFile(f, 2, (data) => {
      $('editAvatarPreview').innerHTML = `<img src="${data}"/>`;
      $('editAvatarData').value = data;
    });
  });

  /* SETTINGS MODAL */
  $('closeSettings').addEventListener('click', () => closeModal('modalSettings'));
  $('themeDark').addEventListener('click',  () => setTheme('dark'));
  $('themeLight').addEventListener('click', () => setTheme('light'));

  /* UPLOAD MODAL */
  $('closeUpload').addEventListener('click',  () => closeModal('modalUpload'));
  $('btnAddScript').addEventListener('click', addScriptItem);
  $('btnDoUpload').addEventListener('click',  doUpload);
  $('thumbArea').addEventListener('click',    () => $('thumbFile').click());
  $('thumbFile').addEventListener('change', function() {
    const f = this.files[0]; if (!f) return;
    readFile(f, 5, (data) => {
      const area = $('thumbArea');
      area.style.backgroundImage    = `url("${data}")`;
      area.style.backgroundSize     = 'cover';
      area.style.backgroundPosition = 'center';
      $('thumbPlaceholder').style.display = 'none';
      $('thumbData').value = data;
    });
  });

  /* DETAIL MODAL */
  $('closeDetail').addEventListener('click',     () => closeModal('modalDetail'));
  $('btnDeleteScript').addEventListener('click', doDeleteScript);
  $('tabBtnScript').addEventListener('click',    () => switchTab('script'));
  $('tabBtnComment').addEventListener('click',   () => switchTab('comment'));

  /* SEARCH & FILTER */
  $('searchInput').addEventListener('input',  renderScripts);
  $('filterCat').addEventListener('change',   renderScripts);

  /* Tutup modal klik backdrop */
  ['modalAuth','modalEdit','modalSettings','modalUpload','modalDetail'].forEach(id => {
    $(id).addEventListener('click', (e) => { if (e.target===$ (id)) closeModal(id); });
  });
});
