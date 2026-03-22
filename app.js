/* ═══════════════════════════════════════════════════════════
   ScriptVault — app.js
   Firebase v12 ESM · Semua event via addEventListener
═══════════════════════════════════════════════════════════ */

import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';

import {
  getFirestore, collection, doc,
  getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  arrayUnion, query, orderBy, Timestamp
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

/* ─── Firebase init ─── */
const fbApp = initializeApp({
  apiKey:            'AIzaSyCU1q_FpcAyyipVwN6I9N4du8brKudpjTg',
  authDomain:        'vault-45632.firebaseapp.com',
  projectId:         'vault-45632',
  storageBucket:     'vault-45632.firebasestorage.app',
  messagingSenderId: '387874758450',
  appId:             '1:387874758450:web:7967214cbc4a0f81a9412b',
  measurementId:     'G-K3L94E8FM2'
});
const db = getFirestore(fbApp);

/* ─── Konstanta ─── */
const ADMIN_USER = 'DinoIjoNPC';
const ADMIN_PASS = 'GABRIEL@12345';

/* ─── Helper dasar ─── */
const get = (id) => document.getElementById(id);

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const b64e = (s) => { try { return btoa(unescape(encodeURIComponent(s))); } catch (e) { return ''; } };
const b64d = (s) => { try { return decodeURIComponent(escape(atob(s))); } catch (e) { return ''; } };

const timeAgo = (ts) => {
  if (!ts) return '';
  const d = (ts && ts.toDate) ? ts.toDate() : new Date(ts);
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1)  return 'baru saja';
  if (m < 60) return m + ' mnt lalu';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' jam lalu';
  const dy = Math.floor(h / 24);
  if (dy < 30) return dy + ' hari lalu';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

const readFile = (file, maxMB, cb) => {
  if (file.size > maxMB * 1024 * 1024) {
    alert('Foto terlalu besar! Maks ' + maxMB + 'MB.');
    return;
  }
  const r = new FileReader();
  r.onload = (e) => cb(e.target.result);
  r.readAsDataURL(file);
};

/* ─── Session (simpan username saja) ─── */
const Session = {
  get:   () => { try { return localStorage.getItem('sv_sess') || null; } catch (e) { return null; } },
  save:  (u) => { try { localStorage.setItem('sv_sess', u); } catch (e) {} },
  clear: () =>  { try { localStorage.removeItem('sv_sess'); } catch (e) {} }
};

/* ─── Firestore helpers ─── */
const DB = {

  async getUser(username) {
    try {
      const snap = await getDoc(doc(db, 'users', username));
      return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
  },

  async saveUser(u) {
    try { await setDoc(doc(db, 'users', u.username), u); return true; }
    catch (e) { console.error('saveUser', e); return false; }
  },

  async updateUser(username, data) {
    try { await updateDoc(doc(db, 'users', username), data); return true; }
    catch (e) { console.error('updateUser', e); return false; }
  },

  async deleteUser(username) {
    try { await deleteDoc(doc(db, 'users', username)); } catch (e) {}
  },

  async getUserCount() {
    try {
      const snap = await getDocs(collection(db, 'users'));
      return snap.size;
    } catch (e) { return 0; }
  },

  async getScripts() {
    try {
      const q    = query(collection(db, 'scripts'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (e) { return []; }
  },

  async getScript(id) {
    try {
      const snap = await getDoc(doc(db, 'scripts', id));
      return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
  },

  async saveScript(obj) {
    try { await setDoc(doc(db, 'scripts', obj.id), obj); return true; }
    catch (e) { console.error('saveScript', e); return false; }
  },

  async deleteScript(id) {
    try { await deleteDoc(doc(db, 'scripts', id)); return true; }
    catch (e) { return false; }
  },

  async getComments(scriptId) {
    try {
      const q    = query(collection(db, 'comments', scriptId, 'list'), orderBy('createdAt', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data());
    } catch (e) { return []; }
  },

  async addComment(scriptId, obj) {
    try { await setDoc(doc(db, 'comments', scriptId, 'list', obj.id), obj); return true; }
    catch (e) { return false; }
  },

  async addReply(scriptId, commentId, reply) {
    try {
      await updateDoc(doc(db, 'comments', scriptId, 'list', commentId), {
        replies: arrayUnion(reply)
      });
      return true;
    } catch (e) { return false; }
  },

  async seedAdmin() {
    const existing = await DB.getUser(ADMIN_USER);
    if (!existing) {
      await DB.saveUser({
        username:  ADMIN_USER,
        password:  ADMIN_PASS,
        isAdmin:   true,
        avatar:    '',
        createdAt: new Date().toISOString()
      });
    } else if (!existing.isAdmin) {
      await DB.updateUser(ADMIN_USER, { isAdmin: true });
    }
  }
};

/* ─── State ─── */
let currentUser   = null;
let currentScript = null;
let itemCount     = 0;

/* ─── UI helpers ─── */
const openModal = (id) => {
  const el = get(id);
  if (el) el.classList.remove('hidden');
};

const closeModal = (id) => {
  const el = get(id);
  if (el) el.classList.add('hidden');
};

let toastTimer = null;
const showToast = (msg) => {
  const el = get('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
};

const showLoading = (on) => {
  const el = get('loadingOverlay');
  if (el) el.classList.toggle('hidden', !on);
};

const showAlert = (id, msg, type) => {
  const el = get(id);
  if (!el) return;
  el.textContent = msg;
  el.className   = 'alert ' + (type === 'ok' ? 'alert-success' : 'alert-error');
};

const hideAlert = (id) => {
  const el = get(id);
  if (!el) return;
  el.textContent = '';
  el.className   = 'alert hidden';
};

const clearAlerts = () => {
  document.querySelectorAll('.alert').forEach((el) => {
    el.textContent = '';
    el.className   = 'alert hidden';
  });
};

const setTheme = (t) => {
  try { localStorage.setItem('sv_theme', t); } catch (e) {}
  document.documentElement.setAttribute('data-theme', t);
  const dark  = get('themeDark');
  const light = get('themeLight');
  if (dark)  dark.classList.toggle('active',  t === 'dark');
  if (light) light.classList.toggle('active', t === 'light');
};

/* ─── Nav ─── */
const updateNav = (user) => {
  currentUser = user;

  const guestEl  = get('guestNav');
  const userEl   = get('userNav');
  const nameEl   = get('navUsername');
  const badgeEl  = get('navBadge');
  const uploadEl = get('btnUpload');
  const avatarEl = get('navAvatar');

  if (user) {
    guestEl.setAttribute('style', 'display:none');
    userEl.setAttribute('style',  'display:flex;align-items:center;gap:10px');
    nameEl.textContent = user.username;
    badgeEl.setAttribute('style',  user.isAdmin ? 'display:inline-block' : 'display:none');
    uploadEl.setAttribute('style', user.isAdmin ? 'display:inline-block' : 'display:none');
    avatarEl.innerHTML = user.avatar
      ? '<img src="' + user.avatar + '" alt="av"/>'
      : esc(user.username[0].toUpperCase());
  } else {
    guestEl.setAttribute('style', 'display:flex;gap:8px');
    userEl.setAttribute('style',  'display:none');
  }
};

const updateStats = async () => {
  const scripts = await DB.getScripts();
  const count   = await DB.getUserCount();
  const es = get('statScripts');
  const em = get('statMembers');
  if (es) es.textContent = scripts.length;
  if (em) em.textContent = count;
};

/* ─── Auth modal ─── */
const openAuth = (pane) => {
  clearAlerts();
  const login = get('paneLogin');
  const reg   = get('paneRegister');
  if (login) login.style.display    = pane === 'login'    ? 'block' : 'none';
  if (reg)   reg.style.display      = pane === 'register' ? 'block' : 'none';
  openModal('modalAuth');
};

/* ─── Login ─── */
const doLogin = async () => {
  hideAlert('errLogin');

  const username = get('loginUsername').value.trim();
  const password = get('loginPassword').value;

  if (!username || !password) {
    showAlert('errLogin', 'Isi username dan password!');
    return;
  }

  showLoading(true);
  const user = await DB.getUser(username);
  showLoading(false);

  if (!user) {
    showAlert('errLogin', 'Username tidak ditemukan.');
    return;
  }
  if (user.password !== password) {
    showAlert('errLogin', 'Password salah.');
    return;
  }

  Session.save(user.username);
  updateNav(user);
  closeModal('modalAuth');
  showToast('Selamat datang, ' + user.username + '!');
  await renderScripts();
  await updateStats();
};

/* ─── Register ─── */
const doRegister = async () => {
  hideAlert('errRegister');

  const username  = get('regUsername').value.replace(/\s/g, '');
  const password  = get('regPassword').value;
  const password2 = get('regPassword2').value;
  const avatar    = get('regAvData').value;

  if (!username || !password || !password2) {
    showAlert('errRegister', 'Isi semua field!');
    return;
  }
  if (username.length < 3) {
    showAlert('errRegister', 'Username minimal 3 karakter.');
    return;
  }
  if (username.length > 30) {
    showAlert('errRegister', 'Username maksimal 30 karakter.');
    return;
  }
  if (password.length < 6) {
    showAlert('errRegister', 'Password minimal 6 karakter.');
    return;
  }
  if (password !== password2) {
    showAlert('errRegister', 'Password tidak cocok!');
    return;
  }

  showLoading(true);
  const existing = await DB.getUser(username);
  if (existing) {
    showLoading(false);
    showAlert('errRegister', 'Username sudah dipakai!');
    return;
  }

  const newUser = {
    username:  username,
    password:  password,
    isAdmin:   false,
    avatar:    avatar,
    createdAt: new Date().toISOString()
  };

  const ok = await DB.saveUser(newUser);
  showLoading(false);

  if (!ok) {
    showAlert('errRegister', 'Gagal membuat akun, coba lagi.');
    return;
  }

  Session.save(newUser.username);
  updateNav(newUser);
  closeModal('modalAuth');
  showToast('Akun berhasil dibuat! Selamat datang, ' + username + '!');
  await renderScripts();
  await updateStats();
};

/* ─── Logout ─── */
const doLogout = async () => {
  Session.clear();
  updateNav(null);
  showToast('Sampai jumpa!');
  await renderScripts();
};

/* ─── Edit Profil ─── */
const openEditProfile = () => {
  const u = currentUser;
  if (!u) return;
  const prev = get('editAvPrev');
  if (prev) prev.innerHTML = u.avatar ? '<img src="' + u.avatar + '"/>' : '👤';
  const data = get('editAvData');
  if (data) data.value = u.avatar || '';
  const eu = get('editUsername');
  const ep = get('editPassword');
  if (eu) eu.value = '';
  if (ep) ep.value = '';
  clearAlerts();
  openModal('modalEdit');
};

const doEditProfile = async () => {
  hideAlert('errEdit');
  const me = currentUser;
  if (!me) return;

  const newAv = get('editAvData').value;
  const newUn = get('editUsername').value.replace(/\s/g, '').trim();
  const newPw = get('editPassword').value;

  if (newUn && newUn.length < 3) {
    showAlert('errEdit', 'Username minimal 3 karakter.');
    return;
  }
  if (newPw && newPw.length < 6) {
    showAlert('errEdit', 'Password minimal 6 karakter.');
    return;
  }

  showLoading(true);

  if (newUn && newUn !== me.username) {
    const ex = await DB.getUser(newUn);
    if (ex) {
      showLoading(false);
      showAlert('errEdit', 'Username sudah dipakai!');
      return;
    }
    const newObj = {
      username:  newUn,
      password:  newPw   || me.password,
      isAdmin:   me.isAdmin,
      avatar:    newAv   || me.avatar,
      createdAt: me.createdAt
    };
    await DB.saveUser(newObj);
    await DB.deleteUser(me.username);
    Session.save(newUn);
    showLoading(false);
    updateNav(newObj);
  } else {
    const upd = {};
    if (newAv) upd.avatar   = newAv;
    if (newPw) upd.password = newPw;
    if (Object.keys(upd).length) await DB.updateUser(me.username, upd);
    const updated = await DB.getUser(me.username);
    showLoading(false);
    if (updated) { Session.save(updated.username); updateNav(updated); }
  }

  await renderScripts();
  showAlert('okEdit', 'Profil berhasil diperbarui!', 'ok');
  setTimeout(() => closeModal('modalEdit'), 1200);
};

/* ─── Render scripts ─── */
const renderScripts = async () => {
  const q    = get('searchInput') ? get('searchInput').value.toLowerCase() : '';
  const cat  = get('filterCat')   ? get('filterCat').value : '';
  const grid = get('scriptsGrid');
  if (!grid) return;

  grid.innerHTML = '<div class="empty-state"><p style="color:var(--gray)">Memuat...</p></div>';

  let data = await DB.getScripts();

  if (q)   data = data.filter((s) => s.title.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  if (cat) data = data.filter((s) => s.category === cat);

  const titleEl = get('sectionTitle');
  if (titleEl) titleEl.textContent = (q || cat) ? 'Hasil: ' + data.length + ' Script' : 'Semua Script';

  if (!data.length) {
    grid.innerHTML = '<div class="empty-state"><h3>KOSONG</h3><p>Belum ada script' + (q || cat ? ' yang cocok' : '') + '</p></div>';
    return;
  }

  grid.innerHTML = '';
  data.forEach((s, i) => grid.appendChild(buildCard(s, i)));
};

const buildCard = (s, idx) => {
  const el = document.createElement('div');
  el.className = 'script-card';
  el.style.animationDelay = (idx * 0.05) + 's';

  const scripts = s.scripts || [];
  const rows = scripts.map((sc) => {
    const enc = b64e(sc.code);
    return '<div class="card-script-row">'
      + '<span class="card-script-name">' + esc(sc.name) + '</span>'
      + '<button class="copy-btn" data-code="' + enc + '">📋 Salin</button>'
      + '</div>';
  }).join('');

  const thumbHtml = s.thumb
    ? '<img src="' + s.thumb + '" alt="thumb"/>'
    : '<div class="card-thumb-empty">🗂</div>';

  const avHtml = s.authorAvatar
    ? '<img src="' + s.authorAvatar + '" alt="av"/>'
    : esc((s.author || '?')[0].toUpperCase());

  el.innerHTML = '<div class="card-thumb">' + thumbHtml + '</div>'
    + '<div class="card-body">'
    +   '<div class="card-top">'
    +     '<span class="card-tag">' + esc(s.category) + '</span>'
    +     '<span class="card-count">' + scripts.length + ' script</span>'
    +   '</div>'
    +   '<div class="card-title">' + esc(s.title) + '</div>'
    +   '<div class="card-desc">'  + esc(s.desc)  + '</div>'
    +   '<div class="card-script-list">' + rows + '</div>'
    +   '<div class="card-footer">'
    +     '<div class="card-avatar-sm">' + avHtml + '</div>'
    +     '<span class="card-author">' + esc(s.author || '') + '</span>'
    +   '</div>'
    + '</div>';

  el.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      doCopy(btn.dataset.code, btn);
    });
  });

  el.addEventListener('click', () => openDetail(s.id));
  return el;
};

const doCopy = (b64, btn) => {
  navigator.clipboard.writeText(b64d(b64)).then(() => {
    btn.textContent = '✓ Disalin';
    btn.classList.add('copied');
    setTimeout(() => { btn.innerHTML = '📋 Salin'; btn.classList.remove('copied'); }, 2000);
  }).catch(() => showToast('Gagal menyalin.'));
};

/* ─── Detail ─── */
const openDetail = async (id) => {
  showLoading(true);
  const s = await DB.getScript(id);
  showLoading(false);
  if (!s) return;

  currentScript = id;

  get('detailThumb').innerHTML = s.thumb
    ? '<img src="' + s.thumb + '" alt="thumb"/>'
    : '<div class="detail-thumb-empty">🗂</div>';

  get('detailTag').textContent        = s.category;
  get('detailTitle').textContent      = s.title;
  get('detailDesc').textContent       = s.desc;
  get('detailAuthorName').textContent = s.author;
  get('detailDate').textContent       = timeAgo(s.createdAt);
  get('detailAvatar').innerHTML       = s.authorAvatar
    ? '<img src="' + s.authorAvatar + '" alt="av"/>'
    : esc((s.author || '?')[0].toUpperCase());

  const scriptEl = get('detailScripts');
  scriptEl.innerHTML = '';
  (s.scripts || []).forEach((sc, i) => scriptEl.appendChild(buildScriptItem(sc, i)));

  get('adminActions').style.display = (currentUser && currentUser.isAdmin) ? 'block' : 'none';

  get('commentInput').innerHTML = '';
  get('commentList').innerHTML  = '';
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
  nameEl.className   = 'detail-script-name';
  nameEl.textContent = sc.name;

  const acts = document.createElement('div');
  acts.className = 'detail-script-actions';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'copy-btn';
  copyBtn.innerHTML = '📋 Salin';
  const enc = b64e(sc.code);
  copyBtn.addEventListener('click', (e) => { e.stopPropagation(); doCopy(enc, copyBtn); });

  const arr = document.createElement('span');
  arr.className   = 'code-toggle';
  arr.textContent = '▾';

  acts.appendChild(copyBtn);
  acts.appendChild(arr);
  header.appendChild(document.createTextNode('📄 '));
  header.appendChild(nameEl);
  header.appendChild(acts);

  const codeWrap = document.createElement('div');
  codeWrap.className = 'code-wrap';
  const pre = document.createElement('pre');
  pre.className   = 'code-block';
  pre.textContent = sc.code;
  codeWrap.appendChild(pre);

  header.addEventListener('click', () => {
    codeWrap.classList.toggle('open');
    arr.textContent = codeWrap.classList.contains('open') ? '▴' : '▾';
  });

  wrap.appendChild(header);
  wrap.appendChild(codeWrap);
  return wrap;
};

const switchTab = (tab) => {
  const isScript = tab === 'script';
  get('tabScript').classList.toggle('active',    isScript);
  get('tabComment').classList.toggle('active',   !isScript);
  get('tabBtnScript').classList.toggle('active',  isScript);
  get('tabBtnComment').classList.toggle('active', !isScript);
};

/* ─── Upload ─── */
const resetUploadForm = () => {
  ['upTitle', 'upDesc', 'thumbData'].forEach((id) => { const el = get(id); if (el) el.value = ''; });
  const area = get('thumbArea');
  if (area) {
    area.style.backgroundImage    = '';
    area.style.backgroundSize     = '';
    area.style.backgroundPosition = '';
  }
  const ph = get('thumbPH');
  if (ph) ph.style.display = 'flex';
  const si = get('scriptItems');
  if (si) si.innerHTML = '';
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
  lbl.className   = 'script-item-num';
  lbl.textContent = 'Script #' + n;

  const btnDel = document.createElement('button');
  btnDel.className   = 'script-item-del';
  btnDel.textContent = '✕';
  btnDel.addEventListener('click', () => wrap.remove());

  header.appendChild(lbl);
  header.appendChild(btnDel);

  const g1 = document.createElement('div');
  g1.className = 'form-group';
  g1.style.marginBottom = '10px';
  const l1  = document.createElement('label');
  l1.className   = 'form-label';
  l1.textContent = 'Nama Script';
  const inp = document.createElement('input');
  inp.className   = 'form-input';
  inp.type        = 'text';
  inp.placeholder = 'Contoh: Auto Farm v2';
  inp.setAttribute('data-sname', '');
  g1.appendChild(l1);
  g1.appendChild(inp);

  const g2 = document.createElement('div');
  g2.className = 'form-group';
  g2.style.marginBottom = '0';
  const l2  = document.createElement('label');
  l2.className   = 'form-label';
  l2.textContent = 'Kode Script';
  const ta  = document.createElement('textarea');
  ta.className   = 'form-input form-textarea';
  ta.rows        = 5;
  ta.placeholder = '-- Paste kode di sini...';
  ta.setAttribute('data-scode', '');
  g2.appendChild(l2);
  g2.appendChild(ta);

  wrap.appendChild(header);
  wrap.appendChild(g1);
  wrap.appendChild(g2);

  const container = get('scriptItems');
  if (container) container.appendChild(wrap);
};

const doUpload = async () => {
  hideAlert('errUpload');
  if (!currentUser || !currentUser.isAdmin) {
    showAlert('errUpload', 'Akses ditolak!');
    return;
  }

  const title = get('upTitle').value.trim();
  const cat   = get('upCat').value;
  const desc  = get('upDesc').value.trim();
  const thumb = get('thumbData').value;

  if (!title || !desc) {
    showAlert('errUpload', 'Judul dan deskripsi wajib diisi!');
    return;
  }

  const container = get('scriptItems');
  const items     = container ? container.querySelectorAll('.script-item') : [];
  const scripts   = [];

  for (let i = 0; i < items.length; i++) {
    const nameEl = items[i].querySelector('[data-sname]');
    const codeEl = items[i].querySelector('[data-scode]');
    if (!nameEl || !codeEl) continue;
    const name = nameEl.value.trim();
    const code = codeEl.value.trim();
    if (!name && !code) continue;
    if (!name) { showAlert('errUpload', 'Script #' + (i + 1) + ': nama kosong!'); return; }
    if (!code) { showAlert('errUpload', 'Script #' + (i + 1) + ': kode kosong!'); return; }
    scripts.push({ name: name, code: code });
  }

  if (!scripts.length) {
    showAlert('errUpload', 'Tambahkan minimal 1 script!');
    return;
  }

  showLoading(true);
  const ok = await DB.saveScript({
    id:           uid(),
    title:        title,
    category:     cat,
    desc:         desc,
    thumb:        thumb,
    scripts:      scripts,
    author:       currentUser.username,
    authorAvatar: currentUser.avatar || '',
    createdAt:    Timestamp.now()
  });
  showLoading(false);

  if (!ok) { showAlert('errUpload', 'Gagal upload, coba lagi.'); return; }

  closeModal('modalUpload');
  showToast('Script berhasil dipublikasikan!');
  await renderScripts();
  await updateStats();
};

const doDeleteScript = async () => {
  if (!confirm('Yakin ingin menghapus script ini?')) return;
  showLoading(true);
  await DB.deleteScript(currentScript);
  showLoading(false);
  closeModal('modalDetail');
  showToast('Script dihapus.');
  await renderScripts();
  await updateStats();
};

/* ─── Komentar ─── */
const renderComments = async (scriptId) => {
  const me   = currentUser;
  const wrap = get('commentInput');
  if (!wrap) return;

  if (!wrap.hasChildNodes()) {
    if (me) {
      const avH = me.avatar
        ? '<img src="' + me.avatar + '" alt="av"/>'
        : esc(me.username[0].toUpperCase());

      const box = document.createElement('div');
      box.className = 'comment-input-box';
      box.innerHTML = '<div class="comment-input-header">'
        +   '<div class="comment-avatar">' + avH + '</div>'
        +   '<span class="comment-username">' + esc(me.username) + '</span>'
        +   (me.isAdmin ? '<span class="dev-badge">Developer</span>' : '')
        + '</div>'
        + '<textarea class="comment-textarea" id="cmtTA" rows="3" placeholder="Tulis komentar..."></textarea>'
        + '<div class="comment-submit-row">'
        +   '<button class="btn-send" id="cmtSendBtn">Kirim →</button>'
        + '</div>';
      wrap.appendChild(box);

      const sendBtn = get('cmtSendBtn');
      if (sendBtn) {
        sendBtn.addEventListener('click', () => postComment(scriptId));
      }
    } else {
      const p = document.createElement('div');
      p.className = 'login-prompt';
      p.innerHTML = '<p>Kamu harus login untuk berkomentar</p>'
        + '<button class="btn btn-primary" id="btnLoginCmt">Login Sekarang</button>';
      wrap.appendChild(p);
      const lb = get('btnLoginCmt');
      if (lb) {
        lb.addEventListener('click', () => {
          closeModal('modalDetail');
          openAuth('login');
        });
      }
    }
  }

  await refreshCommentList(scriptId);
};

const refreshCommentList = async (scriptId) => {
  const listEl = get('commentList');
  if (!listEl) return;

  listEl.innerHTML = '<p style="color:var(--gray);font-size:11px;padding:8px 0">Memuat komentar...</p>';

  const list  = await DB.getComments(scriptId);
  const total = list.reduce((a, c) => a + 1 + ((c.replies && c.replies.length) || 0), 0);
  const badge = get('detailCmtCount');
  if (badge) badge.textContent = total;

  listEl.innerHTML = '';
  if (!list.length) {
    listEl.innerHTML = '<div class="no-comments">Belum ada komentar — jadilah yang pertama!</div>';
    return;
  }
  list.forEach((c) => listEl.appendChild(buildCommentEl(c, scriptId)));
};

const buildCommentEl = (c, scriptId) => {
  const isAdm = (c.author === ADMIN_USER);
  const me    = currentUser;
  const avH   = c.authorAvatar
    ? '<img src="' + c.authorAvatar + '" alt="av"/>'
    : esc((c.author || '?')[0].toUpperCase());

  const repsHtml = (c.replies || []).map((r) => {
    const rAdm = (r.author === ADMIN_USER);
    const rAv  = r.authorAvatar
      ? '<img src="' + r.authorAvatar + '" alt="av"/>'
      : esc((r.author || '?')[0].toUpperCase());
    return '<div class="reply-item">'
      + '<div class="comment-header">'
      +   '<div class="comment-avatar" style="width:24px;height:24px;font-size:10px">' + rAv + '</div>'
      +   '<span class="comment-name">' + esc(r.author) + '</span>'
      +   (rAdm ? '<span class="comment-role">Developer</span>' : '')
      +   '<span class="comment-time">' + timeAgo(r.createdAt) + '</span>'
      + '</div>'
      + '<div class="comment-body">' + esc(r.body) + '</div>'
      + '</div>';
  }).join('');

  const item = document.createElement('div');
  item.className = 'comment-item';
  item.innerHTML = '<div class="comment-header">'
    +   '<div class="comment-avatar">' + avH + '</div>'
    +   '<span class="comment-name">' + esc(c.author) + '</span>'
    +   (isAdm ? '<span class="comment-role">Developer</span>' : '')
    +   '<span class="comment-time">' + timeAgo(c.createdAt) + '</span>'
    + '</div>'
    + '<div class="comment-body">' + esc(c.body) + '</div>'
    + '<div class="comment-actions">'
    +   (me ? '<button class="btn-reply">↩ Balas</button>' : '')
    + '</div>'
    + (repsHtml ? '<div class="replies">' + repsHtml + '</div>' : '')
    + '<div class="reply-input-wrap" id="riw_' + c.id + '"></div>';

  if (me) {
    const replyBtn = item.querySelector('.btn-reply');
    if (replyBtn) {
      const cmtId = c.id;
      replyBtn.addEventListener('click', () => toggleReply(cmtId, scriptId));
    }
  }
  return item;
};

const postComment = async (scriptId) => {
  const me = currentUser;
  if (!me) return;
  const ta = get('cmtTA');
  if (!ta) return;
  const body = ta.value.trim();
  if (!body) return;

  const ok = await DB.addComment(scriptId, {
    id:           uid(),
    author:       me.username,
    authorAvatar: me.avatar || '',
    body:         body,
    replies:      [],
    createdAt:    Timestamp.now()
  });
  if (!ok) { showToast('Gagal kirim komentar.'); return; }
  ta.value = '';
  await refreshCommentList(scriptId);
};

const toggleReply = (cmtId, scriptId) => {
  const wrap = get('riw_' + cmtId);
  if (!wrap) return;
  if (wrap.hasChildNodes()) { wrap.innerHTML = ''; return; }
  const me = currentUser;
  if (!me) return;

  const div = document.createElement('div');
  div.style.paddingTop = '10px';

  const ta = document.createElement('textarea');
  ta.className   = 'comment-textarea';
  ta.rows        = 2;
  ta.placeholder = 'Tulis balasan...';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:8px';

  const btnC = document.createElement('button');
  btnC.className   = 'btn-cancel-reply';
  btnC.textContent = 'Batal';
  btnC.addEventListener('click', () => { wrap.innerHTML = ''; });

  const btnS = document.createElement('button');
  btnS.className   = 'btn-send';
  btnS.textContent = 'Kirim →';
  btnS.addEventListener('click', async () => {
    const body = ta.value.trim();
    if (!body) return;
    const ok = await DB.addReply(scriptId, cmtId, {
      id:           uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body:         body,
      createdAt:    Timestamp.now()
    });
    if (!ok) { showToast('Gagal kirim balasan.'); return; }
    await refreshCommentList(scriptId);
  });

  row.appendChild(btnC);
  row.appendChild(btnS);
  div.appendChild(ta);
  div.appendChild(row);
  wrap.appendChild(div);
};

/* ═══════════════════════════════════════════════════════════
   INIT  —  Pasang semua event listener setelah DOM siap
═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {

  /* Tema */
  let theme = 'dark';
  try { theme = localStorage.getItem('sv_theme') || 'dark'; } catch (e) {}
  setTheme(theme);

  /* Session */
  const savedUser = Session.get();
  if (savedUser) {
    showLoading(true);
    const user = await DB.getUser(savedUser);
    showLoading(false);
    if (user) {
      updateNav(user);
    } else {
      Session.clear();
      updateNav(null);
    }
  } else {
    updateNav(null);
  }

  /* Render awal */
  await renderScripts();
  await updateStats();

  /* Seed admin (background) */
  DB.seedAdmin();

  /* ─── NAV buttons ─── */
  get('btnMasuk').addEventListener('click',  () => openAuth('login'));
  get('btnDaftar').addEventListener('click', () => openAuth('register'));

  get('btnSettings').addEventListener('click', () => {
    let t = 'dark';
    try { t = localStorage.getItem('sv_theme') || 'dark'; } catch (e) {}
    setTheme(t);
    openModal('modalSettings');
  });

  get('btnUpload').addEventListener('click', () => {
    resetUploadForm();
    openModal('modalUpload');
  });

  get('navProfile').addEventListener('click', (e) => {
    if (!e.target.closest('#dropdown')) {
      get('dropdown').classList.toggle('open');
    }
  });

  get('btnEditProfile').addEventListener('click', () => {
    get('dropdown').classList.remove('open');
    openEditProfile();
  });

  get('btnLogout').addEventListener('click', () => {
    get('dropdown').classList.remove('open');
    doLogout();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#navProfile')) {
      const dd = get('dropdown');
      if (dd) dd.classList.remove('open');
    }
  });

  /* ─── AUTH modal ─── */
  get('closeAuth').addEventListener('click',  () => closeModal('modalAuth'));
  get('toRegister').addEventListener('click', () => openAuth('register'));
  get('toLogin').addEventListener('click',    () => openAuth('login'));
  get('btnDoLogin').addEventListener('click', doLogin);
  get('btnDoRegister').addEventListener('click', doRegister);

  /* Enter key di login */
  get('loginUsername').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  get('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  /* Strip spasi username */
  get('regUsername').addEventListener('input', function () { this.value = this.value.replace(/\s/g, ''); });

  /* Avatar register */
  get('btnPickRegAv').addEventListener('click', () => get('regAvFile').click());
  get('regAvFile').addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    readFile(f, 2, (data) => {
      get('regAvPrev').innerHTML = '<img src="' + data + '"/>';
      get('regAvData').value     = data;
    });
  });

  /* Modal auth — klik backdrop tutup */
  get('modalAuth').addEventListener('click', (e) => {
    if (e.target === get('modalAuth')) closeModal('modalAuth');
  });

  /* ─── EDIT PROFIL ─── */
  get('closeEdit').addEventListener('click',    () => closeModal('modalEdit'));
  get('btnDoEdit').addEventListener('click',    doEditProfile);
  get('btnPickEditAv').addEventListener('click', () => get('editAvFile').click());
  get('editAvFile').addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    readFile(f, 2, (data) => {
      get('editAvPrev').innerHTML = '<img src="' + data + '"/>';
      get('editAvData').value     = data;
    });
  });
  get('editUsername').addEventListener('input', function () { this.value = this.value.replace(/\s/g, ''); });
  get('modalEdit').addEventListener('click', (e) => {
    if (e.target === get('modalEdit')) closeModal('modalEdit');
  });

  /* ─── SETTINGS ─── */
  get('closeSettings').addEventListener('click', () => closeModal('modalSettings'));
  get('themeDark').addEventListener('click',     () => setTheme('dark'));
  get('themeLight').addEventListener('click',    () => setTheme('light'));
  get('modalSettings').addEventListener('click', (e) => {
    if (e.target === get('modalSettings')) closeModal('modalSettings');
  });

  /* ─── UPLOAD ─── */
  get('closeUpload').addEventListener('click',   () => closeModal('modalUpload'));
  get('btnAddScript').addEventListener('click',  addScriptItem);
  get('btnDoUpload').addEventListener('click',   doUpload);
  get('thumbArea').addEventListener('click',     () => get('thumbFile').click());
  get('thumbFile').addEventListener('change', function () {
    const f = this.files[0];
    if (!f) return;
    readFile(f, 5, (data) => {
      const area = get('thumbArea');
      area.style.backgroundImage    = 'url("' + data + '")';
      area.style.backgroundSize     = 'cover';
      area.style.backgroundPosition = 'center';
      const ph = get('thumbPH');
      if (ph) ph.style.display = 'none';
      get('thumbData').value = data;
    });
  });
  get('modalUpload').addEventListener('click', (e) => {
    if (e.target === get('modalUpload')) closeModal('modalUpload');
  });

  /* ─── DETAIL ─── */
  get('closeDetail').addEventListener('click',     () => closeModal('modalDetail'));
  get('btnDeleteScript').addEventListener('click', doDeleteScript);
  get('tabBtnScript').addEventListener('click',    () => switchTab('script'));
  get('tabBtnComment').addEventListener('click',   () => switchTab('comment'));
  get('modalDetail').addEventListener('click', (e) => {
    if (e.target === get('modalDetail')) closeModal('modalDetail');
  });

  /* ─── SEARCH & FILTER ─── */
  get('searchInput').addEventListener('input',  renderScripts);
  get('filterCat').addEventListener('change',   renderScripts);

});
