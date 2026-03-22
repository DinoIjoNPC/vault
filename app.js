/* ═══════════════════════════════════════════════════════════
   app.js  —  ScriptVault (Firebase Edition)
   Database: Firebase Firestore (online, semua device sinkron)
   
   Struktur Firestore:
     /users/{username}        → data akun
     /scripts/{id}            → data script
     /comments/{scriptId}/list/{commentId} → komentar
═══════════════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────────────
   FIREBASE CONFIG & INIT
───────────────────────────────────────────────────────── */
var FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCU1q_FpcAyyipVwN6I9N4du8brKudpjTg",
  authDomain:        "vault-45632.firebaseapp.com",
  projectId:         "vault-45632",
  storageBucket:     "vault-45632.firebasestorage.app",
  messagingSenderId: "387874758450",
  appId:             "1:387874758450:web:a659361321cc625ca9412b"
};

/* Load Firebase via CDN (compat version — tidak perlu bundler) */
var _db   = null; /* Firestore instance */
var _ready = false;

function _initFirebase() {
  return new Promise(function(resolve) {
    /* Sudah di-init sebelumnya */
    if (_db) { resolve(); return; }

    firebase.initializeApp(FIREBASE_CONFIG);
    _db    = firebase.firestore();
    _ready = true;
    resolve();
  });
}

/* ─────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────── */
var ADMIN_USER = 'DinoIjoNPC';
var ADMIN_PASS = 'GABRIEL@12345';

/* ─────────────────────────────────────────────────────────
   UTILS
───────────────────────────────────────────────────────── */
var Utils = {
  uid: function() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  },
  esc: function(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
  b64e: function(s) {
    try { return btoa(unescape(encodeURIComponent(s))); } catch(e) { return ''; }
  },
  b64d: function(s) {
    try { return decodeURIComponent(escape(atob(s))); } catch(e) { return ''; }
  },
  timeAgo: function(ts) {
    if (!ts) return '';
    var date = ts.toDate ? ts.toDate() : new Date(ts);
    var diff = Date.now() - date.getTime();
    var m = Math.floor(diff / 60000);
    if (m < 1)  return 'baru saja';
    if (m < 60) return m + ' mnt lalu';
    var h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    var d = Math.floor(h / 24);
    if (d < 30) return d + ' hari lalu';
    return date.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
  },
  readFile: function(file, maxBytes, cb) {
    if (file.size > maxBytes) {
      alert('Foto terlalu besar! Maks ' + Math.round(maxBytes/1024/1024) + 'MB.');
      return;
    }
    var r = new FileReader();
    r.onload = function(e) { cb(e.target.result); };
    r.readAsDataURL(file);
  }
};

/* ─────────────────────────────────────────────────────────
   SESSION  —  hanya simpan username di localStorage
───────────────────────────────────────────────────────── */
var Session = {
  KEY: 'sv_session',
  get: function() {
    try { return localStorage.getItem(this.KEY) || null; } catch(e) { return null; }
  },
  save: function(username) {
    try { localStorage.setItem(this.KEY, username); } catch(e) {}
  },
  clear: function() {
    try { localStorage.removeItem(this.KEY); } catch(e) {}
  }
};

/* ─────────────────────────────────────────────────────────
   DB  —  Semua operasi Firestore
───────────────────────────────────────────────────────── */
var DB = {

  /* ── USERS ── */
  getUser: function(username, cb) {
    _db.collection('users').doc(username).get()
      .then(function(doc) {
        cb(doc.exists ? doc.data() : null);
      })
      .catch(function() { cb(null); });
  },

  saveUser: function(userObj, cb) {
    _db.collection('users').doc(userObj.username).set(userObj)
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('saveUser:', e); if (cb) cb(false); });
  },

  updateUser: function(username, data, cb) {
    _db.collection('users').doc(username).update(data)
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('updateUser:', e); if (cb) cb(false); });
  },

  getUserCount: function(cb) {
    _db.collection('users').get()
      .then(function(snap) { cb(snap.size); })
      .catch(function() { cb(0); });
  },

  /* ── SCRIPTS ── */
  getScripts: function(cb) {
    _db.collection('scripts').orderBy('createdAt', 'desc').get()
      .then(function(snap) {
        var list = [];
        snap.forEach(function(doc) { list.push(doc.data()); });
        cb(list);
      })
      .catch(function(e) { console.error('getScripts:', e); cb([]); });
  },

  getScript: function(id, cb) {
    _db.collection('scripts').doc(id).get()
      .then(function(doc) { cb(doc.exists ? doc.data() : null); })
      .catch(function() { cb(null); });
  },

  saveScript: function(scriptObj, cb) {
    _db.collection('scripts').doc(scriptObj.id).set(scriptObj)
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('saveScript:', e); if (cb) cb(false); });
  },

  deleteScript: function(id, cb) {
    _db.collection('scripts').doc(id).delete()
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('deleteScript:', e); if (cb) cb(false); });
  },

  /* ── COMMENTS ── */
  getComments: function(scriptId, cb) {
    _db.collection('comments').doc(scriptId)
      .collection('list').orderBy('createdAt', 'asc').get()
      .then(function(snap) {
        var list = [];
        snap.forEach(function(doc) { list.push(doc.data()); });
        cb(list);
      })
      .catch(function() { cb([]); });
  },

  addComment: function(scriptId, commentObj, cb) {
    _db.collection('comments').doc(scriptId)
      .collection('list').doc(commentObj.id).set(commentObj)
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('addComment:', e); if (cb) cb(false); });
  },

  addReply: function(scriptId, commentId, replyObj, cb) {
    /* Reply disimpan sebagai sub-array di dalam comment document */
    _db.collection('comments').doc(scriptId)
      .collection('list').doc(commentId)
      .update({
        replies: firebase.firestore.FieldValue.arrayUnion(replyObj)
      })
      .then(function() { if (cb) cb(true); })
      .catch(function(e) { console.error('addReply:', e); if (cb) cb(false); });
  },

  /* ── ADMIN SEED ── */
  seedAdmin: function() {
    DB.getUser(ADMIN_USER, function(existing) {
      if (!existing) {
        DB.saveUser({
          username:  ADMIN_USER,
          password:  ADMIN_PASS,
          isAdmin:   true,
          avatar:    '',
          createdAt: new Date().toISOString()
        });
      } else if (!existing.isAdmin) {
        DB.updateUser(ADMIN_USER, { isAdmin: true });
      }
    });
  }
};

/* ─────────────────────────────────────────────────────────
   UI  —  Modal, Nav, Tema, Toast
───────────────────────────────────────────────────────── */
var UI = {

  _toastTimer: null,
  _currentUser: null, /* cache user yang sedang login */

  /* ── TOAST ── */
  toast: function(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(UI._toastTimer);
    UI._toastTimer = setTimeout(function() { el.classList.add('hidden'); }, 2800);
  },

  /* ── LOADING ── */
  loading: function(show) {
    var el = document.getElementById('loadingOverlay');
    if (el) el.classList.toggle('hidden', !show);
  },

  /* ── ALERT ── */
  showAlert: function(id, msg, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className   = 'alert ' + (type === 'ok' ? 'alert-success' : 'alert-error');
  },
  hideAlert: function(id) {
    var el = document.getElementById(id);
    if (el) { el.className = 'alert hidden'; el.textContent = ''; }
  },
  clearAlerts: function() {
    document.querySelectorAll('.alert').forEach(function(el) {
      el.className = 'alert hidden'; el.textContent = '';
    });
  },

  /* ── MODAL ── */
  openModal:  function(id) { document.getElementById(id).classList.remove('hidden'); },
  closeModal: function(id) { document.getElementById(id).classList.add('hidden'); },
  bgClose:    function(e, id) {
    if (e.target === document.getElementById(id)) UI.closeModal(id);
  },

  openAuth: function(pane) {
    UI.clearAlerts();
    document.getElementById('paneLogin').style.display    = pane === 'login'    ? 'block' : 'none';
    document.getElementById('paneRegister').style.display = pane === 'register' ? 'block' : 'none';
    UI.openModal('modalAuth');
  },

  /* ── NAV ── */
  updateNav: function(user) {
    UI._currentUser = user;
    var guestEl  = document.getElementById('guestNav');
    var userEl   = document.getElementById('userNav');
    var nameEl   = document.getElementById('navUsername');
    var badgeEl  = document.getElementById('navBadge');
    var uploadEl = document.getElementById('btnUpload');
    var avatarEl = document.getElementById('navAvatar');

    if (user) {
      guestEl.setAttribute('style', 'display:none');
      userEl.setAttribute('style',  'display:flex;align-items:center;gap:10px');
      nameEl.textContent = user.username;
      badgeEl.setAttribute('style',  user.isAdmin ? 'display:inline-block' : 'display:none');
      uploadEl.setAttribute('style', user.isAdmin ? 'display:inline-block' : 'display:none');
      avatarEl.innerHTML = user.avatar
        ? '<img src="' + user.avatar + '" alt="av"/>'
        : Utils.esc(user.username[0].toUpperCase());
    } else {
      guestEl.setAttribute('style', 'display:flex;gap:8px');
      userEl.setAttribute('style',  'display:none');
    }
  },

  toggleDrop: function() {
    document.getElementById('dropdown').classList.toggle('open');
  },

  /* ── TEMA ── */
  setTheme: function(t) {
    try { localStorage.setItem('sv_theme', t); } catch(e) {}
    document.documentElement.setAttribute('data-theme', t);
    document.getElementById('themeDark').classList.toggle('active',  t === 'dark');
    document.getElementById('themeLight').classList.toggle('active', t === 'light');
  },
  applyStoredTheme: function() {
    var t = 'dark';
    try { t = localStorage.getItem('sv_theme') || 'dark'; } catch(e) {}
    UI.setTheme(t);
  },
  openSettings: function() {
    var t = 'dark';
    try { t = localStorage.getItem('sv_theme') || 'dark'; } catch(e) {}
    UI.setTheme(t);
    UI.openModal('modalSettings');
  },

  /* ── EDIT PROFILE ── */
  openEditProfile: function() {
    document.getElementById('dropdown').classList.remove('open');
    var u = UI._currentUser;
    if (!u) return;
    document.getElementById('editAvatarPreview').innerHTML =
      u.avatar ? '<img src="' + u.avatar + '"/>' : '👤';
    document.getElementById('editAvatarData').value = u.avatar || '';
    document.getElementById('editUsername').value   = '';
    document.getElementById('editPassword').value   = '';
    UI.clearAlerts();
    UI.openModal('modalEdit');
  },

  /* ── FILE LOADERS ── */
  loadAvatar: function(input, prevId, dataId) {
    var f = input.files[0]; if (!f) return;
    Utils.readFile(f, 2*1024*1024, function(data) {
      document.getElementById(prevId).innerHTML = '<img src="' + data + '"/>';
      document.getElementById(dataId).value     = data;
    });
  },

  loadThumb: function(input) {
    var f = input.files[0]; if (!f) return;
    Utils.readFile(f, 5*1024*1024, function(data) {
      var area = document.getElementById('thumbArea');
      area.style.backgroundImage    = 'url("' + data + '")';
      area.style.backgroundSize     = 'cover';
      area.style.backgroundPosition = 'center';
      document.getElementById('thumbPlaceholder').style.display = 'none';
      document.getElementById('thumbData').value = data;
    });
  },

  /* ── UPLOAD FORM ── */
  _itemCount: 0,

  resetUploadForm: function() {
    document.getElementById('upTitle').value   = '';
    document.getElementById('upDesc').value    = '';
    document.getElementById('thumbData').value = '';
    var area = document.getElementById('thumbArea');
    area.style.backgroundImage    = '';
    area.style.backgroundSize     = '';
    area.style.backgroundPosition = '';
    document.getElementById('thumbPlaceholder').style.display = 'flex';
    document.getElementById('scriptItems').innerHTML = '';
    UI._itemCount = 0;
    UI.addScriptItem();
  },

  openUpload: function() {
    UI.clearAlerts();
    UI.resetUploadForm();
    UI.openModal('modalUpload');
  },

  addScriptItem: function() {
    UI._itemCount++;
    var n = UI._itemCount;

    var wrap = document.createElement('div');
    wrap.className = 'script-item';

    /* Header */
    var header = document.createElement('div');
    header.className = 'script-item-header';
    var lbl = document.createElement('span');
    lbl.className   = 'script-item-num';
    lbl.textContent = 'Script #' + n;
    var btnDel = document.createElement('button');
    btnDel.className   = 'script-item-del';
    btnDel.textContent = '✕';
    btnDel.title       = 'Hapus';
    (function(el) {
      btnDel.addEventListener('click', function() { el.remove(); });
    })(wrap);
    header.appendChild(lbl);
    header.appendChild(btnDel);

    /* Nama */
    var g1   = document.createElement('div');
    g1.className = 'form-group';
    g1.style.marginBottom = '10px';
    var l1   = document.createElement('label');
    l1.className = 'form-label'; l1.textContent = 'Nama Script';
    var inp  = document.createElement('input');
    inp.className   = 'form-input';
    inp.type        = 'text';
    inp.placeholder = 'Contoh: Auto Farm v2';
    inp.setAttribute('data-sname', '');
    g1.appendChild(l1); g1.appendChild(inp);

    /* Kode */
    var g2  = document.createElement('div');
    g2.className = 'form-group';
    g2.style.marginBottom = '0';
    var l2  = document.createElement('label');
    l2.className = 'form-label'; l2.textContent = 'Kode Script';
    var ta  = document.createElement('textarea');
    ta.className   = 'form-input form-textarea';
    ta.rows        = 5;
    ta.placeholder = '-- Paste kode di sini...';
    ta.setAttribute('data-scode', '');
    g2.appendChild(l2); g2.appendChild(ta);

    wrap.appendChild(header);
    wrap.appendChild(g1);
    wrap.appendChild(g2);
    document.getElementById('scriptItems').appendChild(wrap);
  },

  /* ── TAB ── */
  switchTab: function(tab) {
    var isScript = tab === 'script';
    document.getElementById('tabScript').classList.toggle('active',   isScript);
    document.getElementById('tabComment').classList.toggle('active',  !isScript);
    document.getElementById('tabBtnScript').classList.toggle('active',  isScript);
    document.getElementById('tabBtnComment').classList.toggle('active', !isScript);
  },

  /* ── STATS ── */
  updateStats: function() {
    DB.getScripts(function(list) {
      document.getElementById('statScripts').textContent = list.length;
    });
    DB.getUserCount(function(n) {
      document.getElementById('statMembers').textContent = n;
    });
  }
};

/* Tutup dropdown klik di luar */
document.addEventListener('click', function(e) {
  if (!e.target.closest('#navProfile')) {
    var dd = document.getElementById('dropdown');
    if (dd) dd.classList.remove('open');
  }
});

/* ─────────────────────────────────────────────────────────
   AUTH  —  Login, Register, Logout, Edit Profil
───────────────────────────────────────────────────────── */
var Auth = {

  login: function() {
    UI.hideAlert('errLogin');
    var username = document.getElementById('loginUsername').value.trim();
    var password = document.getElementById('loginPassword').value;

    if (!username || !password) {
      UI.showAlert('errLogin', 'Isi username dan password!'); return;
    }

    UI.loading(true);
    DB.getUser(username, function(user) {
      UI.loading(false);
      if (!user) {
        UI.showAlert('errLogin', 'Username tidak ditemukan.'); return;
      }
      if (user.password !== password) {
        UI.showAlert('errLogin', 'Password salah.'); return;
      }
      Session.save(user.username);
      UI.updateNav(user);
      Scripts.render();
      UI.updateStats();
      UI.closeModal('modalAuth');
      UI.toast('Selamat datang, ' + user.username + '!');
    });
  },

  register: function() {
    UI.hideAlert('errRegister');
    var username  = document.getElementById('regUsername').value.replace(/\s/g, '');
    var password  = document.getElementById('regPassword').value;
    var password2 = document.getElementById('regPassword2').value;
    var avatar    = document.getElementById('regAvatarData').value;

    if (!username || !password || !password2) {
      UI.showAlert('errRegister', 'Isi semua field!'); return;
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

    UI.loading(true);
    /* Cek apakah username sudah ada */
    DB.getUser(username, function(existing) {
      if (existing) {
        UI.loading(false);
        UI.showAlert('errRegister', 'Username sudah dipakai!'); return;
      }
      var newUser = {
        username:  username,
        password:  password,
        isAdmin:   false,
        avatar:    avatar,
        createdAt: new Date().toISOString()
      };
      DB.saveUser(newUser, function(ok) {
        UI.loading(false);
        if (!ok) {
          UI.showAlert('errRegister', 'Gagal membuat akun, coba lagi.'); return;
        }
        Session.save(newUser.username);
        UI.updateNav(newUser);
        Scripts.render();
        UI.updateStats();
        UI.closeModal('modalAuth');
        UI.toast('Akun berhasil dibuat! Selamat datang, ' + username + '!');
      });
    });
  },

  logout: function() {
    Session.clear();
    UI.updateNav(null);
    Scripts.render();
    UI.toast('Sampai jumpa!');
  },

  saveProfile: function() {
    UI.hideAlert('errEdit');
    var me = UI._currentUser;
    if (!me) return;

    var newAvatar   = document.getElementById('editAvatarData').value;
    var newUsername = document.getElementById('editUsername').value.replace(/\s/g, '').trim();
    var newPassword = document.getElementById('editPassword').value;

    if (newUsername && newUsername.length < 3) {
      UI.showAlert('errEdit', 'Username minimal 3 karakter.'); return;
    }
    if (newPassword && newPassword.length < 6) {
      UI.showAlert('errEdit', 'Password minimal 6 karakter.'); return;
    }

    var doSave = function() {
      var updates = {};
      if (newAvatar)   updates.avatar   = newAvatar;
      if (newPassword) updates.password = newPassword;

      UI.loading(true);
      DB.updateUser(me.username, updates, function(ok) {
        if (!ok) {
          UI.loading(false);
          UI.showAlert('errEdit', 'Gagal menyimpan, coba lagi.'); return;
        }
        /* Refresh data user dari DB */
        DB.getUser(me.username, function(updated) {
          UI.loading(false);
          if (updated) {
            Session.save(updated.username);
            UI.updateNav(updated);
          }
          UI.showAlert('okEdit', 'Profil berhasil diperbarui!', 'ok');
          setTimeout(function() { UI.closeModal('modalEdit'); }, 1200);
        });
      });
    };

    /* Jika ada username baru, cek dulu apakah sudah dipakai */
    if (newUsername && newUsername !== me.username) {
      UI.loading(true);
      DB.getUser(newUsername, function(existing) {
        UI.loading(false);
        if (existing) {
          UI.showAlert('errEdit', 'Username sudah dipakai!'); return;
        }
        /* Buat dokumen user baru dengan username baru */
        var newUserObj = {
          username:  newUsername,
          password:  newPassword  || me.password,
          isAdmin:   me.isAdmin,
          avatar:    newAvatar    || me.avatar,
          createdAt: me.createdAt
        };
        UI.loading(true);
        DB.saveUser(newUserObj, function(ok) {
          if (!ok) {
            UI.loading(false);
            UI.showAlert('errEdit', 'Gagal menyimpan, coba lagi.'); return;
          }
          /* Hapus dokumen username lama */
          _db.collection('users').doc(me.username).delete();
          Session.save(newUsername);
          UI.loading(false);
          UI.updateNav(newUserObj);
          UI.showAlert('okEdit', 'Profil berhasil diperbarui!', 'ok');
          setTimeout(function() { UI.closeModal('modalEdit'); }, 1200);
        });
      });
    } else {
      doSave();
    }
  }
};

/* ─────────────────────────────────────────────────────────
   SCRIPTS  —  Render, Upload, Detail, Delete
───────────────────────────────────────────────────────── */
var Scripts = {

  _currentId: null,

  render: function() {
    var q   = document.getElementById('searchInput').value.toLowerCase();
    var cat = document.getElementById('filterCat').value;
    var grid = document.getElementById('scriptsGrid');

    grid.innerHTML = '<div class="empty-state"><p style="color:var(--gray)">Memuat...</p></div>';

    DB.getScripts(function(data) {
      if (q)   data = data.filter(function(s) {
        return s.title.toLowerCase().indexOf(q) > -1 || s.desc.toLowerCase().indexOf(q) > -1;
      });
      if (cat) data = data.filter(function(s) { return s.category === cat; });

      document.getElementById('sectionTitle').textContent =
        (q || cat) ? 'Hasil: ' + data.length + ' Script' : 'Semua Script';

      if (!data.length) {
        grid.innerHTML =
          '<div class="empty-state"><h3>KOSONG</h3>' +
          '<p>Belum ada script' + (q || cat ? ' yang cocok' : '') + '</p></div>';
        return;
      }

      grid.innerHTML = '';
      for (var i = 0; i < data.length; i++) {
        grid.appendChild(Scripts._buildCard(data[i], i));
      }

      /* Event delegation copy button */
      grid.querySelectorAll('.copy-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          Scripts._doCopy(btn.dataset.code, btn);
        });
      });

      UI.updateStats();
    });
  },

  _buildCard: function(s, idx) {
    var el = document.createElement('div');
    el.className = 'script-card';
    el.dataset.id = s.id;
    el.style.animationDelay = (idx * 0.05) + 's';

    var thumbHtml = s.thumb
      ? '<img src="' + s.thumb + '" alt="thumb"/>'
      : '<div class="card-thumb-empty">🗂</div>';

    var rowsHtml = '';
    var scripts  = s.scripts || [];
    for (var j = 0; j < scripts.length; j++) {
      rowsHtml +=
        '<div class="card-script-row" onclick="event.stopPropagation()">' +
          '<span class="card-script-name">' + Utils.esc(scripts[j].name) + '</span>' +
          '<button class="copy-btn" data-code="' + Utils.b64e(scripts[j].code) + '">📋 Salin</button>' +
        '</div>';
    }

    var avHtml = s.authorAvatar
      ? '<img src="' + s.authorAvatar + '" alt="av"/>'
      : Utils.esc((s.author || '?')[0].toUpperCase());

    el.innerHTML =
      '<div class="card-thumb">' + thumbHtml + '</div>' +
      '<div class="card-body">' +
        '<div class="card-top">' +
          '<span class="card-tag">'   + Utils.esc(s.category) + '</span>' +
          '<span class="card-count">' + scripts.length + ' script</span>' +
        '</div>' +
        '<div class="card-title">' + Utils.esc(s.title) + '</div>' +
        '<div class="card-desc">'  + Utils.esc(s.desc)  + '</div>' +
        '<div class="card-script-list">' + rowsHtml + '</div>' +
        '<div class="card-footer">' +
          '<div class="card-avatar-sm">' + avHtml + '</div>' +
          '<span class="card-author">'   + Utils.esc(s.author || '') + '</span>' +
        '</div>' +
      '</div>';

    /* Klik card buka detail */
    el.addEventListener('click', function() {
      Scripts.openDetail(s.id);
    });

    return el;
  },

  _doCopy: function(b64, btn) {
    var code = Utils.b64d(b64);
    navigator.clipboard.writeText(code).then(function() {
      btn.textContent = '✓ Disalin';
      btn.classList.add('copied');
      setTimeout(function() {
        btn.innerHTML = '📋 Salin';
        btn.classList.remove('copied');
      }, 2000);
    }).catch(function() { UI.toast('Gagal menyalin.'); });
  },

  openDetail: function(id) {
    UI.loading(true);
    DB.getScript(id, function(s) {
      UI.loading(false);
      if (!s) return;

      Scripts._currentId = id;

      /* Thumbnail */
      document.getElementById('detailThumb').innerHTML = s.thumb
        ? '<img src="' + s.thumb + '" alt="thumb"/>'
        : '<div class="detail-thumb-empty">🗂</div>';

      /* Header info */
      document.getElementById('detailTag').textContent        = s.category;
      document.getElementById('detailTitle').textContent      = s.title;
      document.getElementById('detailDesc').textContent       = s.desc;
      document.getElementById('detailAuthorName').textContent = s.author;
      document.getElementById('detailDate').textContent       = Utils.timeAgo(s.createdAt);
      document.getElementById('detailAvatar').innerHTML       = s.authorAvatar
        ? '<img src="' + s.authorAvatar + '" alt="av"/>'
        : Utils.esc((s.author || '?')[0].toUpperCase());

      /* Scripts list */
      var scriptEl = document.getElementById('detailScripts');
      scriptEl.innerHTML = '';
      var scripts = s.scripts || [];
      for (var i = 0; i < scripts.length; i++) {
        scriptEl.appendChild(Scripts._buildScriptItem(scripts[i], i));
      }

      /* Admin button */
      var me = UI._currentUser;
      document.getElementById('adminActions').style.display =
        (me && me.isAdmin) ? 'block' : 'none';

      /* Comments */
      document.getElementById('commentInput').innerHTML = '';
      document.getElementById('commentList').innerHTML  = '';
      Comments.render(id);

      UI.switchTab('script');
      UI.openModal('modalDetail');
    });
  },

  _buildScriptItem: function(sc, idx) {
    var wrap = document.createElement('div');
    wrap.className = 'detail-script-item';

    var header = document.createElement('div');
    header.className = 'detail-script-header';

    var nameEl = document.createElement('span');
    nameEl.className = 'detail-script-name';
    nameEl.textContent = sc.name;

    var acts = document.createElement('div');
    acts.className = 'detail-script-actions';

    var copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '📋 Salin';
    var enc = Utils.b64e(sc.code);
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      Scripts._doCopy(enc, copyBtn);
    });

    var arr = document.createElement('span');
    arr.className = 'code-toggle';
    arr.id        = 'arr_' + idx;
    arr.textContent = '▾';

    acts.appendChild(copyBtn);
    acts.appendChild(arr);
    header.appendChild(document.createTextNode('📄 '));
    header.appendChild(nameEl);
    header.appendChild(acts);

    var codeWrap = document.createElement('div');
    codeWrap.className = 'code-wrap';
    codeWrap.id        = 'cw_' + idx;
    var pre = document.createElement('pre');
    pre.className   = 'code-block';
    pre.textContent = sc.code;
    codeWrap.appendChild(pre);

    header.addEventListener('click', function() {
      codeWrap.classList.toggle('open');
      arr.textContent = codeWrap.classList.contains('open') ? '▴' : '▾';
    });

    wrap.appendChild(header);
    wrap.appendChild(codeWrap);
    return wrap;
  },

  upload: function() {
    UI.hideAlert('errUpload');
    var me = UI._currentUser;
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

    /* Kumpulkan semua script item */
    var container = document.getElementById('scriptItems');
    var items     = container.querySelectorAll('.script-item');
    var scripts   = [];

    for (var i = 0; i < items.length; i++) {
      var nameEl = items[i].querySelector('[data-sname]');
      var codeEl = items[i].querySelector('[data-scode]');
      if (!nameEl || !codeEl) continue;
      var name = nameEl.value.trim();
      var code = codeEl.value.trim();
      if (!name && !code) continue;
      if (!name) { UI.showAlert('errUpload', 'Script #' + (i+1) + ': nama kosong!'); return; }
      if (!code) { UI.showAlert('errUpload', 'Script #' + (i+1) + ': kode kosong!');  return; }
      scripts.push({ name: name, code: code });
    }

    if (!scripts.length) {
      UI.showAlert('errUpload', 'Tambahkan minimal 1 script!'); return;
    }

    var scriptObj = {
      id:           Utils.uid(),
      title:        title,
      category:     cat,
      desc:         desc,
      thumb:        thumb,
      scripts:      scripts,
      author:       me.username,
      authorAvatar: me.avatar || '',
      createdAt:    firebase.firestore.Timestamp.now()
    };

    UI.loading(true);
    DB.saveScript(scriptObj, function(ok) {
      UI.loading(false);
      if (!ok) {
        UI.showAlert('errUpload', 'Gagal upload, coba lagi.'); return;
      }
      UI.closeModal('modalUpload');
      Scripts.render();
      UI.toast('Script berhasil dipublikasikan!');
    });
  },

  delete: function() {
    if (!confirm('Yakin ingin menghapus script ini?')) return;
    UI.loading(true);
    DB.deleteScript(Scripts._currentId, function() {
      UI.loading(false);
      UI.closeModal('modalDetail');
      Scripts.render();
      UI.toast('Script dihapus.');
    });
  }
};

/* ─────────────────────────────────────────────────────────
   COMMENTS  —  Komentar & Balasan (online Firestore)
───────────────────────────────────────────────────────── */
var Comments = {

  render: function(scriptId) {
    var me   = UI._currentUser;
    var wrap = document.getElementById('commentInput');

    /* Input box */
    if (!wrap.hasChildNodes()) {
      if (me) {
        var avH = me.avatar
          ? '<img src="' + me.avatar + '" alt="av"/>'
          : Utils.esc(me.username[0].toUpperCase());

        var box = document.createElement('div');
        box.className = 'comment-input-box';
        box.innerHTML =
          '<div class="comment-input-header">' +
            '<div class="comment-avatar">' + avH + '</div>' +
            '<span class="comment-username">' + Utils.esc(me.username) + '</span>' +
            (me.isAdmin ? '<span class="dev-badge">Developer</span>' : '') +
          '</div>' +
          '<textarea class="comment-textarea" id="cmtTextarea" rows="3" placeholder="Tulis komentar..."></textarea>' +
          '<div class="comment-submit-row">' +
            '<button class="btn-send" id="cmtSendBtn">Kirim →</button>' +
          '</div>';
        wrap.appendChild(box);

        document.getElementById('cmtSendBtn').addEventListener('click', function() {
          Comments.post(scriptId);
        });
      } else {
        var prompt = document.createElement('div');
        prompt.className = 'login-prompt';
        prompt.innerHTML =
          '<p>Kamu harus login untuk berkomentar</p>' +
          '<button class="btn btn-primary">Login Sekarang</button>';
        prompt.querySelector('button').addEventListener('click', function() {
          UI.closeModal('modalDetail');
          UI.openAuth('login');
        });
        wrap.appendChild(prompt);
      }
    }

    Comments.refreshList(scriptId);
  },

  refreshList: function(scriptId) {
    var listEl = document.getElementById('commentList');
    listEl.innerHTML = '<p style="color:var(--gray);font-size:11px;padding:8px 0">Memuat komentar...</p>';

    DB.getComments(scriptId, function(list) {
      listEl.innerHTML = '';

      /* Update badge */
      var total = list.reduce(function(a, c) {
        return a + 1 + (c.replies ? c.replies.length : 0);
      }, 0);
      var badge = document.getElementById('detailCmtCount');
      if (badge) badge.textContent = total;

      if (!list.length) {
        listEl.innerHTML = '<div class="no-comments">Belum ada komentar — jadilah yang pertama!</div>';
        return;
      }

      for (var i = 0; i < list.length; i++) {
        listEl.appendChild(Comments._buildEl(list[i], scriptId));
      }
    });
  },

  _buildEl: function(c, scriptId) {
    var cu    = null; /* tidak fetch user per komentar — pakai data yang tersimpan */
    var isAdm = (c.author === ADMIN_USER);
    var me    = UI._currentUser;

    var avH = c.authorAvatar
      ? '<img src="' + c.authorAvatar + '" alt="av"/>'
      : Utils.esc((c.author || '?')[0].toUpperCase());

    var item = document.createElement('div');
    item.className = 'comment-item';

    /* Replies HTML */
    var reps     = c.replies || [];
    var repsHtml = '';
    for (var j = 0; j < reps.length; j++) {
      var r    = reps[j];
      var rAdm = (r.author === ADMIN_USER);
      var rAv  = r.authorAvatar
        ? '<img src="' + r.authorAvatar + '" alt="av"/>'
        : Utils.esc((r.author || '?')[0].toUpperCase());
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
      '<div class="comment-header">' +
        '<div class="comment-avatar">' + avH + '</div>' +
        '<span class="comment-name">' + Utils.esc(c.author) + '</span>' +
        (isAdm ? '<span class="comment-role">Developer</span>' : '') +
        '<span class="comment-time">' + Utils.timeAgo(c.createdAt) + '</span>' +
      '</div>' +
      '<div class="comment-body">' + Utils.esc(c.body) + '</div>' +
      '<div class="comment-actions">' +
        (me ? '<button class="btn-reply">↩ Balas</button>' : '') +
      '</div>' +
      (repsHtml ? '<div class="replies">' + repsHtml + '</div>' : '') +
      '<div class="reply-input-wrap" id="riw_' + c.id + '"></div>';

    /* Event listener reply button — IIFE untuk capture c.id */
    if (me) {
      var replyBtn = item.querySelector('.btn-reply');
      (function(cmtId) {
        replyBtn.addEventListener('click', function() {
          Comments.toggleReply(cmtId, scriptId);
        });
      })(c.id);
    }

    return item;
  },

  post: function(scriptId) {
    var me = UI._currentUser; if (!me) return;
    var ta = document.getElementById('cmtTextarea'); if (!ta) return;
    var body = ta.value.trim(); if (!body) return;

    var cmt = {
      id:           Utils.uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body:         body,
      replies:      [],
      createdAt:    firebase.firestore.Timestamp.now()
    };

    DB.addComment(scriptId, cmt, function(ok) {
      if (!ok) { UI.toast('Gagal kirim komentar.'); return; }
      ta.value = '';
      Comments.refreshList(scriptId);
    });
  },

  toggleReply: function(cmtId, scriptId) {
    var wrap = document.getElementById('riw_' + cmtId);
    if (!wrap) return;
    if (wrap.hasChildNodes()) { wrap.innerHTML = ''; return; }

    var me = UI._currentUser; if (!me) return;

    var div = document.createElement('div');
    div.style.paddingTop = '10px';

    var ta = document.createElement('textarea');
    ta.className   = 'comment-textarea';
    ta.rows        = 2;
    ta.placeholder = 'Tulis balasan...';

    var row = document.createElement('div');
    row.className        = 'comment-submit-row';
    row.style.gap        = '8px';
    row.style.display    = 'flex';
    row.style.justifyContent = 'flex-end';
    row.style.marginTop  = '8px';

    var btnCancel = document.createElement('button');
    btnCancel.className   = 'btn-cancel-reply';
    btnCancel.textContent = 'Batal';
    btnCancel.addEventListener('click', function() { wrap.innerHTML = ''; });

    var btnSend = document.createElement('button');
    btnSend.className   = 'btn-send';
    btnSend.textContent = 'Kirim →';
    btnSend.addEventListener('click', function() {
      var body = ta.value.trim();
      if (!body) return;
      Comments.postReply(cmtId, scriptId, body);
    });

    row.appendChild(btnCancel);
    row.appendChild(btnSend);
    div.appendChild(ta);
    div.appendChild(row);
    wrap.appendChild(div);
  },

  postReply: function(cmtId, scriptId, body) {
    var me = UI._currentUser; if (!me) return;
    var reply = {
      id:           Utils.uid(),
      author:       me.username,
      authorAvatar: me.avatar || '',
      body:         body,
      createdAt:    firebase.firestore.Timestamp.now()
    };
    DB.addReply(scriptId, cmtId, reply, function(ok) {
      if (!ok) { UI.toast('Gagal kirim balasan.'); return; }
      Comments.refreshList(scriptId);
    });
  }
};

/* ─────────────────────────────────────────────────────────
   INIT  —  Jalankan saat halaman siap
───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {

  /* 1. Init Firebase */
  _initFirebase().then(function() {

    /* 2. Tema */
    UI.applyStoredTheme();

    /* 3. Cek session — ambil data user dari Firestore */
    var savedUsername = Session.get();
    if (savedUsername) {
      DB.getUser(savedUsername, function(user) {
        if (user) {
          UI.updateNav(user);
        } else {
          /* User tidak ada di DB — hapus session */
          Session.clear();
          UI.updateNav(null);
        }
        Scripts.render();
        UI.updateStats();
      });
    } else {
      UI.updateNav(null);
      Scripts.render();
      UI.updateStats();
    }

    /* 4. Seed admin */
    DB.seedAdmin();

  });

});
