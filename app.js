/* ═══════════════════════════════════════════════════════════
   app.js  —  ScriptVault (Firebase v12 ESM)
   Import langsung dari CDN gstatic — tidak perlu npm
═══════════════════════════════════════════════════════════ */

import { initializeApp }                          from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getFirestore, collection, doc,
         getDoc, getDocs, setDoc, updateDoc,
         deleteDoc, addDoc, arrayUnion,
         query, orderBy, Timestamp }              from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

/* ─────────────────────────────────────────────────────────
   INIT FIREBASE
───────────────────────────────────────────────────────── */
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCU1q_FpcAyyipVwN6I9N4du8brKudpjTg',
  authDomain:        'vault-45632.firebaseapp.com',
  projectId:         'vault-45632',
  storageBucket:     'vault-45632.firebasestorage.app',
  messagingSenderId: '387874758450',
  appId:             '1:387874758450:web:7967214cbc4a0f81a9412b',
  measurementId:     'G-K3L94E8FM2'
};

const app = initializeApp(FIREBASE_CONFIG);
const db  = getFirestore(app);

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
const ADMIN_USER = 'DinoIjoNPC';
const ADMIN_PASS = 'GABRIEL@12345';

/* ─────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────── */
const Utils = {
  uid: () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6),

  esc: (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;'),

  b64e: (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch { return ''; } },
  b64d: (s) => { try { return decodeURIComponent(escape(atob(s))); } catch { return ''; } },

  timeAgo: (ts) => {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    const m = Math.floor((Date.now() - date.getTime()) / 60000);
    if (m < 1)  return 'baru saja';
    if (m < 60) return m + ' mnt lalu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    const d = Math.floor(h / 24);
    if (d < 30) return d + ' hari lalu';
    return date.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  },

  readFile: (file, maxBytes, cb) => {
    if (file.size > maxBytes) { alert('Foto terlalu besar! Maks ' + Math.round(maxBytes/1024/1024) + 'MB.'); return; }
    const r = new FileReader();
    r.onload = (e) => cb(e.target.result);
    r.readAsDataURL(file);
  }
};

/* ─────────────────────────────────────────────────────────
   SESSION  —  simpan username saja di localStorage
───────────────────────────────────────────────────────── */
const Session = {
  KEY: 'sv_session',
  get:   () => { try { return localStorage.getItem('sv_session') || null; } catch { return null; } },
  save:  (u) => { try { localStorage.setItem('sv_session', u); } catch {} },
  clear: () =>  { try { localStorage.removeItem('sv_session'); } catch {} }
};

/* ─────────────────────────────────────────────────────────
   DB  —  Firestore helpers
───────────────────────────────────────────────────────── */
const DB = {

  /* ── USERS ── */
  async getUser(username) {
    try {
      const snap = await getDoc(doc(db, 'users', username));
      return snap.exists() ? snap.data() : null;
    } catch { return null; }
  },

  async saveUser(userObj) {
    try { await setDoc(doc(db, 'users', userObj.username), userObj); return true; }
    catch (e) { console.error('saveUser:', e); return false; }
  },

  async updateUser(username, data) {
    try { await updateDoc(doc(db, 'users', username), data); return true; }
    catch (e) { console.error('updateUser:', e); return false; }
  },

  async getUserCount() {
    try { const s = await getDocs(collection(db, 'users')); return s.size; }
    catch { return 0; }
  },

  async seedAdmin() {
    const existing = await DB.getUser(ADMIN_USER);
    if (!existing) {
      await DB.saveUser({ username: ADMIN_USER, password: ADMIN_PASS, isAdmin: true, avatar: '', createdAt: new Date().toISOString() });
    } else if (!existing.isAdmin) {
      await DB.updateUser(ADMIN_USER, { isAdmin: true });
    }
  },

  /* ── SCRIPTS ── */
  async getScripts() {
    try {
      const q    = query(collection(db, 'scripts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch { return []; }
  },

  async getScript(id) {
    try {
      const snap = await getDoc(doc(db, 'scripts', id));
      return snap.exists() ? snap.data() : null;
    } catch { return null; }
  },

  async saveScript(obj) {
    try { await setDoc(doc(db, 'scripts', obj.id), obj); return true; }
    catch (e) { console.error('saveScript:', e); return false; }
  },

  async deleteScript(id) {
    try { await deleteDoc(doc(db, 'scripts', id)); return true; }
    catch { return false; }
  },

  /* ── COMMENTS ── */
  async getComments(scriptId) {
    try {
      const q    = query(collection(db, 'comments', scriptId, 'list'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => d.data());
    } catch { return []; }
  },

  async addComment(scriptId, commentObj) {
    try { await setDoc(doc(db, 'comments', scriptId, 'list', commentObj.id), commentObj); return true; }
    catch { return false; }
  },

  async addReply(scriptId, commentId, replyObj) {
    try {
      await updateDoc(doc(db, 'comments', scriptId, 'list', commentId), {
        replies: arrayUnion(replyObj)
      });
      return true;
    } catch { return false; }
  }
};

/* ─────────────────────────────────────────────────────────
   UI  —  Modal, Nav, Tema, Toast, Form
───────────────────────────────────────────────────────── */
const UI = {

  _currentUser: null,
  _toastTimer:  null,

  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
  },

  loading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.toggle('hidden', !show);
  },

  showAlert(id, msg, type = 'err') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'alert ' + (type === 'ok' ? 'alert-success' : 'alert-error');
  },
  hideAlert(id) {
    const el = document.getElementById(id);
    if (el) { el.className = 'alert hidden'; el.textContent = ''; }
  },
  clearAlerts() {
    document.querySelectorAll('.alert').forEach(el => {
      el.className = 'alert hidden'; el.textContent = '';
    });
  },

  openModal(id)  { document.getElementById(id).classList.remove('hidden'); },
  closeModal(id) { document.getElementById(id).classList.add('hidden'); },
  bgClose(e, id) { if (e.target === document.getElementById(id)) UI.closeModal(id); },

  openAuth(pane) {
    UI.clearAlerts();
    document.getElementById('paneLogin').style.display    = pane === 'login'    ? 'block' : 'none';
    document.getElementById('paneRegister').style.display = pane === 'register' ? 'block' : 'none';
    UI.openModal('modalAuth');
  },

  updateNav(user) {
    UI._currentUser = user;
    const guestEl  = document.getElementById('guestNav');
    const userEl   = document.getElementById('userNav');
    const nameEl   = document.getElementById('navUsername');
    const badgeEl  = document.getElementById('navBadge');
    const uploadEl = document.getElementById('btnUpload');
    const avatarEl = document.getElementById('navAvatar');

    if (user) {
      guestEl.setAttribute('style',  'display:none');
      userEl.setAttribute('style',   'display:flex;align-items:center;gap:10px');
      nameEl.textContent = user.username;
      badgeEl.setAttribute('style',  user.isAdmin ? 'display:inline-block' : 'display:none');
      uploadEl.setAttribute('style', user.isAdmin ? 'display:inline-block' : 'display:none');
      avatarEl.innerHTML = user.avatar
        ? `<img src="${user.avatar}" alt="av"/>`
        : Utils.esc(user.username[0].toUpperCase());
    } else {
      guestEl.setAttribute('style', 'display:flex;gap:8px');
      userEl.setAttribute('style',  'display:none');
    }
  },

  toggleDrop() {
    document.getElementById('dropdown').classList.toggle('open');
  },

  setTheme(t) {
    try { localStorage.setItem('sv_theme', t); } catch {}
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeDark').classList.toggle('active',  t === 'dark');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
  },
  applyStoredTheme() {
    let t = 'dark';
    try { t = localStorage.getItem('sv_theme') || 'dark'; } catch {}
    UI.setTheme(t);
  },
  openSettings() {
    let t = 'dark';
    try { t = localStorage.getItem('sv_theme') || 'dark'; } catch {}
    UI.setTheme(t);
    UI.openModal('modalSettings');
  },

  openEditProfile() {
    document.getElementById('dropdown').classList.remove('open');
    const u = UI._currentUser;
    if (!u) return;
    document.getElementById('editAvatarPreview').innerHTML = u.avatar ? `<img src="${u.avatar}"/>` : '👤';
    document.getElementById('editAvatarData').value = u.avatar || '';
    document.getElementById('editUsername').value   = '';
    document.getElementById('editPassword').value   = '';
    UI.clearAlerts();
    UI.openModal('modalEdit');
  },

  loadAvatar(input, prevId, dataId) {
    const f = input.files[0]; if (!f) return;
    Utils.readFile(f, 2*1024*1024, (data) => {
      document.getElementById(prevId).innerHTML = `<img src="${data}"/>`;
      document.getElementById(dataId).value = data;
    });
  },

  loadThumb(input) {
    const f = input.files[0]; if (!f) return;
    Utils.readFile(f, 5*1024*1024, (data) => {
      const area = document.getElementById('thumbArea');
      area.style.backgroundImage    = `url("${data}")`;
      area.style.backgroundSize     = 'cover';
      area.style.backgroundPosition = 'center';
      document.getElementById('thumbPlaceholder').style.display = 'none';
      document.getElementById('thumbData').value = data;
    });
  },

  _itemCount: 0,

  resetUploadForm() {
    document.getElementById('upTitle').value   = '';
    document.getElementById('upDesc').value    = '';
    document.getElementById('thumbData').value = '';
    const area = document.getElementById('thumbArea');
    area.style.backgroundImage = area.style.backgroundSize = area.style.backgroundPosition = '';
    document.getElementById('thumbPlaceholder').style.display = 'flex';
    document.getElementById('scriptItems').innerHTML = '';
    UI._itemCount = 0;
    UI.addScriptItem();
  },

  openUpload() {
    UI.clearAlerts();
    UI.resetUploadForm();
    UI.openModal('modalUpload');
  },

  addScriptItem() {
    UI._itemCount++;
    const n    = UI._itemCount;
    const wrap = document.createElement('div');
    wrap.className = 'script-item';

    /* Header */
    const header = document.createElement('div');
    header.className = 'script-item-header';
    const lbl = document.createElement('span');
    lbl.className = 'script-item-num'; lbl.textContent = 'Script #' + n;
    const btnDel = document.createElement('button');
    btnDel.className = 'script-item-del'; btnDel.textContent = '✕'; btnDel.title = 'Hapus';
    btnDel.addEventListener('click', () => wrap.remove());
    header.appendChild(lbl); header.appendChild(btnDel);

    /* Nama */
    const g1 = document.createElement('div');
    g1.className = 'form-group'; g1.style.marginBottom = '10px';
    const l1 = document.createElement('label');
    l1.className = 'form-label'; l1.textContent = 'Nama Script';
    const inp = document.createElement('input');
    inp.className = 'form-input'; inp.type = 'text';
    inp.placeholder = 'Contoh: Auto Farm v2';
    inp.setAttribute('data-sname', '');
    g1.appendChild(l1); g1.appendChild(inp);

    /* Kode */
    const g2 = document.createElement('div');
    g2.className = 'form-group'; g2.style.marginBottom = '0';
    const l2 = document.createElement('label');
    l2.className = 'form-label'; l2.textContent = 'Kode Script';
    const ta = document.createElement('textarea');
    ta.className = 'form-input form-textarea'; ta.rows = 5;
    ta.placeholder = '-- Paste kode di sini...';
    ta.setAttribute('data-scode', '');
    g2.appendChild(l2); g2.appendChild(ta);

    wrap.appendChild(header); wrap.appendChild(g1); wrap.appendChild(g2);
    document.getElementById('scriptItems').appendChild(wrap);
  },

  switchTab(tab) {
    const isScript = tab === 'script';
    document.getElementById('tabScript').classList.toggle('active',    isScript);
    document.getElementById('tabComment').classList.toggle('active',   !isScript);
    document.getElementById('tabBtnScript').classList.toggle('active',  isScript);
    document.getElementById('tabBtnComment').classList.toggle('active', !isScript);
  },

  async updateStats() {
    const scripts = await DB.getScripts();
    document.getElementById('statScripts').textContent = scripts.length;
    const cnt = await DB.getUserCount();
    document.getElementById('statMembers').textContent = cnt;
  }
};

/* Tutup dropdown klik di luar */
document.addEventListener('click', (e) => {
  if (!e.target.closest('#navProfile')) {
    document.getElementById('dropdown')?.classList.remove('open');
  }
});

/* ─────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────── */
const Auth = {

  async login() {
    UI.hideAlert('errLogin');
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) { UI.showAlert('errLogin', 'Isi username dan password!'); return; }

    UI.loading(true);
    const user = await DB.getUser(username);
    UI.loading(false);

    if (!user)                  { UI.showAlert('errLogin', 'Username tidak ditemukan.'); return; }
    if (user.password !== password) { UI.showAlert('errLogin', 'Password salah.'); return; }

    Session.save(user.username);
    UI.updateNav(user);
    await Scripts.render();
    await UI.updateStats();
    UI.closeModal('modalAuth');
    UI.toast('Selamat datang, ' + user.username + '!');
  },

  async register() {
    UI.hideAlert('errRegister');
    const username  = document.getElementById('regUsername').value.replace(/\s/g, '');
    const password  = document.getElementById('regPassword').value;
    const password2 = document.getElementById('regPassword2').value;
    const avatar    = document.getElementById('regAvatarData').value;

    if (!username || !password || !password2) { UI.showAlert('errRegister', 'Isi semua field!'); return; }
    if (username.length < 3)  { UI.showAlert('errRegister', 'Username minimal 3 karakter.'); return; }
    if (username.length > 30) { UI.showAlert('errRegister', 'Username maksimal 30 karakter.'); return; }
    if (password.length < 6)  { UI.showAlert('errRegister', 'Password minimal 6 karakter.'); return; }
    if (password !== password2) { UI.showAlert('errRegister', 'Password tidak cocok!'); return; }

    UI.loading(true);
    const existing = await DB.getUser(username);
    if (existing) { UI.loading(false); UI.showAlert('errRegister', 'Username sudah dipakai!'); return; }

    const newUser = { username, password, isAdmin: false, avatar, createdAt: new Date().toISOString() };
    const ok = await DB.saveUser(newUser);
    UI.loading(false);

    if (!ok) { UI.showAlert('errRegister', 'Gagal membuat akun, coba lagi.'); return; }

    Session.save(newUser.username);
    UI.updateNav(newUser);
    await Scripts.render();
    await UI.updateStats();
    UI.closeModal('modalAuth');
    UI.toast('Akun berhasil dibuat! Selamat datang, ' + username + '!');
  },

  async logout() {
    Session.clear();
    UI.updateNav(null);
    await Scripts.render();
    UI.toast('Sampai jumpa!');
  },

  async saveProfile() {
    UI.hideAlert('errEdit');
    const me = UI._currentUser; if (!me) return;

    const newAvatar   = document.getElementById('editAvatarData').value;
    const newUsername = document.getElementById('editUsername').value.replace(/\s/g, '').trim();
    const newPassword = document.getElementById('editPassword').value;

    if (newUsername && newUsername.length < 3) { UI.showAlert('errEdit', 'Username minimal 3 karakter.'); return; }
    if (newPassword && newPassword.length < 6) { UI.showAlert('errEdit', 'Password minimal 6 karakter.'); return; }

    UI.loading(true);

    /* Jika ganti username */
    if (newUsername && newUsername !== me.username) {
      const existing = await DB.getUser(newUsername);
      if (existing) { UI.loading(false); UI.showAlert('errEdit', 'Username sudah dipakai!'); return; }

      const newObj = {
        username:  newUsername,
        password:  newPassword  || me.password,
        isAdmin:   me.isAdmin,
        avatar:    newAvatar    || me.avatar,
        createdAt: me.createdAt
      };
      await DB.saveUser(newObj);
      /* Hapus username lama */
      try { await deleteDoc(doc(db, 'users', me.username)); } catch {}
      Session.save(newUsername);
      UI.loading(false);
      UI.updateNav(newObj);
    } else {
      /* Update data tanpa ganti username */
      const updates = {};
      if (newAvatar)   updates.avatar   = newAvatar;
      if (newPassword) updates.password = newPassword;
      if (Object.keys(updates).length) await DB.updateUser(me.username, updates);
      const updated = await DB.getUser(me.username);
      UI.loading(false);
      if (updated) { Session.save(updated.username); UI.updateNav(updated); }
    }

    await Scripts.render();
    UI.showAlert('okEdit', 'Profil berhasil diperbarui!', 'ok');
    setTimeout(() => UI.closeModal('modalEdit'), 1200);
  }
};

/* ─────────────────────────────────────────────────────────
   SCRIPTS
───────────────────────────────────────────────────────── */
const Scripts = {

  _currentId: null,

  async render() {
    const q    = document.getElementById('searchInput').value.toLowerCase();
    const cat  = document.getElementById('filterCat').value;
    const grid = document.getElementById('scriptsGrid');
    grid.innerHTML = '<div class="empty-state"><p style="color:var(--gray)">Memuat...</p></div>';

    let data = await DB.getScripts();
    if (q)   data = data.filter(s => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
    if (cat) data = data.filter(s => s.category === cat);

    document.getElementById('sectionTitle').textContent =
      (q || cat) ? `Hasil: ${data.length} Script` : 'Semua Script';

    if (!data.length) {
      grid.innerHTML = `<div class="empty-state"><h3>KOSONG</h3><p>Belum ada script${q||cat?' yang cocok':''}</p></div>`;
      return;
    }

    grid.innerHTML = '';
    data.forEach((s, i) => {
      const card = Scripts._buildCard(s, i);
      grid.appendChild(card);
    });

    /* Copy buttons */
    grid.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); Scripts._doCopy(btn.dataset.code, btn); });
    });

    await UI.updateStats();
  },

  _buildCard(s, idx) {
    const el = document.createElement('div');
    el.className = 'script-card';
    el.dataset.id = s.id;
    el.style.animationDelay = (idx * 0.05) + 's';

    const thumbHtml = s.thumb
      ? `<img src="${s.thumb}" alt="thumb"/>`
      : '<div class="card-thumb-empty">🗂</div>';

    const scripts = s.scripts || [];
    const rows = scripts.map(sc =>
      `<div class="card-script-row" onclick="event.stopPropagation()">
        <span class="card-script-name">${Utils.esc(sc.name)}</span>
        <button class="copy-btn" data-code="${Utils.b64e(sc.code)}">📋 Salin</button>
      </div>`
    ).join('');

    const avHtml = s.authorAvatar
      ? `<img src="${s.authorAvatar}" alt="av"/>`
      : Utils.esc((s.author || '?')[0].toUpperCase());

    el.innerHTML = `
      <div class="card-thumb">${thumbHtml}</div>
      <div class="card-body">
        <div class="card-top">
          <span class="card-tag">${Utils.esc(s.category)}</span>
          <span class="card-count">${scripts.length} script</span>
        </div>
        <div class="card-title">${Utils.esc(s.title)}</div>
        <div class="card-desc">${Utils.esc(s.desc)}</div>
        <div class="card-script-list">${rows}</div>
        <div class="card-footer">
          <div class="card-avatar-sm">${avHtml}</div>
          <span class="card-author">${Utils.esc(s.author || '')}</span>
        </div>
      </div>`;

    el.addEventListener('click', () => Scripts.openDetail(s.id));
    return el;
  },

  _doCopy(b64, btn) {
    navigator.clipboard.writeText(Utils.b64d(b64)).then(() => {
      btn.textContent = '✓ Disalin'; btn.classList.add('copied');
      setTimeout(() => { btn.innerHTML = '📋 Salin'; btn.classList.remove('copied'); }, 2000);
    }).catch(() => UI.toast('Gagal menyalin.'));
  },

  async openDetail(id) {
    UI.loading(true);
    const s = await DB.getScript(id);
    UI.loading(false);
    if (!s) return;

    Scripts._currentId = id;

    document.getElementById('detailThumb').innerHTML = s.thumb
      ? `<img src="${s.thumb}" alt="thumb"/>`
      : '<div class="detail-thumb-empty">🗂</div>';

    document.getElementById('detailTag').textContent        = s.category;
    document.getElementById('detailTitle').textContent      = s.title;
    document.getElementById('detailDesc').textContent       = s.desc;
    document.getElementById('detailAuthorName').textContent = s.author;
    document.getElementById('detailDate').textContent       = Utils.timeAgo(s.createdAt);
    document.getElementById('detailAvatar').innerHTML       = s.authorAvatar
      ? `<img src="${s.authorAvatar}" alt="av"/>`
      : Utils.esc((s.author || '?')[0].toUpperCase());

    const scriptEl = document.getElementById('detailScripts');
    scriptEl.innerHTML = '';
    (s.scripts || []).forEach((sc, i) => scriptEl.appendChild(Scripts._buildScriptItem(sc, i)));

    const me = UI._currentUser;
    document.getElementById('adminActions').style.display = (me && me.isAdmin) ? 'block' : 'none';

    document.getElementById('commentInput').innerHTML = '';
    document.getElementById('commentList').innerHTML  = '';
    await Comments.render(id);

    UI.switchTab('script');
    UI.openModal('modalDetail');
  },

  _buildScriptItem(sc, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'detail-script-item';

    const header = document.createElement('div');
    header.className = 'detail-script-header';

    const nameEl = document.createElement('span');
    nameEl.className = 'detail-script-name';
    nameEl.textContent = sc.name;

    const acts = document.createElement('div');
    acts.className = 'detail-script-actions';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋 Salin';
    const enc = Utils.b64e(sc.code);
    copyBtn.addEventListener('click', (e) => { e.stopPropagation(); Scripts._doCopy(enc, copyBtn); });

    const arr = document.createElement('span');
    arr.className = 'code-toggle'; arr.textContent = '▾';

    acts.appendChild(copyBtn); acts.appendChild(arr);
    header.appendChild(document.createTextNode('📄 '));
    header.appendChild(nameEl); header.appendChild(acts);

    const codeWrap = document.createElement('div');
    codeWrap.className = 'code-wrap';
    const pre = document.createElement('pre');
    pre.className = 'code-block'; pre.textContent = sc.code;
    codeWrap.appendChild(pre);

    header.addEventListener('click', () => {
      codeWrap.classList.toggle('open');
      arr.textContent = codeWrap.classList.contains('open') ? '▴' : '▾';
    });

    wrap.appendChild(header); wrap.appendChild(codeWrap);
    return wrap;
  },

  async upload() {
    UI.hideAlert('errUpload');
    const me = UI._currentUser;
    if (!me || !me.isAdmin) { UI.showAlert('errUpload', 'Akses ditolak!'); return; }

    const title = document.getElementById('upTitle').value.trim();
    const cat   = document.getElementById('upCategory').value;
    const desc  = document.getElementById('upDesc').value.trim();
    const thumb = document.getElementById('thumbData').value;

    if (!title || !desc) { UI.showAlert('errUpload', 'Judul dan deskripsi wajib diisi!'); return; }

    /* Kumpulkan script items */
    const container = document.getElementById('scriptItems');
    const items     = container.querySelectorAll('.script-item');
    const scripts   = [];

    for (let i = 0; i < items.length; i++) {
      const nameEl = items[i].querySelector('[data-sname]');
      const codeEl = items[i].querySelector('[data-scode]');
      if (!nameEl || !codeEl) continue;
      const name = nameEl.value.trim();
      const code = codeEl.value.trim();
      if (!name && !code) continue;
      if (!name) { UI.showAlert('errUpload', `Script #${i+1}: nama kosong!`); return; }
      if (!code) { UI.showAlert('errUpload', `Script #${i+1}: kode kosong!`);  return; }
      scripts.push({ name, code });
    }

    if (!scripts.length) { UI.showAlert('errUpload', 'Tambahkan minimal 1 script!'); return; }

    const obj = {
      id:           Utils.uid(),
      title, category: cat, desc, thumb, scripts,
      author:       me.username,
      authorAvatar: me.avatar || '',
      createdAt:    Timestamp.now()
    };

    UI.loading(true);
    const ok = await DB.saveScript(obj);
    UI.loading(false);

    if (!ok) { UI.showAlert('errUpload', 'Gagal upload, coba lagi.'); return; }
    UI.closeModal('modalUpload');
    await Scripts.render();
    UI.toast('Script berhasil dipublikasikan!');
  },

  async delete() {
    if (!confirm('Yakin ingin menghapus script ini?')) return;
    UI.loading(true);
    await DB.deleteScript(Scripts._currentId);
    UI.loading(false);
    UI.closeModal('modalDetail');
    await Scripts.render();
    UI.toast('Script dihapus.');
  }
};

/* ─────────────────────────────────────────────────────────
   COMMENTS
───────────────────────────────────────────────────────── */
const Comments = {

  async render(scriptId) {
    const me   = UI._currentUser;
    const wrap = document.getElementById('commentInput');

    if (!wrap.hasChildNodes()) {
      if (me) {
        const avH = me.avatar ? `<img src="${me.avatar}" alt="av"/>` : Utils.esc(me.username[0].toUpperCase());
        const box = document.createElement('div');
        box.className = 'comment-input-box';
        box.innerHTML = `
          <div class="comment-input-header">
            <div class="comment-avatar">${avH}</div>
            <span class="comment-username">${Utils.esc(me.username)}</span>
            ${me.isAdmin ? '<span class="dev-badge">Developer</span>' : ''}
          </div>
          <textarea class="comment-textarea" id="cmtTextarea" rows="3" placeholder="Tulis komentar..."></textarea>
          <div class="comment-submit-row">
            <button class="btn-send" id="cmtSendBtn">Kirim →</button>
          </div>`;
        wrap.appendChild(box);
        document.getElementById('cmtSendBtn').addEventListener('click', () => Comments.post(scriptId));
      } else {
        const prompt = document.createElement('div');
        prompt.className = 'login-prompt';
        prompt.innerHTML = '<p>Kamu harus login untuk berkomentar</p><button class="btn btn-primary">Login Sekarang</button>';
        prompt.querySelector('button').addEventListener('click', () => {
          UI.closeModal('modalDetail'); UI.openAuth('login');
        });
        wrap.appendChild(prompt);
      }
    }

    await Comments.refreshList(scriptId);
  },

  async refreshList(scriptId) {
    const listEl = document.getElementById('commentList');
    listEl.innerHTML = '<p style="color:var(--gray);font-size:11px;padding:8px 0">Memuat komentar...</p>';

    const list = await DB.getComments(scriptId);

    const total = list.reduce((a, c) => a + 1 + (c.replies?.length || 0), 0);
    const badge = document.getElementById('detailCmtCount');
    if (badge) badge.textContent = total;

    listEl.innerHTML = '';
    if (!list.length) {
      listEl.innerHTML = '<div class="no-comments">Belum ada komentar — jadilah yang pertama!</div>';
      return;
    }
    list.forEach(c => listEl.appendChild(Comments._buildEl(c, scriptId)));
  },

  _buildEl(c, scriptId) {
    const isAdm = c.author === ADMIN_USER;
    const me    = UI._currentUser;
    const avH   = c.authorAvatar
      ? `<img src="${c.authorAvatar}" alt="av"/>`
      : Utils.esc((c.author || '?')[0].toUpperCase());

    const repsHtml = (c.replies || []).map(r => {
      const rAdm = r.author === ADMIN_USER;
      const rAv  = r.authorAvatar
        ? `<img src="${r.authorAvatar}" alt="av"/>`
        : Utils.esc((r.author || '?')[0].toUpperCase());
      return `
        <div class="reply-item">
          <div class="comment-header">
            <div class="comment-avatar" style="width:24px;height:24px;font-size:10px">${rAv}</div>
            <span class="comment-name">${Utils.esc(r.author)}</span>
            ${rAdm ? '<span class="comment-role">Developer</span>' : ''}
            <span class="comment-time">${Utils.timeAgo(r.createdAt)}</span>
          </div>
          <div class="comment-body">${Utils.esc(r.body)}</div>
        </div>`;
    }).join('');

    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `
      <div class="comment-header">
        <div class="comment-avatar">${avH}</div>
        <span class="comment-name">${Utils.esc(c.author)}</span>
        ${isAdm ? '<span class="comment-role">Developer</span>' : ''}
        <span class="comment-time">${Utils.timeAgo(c.createdAt)}</span>
      </div>
      <div class="comment-body">${Utils.esc(c.body)}</div>
      <div class="comment-actions">
        ${me ? '<button class="btn-reply">↩ Balas</button>' : ''}
      </div>
      ${repsHtml ? `<div class="replies">${repsHtml}</div>` : ''}
      <div class="reply-input-wrap" id="riw_${c.id}"></div>`;

    if (me) {
      item.querySelector('.btn-reply').addEventListener('click', () => {
        Comments.toggleReply(c.id, scriptId);
      });
    }

    return item;
  },

  async post(scriptId) {
    const me = UI._currentUser; if (!me) return;
    const ta = document.getElementById('cmtTextarea'); if (!ta) return;
    const body = ta.value.trim(); if (!body) return;

    const cmt = {
      id:           Utils.uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body,
      replies:      [],
      createdAt:    Timestamp.now()
    };

    const ok = await DB.addComment(scriptId, cmt);
    if (!ok) { UI.toast('Gagal kirim komentar.'); return; }
    ta.value = '';
    await Comments.refreshList(scriptId);
  },

  toggleReply(cmtId, scriptId) {
    const wrap = document.getElementById('riw_' + cmtId);
    if (!wrap) return;
    if (wrap.hasChildNodes()) { wrap.innerHTML = ''; return; }

    const me = UI._currentUser; if (!me) return;

    const div = document.createElement('div');
    div.style.paddingTop = '10px';

    const ta = document.createElement('textarea');
    ta.className = 'comment-textarea'; ta.rows = 2; ta.placeholder = 'Tulis balasan...';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-cancel-reply'; btnCancel.textContent = 'Batal';
    btnCancel.addEventListener('click', () => wrap.innerHTML = '');

    const btnSend = document.createElement('button');
    btnSend.className = 'btn-send'; btnSend.textContent = 'Kirim →';
    btnSend.addEventListener('click', async () => {
      const body = ta.value.trim(); if (!body) return;
      const reply = {
        id:           Utils.uid(),
        author:       me.username,
        authorAvatar: me.avatar || '',
        body,
        createdAt:    Timestamp.now()
      };
      const ok = await DB.addReply(scriptId, cmtId, reply);
      if (!ok) { UI.toast('Gagal kirim balasan.'); return; }
      await Comments.refreshList(scriptId);
    });

    row.appendChild(btnCancel); row.appendChild(btnSend);
    div.appendChild(ta); div.appendChild(row);
    wrap.appendChild(div);
  }
};

/* ─────────────────────────────────────────────────────────
   EXPOSE ke HTML (onclick di HTML butuh global function)
───────────────────────────────────────────────────────── */
window.UI      = UI;
window.Auth    = Auth;
window.Scripts = Scripts;
window.Comments = Comments;

/* ─────────────────────────────────────────────────────────
   INIT
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {

  UI.applyStoredTheme();

  /* Cek session */
  const savedUsername = Session.get();
  if (savedUsername) {
    UI.loading(true);
    const user = await DB.getUser(savedUsername);
    UI.loading(false);
    UI.updateNav(user || null);
    if (!user) Session.clear();
  } else {
    UI.updateNav(null);
  }

  await Scripts.render();
  await UI.updateStats();
  await DB.seedAdmin();

});
