/* ═══════════════════════════════════════════════════════════
   app.js  —  ScriptVault
   Struktur modul:
     DB      → penyimpanan data (localStorage)
     Auth    → login, register, logout, edit profil
     Scripts → upload, render, delete
     Comments→ komentar & balasan
     UI      → modal, nav, tema, toast
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
var ADMIN_USER = 'DinoIjoNPC';
var ADMIN_PASS = 'GABRIEL@12345';

/* ─────────────────────────────────────────────────────────
   DB  —  Data Storage
   Semua data tersimpan di localStorage browser.
   Key prefix "sv6_" agar tidak bentrok dengan versi lama.
───────────────────────────────────────────────────────── */
var DB = (function () {

  var K = {
    users:    'sv6_users',
    scripts:  'sv6_scripts',
    comments: 'sv6_comments',
    theme:    'sv6_theme',
    session:  'sv6_session'
  };

  /* helpers */
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { console.error('localStorage write error:', e); }
  }
  function remove(key) {
    localStorage.removeItem(key);
  }

  /* ── USERS ── */
  function getUsers()      { return read(K.users) || []; }
  function saveUsers(arr)  { write(K.users, arr); }

  function findUser(username) {
    var all = getUsers();
    var un = username.toLowerCase();
    for (var i = 0; i < all.length; i++) {
      if (all[i].username.toLowerCase() === un) return all[i];
    }
    return null;
  }

  function upsertUser(userObj) {
    var all = getUsers();
    var idx = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].username === userObj.username) { idx = i; break; }
    }
    if (idx === -1) { all.push(userObj); }
    else            { all[idx] = userObj; }
    saveUsers(all);
  }

  function usernameExists(username, excludeSelf) {
    var all = getUsers();
    var un  = username.toLowerCase();
    for (var i = 0; i < all.length; i++) {
      if (all[i].username.toLowerCase() === un) {
        if (excludeSelf && all[i].username === excludeSelf) continue;
        return true;
      }
    }
    return false;
  }

  /* ── SCRIPTS ── */
  function getScripts()     { return read(K.scripts) || []; }
  function saveScripts(arr) { write(K.scripts, arr); }

  /* ── COMMENTS ── */
  function getComments()      { return read(K.comments) || {}; }
  function saveComments(obj)  { write(K.comments, obj); }

  function getScriptComments(scriptId) {
    return getComments()[scriptId] || [];
  }

  function saveScriptComments(scriptId, list) {
    var all = getComments();
    all[scriptId] = list;
    saveComments(all);
  }

  /* ── THEME ── */
  function getTheme()    { return read(K.theme) || 'dark'; }
  function saveTheme(t)  { write(K.theme, t); }

  /* ── SESSION ──
     Simpan hanya USERNAME di localStorage (bukan seluruh object user).
     Alasan: avatar base64 bisa sangat besar dan menyebabkan
     localStorage.setItem() gagal diam-diam (QuotaExceededError),
     sehingga session tidak tersimpan dan user ter-logout.
     Saat dibutuhkan, cari data lengkap dari DB.getUsers().          */
  function getSession() {
    try { return localStorage.getItem(K.session) || null; }
    catch(e) { return null; }
  }
  function saveSession(u) {
    try {
      // Simpan hanya username (string kecil, tidak akan exceed quota)
      localStorage.setItem(K.session, u.username);
    } catch(e) { console.warn('Session save failed:', e); }
  }
  function clearSession() {
    try { localStorage.removeItem(K.session); } catch(e) {}
  }

  /* Ambil data user terbaru dari DB berdasarkan username di session */
  function getCurrentUser() {
    var username = getSession();
    if (!username) return null;
    var user = findUser(username);
    return user || null;
  }

  /* ── ADMIN SEED ──
     Hanya membuat akun admin jika BELUM ADA.
     Tidak pernah overwrite data yang sudah tersimpan.      */
  function seedAdmin() {
    var existing = findUser(ADMIN_USER);
    if (!existing) {
      var adminUser = {
        username:  ADMIN_USER,
        password:  ADMIN_PASS,
        isAdmin:   true,
        avatar:    '',
        createdAt: new Date().toISOString()
      };
      var all = getUsers();
      all.unshift(adminUser);
      saveUsers(all);
    } else if (!existing.isAdmin) {
      // Pastikan isAdmin=true jika akunnya ada tapi flag-nya hilang
      existing.isAdmin = true;
      upsertUser(existing);
    }
  }

  return {
    getUsers:             getUsers,
    saveUsers:            saveUsers,
    findUser:             findUser,
    upsertUser:           upsertUser,
    usernameExists:       usernameExists,
    getScripts:           getScripts,
    saveScripts:          saveScripts,
    getScriptComments:    getScriptComments,
    saveScriptComments:   saveScriptComments,
    getTheme:             getTheme,
    saveTheme:            saveTheme,
    getSession:           getSession,
    saveSession:          saveSession,
    clearSession:         clearSession,
    getCurrentUser:       getCurrentUser,
    seedAdmin:            seedAdmin
  };

})();

/* ─────────────────────────────────────────────────────────
   UTILS  —  Fungsi pembantu umum
───────────────────────────────────────────────────────── */
var Utils = (function () {

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* Escape HTML untuk mencegah XSS */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Base64 encode / decode untuk kode script di onclick */
  function b64e(str) {
    try { return btoa(unescape(encodeURIComponent(str))); }
    catch (e) { return ''; }
  }
  function b64d(str) {
    try { return decodeURIComponent(escape(atob(str))); }
    catch (e) { return ''; }
  }

  function timeAgo(iso) {
    var diff = Date.now() - new Date(iso).getTime();
    var m    = Math.floor(diff / 60000);
    if (m < 1)   return 'baru saja';
    if (m < 60)  return m + ' mnt lalu';
    var h = Math.floor(m / 60);
    if (h < 24)  return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d < 30)  return d + ' hari lalu';
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function readFileAsDataURL(file, maxBytes, callback) {
    if (file.size > maxBytes) {
      alert('Foto terlalu besar! Maks ' + Math.round(maxBytes / 1024 / 1024) + 'MB.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) { callback(e.target.result); };
    reader.readAsDataURL(file);
  }

  return { uid: uid, esc: esc, b64e: b64e, b64d: b64d, timeAgo: timeAgo, readFileAsDataURL: readFileAsDataURL };

})();

/* ─────────────────────────────────────────────────────────
   UI  —  Modal, Nav, Tema, Toast, Helper render
───────────────────────────────────────────────────────── */
var UI = (function () {

  /* ── TOAST ── */
  var _toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { el.classList.add('hidden'); }, 2800);
  }

  /* ── ALERT ── */
  function showAlert(id, msg, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'alert ' + (type === 'ok' ? 'alert-success' : 'alert-error');
  }
  function hideAlert(id) {
    var el = document.getElementById(id);
    if (el) { el.className = 'alert hidden'; el.textContent = ''; }
  }
  function clearAllAlerts() {
    document.querySelectorAll('.alert').forEach(function (el) {
      el.className = 'alert hidden'; el.textContent = '';
    });
  }

  /* ── MODAL ── */
  function openModal(id)  { document.getElementById(id).classList.remove('hidden'); }
  function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
  function bgClose(e, id) {
    if (e.target === document.getElementById(id)) closeModal(id);
  }

  function openAuth(pane) {
    clearAllAlerts();
    document.getElementById('paneLogin').style.display    = (pane === 'login')    ? 'block' : 'none';
    document.getElementById('paneRegister').style.display = (pane === 'register') ? 'block' : 'none';
    openModal('modalAuth');
  }

  /* ── NAV ── */
  function updateNav(user) {
    var guestEl  = document.getElementById('guestNav');
    var userEl   = document.getElementById('userNav');
    var nameEl   = document.getElementById('navUsername');
    var badgeEl  = document.getElementById('navBadge');
    var uploadEl = document.getElementById('btnUpload');
    var avatarEl = document.getElementById('navAvatar');

    if (user) {
      // setAttribute('style') untuk override inline style dari HTML
      guestEl.setAttribute('style', 'display:none');
      userEl.setAttribute('style',  'display:flex;align-items:center;gap:10px');
      nameEl.textContent = user.username;
      badgeEl.setAttribute('style',  user.isAdmin ? 'display:inline-block' : 'display:none');
      uploadEl.setAttribute('style', user.isAdmin ? 'display:inline-block' : 'display:none');
      avatarEl.innerHTML = user.avatar
        ? '<img src="' + user.avatar + '" alt="avatar"/>'
        : Utils.esc(user.username[0].toUpperCase());
    } else {
      guestEl.setAttribute('style', 'display:flex;gap:8px');
      userEl.setAttribute('style',  'display:none');
    }
  }

  function toggleDrop() {
    document.getElementById('dropdown').classList.toggle('open');
  }

  /* Tutup dropdown saat klik di luar */
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#navProfile')) {
      var dd = document.getElementById('dropdown');
      if (dd) dd.classList.remove('open');
    }
  });

  /* ── TEMA ── */
  function setTheme(t) {
    DB.saveTheme(t);
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeDark').classList.toggle('active',  t === 'dark');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
  }

  function applyStoredTheme() {
    setTheme(DB.getTheme());
  }

  function openSettings() {
    setTheme(DB.getTheme()); // sync UI toggle
    openModal('modalSettings');
  }

  /* ── EDIT PROFILE ── */
  function openEditProfile() {
    document.getElementById('dropdown').classList.remove('open');
    var u = DB.getCurrentUser();
    if (!u) return;
    document.getElementById('editAvatarPreview').innerHTML =
      u.avatar ? '<img src="' + u.avatar + '"/>' : '👤';
    document.getElementById('editAvatarData').value = u.avatar || '';
    document.getElementById('editUsername').value   = '';
    document.getElementById('editPassword').value   = '';
    clearAllAlerts();
    openModal('modalEdit');
  }

  /* ── AVATAR LOADER ── */
  function loadAvatar(input, previewId, dataId) {
    var file = input.files[0];
    if (!file) return;
    Utils.readFileAsDataURL(file, 2 * 1024 * 1024, function (dataUrl) {
      document.getElementById(previewId).innerHTML = '<img src="' + dataUrl + '"/>';
      document.getElementById(dataId).value        = dataUrl;
    });
  }

  /* ── THUMBNAIL LOADER ── */
  function loadThumb(input) {
    var file = input.files[0];
    if (!file) return;
    Utils.readFileAsDataURL(file, 5 * 1024 * 1024, function (dataUrl) {
      var area = document.getElementById('thumbArea');
      area.style.backgroundImage    = 'url("' + dataUrl + '")';
      area.style.backgroundSize     = 'cover';
      area.style.backgroundPosition = 'center';
      document.getElementById('thumbPlaceholder').style.display = 'none';
      document.getElementById('thumbData').value = dataUrl;
    });
  }

  /* ── UPLOAD FORM: Script Items ── */
  var _scriptItemCount = 0;

  function resetUploadForm() {
    document.getElementById('upTitle').value   = '';
    document.getElementById('upDesc').value    = '';
    document.getElementById('thumbData').value = '';
    var area = document.getElementById('thumbArea');
    area.style.backgroundImage    = '';
    area.style.backgroundSize     = '';
    area.style.backgroundPosition = '';
    document.getElementById('thumbPlaceholder').style.display = 'flex';
    // Reset container dan counter — urutan penting: reset dulu, baru tambah
    var container = document.getElementById('scriptItems');
    container.innerHTML = '';
    _scriptItemCount    = 0;
    addScriptItem(); // mulai dengan 1 item kosong
  }

  function openUpload() {
    clearAllAlerts();
    resetUploadForm();
    openModal('modalUpload');
  }

  function addScriptItem() {
    _scriptItemCount++;
    var n = _scriptItemCount;

    /* Buat wrapper */
    var div = document.createElement('div');
    div.className = 'script-item';

    /* Header: label + tombol hapus */
    var header = document.createElement('div');
    header.className = 'script-item-header';

    var label = document.createElement('span');
    label.className   = 'script-item-num';
    label.textContent = 'Script #' + n;

    var btnDel = document.createElement('button');
    btnDel.className = 'script-item-del';
    btnDel.title     = 'Hapus';
    btnDel.textContent = '✕';
    /* Closure capture div — hapus elemen ini sendiri */
    (function(el) {
      btnDel.addEventListener('click', function() { el.remove(); });
    })(div);

    header.appendChild(label);
    header.appendChild(btnDel);

    /* Input nama */
    var grpName = document.createElement('div');
    grpName.className = 'form-group';
    grpName.style.marginBottom = '10px';
    var lblName = document.createElement('label');
    lblName.className   = 'form-label';
    lblName.textContent = 'Nama Script';
    var inputName = document.createElement('input');
    inputName.className   = 'form-input';
    inputName.type        = 'text';
    inputName.placeholder = 'Contoh: Auto Farm v2';
    inputName.setAttribute('data-sname', '');
    grpName.appendChild(lblName);
    grpName.appendChild(inputName);

    /* Textarea kode */
    var grpCode = document.createElement('div');
    grpCode.className = 'form-group';
    grpCode.style.marginBottom = '0';
    var lblCode = document.createElement('label');
    lblCode.className   = 'form-label';
    lblCode.textContent = 'Kode Script';
    var taCode = document.createElement('textarea');
    taCode.className   = 'form-input form-textarea';
    taCode.rows        = 5;
    taCode.placeholder = '-- Paste kode di sini...';
    taCode.setAttribute('data-scode', '');
    grpCode.appendChild(lblCode);
    grpCode.appendChild(taCode);

    div.appendChild(header);
    div.appendChild(grpName);
    div.appendChild(grpCode);

    document.getElementById('scriptItems').appendChild(div);
  }

  /* ── TAB ── */
  function switchTab(tab) {
    var isScript = (tab === 'script');
    document.getElementById('tabScript').classList.toggle('active',  isScript);
    document.getElementById('tabComment').classList.toggle('active', !isScript);
    document.getElementById('tabBtnScript').classList.toggle('active',  isScript);
    document.getElementById('tabBtnComment').classList.toggle('active', !isScript);
  }

  /* ── STATS ── */
  function updateStats() {
    document.getElementById('statScripts').textContent = DB.getScripts().length;
    document.getElementById('statMembers').textContent = DB.getUsers().length;
  }

  return {
    toast:           toast,
    showAlert:       showAlert,
    hideAlert:       hideAlert,
    clearAllAlerts:  clearAllAlerts,
    openModal:       openModal,
    closeModal:      closeModal,
    bgClose:         bgClose,
    openAuth:        openAuth,
    updateNav:       updateNav,
    toggleDrop:      toggleDrop,
    setTheme:        setTheme,
    applyStoredTheme: applyStoredTheme,
    openSettings:    openSettings,
    openEditProfile: openEditProfile,
    loadAvatar:      loadAvatar,
    loadThumb:       loadThumb,
    openUpload:      openUpload,
    addScriptItem:   addScriptItem,
    switchTab:       switchTab,
    updateStats:     updateStats
  };

})();

/* ─────────────────────────────────────────────────────────
   AUTH  —  Login, Register, Logout, Edit Profil
───────────────────────────────────────────────────────── */
var Auth = (function () {

  function login() {
    UI.hideAlert('errLogin');

    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value; // JANGAN trim password

    if (!username || !password) {
      UI.showAlert('errLogin', 'Isi username dan password!');
      return;
    }

    var user = DB.findUser(username);

    if (!user) {
      UI.showAlert('errLogin', 'Username tidak ditemukan.');
      return;
    }
    if (user.password !== password) {
      UI.showAlert('errLogin', 'Password salah.');
      return;
    }

    /* Simpan session */
    DB.saveSession(user);

    /* Update UI langsung dengan object user — tidak perlu baca ulang dari DB */
    UI.updateNav(user);
    Scripts.render();
    UI.closeModal('modalAuth');
    UI.toast('Selamat datang, ' + user.username + '!');
  }

  function register() {
    UI.hideAlert('errRegister');

    var username  = document.getElementById('regUsername').value.replace(/\s/g, '');
    var password  = document.getElementById('regPassword').value;
    var password2 = document.getElementById('regPassword2').value;
    var avatar    = document.getElementById('regAvatarData').value;

    if (!username || !password || !password2) {
      UI.showAlert('errRegister', 'Isi semua field yang wajib!'); return;
    }
    if (username.length < 3) {
      UI.showAlert('errRegister', 'Username minimal 3 karakter.'); return;
    }
    if (username.length > 30) {
      UI.showAlert('errRegister', 'Username maksimal 30 karakter.'); return;
    }
    if (password.length < 6) {
      UI.showAlert('errRegister', 'Password minimal 6 karakter.'); return;
    }
    if (password !== password2) {
      UI.showAlert('errRegister', 'Password tidak cocok!'); return;
    }
    if (DB.usernameExists(username)) {
      UI.showAlert('errRegister', 'Username sudah dipakai. Coba nama lain.'); return;
    }

    var newUser = {
      username:  username,
      password:  password,
      isAdmin:   false,
      avatar:    avatar,
      createdAt: new Date().toISOString()
    };

    DB.upsertUser(newUser);
    DB.saveSession(newUser);

    UI.updateNav(newUser);
    Scripts.render();
    UI.updateStats();
    UI.closeModal('modalAuth');
    UI.toast('Akun berhasil dibuat! Selamat datang, ' + username + '!');
  }

  function logout() {
    DB.clearSession();
    UI.updateNav(null);
    Scripts.render();
    UI.toast('Sampai jumpa!');
  }

  function saveProfile() {
    UI.hideAlert('errEdit');

    var me      = DB.getCurrentUser();
    if (!me) return;

    var newAvatar   = document.getElementById('editAvatarData').value;
    var newUsername = document.getElementById('editUsername').value.replace(/\s/g, '').trim();
    var newPassword = document.getElementById('editPassword').value;

    /* Validasi username baru */
    if (newUsername) {
      if (newUsername.length < 3) {
        UI.showAlert('errEdit', 'Username minimal 3 karakter.'); return;
      }
      if (DB.usernameExists(newUsername, me.username)) {
        UI.showAlert('errEdit', 'Username sudah dipakai orang lain!'); return;
      }
    }
    /* Validasi password baru */
    if (newPassword && newPassword.length < 6) {
      UI.showAlert('errEdit', 'Password baru minimal 6 karakter.'); return;
    }

    /* Terapkan perubahan */
    var oldUsername = me.username;
    var updated     = {
      username:  newUsername  || me.username,
      password:  newPassword  || me.password,
      isAdmin:   me.isAdmin,
      avatar:    newAvatar    || me.avatar,
      createdAt: me.createdAt
    };

    /* Jika username berubah, update juga di semua komentar & scripts */
    if (newUsername && newUsername !== oldUsername) {
      var cmts = DB.getScripts().reduce(function (_, s) { return s; }, null);
      /* Update comments */
      var allCmts = {};
      var scriptList = DB.getScripts();
      for (var i = 0; i < scriptList.length; i++) {
        var sid  = scriptList[i].id;
        var list = DB.getScriptComments(sid);
        for (var j = 0; j < list.length; j++) {
          if (list[j].author === oldUsername) list[j].author = newUsername;
          var reps = list[j].replies || [];
          for (var k = 0; k < reps.length; k++) {
            if (reps[k].author === oldUsername) reps[k].author = newUsername;
          }
        }
        allCmts[sid] = list;
      }
      DB.saveScriptComments = function() {}; // patched below
      /* save all at once */
      try { localStorage.setItem('sv6_comments', JSON.stringify(allCmts)); } catch(e) {}

      /* Update author di scripts */
      var scripts = DB.getScripts();
      for (var s = 0; s < scripts.length; s++) {
        if (scripts[s].author === oldUsername) scripts[s].author = newUsername;
      }
      DB.saveScripts(scripts);
    }

    /* Hapus entri lama jika username berubah, lalu simpan baru */
    if (newUsername && newUsername !== oldUsername) {
      var users = DB.getUsers().filter(function (u) { return u.username !== oldUsername; });
      users.push(updated);
      DB.saveUsers(users);
    } else {
      DB.upsertUser(updated);
    }

    /* Update session */
    DB.saveSession(updated);

    /* Update UI */
    UI.updateNav(updated);
    Scripts.render();
    UI.showAlert('okEdit', 'Profil berhasil diperbarui!', 'ok');
    setTimeout(function () { UI.closeModal('modalEdit'); }, 1200);
  }

  return { login: login, register: register, logout: logout, saveProfile: saveProfile };

})();

/* ─────────────────────────────────────────────────────────
   SCRIPTS  —  Upload, Render, Delete
───────────────────────────────────────────────────────── */
var Scripts = (function () {

  var _currentId = null;

  function currentId()      { return _currentId; }
  function setCurrentId(id) { _currentId = id; }

  /* ── COPY ── */
  function copyCode(e, b64, btn) {
    e.stopPropagation();
    var code = Utils.b64d(b64);
    navigator.clipboard.writeText(code).then(function () {
      btn.textContent = '✓ Disalin';
      btn.classList.add('copied');
      setTimeout(function () {
        btn.innerHTML = '📋 Salin';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function () {
      UI.toast('Gagal menyalin.');
    });
  }

  /* ── RENDER GRID ── */
  function render() {
    var q    = document.getElementById('searchInput').value.toLowerCase();
    var cat  = document.getElementById('filterCat').value;
    var data = DB.getScripts();

    if (q)   data = data.filter(function (s) {
      return s.title.toLowerCase().indexOf(q) > -1 || s.desc.toLowerCase().indexOf(q) > -1;
    });
    if (cat) data = data.filter(function (s) { return s.category === cat; });

    document.getElementById('sectionTitle').textContent =
      (q || cat) ? ('Hasil: ' + data.length + ' Script') : 'Semua Script';

    var grid = document.getElementById('scriptsGrid');

    if (!data.length) {
      grid.innerHTML =
        '<div class="empty-state">' +
          '<h3>KOSONG</h3>' +
          '<p>Belum ada script' + (q || cat ? ' yang cocok' : '') + '</p>' +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < data.length; i++) {
      html += _buildCard(data[i], i);
    }
    grid.innerHTML = html;

    /* Pasang event listener copy button di card — pakai event delegation */
    grid.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        copyCode(e, btn.dataset.code, btn);
      });
    });

    UI.updateStats();
  }

  function _buildCard(s, idx) {
    var cmtCount = DB.getScriptComments(s.id)
      .reduce(function (a, c) { return a + 1 + (c.replies ? c.replies.length : 0); }, 0);

    var thumbHtml = s.thumb
      ? '<img src="' + s.thumb + '" alt="thumb"/>'
      : '<div class="card-thumb-empty">🗂</div>';

    var rowsHtml = '';
    var scripts  = s.scripts || [];
    for (var j = 0; j < scripts.length; j++) {
      var sc  = scripts[j];
      var enc = Utils.b64e(sc.code);
      rowsHtml +=
        '<div class="card-script-row" onclick="event.stopPropagation()">' +
          '<span class="card-script-name">' + Utils.esc(sc.name) + '</span>' +
          '<button class="copy-btn" data-code="' + enc + '">📋 Salin</button>' +
        '</div>';
    }

    var avatarHtml = s.authorAvatar
      ? '<img src="' + s.authorAvatar + '" alt="a"/>'
      : Utils.esc(s.author[0].toUpperCase());

    return (
      '<div class="script-card" data-id="' + s.id + '" style="animation-delay:' + (idx * 0.05) + 's">' +
        '<div class="card-thumb">' + thumbHtml + '</div>' +
        '<div class="card-body">' +
          '<div class="card-top">' +
            '<span class="card-tag">' + Utils.esc(s.category) + '</span>' +
            '<span class="card-count">' + scripts.length + ' script</span>' +
          '</div>' +
          '<div class="card-title">' + Utils.esc(s.title) + '</div>' +
          '<div class="card-desc">'  + Utils.esc(s.desc)  + '</div>' +
          '<div class="card-script-list">' + rowsHtml + '</div>' +
          '<div class="card-footer">' +
            '<div class="card-avatar-sm">' + avatarHtml + '</div>' +
            '<span class="card-author">'   + Utils.esc(s.author) + '</span>' +
            '<span class="card-comments">💬 ' + cmtCount + '</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /* ── OPEN DETAIL ── */
  function openDetail(id) {
    var s = null;
    var all = DB.getScripts();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { s = all[i]; break; }
    }
    if (!s) return;

    setCurrentId(id);

    /* Thumbnail */
    document.getElementById('detailThumb').innerHTML = s.thumb
      ? '<img src="' + s.thumb + '" alt="thumb"/>'
      : '<div class="detail-thumb-empty">🗂</div>';

    /* Header */
    document.getElementById('detailTag').textContent        = s.category;
    document.getElementById('detailTitle').textContent      = s.title;
    document.getElementById('detailDesc').textContent       = s.desc;
    document.getElementById('detailAuthorName').textContent = s.author;
    document.getElementById('detailDate').textContent       = new Date(s.createdAt)
      .toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

    document.getElementById('detailAvatar').innerHTML = s.authorAvatar
      ? '<img src="' + s.authorAvatar + '" alt="av"/>'
      : Utils.esc(s.author[0].toUpperCase());

    /* Scripts list */
    var scriptHtml = '';
    var scripts    = s.scripts || [];
    for (var j = 0; j < scripts.length; j++) {
      var sc  = scripts[j];
      var enc = Utils.b64e(sc.code);
      scriptHtml +=
        '<div class="detail-script-item">' +
          '<div class="detail-script-header" data-idx="' + j + '">' +
            '<span>📄</span>' +
            '<span class="detail-script-name">' + Utils.esc(sc.name) + '</span>' +
            '<div class="detail-script-actions">' +
              '<button class="copy-btn" data-code="' + enc + '">📋 Salin</button>' +
              '<span class="code-toggle" id="arr_' + j + '">▾</span>' +
            '</div>' +
          '</div>' +
          '<div class="code-wrap" id="cw_' + j + '">' +
            '<pre class="code-block">' + Utils.esc(sc.code) + '</pre>' +
          '</div>' +
        '</div>';
    }
    document.getElementById('detailScripts').innerHTML = scriptHtml;

    /* Pasang event listeners untuk toggle kode & copy */
    document.querySelectorAll('.detail-script-header').forEach(function (header) {
      header.addEventListener('click', function (e) {
        if (e.target.classList.contains('copy-btn')) return;
        var idx = header.dataset.idx;
        var cw  = document.getElementById('cw_'  + idx);
        var arr = document.getElementById('arr_' + idx);
        cw.classList.toggle('open');
        if (arr) arr.textContent = cw.classList.contains('open') ? '▴' : '▾';
      });
    });

    document.querySelectorAll('#detailScripts .copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        copyCode(e, btn.dataset.code, btn);
      });
    });

    /* Admin actions */
    var me = DB.getCurrentUser();
    document.getElementById('adminActions').style.display = (me && me.isAdmin) ? 'block' : 'none';

    /* Reset & render comments */
    document.getElementById('commentInput').innerHTML = '';
    document.getElementById('commentList').innerHTML  = '';
    Comments.render(id);
    Comments.updateBadge(id);

    UI.switchTab('script');
    UI.openModal('modalDetail');
  }

  /* ── UPLOAD ── */
  function upload() {
    UI.hideAlert('errUpload');
    var me = DB.getCurrentUser();
    if (!me || !me.isAdmin) {
      UI.showAlert('errUpload', 'Akses ditolak!'); return;
    }

    var title = document.getElementById('upTitle').value.trim();
    var cat   = document.getElementById('upCategory').value;
    var desc  = document.getElementById('upDesc').value.trim();
    var thumb = document.getElementById('thumbData').value;

    if (!title || !desc) {
      UI.showAlert('errUpload', 'Judul dan deskripsi wajib diisi!'); return;
    }

    // FIX: scope ke #scriptItems agar tidak bentrok dengan elemen lain di halaman
    var container = document.getElementById('scriptItems');
    var items     = container ? container.querySelectorAll('.script-item') : [];
    var scripts   = [];

    for (var i = 0; i < items.length; i++) {
      var nameEl = items[i].querySelector('[data-sname]');
      var codeEl = items[i].querySelector('[data-scode]');

      // Pastikan elemen benar-benar ditemukan
      if (!nameEl || !codeEl) continue;

      var name = nameEl.value.trim();
      var code = codeEl.value.trim();

      if (!name && !code) continue; // skip item kosong
      if (!name) { UI.showAlert('errUpload', 'Script #' + (i+1) + ': nama tidak boleh kosong!'); return; }
      if (!code) { UI.showAlert('errUpload', 'Script #' + (i+1) + ': kode tidak boleh kosong!');  return; }

      scripts.push({ name: name, code: code });
    }

    if (!scripts.length) {
      UI.showAlert('errUpload', 'Tambahkan minimal 1 script!'); return;
    }

    var all = DB.getScripts();
    all.unshift({
      id:           Utils.uid(),
      title:        title,
      category:     cat,
      desc:         desc,
      thumb:        thumb,
      scripts:      scripts,
      author:       me.username,
      authorAvatar: me.avatar || '',
      createdAt:    new Date().toISOString()
    });
    DB.saveScripts(all);

    UI.closeModal('modalUpload');
    render();
    UI.toast('Script berhasil dipublikasikan!');
  }

  /* ── DELETE ── */
  function deleteScript() {
    if (!confirm('Yakin ingin menghapus script ini?')) return;
    var all = DB.getScripts().filter(function (s) { return s.id !== _currentId; });
    DB.saveScripts(all);
    UI.closeModal('modalDetail');
    render();
    UI.toast('Script dihapus.');
  }

  return {
    render:      render,
    openDetail:  openDetail,
    upload:      upload,
    delete:      deleteScript,
    copyCode:    copyCode
  };

})();

/* ─────────────────────────────────────────────────────────
   COMMENTS  —  Komentar & Balasan
───────────────────────────────────────────────────────── */
var Comments = (function () {

  function render(scriptId) {
    var me   = DB.getCurrentUser();
    var wrap = document.getElementById('commentInput');

    /* Render kotak input hanya sekali */
    if (!wrap.hasChildNodes()) {
      if (me) {
        var avHtml = me.avatar
          ? '<img src="' + me.avatar + '" alt="av"/>'
          : Utils.esc(me.username[0].toUpperCase());

        var box = document.createElement('div');
        box.className = 'comment-input-box';
        box.innerHTML =
          '<div class="comment-input-header">' +
            '<div class="comment-avatar">' + avHtml + '</div>' +
            '<span class="comment-username">' + Utils.esc(me.username) + '</span>' +
            (me.isAdmin ? '<span class="dev-badge">Developer</span>' : '') +
          '</div>' +
          '<textarea class="comment-textarea" id="cmtTextarea" rows="3" placeholder="Tulis komentar..."></textarea>' +
          '<div class="comment-submit-row">' +
            '<button class="btn-send" id="cmtSendBtn">Kirim →</button>' +
          '</div>';
        wrap.appendChild(box);

        /* Event listener langsung — tidak pakai string onclick */
        document.getElementById('cmtSendBtn').addEventListener('click', function () {
          postComment(scriptId);
        });
      } else {
        var prompt = document.createElement('div');
        prompt.className = 'login-prompt';
        prompt.innerHTML =
          '<p>Kamu harus login untuk berkomentar</p>' +
          '<button class="btn btn-primary">Login Sekarang</button>';
        prompt.querySelector('button').addEventListener('click', function () {
          UI.closeModal('modalDetail');
          UI.openAuth('login');
        });
        wrap.appendChild(prompt);
      }
    }

    refreshList(scriptId);
  }

  function refreshList(scriptId) {
    var list = DB.getScriptComments(scriptId);
    var el   = document.getElementById('commentList');

    if (!list.length) {
      el.innerHTML = '<div class="no-comments">Belum ada komentar — jadilah yang pertama!</div>';
      return;
    }

    el.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      el.appendChild(_buildCommentEl(list[i], scriptId));
    }
  }

  function _buildCommentEl(c, scriptId) {
    var cu    = DB.findUser(c.author);
    var isAdm = cu && cu.isAdmin;
    var me    = DB.getCurrentUser();

    var avHtml = c.authorAvatar
      ? '<img src="' + c.authorAvatar + '" alt="av"/>'
      : Utils.esc(c.author[0].toUpperCase());

    var item = document.createElement('div');
    item.className = 'comment-item';
    item.id        = 'ci_' + c.id;

    /* Header */
    var headerHtml =
      '<div class="comment-header">' +
        '<div class="comment-avatar">' + avHtml + '</div>' +
        '<span class="comment-name">'  + Utils.esc(c.author) + '</span>' +
        (isAdm ? '<span class="comment-role">Developer</span>' : '') +
        '<span class="comment-time">'  + Utils.timeAgo(c.createdAt) + '</span>' +
      '</div>' +
      '<div class="comment-body">' + Utils.esc(c.body) + '</div>';

    /* Replies — pakai var j bukan var i agar tidak shadowing */
    var reps     = c.replies || [];
    var repsHtml = '';
    for (var j = 0; j < reps.length; j++) {
      var r    = reps[j];
      var ru   = DB.findUser(r.author);
      var rAdm = ru && ru.isAdmin;
      var rAv  = r.authorAvatar
        ? '<img src="' + r.authorAvatar + '" alt="av"/>'
        : Utils.esc(r.author[0].toUpperCase());
      repsHtml +=
        '<div class="reply-item">' +
          '<div class="comment-header">' +
            '<div class="comment-avatar" style="width:24px;height:24px;font-size:10px">' + rAv + '</div>' +
            '<span class="comment-name">' + Utils.esc(r.author) + '</span>' +
            (rAdm ? '<span class="comment-role">Developer</span>' : '') +
            '<span class="comment-time">' + Utils.timeAgo(r.createdAt) + '</span>' +
          '</div>' +
          '<div class="comment-body">' + Utils.esc(r.body) + '</div>' +
        '</div>';
    }

    item.innerHTML =
      headerHtml +
      '<div class="comment-actions">' +
        (me ? '<button class="btn-reply">↩ Balas</button>' : '') +
      '</div>' +
      (repsHtml ? '<div class="replies">' + repsHtml + '</div>' : '') +
      '<div class="reply-input-wrap" id="riw_' + c.id + '"></div>';

    /* Pasang event listener tombol Balas
       Pakai IIFE untuk capture nilai c.id yang benar di setiap iterasi */
    if (me) {
      var replyBtn = item.querySelector('.btn-reply');
      (function(cmtId) {
        replyBtn.addEventListener('click', function () {
          toggleReplyInput(cmtId, scriptId);
        });
      })(c.id);
    }

    return item;
  }

  function toggleReplyInput(cmtId, scriptId) {
    var wrap = document.getElementById('riw_' + cmtId);
    if (!wrap) return;

    if (wrap.hasChildNodes()) { wrap.innerHTML = ''; return; }

    var me = DB.getCurrentUser();
    if (!me) return;

    /* Buat elemen dengan DOM API — tidak pakai innerHTML untuk event */
    var div = document.createElement('div');
    div.style.paddingTop = '10px';

    var ta = document.createElement('textarea');
    ta.className   = 'comment-textarea';
    ta.rows        = 2;
    ta.placeholder = 'Tulis balasan...';

    var row = document.createElement('div');
    row.className = 'comment-submit-row';
    row.style.gap = '8px';
    row.style.display = 'flex';
    row.style.justifyContent = 'flex-end';

    var btnCancel = document.createElement('button');
    btnCancel.className   = 'btn-cancel-reply';
    btnCancel.textContent = 'Batal';
    btnCancel.addEventListener('click', function () { wrap.innerHTML = ''; });

    var btnSend = document.createElement('button');
    btnSend.className   = 'btn-send';
    btnSend.textContent = 'Kirim →';
    btnSend.addEventListener('click', function () {
      postReply(cmtId, scriptId, ta.value.trim());
    });

    row.appendChild(btnCancel);
    row.appendChild(btnSend);
    div.appendChild(ta);
    div.appendChild(row);
    wrap.appendChild(div);
  }

  function postComment(scriptId) {
    var me = DB.getCurrentUser();
    if (!me) return;

    var ta = document.getElementById('cmtTextarea');
    if (!ta) return;

    var body = ta.value.trim();
    if (!body) return;

    var list = DB.getScriptComments(scriptId);
    list.push({
      id:           Utils.uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body:         body,
      replies:      [],
      createdAt:    new Date().toISOString()
    });
    DB.saveScriptComments(scriptId, list);

    ta.value = '';
    refreshList(scriptId);
    updateBadge(scriptId);
  }

  function postReply(cmtId, scriptId, body) {
    if (!body) return;
    var me = DB.getCurrentUser();
    if (!me) return;

    var list = DB.getScriptComments(scriptId);
    var c    = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === cmtId) { c = list[i]; break; }
    }
    if (!c) return;

    if (!c.replies) c.replies = [];
    c.replies.push({
      id:           Utils.uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body:         body,
      createdAt:    new Date().toISOString()
    });
    DB.saveScriptComments(scriptId, list);

    refreshList(scriptId);
    updateBadge(scriptId);
  }

  function updateBadge(scriptId) {
    var list  = DB.getScriptComments(scriptId);
    var total = list.reduce(function (a, c) {
      return a + 1 + (c.replies ? c.replies.length : 0);
    }, 0);
    var el = document.getElementById('detailCmtCount');
    if (el) el.textContent = total;
  }

  return { render: render, refreshList: refreshList, updateBadge: updateBadge };

})();

/* ─────────────────────────────────────────────────────────
   EVENT DELEGATION  —  Klik card buka detail
───────────────────────────────────────────────────────── */
document.addEventListener('click', function (e) {
  var card = e.target.closest('.script-card');
  if (card && !e.target.closest('.copy-btn')) {
    Scripts.openDetail(card.dataset.id);
  }
});

/* ─────────────────────────────────────────────────────────
   INIT  —  Jalankan saat halaman siap
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {

  /* 1. Buat akun admin jika belum ada */
  DB.seedAdmin();

  /* 2. Terapkan tema tersimpan */
  UI.applyStoredTheme();

  /* 3. Terapkan session yang tersimpan */
  var me = DB.getCurrentUser();
  UI.updateNav(me);

  /* 4. Render konten */
  Scripts.render();
  UI.updateStats();

});
