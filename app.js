// ══════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════
const ADMIN_USER = 'DinoIjoNPC';
const ADMIN_PASS = 'GABRIEL@12345';

// ══════════════════════════════════════════
//  STORAGE
// ══════════════════════════════════════════
function lsGet(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function lsSet(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
function lsDel(k){ localStorage.removeItem(k); }

const DB = {
  users:    { get: ()=> lsGet('sv_users')    || [], save: v=> lsSet('sv_users', v) },
  scripts:  { get: ()=> lsGet('sv_scripts')  || [], save: v=> lsSet('sv_scripts', v) },
  comments: { get: ()=> lsGet('sv_comments') || {}, save: v=> lsSet('sv_comments', v) },
  reports:  { get: ()=> lsGet('sv_reports')  || [], save: v=> lsSet('sv_reports', v) },
  theme:    { get: ()=> lsGet('sv_theme')    || 'dark', save: v=> lsSet('sv_theme', v) },
  me: {
    get:   ()  => lsGet('sv_me'),
    set:   v   => lsSet('sv_me', v),
    del:   ()  => lsDel('sv_me'),
    fresh: function(){
      const me = this.get();
      if(!me) return null;
      const u = DB.users.get().find(x => x.username === me.username);
      if(u){ this.set(u); return u; }
      return me;
    }
  }
};

// ══════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════
let currentScriptId = null;
let siCount = 0;

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function stripSpace(inp){ inp.value = inp.value.replace(/\s/g,''); }
function b64e(s){ try{ return btoa(unescape(encodeURIComponent(s))); }catch(e){ return ''; } }
function b64d(s){ try{ return decodeURIComponent(escape(atob(s))); }catch(e){ return ''; } }

function timeAgo(iso){
  const d = Date.now() - new Date(iso);
  const m = Math.floor(d/60000);
  if(m<1) return 'baru saja';
  if(m<60) return m+' mnt lalu';
  const h = Math.floor(m/60);
  if(h<24) return h+' jam lalu';
  const dy = Math.floor(h/24);
  if(dy<30) return dy+' hari lalu';
  return new Date(iso).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
}

// ══════════════════════════════════════════
//  INIT — FIX: seedAdmin TIDAK overwrite data yang sudah ada
// ══════════════════════════════════════════
function seedAdmin(){
  const users = DB.users.get();
  // Hanya tambah kalau belum ada — TIDAK pernah overwrite
  if(!users.find(u => u.username === ADMIN_USER)){
    users.unshift({ username:ADMIN_USER, password:ADMIN_PASS, isAdmin:true, avatar:'', createdAt:new Date().toISOString() });
    DB.users.save(users);
  }
  // Pastikan isAdmin selalu benar (tapi JANGAN ganti password/avatar)
  const all = DB.users.get();
  const idx = all.findIndex(u => u.username === ADMIN_USER);
  if(idx !== -1 && !all[idx].isAdmin){
    all[idx].isAdmin = true;
    DB.users.save(all);
  }
  // Sync session kalau admin sedang login
  const me = DB.me.get();
  if(me && me.username === ADMIN_USER){
    const fresh = DB.users.get().find(u => u.username === ADMIN_USER);
    if(fresh) DB.me.set(fresh);
  }
}

window.onload = function(){
  seedAdmin();
  applyTheme(DB.theme.get());
  renderNav();
  renderScripts();
  renderStats();
  addSitem();
};

// ══════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════
function setTheme(t){ DB.theme.save(t); applyTheme(t); syncThemeUI(t); }
function applyTheme(t){ document.documentElement.setAttribute('data-theme',t); }
function syncThemeUI(t){
  document.getElementById('optDark').classList.toggle('active', t==='dark');
  document.getElementById('optLight').classList.toggle('active', t==='light');
}
function openSettings(){ syncThemeUI(DB.theme.get()); document.getElementById('settingsOverlay').classList.remove('hidden'); }

// ══════════════════════════════════════════
//  NAV
// ══════════════════════════════════════════
function renderNav(){
  const u = DB.me.fresh();
  document.getElementById('navGuest').style.display = u ? 'none' : 'flex';
  document.getElementById('navUser').style.display  = u ? 'flex' : 'none';
  if(u){
    document.getElementById('navUname').textContent = u.username;
    document.getElementById('navBadge').style.display        = u.isAdmin ? 'inline-block' : 'none';
    document.getElementById('adminUpWrap').style.display     = u.isAdmin ? 'block' : 'none';
    document.getElementById('adminReportWrap').style.display = u.isAdmin ? 'block' : 'none';
    const av = document.getElementById('navAv');
    av.innerHTML = u.avatar ? '<img src="'+u.avatar+'"/>' : esc(u.username[0].toUpperCase());
  }
}

function toggleDrop(){ document.getElementById('drop').classList.toggle('open'); }
document.addEventListener('click', function(e){
  if(!e.target.closest('.nav-profile')) document.getElementById('drop').classList.remove('open');
});
function doLogout(){ DB.me.del(); renderNav(); renderScripts(); showToast('Sampai jumpa!'); }

// ══════════════════════════════════════════
//  MODAL HELPERS
// ══════════════════════════════════════════
function openModal(id){ document.getElementById(id).classList.remove('hidden'); }
function closeModal(id){ document.getElementById(id).classList.add('hidden'); }
function bgClose(e,id){ if(e.target===document.getElementById(id)) closeModal(id); }
function clrAlerts(){ document.querySelectorAll('.alert').forEach(function(el){ el.classList.remove('show'); el.textContent=''; }); }
function showAlert(id,msg,isOk){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg;
  el.className = 'alert ' + (isOk ? 'alert-ok' : 'alert-err') + ' show';
}

// ══════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════
function openAuth(pane){
  clrAlerts();
  document.getElementById('paneLogin').style.display    = pane==='login'    ? 'block' : 'none';
  document.getElementById('paneRegister').style.display = pane==='register' ? 'block' : 'none';
  openModal('authOverlay');
}

function submitLogin(e){
  e.preventDefault();
  const un = document.getElementById('fLoginUser').value.trim();
  const pw = document.getElementById('fLoginPass').value; // jangan trim password
  if(!un || !pw) return showAlert('errLogin','Isi semua field!');
  const users = DB.users.get();
  const found = users.find(function(x){ return x.username.toLowerCase() === un.toLowerCase(); });
  if(!found) return showAlert('errLogin','Username tidak ditemukan.');
  if(found.password !== pw) return showAlert('errLogin','Password salah.');
  DB.me.set(found);
  closeModal('authOverlay');
  renderNav();
  renderScripts();
  showToast('Selamat datang, ' + found.username + '!');
}

function submitRegister(e){
  e.preventDefault();
  const un  = document.getElementById('fRegUser').value.replace(/\s/g,'');
  const pw  = document.getElementById('fRegPass').value;
  const pw2 = document.getElementById('fRegPass2').value;
  const av  = document.getElementById('regAvData').value;
  if(!un||!pw||!pw2)   return showAlert('errReg','Isi semua field!');
  if(un.length < 3)    return showAlert('errReg','Username minimal 3 karakter.');
  if(pw.length < 6)    return showAlert('errReg','Password minimal 6 karakter.');
  if(pw !== pw2)       return showAlert('errReg','Password tidak cocok!');
  const users = DB.users.get();
  if(users.find(function(x){ return x.username.toLowerCase() === un.toLowerCase(); }))
    return showAlert('errReg','Username sudah dipakai!');
  const newU = { username:un, password:pw, isAdmin:false, avatar:av, createdAt:new Date().toISOString() };
  users.push(newU);
  DB.users.save(users);
  DB.me.set(newU);
  closeModal('authOverlay');
  renderNav(); renderScripts(); renderStats();
  showToast('Akun berhasil dibuat! Selamat datang, ' + un + '!');
}

// ══════════════════════════════════════════
//  PHOTO LOADERS — FIX: pakai background-image CSS, bukan insertBefore
// ══════════════════════════════════════════
function loadAvatar(input, prevId, dataId){
  const f = input.files[0]; if(!f) return;
  if(f.size > 2*1024*1024){ alert('Foto terlalu besar! Maks 2MB.'); return; }
  const r = new FileReader();
  r.onload = function(ev){
    document.getElementById(prevId).innerHTML = '<img src="'+ev.target.result+'"/>';
    document.getElementById(dataId).value = ev.target.result;
  };
  r.readAsDataURL(f);
}

function loadThumb(input){
  const f = input.files[0]; if(!f) return;
  if(f.size > 5*1024*1024){ alert('Foto terlalu besar! Maks 5MB.'); return; }
  const r = new FileReader();
  r.onload = function(ev){
    const area = document.getElementById('thumbArea');
    // FIX: background-image, tidak ada insertBefore yang bisa crash
    area.style.backgroundImage = 'url("'+ev.target.result.replace(/"/g,'\\"')+'")';
    area.style.backgroundSize = 'cover';
    area.style.backgroundPosition = 'center';
    document.getElementById('thumbPh').style.display = 'none';
    document.getElementById('thumbData').value = ev.target.result;
  };
  r.readAsDataURL(f);
}

function loadReportPhoto(input){
  const f = input.files[0]; if(!f) return;
  if(f.size > 5*1024*1024){ alert('Foto terlalu besar! Maks 5MB.'); return; }
  const r = new FileReader();
  r.onload = function(ev){
    const area = document.getElementById('reportPhotoArea');
    // FIX: background-image
    area.style.backgroundImage = 'url("'+ev.target.result.replace(/"/g,'\\"')+'")';
    area.style.backgroundSize = 'cover';
    area.style.backgroundPosition = 'center';
    document.getElementById('reportPhotoPh').style.display = 'none';
    document.getElementById('reportPhotoData').value = ev.target.result;
  };
  r.readAsDataURL(f);
}

// ══════════════════════════════════════════
//  EDIT PROFILE — FIX: tidak overwrite admin saat refresh
// ══════════════════════════════════════════
function openEditProfile(){
  document.getElementById('drop').classList.remove('open');
  const u = DB.me.fresh(); if(!u) return;
  document.getElementById('editAvPrev').innerHTML = u.avatar ? '<img src="'+u.avatar+'"/>' : '👤';
  document.getElementById('editAvData').value = u.avatar||'';
  document.getElementById('editUser').value = '';
  document.getElementById('editPass').value = '';
  clrAlerts();
  openModal('editOverlay');
}

function doEditProfile(){
  const u = DB.me.fresh(); if(!u) return;
  const av    = document.getElementById('editAvData').value;
  const newUn = document.getElementById('editUser').value.replace(/\s/g,'').trim();
  const newPw = document.getElementById('editPass').value;
  if(newUn){
    if(newUn.length < 3) return showAlert('errEdit','Username minimal 3 karakter.');
    const taken = DB.users.get().find(function(x){
      return x.username.toLowerCase()===newUn.toLowerCase() && x.username!==u.username;
    });
    if(taken) return showAlert('errEdit','Username sudah dipakai!');
  }
  if(newPw && newPw.length < 6) return showAlert('errEdit','Password minimal 6 karakter.');
  const users = DB.users.get();
  const idx = users.findIndex(function(x){ return x.username === u.username; });
  if(idx === -1) return;
  const oldUn = users[idx].username;
  if(av)    users[idx].avatar   = av;
  if(newPw) users[idx].password = newPw;
  if(newUn && newUn !== oldUn){
    const cmts = DB.comments.get();
    Object.values(cmts).forEach(function(list){
      list.forEach(function(c){
        if(c.author===oldUn) c.author=newUn;
        (c.replies||[]).forEach(function(r){ if(r.author===oldUn) r.author=newUn; });
      });
    });
    DB.comments.save(cmts);
    const scripts = DB.scripts.get();
    scripts.forEach(function(s){ if(s.author===oldUn) s.author=newUn; });
    DB.scripts.save(scripts);
    users[idx].username = newUn;
  }
  DB.users.save(users);
  DB.me.set(users[idx]);
  renderNav();
  renderScripts();
  showAlert('okEdit','Profil berhasil diperbarui!', true);
  setTimeout(function(){ closeModal('editOverlay'); }, 1200);
}

// ══════════════════════════════════════════
//  UPLOAD
// ══════════════════════════════════════════
function openUpload(){
  clrAlerts();
  document.getElementById('upTitle').value = '';
  document.getElementById('upDesc').value  = '';
  document.getElementById('thumbData').value = '';
  const area = document.getElementById('thumbArea');
  area.style.backgroundImage = '';
  document.getElementById('thumbPh').style.display = 'flex';
  document.getElementById('scriptsList').innerHTML = '';
  siCount = 0; addSitem();
  openModal('uploadOverlay');
}

function addSitem(){
  siCount++;
  const id = 'sitem_'+siCount;
  const el = document.createElement('div');
  el.className = 'sitem'; el.id = id;
  el.innerHTML =
    '<div class="sitem-head">'+
      '<span class="sitem-num">Script #'+siCount+'</span>'+
      '<button type="button" class="sitem-del" onclick="document.getElementById(\''+id+'\').remove()">✕</button>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:10px">'+
      '<label class="fl">Nama Script</label>'+
      '<input class="fi" type="text" placeholder="Contoh: Auto Farm v2" data-sname/>'+
    '</div>'+
    '<div class="fg" style="margin-bottom:0">'+
      '<label class="fl">Kode Script</label>'+
      '<textarea class="fi" rows="5" placeholder="-- Paste kode di sini..." data-scode></textarea>'+
    '</div>';
  document.getElementById('scriptsList').appendChild(el);
}

function doUpload(){
  const u = DB.me.fresh();
  if(!u||!u.isAdmin) return showAlert('errUpload','Akses ditolak!');
  const title = document.getElementById('upTitle').value.trim();
  const cat   = document.getElementById('upCat').value;
  const desc  = document.getElementById('upDesc').value.trim();
  const thumb = document.getElementById('thumbData').value;
  if(!title||!desc) return showAlert('errUpload','Judul dan deskripsi wajib diisi!');
  const items = document.querySelectorAll('.sitem');
  const scripts = [];
  for(let i=0;i<items.length;i++){
    const name = items[i].querySelector('[data-sname]').value.trim();
    const code = items[i].querySelector('[data-scode]').value.trim();
    if(!name||!code) return showAlert('errUpload','Isi nama dan kode untuk setiap script!');
    scripts.push({name:name,code:code});
  }
  if(!scripts.length) return showAlert('errUpload','Tambahkan minimal 1 script!');
  const all = DB.scripts.get();
  all.unshift({ id:uid(), title:title, category:cat, desc:desc, thumb:thumb, scripts:scripts,
    author:u.username, authorAvatar:u.avatar||'', createdAt:new Date().toISOString() });
  DB.scripts.save(all);
  closeModal('uploadOverlay');
  renderScripts(); renderStats();
  showToast('Script berhasil dipublikasikan!');
}

// ══════════════════════════════════════════
//  RENDER SCRIPTS
// ══════════════════════════════════════════
function renderScripts(){
  const q   = document.getElementById('searchInput').value.toLowerCase();
  const cat = document.getElementById('filterCat').value;
  let data  = DB.scripts.get();
  if(q)   data = data.filter(function(s){ return s.title.toLowerCase().includes(q)||s.desc.toLowerCase().includes(q); });
  if(cat) data = data.filter(function(s){ return s.category===cat; });
  document.getElementById('secLabel').textContent = (q||cat) ? 'Hasil: '+data.length+' Script' : 'Semua Script';
  const grid = document.getElementById('grid');
  const cmts = DB.comments.get();
  if(!data.length){
    grid.innerHTML = '<div class="empty"><h3>KOSONG</h3><p>Belum ada script'+(q||cat?' yang cocok':'')+'</p></div>';
    return;
  }
  grid.innerHTML = data.map(function(s,i){
    const cc = (cmts[s.id]||[]).reduce(function(a,c){ return a+1+(c.replies?c.replies.length:0); },0);
    const thumbHtml = s.thumb
      ? '<img src="'+s.thumb+'" style="width:100%;height:100%;object-fit:cover"/>'
      : '<div class="card-thumb-ph">🗂</div>';
    const rows = (s.scripts||[]).map(function(sc){
      const enc = b64e(sc.code);
      return '<div class="card-srow" onclick="event.stopPropagation()">'+
        '<span class="card-sname">'+esc(sc.name)+'</span>'+
        '<button type="button" class="cpbtn" onclick="doCopy(event,\''+enc+'\',this)">📋 Salin</button>'+
        '</div>';
    }).join('');
    return '<div class="script-card" onclick="openDetail(\''+s.id+'\')" style="animation-delay:'+(i*.05)+'s">'+
      '<div class="card-thumb">'+thumbHtml+'</div>'+
      '<div class="card-body">'+
        '<div class="card-top">'+
          '<span class="card-tag">'+esc(s.category)+'</span>'+
          '<span class="card-count">'+((s.scripts||[]).length)+' script</span>'+
        '</div>'+
        '<div class="card-title">'+esc(s.title)+'</div>'+
        '<div class="card-desc">'+esc(s.desc)+'</div>'+
        '<div class="card-scripts">'+rows+'</div>'+
        '<div class="card-footer">'+
          '<div class="card-av">'+(s.authorAvatar?'<img src="'+s.authorAvatar+'"/>':esc(s.author[0].toUpperCase()))+'</div>'+
          '<span class="card-author">'+esc(s.author)+'</span>'+
          '<span class="card-cmts">💬 '+cc+'</span>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

// ══════════════════════════════════════════
//  COPY
// ══════════════════════════════════════════
function doCopy(e, b64, btn){
  e.stopPropagation();
  navigator.clipboard.writeText(b64d(b64)).then(function(){
    btn.textContent = '✓ Disalin'; btn.classList.add('copied');
    setTimeout(function(){ btn.innerHTML='📋 Salin'; btn.classList.remove('copied'); }, 2000);
  }).catch(function(){ showToast('Gagal menyalin.'); });
}

// ══════════════════════════════════════════
//  DETAIL
// ══════════════════════════════════════════
function openDetail(id){
  const s = DB.scripts.get().find(function(x){ return x.id===id; }); if(!s) return;
  currentScriptId = id;
  document.getElementById('detThumb').innerHTML = s.thumb
    ? '<img src="'+s.thumb+'"/>'
    : '<div class="detail-thumb-ph">🗂</div>';
  document.getElementById('dTag').textContent    = s.category;
  document.getElementById('dTitle').textContent  = s.title;
  document.getElementById('dDesc').textContent   = s.desc;
  document.getElementById('dAuthor').textContent = s.author;
  document.getElementById('dDate').textContent   = new Date(s.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  document.getElementById('dAv').innerHTML = s.authorAvatar ? '<img src="'+s.authorAvatar+'"/>' : esc(s.author[0].toUpperCase());
  document.getElementById('dScripts').innerHTML = (s.scripts||[]).map(function(sc,i){
    const enc = b64e(sc.code);
    return '<div class="det-sitem">'+
      '<div class="det-sitem-head" onclick="toggleCode(\'dcode_'+i+'\',\'darr_'+i+'\')">'+
        '<span>📄</span>'+
        '<span class="det-sname">'+esc(sc.name)+'</span>'+
        '<div class="det-acts">'+
          '<button type="button" class="cpbtn" onclick="doCopy(event,\''+enc+'\',this)">📋 Salin</button>'+
          '<span id="darr_'+i+'" style="color:var(--gray);font-size:12px">▾</span>'+
        '</div>'+
      '</div>'+
      '<div class="code-wrap" id="dcode_'+i+'">'+
        '<pre class="det-code">'+esc(sc.code)+'</pre>'+
      '</div>'+
    '</div>';
  }).join('');
  const u = DB.me.fresh();
  document.getElementById('adminActRow').style.display   = (u&&u.isAdmin) ? 'block' : 'none';
  document.getElementById('reportBtnWrap').style.display = u ? 'block' : 'none';
  // Reset & render comments
  document.getElementById('cmtInputWrap').innerHTML = '';
  document.getElementById('cmtList').innerHTML = '';
  renderComments(id);
  updateCmtBadge(id);
  switchTab('s');
  openModal('detailOverlay');
}

function toggleCode(id, arrId){
  const el = document.getElementById(id); el.classList.toggle('open');
  const arr = document.getElementById(arrId);
  if(arr) arr.textContent = el.classList.contains('open') ? '▴' : '▾';
}
function switchTab(t){
  document.getElementById('panelS').classList.toggle('active', t==='s');
  document.getElementById('panelC').classList.toggle('active', t==='c');
  document.getElementById('tabS').classList.toggle('active', t==='s');
  document.getElementById('tabC').classList.toggle('active', t==='c');
}
function doDeleteScript(){
  if(!confirm('Yakin hapus script ini?')) return;
  DB.scripts.save(DB.scripts.get().filter(function(s){ return s.id!==currentScriptId; }));
  closeModal('detailOverlay');
  renderScripts(); renderStats();
  showToast('Script dihapus.');
}

// ══════════════════════════════════════════
//  COMMENTS — FIX: input & list dipisah, tidak saling destroy
// ══════════════════════════════════════════
function renderComments(scriptId){
  const u    = DB.me.fresh();
  const wrap = document.getElementById('cmtInputWrap');

  // Render input hanya sekali (cek apakah sudah ada)
  if(!wrap.querySelector('.cmt-input-area,.login-prompt')){
    if(u){
      const avH = u.avatar ? '<img src="'+u.avatar+'"/>' : esc(u.username[0].toUpperCase());
      wrap.innerHTML =
        '<div class="cmt-input-area">'+
          '<div class="cmt-head">'+
            '<div class="cmt-av">'+avH+'</div>'+
            '<span class="cmt-who">'+esc(u.username)+'</span>'+
            (u.isAdmin ? '<span class="dev-badge">Developer</span>' : '')+
          '</div>'+
          '<textarea class="cmt-ta" id="mainCmtTA" rows="3" placeholder="Tulis komentar..."></textarea>'+
          '<div class="cmt-row">'+
            '<button type="button" class="cmt-send" onclick="postComment()">Kirim →</button>'+
          '</div>'+
        '</div>';
    } else {
      wrap.innerHTML =
        '<div class="login-prompt">'+
          '<p>Kamu harus login untuk berkomentar</p>'+
          '<button type="button" onclick="closeModal(\'detailOverlay\');openAuth(\'login\')">Login Sekarang</button>'+
        '</div>';
    }
  }
  renderCommentList(scriptId);
}

function renderCommentList(scriptId){
  const list   = DB.comments.get()[scriptId] || [];
  const listEl = document.getElementById('cmtList');
  if(!list.length){
    listEl.innerHTML = '<div class="no-cmts">Belum ada komentar — jadilah yang pertama!</div>';
    return;
  }
  listEl.innerHTML = list.map(function(c){ return buildComment(c, scriptId); }).join('');
}

function buildComment(c, scriptId){
  const users  = DB.users.get();
  const cu     = users.find(function(x){ return x.username===c.author; });
  const isAdm  = cu && cu.isAdmin === true;
  const avH    = c.authorAvatar ? '<img src="'+c.authorAvatar+'"/>' : esc(c.author[0].toUpperCase());
  const u      = DB.me.fresh();

  const repliesHtml = (c.replies||[]).map(function(r){
    const ru   = users.find(function(x){ return x.username===r.author; });
    const rAdm = ru && ru.isAdmin === true;
    const rAv  = r.authorAvatar ? '<img src="'+r.authorAvatar+'"/>' : esc(r.author[0].toUpperCase());
    return '<div class="reply-item">'+
      '<div class="cmt-header">'+
        '<div class="cmt-av" style="width:24px;height:24px;font-size:10px">'+rAv+'</div>'+
        '<span class="cmt-name">'+esc(r.author)+'</span>'+
        (rAdm ? '<span class="cmt-role">Developer</span>' : '')+
        '<span class="cmt-time">'+timeAgo(r.createdAt)+'</span>'+
      '</div>'+
      '<div class="cmt-body">'+esc(r.body)+'</div>'+
    '</div>';
  }).join('');

  // FIX: tombol reply pakai data-cid & data-sid untuk menghindari quote-escaping bug
  return '<div class="cmt-item" id="ci_'+c.id+'">'+
    '<div class="cmt-header">'+
      '<div class="cmt-av">'+avH+'</div>'+
      '<span class="cmt-name">'+esc(c.author)+'</span>'+
      (isAdm ? '<span class="cmt-role">Developer</span>' : '')+
      '<span class="cmt-time">'+timeAgo(c.createdAt)+'</span>'+
    '</div>'+
    '<div class="cmt-body">'+esc(c.body)+'</div>'+
    '<div class="cmt-actions">'+
      (u ? '<button type="button" class="cmt-reply-btn" data-cid="'+c.id+'" data-sid="'+scriptId+'" onclick="toggleReply(this)">↩ Balas</button>' : '')+
    '</div>'+
    ((c.replies||[]).length ? '<div class="replies">'+repliesHtml+'</div>' : '')+
    '<div class="reply-iw" id="ri_'+c.id+'"></div>'+
  '</div>';
}

// FIX: postComment tidak pakai parameter — baca currentScriptId langsung
function postComment(){
  const u = DB.me.fresh(); if(!u) return;
  const ta = document.getElementById('mainCmtTA'); if(!ta) return;
  const body = ta.value.trim(); if(!body) return;
  const scriptId = currentScriptId; if(!scriptId) return;
  const cmts = DB.comments.get();
  if(!cmts[scriptId]) cmts[scriptId] = [];
  cmts[scriptId].push({ id:uid(), author:u.username, authorAvatar:u.avatar||'', body:body, replies:[], createdAt:new Date().toISOString() });
  DB.comments.save(cmts);
  ta.value = '';
  // FIX: hanya refresh list, jangan destroy input utama
  renderCommentList(scriptId);
  updateCmtBadge(scriptId);
}

// FIX: toggleReply pakai button element, baca data-attr
function toggleReply(btn){
  const cmtId   = btn.dataset.cid;
  const scriptId = btn.dataset.sid;
  const wrap = document.getElementById('ri_'+cmtId);
  if(wrap.innerHTML.trim()){ wrap.innerHTML=''; return; }
  const u = DB.me.fresh(); if(!u) return;
  wrap.innerHTML =
    '<div style="padding-top:10px">'+
      '<textarea class="cmt-ta" id="rta_'+cmtId+'" rows="2" placeholder="Tulis balasan..."></textarea>'+
      '<div class="cmt-row" style="gap:8px;display:flex;justify-content:flex-end;margin-top:8px">'+
        '<button type="button" class="reply-cancel" onclick="document.getElementById(\'ri_'+cmtId+'\').innerHTML=\'\'">Batal</button>'+
        '<button type="button" class="cmt-send" data-cid="'+cmtId+'" data-sid="'+scriptId+'" onclick="postReply(this)">Kirim →</button>'+
      '</div>'+
    '</div>';
}

// FIX: postReply baca dari data-attr button
function postReply(btn){
  const cmtId    = btn.dataset.cid;
  const scriptId = btn.dataset.sid;
  const u = DB.me.fresh(); if(!u) return;
  const ta = document.getElementById('rta_'+cmtId); if(!ta) return;
  const body = ta.value.trim(); if(!body) return;
  const cmts = DB.comments.get();
  if(!cmts[scriptId]) cmts[scriptId] = [];
  const c = cmts[scriptId].find(function(x){ return x.id===cmtId; }); if(!c) return;
  if(!c.replies) c.replies = [];
  c.replies.push({ id:uid(), author:u.username, authorAvatar:u.avatar||'', body:body, createdAt:new Date().toISOString() });
  DB.comments.save(cmts);
  renderCommentList(scriptId);
  updateCmtBadge(scriptId);
}

function updateCmtBadge(scriptId){
  const total = (DB.comments.get()[scriptId]||[]).reduce(function(a,c){ return a+1+(c.replies?c.replies.length:0); },0);
  const el = document.getElementById('dCmtCount'); if(el) el.textContent = total;
}

// ══════════════════════════════════════════
//  LAPOR KESALAHAN — FIX: cek currentScriptId & user
// ══════════════════════════════════════════
function openReportModal(){
  clrAlerts();
  document.getElementById('reportMsg').value = '';
  document.getElementById('reportPhotoData').value = '';
  const area = document.getElementById('reportPhotoArea');
  area.style.backgroundImage = '';
  document.getElementById('reportPhotoPh').style.display = 'flex';
  openModal('reportOverlay');
}

function submitReport(){
  const u = DB.me.fresh();
  if(!u) return showAlert('errReport','Kamu harus login!');
  if(!currentScriptId) return showAlert('errReport','Error: buka ulang script lalu coba lagi.');
  const msg   = document.getElementById('reportMsg').value.trim();
  const photo = document.getElementById('reportPhotoData').value;
  if(!msg) return showAlert('errReport','Tulis keterangan kesalahan terlebih dahulu!');
  const reports = DB.reports.get();
  reports.unshift({
    id:uid(), scriptId:currentScriptId,
    author:u.username, authorAvatar:u.avatar||'',
    msg:msg, photo:photo,
    createdAt:new Date().toISOString()
  });
  DB.reports.save(reports);
  showAlert('okReport','Laporan berhasil dikirim! Terima kasih.', true);
  setTimeout(function(){ closeModal('reportOverlay'); }, 1400);
}

// ══════════════════════════════════════════
//  ADMIN: LAPORAN MASUK
// ══════════════════════════════════════════
function openReports(){
  const reports = DB.reports.get();
  const scripts = DB.scripts.get();
  const el = document.getElementById('reportsList');
  if(!reports.length){
    el.innerHTML = '<div class="no-reports">Belum ada laporan masuk.</div>';
  } else {
    el.innerHTML = reports.map(function(r){
      const s   = scripts.find(function(x){ return x.id===r.scriptId; });
      const avH = r.authorAvatar ? '<img src="'+r.authorAvatar+'"/>' : esc(r.author[0].toUpperCase());
      return '<div class="report-item">'+
        '<div class="report-item-head">'+
          '<div class="report-item-av">'+avH+'</div>'+
          '<span class="report-item-name">'+esc(r.author)+'</span>'+
          '<span class="report-item-time">'+timeAgo(r.createdAt)+'</span>'+
        '</div>'+
        (s ? '<div style="font-size:10px;color:var(--gray);margin-bottom:8px;letter-spacing:1px">📄 '+esc(s.title)+'</div>' : '')+
        '<div class="report-item-msg">'+esc(r.msg)+'</div>'+
        (r.photo ? '<img class="report-item-img" src="'+r.photo+'" alt="bukti"/>' : '')+
      '</div>';
    }).join('');
  }
  openModal('reportsOverlay');
}

// ══════════════════════════════════════════
//  STATS
// ══════════════════════════════════════════
function renderStats(){
  document.getElementById('stTotal').textContent   = DB.scripts.get().length;
  document.getElementById('stMembers').textContent = DB.users.get().length;
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
var toastT;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(function(){ t.classList.add('hidden'); }, 2800);
}
