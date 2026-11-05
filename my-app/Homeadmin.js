// ─────────────────────────────────────────────
//  WellBuddy Admin · app.js
//  สร้าง UI ทั้งหมดด้วย JavaScript
// ─────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js';
import { getStorage, ref as sRef, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js';

// ── Firebase ──────────────────────────────────
const app  = initializeApp({ apiKey:'AIzaSyCFo4mdckNuOeQld6kw38v9R9OTrtS0paY', authDomain:'wellbuddy-3ad83.firebaseapp.com', projectId:'wellbuddy-3ad83', storageBucket:'wellbuddy-3ad83.firebasestorage.app', messagingSenderId:'305933833057', appId:'1:305933833057:web:8e9b06f2a071c24a7aeb20' });
const db   = getFirestore(app);
const st   = getStorage(app);
const auth = getAuth(app);

// ── State ─────────────────────────────────────
let menus = [], filterCat = null, editId = null;
let imgs = [], vid = null, gc = 0, rc = 0;

// ── Helpers ───────────────────────────────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const el  = id => document.getElementById(id);

function make(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  });
  children.flat().forEach(c => {
    if (c == null) return;
    e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  });
  return e;
}

// ── CSS ───────────────────────────────────────
function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    :root{--g:#6FB84C;--gd:#4C9A2A;--gg:rgba(111,184,76,.18);--bg:#0D1117;--s1:#161B22;--s2:#1F2937;--s3:#273040;--bd:#2D3748;--tx:#F0F6FF;--ts:#9AA3C4;--tm:#4A5568;--er:#FC4C4C}
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--tx);min-height:100vh}
    ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--s1)}::-webkit-scrollbar-thumb{background:var(--bd);border-radius:3px}
    input,textarea,select,button{font-family:'Inter',sans-serif}
    .fi{width:100%;background:var(--s2);border:1.5px solid var(--bd);border-radius:10px;padding:10px 14px;color:var(--tx);font-size:13px;outline:none;transition:border-color .2s}
    .fi:focus{border-color:var(--g)}.fi::placeholder{color:var(--tm)}
    textarea.fi{resize:vertical;min-height:70px}select.fi{cursor:pointer}select.fi option{background:var(--s2)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 18px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .2s}
    .btn:disabled{opacity:.5;cursor:not-allowed}
    .bp{background:linear-gradient(135deg,var(--g),var(--gd));color:#fff;box-shadow:0 4px 16px var(--gg)}.bp:hover:not(:disabled){transform:translateY(-1px)}
    .bs{background:var(--s2);color:var(--tx);border:1px solid var(--bd)}.bs:hover{background:var(--s3)}
    .bd_{background:rgba(252,76,76,.12);color:var(--er);border:1px solid rgba(252,76,76,.2)}.bd_:hover{background:rgba(252,76,76,.2)}
    .bg_{background:transparent;color:var(--ts);border:1px solid var(--bd)}.bg_:hover{background:var(--s2)}
    .bsm{padding:7px 12px;font-size:11px;border-radius:8px}
    .card{background:var(--s1);border:1px solid var(--bd);border-radius:18px;overflow:hidden;margin-bottom:16px}
    .card-head{display:flex;align-items:center;gap:12px;padding:18px 22px;border-bottom:1px solid var(--bd)}
    .card-icon{width:34px;height:34px;border-radius:9px;background:var(--gg);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
    .card-title{font-size:14px;font-weight:700}.card-sub{font-size:11px;color:var(--ts);margin-top:1px}
    .card-body{padding:22px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
    .span2{grid-column:span 2}
    .fl{font-size:11px;font-weight:600;color:var(--ts);display:block;margin-bottom:5px;letter-spacing:.04em}
    .fg{margin-bottom:14px}
    .divider{height:1px;background:var(--bd);margin:16px 0}
    .badge{display:inline-flex;align-items:center;justify-content:center;background:var(--g);color:#fff;font-size:9px;font-weight:700;min-width:17px;height:17px;border-radius:9px;padding:0 4px}
    .spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
    @keyframes spin{to{transform:rotate(360deg)}}
    .toast{position:fixed;bottom:20px;right:20px;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;display:none;align-items:center;gap:8px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.4);animation:si .3s ease}
    .toast.success{background:#1A2E1A;border:1px solid rgba(111,184,76,.3);color:var(--g)}
    .toast.error{background:#2E1A1A;border:1px solid rgba(252,76,76,.3);color:var(--er)}
    @keyframes si{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
    .uz{border:2px dashed var(--bd);border-radius:14px;padding:28px;text-align:center;cursor:pointer;transition:all .2s;position:relative;overflow:hidden}
    .uz:hover,.uz.drag-over{border-color:var(--g);background:var(--gg)}
    .uz input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer}
    .upb{height:5px;background:var(--s3);border-radius:3px;overflow:hidden;margin-top:8px}
    .upf{height:100%;background:linear-gradient(90deg,var(--g),#8FD16B);border-radius:3px;width:0%;transition:width .3s}
    .ipi{position:relative;width:90px;height:90px;border-radius:10px;overflow:hidden;border:1px solid var(--bd)}
    .ipi img{width:100%;height:100%;object-fit:cover}
    .ipr{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(252,76,76,.9);border:none;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .ig{background:var(--s2);border:1px solid var(--bd);border-radius:14px;overflow:hidden;margin-bottom:14px}
    .ig-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bd);background:rgba(255,255,255,.02)}
    .gti{background:transparent;border:none;outline:none;color:var(--g);font-size:13px;font-weight:700;flex:1}
    .ig-body{padding:12px 16px}
    .ir{display:grid;grid-template-columns:1.5fr 1fr .8fr .8fr 30px;gap:7px;align-items:center;margin-bottom:7px}
    .ir .fi{padding:7px 10px;font-size:12px;border-radius:7px}
    .er_{display:grid;grid-template-columns:1fr 2fr 30px;gap:7px;align-items:center;margin-bottom:7px}
    .mr{display:grid;grid-template-columns:26px 1fr auto 30px;gap:7px;align-items:flex-start;margin-bottom:9px}
    .sn{width:26px;height:26px;border-radius:50%;background:var(--gg);border:1px solid rgba(111,184,76,.3);color:var(--g);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:7px;flex-shrink:0}
    .rb{width:28px;height:28px;border-radius:7px;background:rgba(252,76,76,.1);border:1px solid rgba(252,76,76,.2);color:var(--er);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
    .rb:hover{background:rgba(252,76,76,.2)}
    .arb{display:flex;align-items:center;gap:5px;font-size:11px;font-weight:600;color:var(--g);cursor:pointer;background:none;border:none;padding:5px 0;margin-top:3px}
    .sab{width:100%;padding:12px;border:2px dashed var(--bd);border-radius:10px;background:transparent;color:var(--ts);font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;margin-top:10px}
    .sab:hover{border-color:var(--g);color:var(--g);background:var(--gg)}
    .mt_{padding:5px 9px;border-radius:7px;font-size:10px;font-weight:600;border:1px solid var(--bd);cursor:pointer;background:var(--gg);border-color:rgba(111,184,76,.3);color:var(--g);margin-top:7px;white-space:nowrap}
    .mt_.mu{background:rgba(156,163,175,.15);color:#9CA3AF;border-color:var(--bd)}
    .fa{display:flex;gap:10px;justify-content:flex-end;padding:18px 22px;border-top:1px solid var(--bd);background:var(--s1);position:sticky;bottom:0;z-index:50;border-radius:0 0 18px 18px}
    .nb{background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.2);border-radius:9px;padding:10px 14px;font-size:11px;color:#F5A623;margin-bottom:16px}
    .nb code{background:rgba(245,166,35,.12);padding:1px 5px;border-radius:3px}
    table{width:100%;border-collapse:collapse}
    thead th{padding:10px 14px;font-size:10px;font-weight:700;color:var(--tm);letter-spacing:.06em;text-transform:uppercase;text-align:left;background:rgba(255,255,255,.02);border-bottom:1px solid var(--bd)}
    tbody tr:hover{background:rgba(255,255,255,.02)}
    tbody td{padding:12px 14px;font-size:12px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
    .cb{display:inline-flex;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700}
    .ca{background:rgba(111,184,76,.15);color:var(--g)}.ck{background:rgba(59,130,246,.15);color:#60A5FA}.cs{background:rgba(245,166,35,.15);color:#F5A623}.csa{background:rgba(236,72,153,.15);color:#F472B6}
    .mthumb{width:36px;height:36px;border-radius:9px;object-fit:cover;border:1px solid var(--bd)}
    .mtp{width:36px;height:36px;border-radius:9px;background:var(--s2);border:1px solid var(--bd);display:flex;align-items:center;justify-content:center;font-size:16px}
    .ni{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:500;color:var(--ts);transition:all .15s;margin-bottom:2px;user-select:none}
    .ni:hover{background:var(--s2);color:var(--tx)}.ni.active{background:var(--gg);color:var(--g);font-weight:600}
    @media(max-width:860px){.sb{display:none!important}.mc{margin-left:0!important}.grid2,.grid4{grid-template-columns:1fr}.span2{grid-column:span 1}.ir{grid-template-columns:1fr 1fr}.mr{grid-template-columns:26px 1fr 30px}}
  `;
  document.head.appendChild(style);
}

// ── Toast ─────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  let t = el('_toast');
  if (!t) { t = make('div', { id: '_toast', class: 'toast' }); document.body.appendChild(t); }
  t.textContent = (type === 'success' ? '✅ ' : '❌ ') + msg;
  t.className = `toast ${type}`; t.style.display = 'flex';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.display = 'none', 3500);
}

// ── Build Login ───────────────────────────────
function buildLogin() {
  const page = make('div', { id: '_lp', style: { display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'radial-gradient(ellipse 60% 50% at 20% 60%,rgba(111,184,76,.12),transparent 70%)' } },
    make('div', { style: { background:'var(--s1)', border:'1px solid var(--bd)', borderRadius:'22px', padding:'44px 38px 38px', width:'100%', maxWidth:'400px', boxShadow:'0 24px 60px rgba(0,0,0,.4)' } },
      make('div', { style: { display:'flex', alignItems:'center', gap:'10px', marginBottom:'28px' } },
        make('div', { style: { width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,var(--g),var(--gd))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px' } }, '🥗'),
        make('span', { style: { fontSize:'18px', fontWeight:'800' } }, 'Well', make('span', { style:{ color:'var(--g)' } }, 'Buddy')),
        make('span', { style: { fontSize:'9px', fontWeight:'700', background:'var(--gg)', color:'var(--g)', border:'1px solid rgba(111,184,76,.3)', borderRadius:'4px', padding:'1px 5px' } }, 'ADMIN')
      ),
      make('h1', { style:{ fontSize:'24px', fontWeight:'800', marginBottom:'5px' } }, 'ยินดีต้อนรับ'),
      make('p',  { style:{ fontSize:'13px', color:'var(--ts)', marginBottom:'24px' } }, 'เข้าสู่ระบบจัดการเมนูอาหาร'),
      make('div', { id:'_lerr', style:{ background:'rgba(252,76,76,.1)', border:'1px solid rgba(252,76,76,.25)', borderRadius:'9px', padding:'9px 13px', fontSize:'12px', color:'var(--er)', marginBottom:'14px', display:'none' } }),
      fieldRow('อีเมล', make('input', { id:'_em', type:'email', class:'fi', placeholder:'admin@example.com' })),
      fieldRow('รหัสผ่าน', make('input', { id:'_pw', type:'password', class:'fi', placeholder:'••••••••' })),
      make('button', { id:'_lbtn', class:'btn bp', style:{ width:'100%', padding:'13px', marginTop:'6px' } }, make('span', { id:'_ltxt' }, 'เข้าสู่ระบบ'))
    )
  );
  document.body.appendChild(page);

  el('_lbtn').onclick = doLogin;
  el('_pw').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
}

function fieldRow(label, input) {
  return make('div', { class:'fg' },
    make('label', { class:'fl' }, label),
    input
  );
}

async function doLogin() {
  const email = el('_em').value.trim(), pw = el('_pw').value;
  const errEl = el('_lerr'), btn = el('_lbtn'), txt = el('_ltxt');
  errEl.style.display = 'none'; btn.disabled = true;
  txt.innerHTML = '<span class="spinner"></span>';
  try { await signInWithEmailAndPassword(auth, email, pw); }
  catch { errEl.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'; errEl.style.display = 'block'; btn.disabled = false; txt.textContent = 'เข้าสู่ระบบ'; }
}

// ── Build App Shell ───────────────────────────
function buildApp() {
  const appEl = make('div', { id:'_app', style:{ display:'none', minHeight:'100vh' } },
    buildSidebar(),
    make('main', { id:'_mc', style:{ marginLeft:'250px', minHeight:'100vh', padding:'28px 32px' } },
      buildListPage(),
      buildFormPage()
    )
  );
  document.body.appendChild(appEl);
}

function buildSidebar() {
  const navItems = [
    { id:'_nl', icon:'🍽️', label:'เมนูทั้งหมด', onclick: () => showPage('list'), badge: true },
    { id:'_nf', icon:'➕', label:'เพิ่มเมนูใหม่', onclick: () => { showPage('form'); resetForm(); } },
  ];
  const catItems = [
    { icon:'🍛', label:'อาหาร', onclick: () => doFilter('อาหาร') },
    { icon:'🧃', label:'เครื่องดื่ม', onclick: () => doFilter('เครื่องดื่ม') },
    { icon:'🍿', label:'Snacks', onclick: () => doFilter('Snacks') },
    { icon:'🫙', label:'Sauce', onclick: () => doFilter('Sauce') },
    { icon:'📋', label:'ทั้งหมด', onclick: () => doFilter(null) },
  ];

  return make('aside', { style:{ width:'250px', background:'var(--s1)', borderRight:'1px solid var(--bd)', position:'fixed', top:0, left:0, bottom:0, display:'flex', flexDirection:'column', overflowY:'auto', zIndex:100 } },
    make('div', { style:{ display:'flex', alignItems:'center', gap:'9px', padding:'22px 18px 18px', borderBottom:'1px solid var(--bd)' } },
      make('div', { style:{ width:'32px', height:'32px', borderRadius:'9px', background:'linear-gradient(135deg,var(--g),var(--gd))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' } }, '🥗'),
      make('span', { style:{ fontSize:'15px', fontWeight:'800' } }, 'Well', make('span', { style:{ color:'var(--g)' } }, 'Buddy')),
      make('span', { style:{ fontSize:'9px', fontWeight:'700', background:'var(--gg)', color:'var(--g)', border:'1px solid rgba(111,184,76,.3)', borderRadius:'4px', padding:'1px 5px' } }, 'ADMIN')
    ),
    make('nav', { style:{ padding:'14px 10px', flex:1 } },
      navLabel('หน้าหลัก'),
      ...navItems.map(item => {
        const children = [make('span', {}, item.icon), make('span', {}, item.label)];
        if (item.badge) children.push(make('span', { id:'_mcb', class:'badge', style:{ marginLeft:'auto' } }, '0'));
        const n = make('div', { id: item.id, class:'ni', onclick: item.onclick }, ...children);
        return n;
      }),
      make('div', { style:{ height:'1px', background:'var(--bd)', margin:'10px 0' } }),
      navLabel('กรองหมวดหมู่'),
      ...catItems.map(item => make('div', { class:'ni', onclick: item.onclick }, make('span', {}, item.icon), make('span', {}, item.label)))
    ),
    make('div', { style:{ padding:'14px', borderTop:'1px solid var(--bd)' } },
      make('div', { style:{ display:'flex', alignItems:'center', gap:'9px', padding:'9px 11px', background:'var(--s2)', borderRadius:'11px', marginBottom:'9px' } },
        make('div', { id:'_uav', style:{ width:'30px', height:'30px', borderRadius:'50%', background:'linear-gradient(135deg,var(--g),var(--gd))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:'700', color:'#fff', flexShrink:0 } }, 'A'),
        make('div', { id:'_uem', style:{ fontSize:'11px', color:'var(--ts)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' } }, '...')
      ),
      make('button', { class:'btn bg_ bsm', style:{ width:'100%' }, onclick: () => signOut(auth) }, '🚪 ออกจากระบบ')
    )
  );
}

function navLabel(txt) {
  return make('div', { style:{ fontSize:'9px', fontWeight:'700', color:'var(--tm)', letterSpacing:'.08em', textTransform:'uppercase', padding:'7px 8px 5px' } }, txt);
}

// ── List Page ─────────────────────────────────
function buildListPage() {
  return make('div', { id:'_pl', style:{ display:'none' } },
    make('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' } },
      make('div', {},
        make('h1', { style:{ fontSize:'20px', fontWeight:'800' } }, 'เมนูอาหารทั้งหมด'),
        make('p',  { id:'_fl', style:{ fontSize:'13px', color:'var(--ts)', marginTop:'2px' } }, 'แสดงทุกหมวดหมู่')
      ),
      make('button', { class:'btn bp', style:{ width:'auto' }, onclick: () => { showPage('form'); resetForm(); } }, '➕ เพิ่มเมนูใหม่')
    ),
    make('div', { style:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'24px' } },
      statCard('🍽️ ทั้งหมด', '_st0', true),
      statCard('🍛 อาหาร', '_st1'),
      statCard('🧃 เครื่องดื่ม', '_st2'),
      statCard('🍿 Snacks & Sauce', '_st3')
    ),
    make('div', { class:'card' },
      make('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px', borderBottom:'1px solid var(--bd)' } },
        make('span', { style:{ fontSize:'15px', fontWeight:'700' } }, 'รายการเมนู'),
        make('button', { class:'btn bs bsm', onclick: loadMenus }, '🔄 รีเฟรช')
      ),
      make('div', { id:'_mlb' },
        make('div', { style:{ padding:'50px', textAlign:'center' } }, make('div', { class:'spinner', style:{ margin:'0 auto 12px' } }), make('p', {}, 'กำลังโหลด...'))
      )
    )
  );
}

function statCard(label, id, green = false) {
  return make('div', { class:'card', style:{ margin:0, padding:'18px' } },
    make('div', { style:{ fontSize:'11px', color:'var(--ts)', fontWeight:'600', marginBottom:'7px' } }, label),
    make('div', { id, style:{ fontSize:'26px', fontWeight:'800', color: green ? 'var(--g)' : 'var(--tx)' } }, '0')
  );
}

// ── Form Page ─────────────────────────────────
function buildFormPage() {
  return make('div', { id:'_pf', style:{ display:'none' } },
    make('div', { style:{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px' } },
      make('div', {},
        make('h1', { id:'_fpt', style:{ fontSize:'20px', fontWeight:'800' } }, '➕ เพิ่มเมนูใหม่'),
        make('p',  { style:{ fontSize:'13px', color:'var(--ts)', marginTop:'2px' } }, 'กรอกข้อมูลครบแล้วกด "บันทึก"')
      ),
      make('button', { class:'btn bg_ bsm', onclick: () => showPage('list') }, '← กลับ')
    ),
    make('div', { class:'nb' }, '⚠️ ตรวจสอบว่า Firestore Rules ของ ', make('code', {}, 'menus'), ' อนุญาต write สำหรับ user ที่ login'),
    buildBasicCard(),
    buildImageCard(),
    buildVideoCard(),
    buildIngredientCard(),
    buildEquipmentCard(),
    buildManualCard(),
    make('div', { class:'fa' },
      make('button', { class:'btn bg_', onclick: () => showPage('list') }, 'ยกเลิก'),
      make('button', { id:'_svb', class:'btn bp', style:{ width:'auto', minWidth:'150px' }, onclick: saveMenu },
        make('span', { id:'_svt' }, '💾 บันทึกเมนู')
      )
    )
  );
}

function formCard(icon, title, sub, ...body) {
  return make('div', { class:'card' },
    make('div', { class:'card-head' },
      make('div', { class:'card-icon' }, icon),
      make('div', {}, make('div', { class:'card-title' }, title), make('div', { class:'card-sub' }, sub))
    ),
    make('div', { class:'card-body' }, ...body)
  );
}

function inp(id, type = 'text', placeholder = '', extra = {}) {
  return make('input', { id, type, class:'fi', placeholder, ...extra });
}

function sel(id, options) {
  return make('select', { id, class:'fi' },
    ...options.map(([v, l]) => make('option', { value: v }, l))
  );
}

function buildBasicCard() {
  return formCard('📝', 'ข้อมูลพื้นฐาน', 'ชื่อ หมวดหมู่ โภชนาการ',
    make('div', { class:'grid2' },
      make('div', { class:'fg span2' },
        make('label', { class:'fl' }, 'ชื่อเมนู *'),
        inp('_fn', 'text', 'เช่น Stuffed Eggplants with Salad'),
        make('div', { style:{ fontSize:'10px', color:'var(--tm)', marginTop:'3px' } }, 'ใส่ \\n ถ้าต้องการขึ้นบรรทัดใหม่ในแอป')
      ),
      make('div', { class:'fg' }, make('label', { class:'fl' }, 'subtitle'), inp('_fsub', 'text', 'เช่น Classic Japanese recipe')),
      make('div', { class:'fg' }, make('label', { class:'fl' }, 'หมวดหมู่ *'), sel('_fcat', [['อาหาร','🍛 อาหาร'],['เครื่องดื่ม','🧃 เครื่องดื่ม'],['Snacks','🍿 Snacks'],['Sauce','🫙 Sauce']])),
      make('div', { class:'fg' }, make('label', { class:'fl' }, 'ความยาก'), sel('_fdif', [['ทำง่าย','ทำง่าย'],['ปานกลาง','ปานกลาง'],['ทำยาก','ทำยาก']])),
      make('div', { class:'fg' }, make('label', { class:'fl' }, 'เวลาทำ'), inp('_ftm', 'text', '40 min'))
    ),
    make('div', { class:'divider' }),
    make('div', { class:'grid4' },
      make('div', { class:'fg' }, make('label', { class:'fl' }, '🔥 kcal'), inp('_fk', 'number', '384')),
      make('div', { class:'fg' }, make('label', { class:'fl' }, '💪 โปรตีน(g)'), inp('_fp', 'number', '18')),
      make('div', { class:'fg' }, make('label', { class:'fl' }, '🌾 คาร์บ(g)'), inp('_fc_', 'number', '45')),
      make('div', { class:'fg' }, make('label', { class:'fl' }, '🫒 ไขมัน(g)'), inp('_ff', 'number', '12'))
    ),
    make('div', { class:'fg', style:{ maxWidth:'180px' } }, make('label', { class:'fl' }, 'จำนวนเสิร์ฟ'), inp('_fsv', 'number', '2', { value:'2', min:'1' }))
  );
}

function buildImageCard() {
  const zone = make('div', { id:'_idz', class:'uz' },
    make('input', { type:'file', id:'_ii', accept:'image/*', multiple:'true' }),
    make('div', { style:{ fontSize:'32px', marginBottom:'8px' } }, '📷'),
    make('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'3px' } }, 'คลิกหรือลากรูปมาวาง'),
    make('div', { style:{ fontSize:'11px', color:'var(--ts)' } }, 'PNG, JPG, WEBP ไม่เกิน 10MB')
  );

  const progWrap = make('div', { id:'_iup', style:{ display:'none', marginTop:'10px' } },
    make('div', { style:{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--ts)', marginBottom:'5px' } },
      make('span', { id:'_ipn' }, 'กำลังอัปโหลด...'),
      make('span', { id:'_ipp' }, '0%')
    ),
    make('div', { class:'upb' }, make('div', { id:'_ipf', class:'upf' }))
  );

  return formCard('🖼️', 'รูปภาพเมนู', 'อัปโหลดได้หลายรูป (สไลด์โชว์ในแอป)',
    zone, progWrap,
    make('div', { id:'_iprev', style:{ display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'14px' } }),
    make('div', { style:{ fontSize:'11px', color:'var(--tm)', marginTop:'10px' } },
      'อัปโหลดแล้ว: ', make('span', { id:'_ic', style:{ color:'var(--g)', fontWeight:'700' } }, '0'), ' รูป'
    )
  );
}

function buildVideoCard() {
  const zone = make('div', { id:'_vdz', class:'uz' },
    make('input', { type:'file', id:'_vi', accept:'video/*' }),
    make('div', { style:{ fontSize:'32px', marginBottom:'8px' } }, '🎥'),
    make('div', { style:{ fontSize:'13px', fontWeight:'600', marginBottom:'3px' } }, 'คลิกหรือลากวิดีโอมาวาง'),
    make('div', { style:{ fontSize:'11px', color:'var(--ts)' } }, 'MP4, MOV, WebM ไม่เกิน 200MB')
  );

  const progWrap = make('div', { id:'_vup', style:{ display:'none', marginTop:'10px' } },
    make('div', { style:{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--ts)', marginBottom:'5px' } },
      make('span', {}, 'กำลังอัปโหลดวิดีโอ...'), make('span', { id:'_vpp' }, '0%')
    ),
    make('div', { class:'upb' }, make('div', { id:'_vpf', class:'upf' }))
  );

  const preview = make('div', { id:'_vpc', style:{ display:'none', marginTop:'12px' } },
    make('div', { style:{ display:'flex', alignItems:'center', gap:'8px', background:'var(--s2)', border:'1px solid var(--bd)', borderRadius:'9px', padding:'9px 13px', fontSize:'11px', color:'var(--ts)', wordBreak:'break-all', marginBottom:'10px' } },
      make('span', {}, '✅'), make('span', { id:'_vut' })
    ),
    make('div', { style:{ borderRadius:'10px', overflow:'hidden', background:'var(--s2)', border:'1px solid var(--bd)' } },
      make('video', { id:'_vp', controls:'true', style:{ width:'100%', maxHeight:'180px', display:'block' } })
    ),
    make('button', { class:'btn bd_ bsm', style:{ marginTop:'10px' }, id:'_rvb' }, '🗑️ ลบวิดีโอ')
  );

  return formCard('🎬', 'วิดีโอวิธีทำ', 'อัปโหลด 1 คลิป (MP4, MOV, WebM)', zone, progWrap, preview);
}

function buildIngredientCard() {
  return formCard('🥦', 'วัตถุดิบ', 'แบ่งเป็นกลุ่ม เพิ่มได้หลายกลุ่ม',
    make('div', { style:{ display:'grid', gridTemplateColumns:'1.5fr 1fr .8fr .8fr 30px', gap:'7px', paddingBottom:'8px', borderBottom:'1px solid var(--bd)', marginBottom:'10px' } },
      ...['ชื่อวัตถุดิบ','ปริมาณ','kcal','โปรตีน',''].map(t => make('span', { style:{ fontSize:'10px', fontWeight:'700', color:'var(--tm)' } }, t))
    ),
    make('div', { id:'_igc' }),
    make('button', { class:'sab', id:'_agb' }, '➕ เพิ่มกลุ่มวัตถุดิบ')
  );
}

function buildEquipmentCard() {
  return formCard('🔪', 'อุปกรณ์', 'Equipment สำหรับทำเมนูนี้',
    make('div', { style:{ display:'grid', gridTemplateColumns:'1fr 2fr 30px', gap:'7px', paddingBottom:'8px', borderBottom:'1px solid var(--bd)', marginBottom:'10px' } },
      ...['ไอคอน (Ionicons)','รายการ',''].map(t => make('span', { style:{ fontSize:'10px', fontWeight:'700', color:'var(--tm)' } }, t))
    ),
    make('div', { id:'_eqc' }),
    make('button', { class:'arb', id:'_aeb' }, '➕ เพิ่มอุปกรณ์')
  );
}

function buildManualCard() {
  return formCard('📋', 'วิธีทำ (Manual)', '"หรี่" = แสดงสีเทาในแอป',
    make('div', { id:'_mc_' }),
    make('button', { class:'arb', id:'_asb' }, '➕ เพิ่มขั้นตอน')
  );
}

// ── Page Nav ──────────────────────────────────
function showPage(p) {
  el('_pl').style.display = p === 'list' ? 'block' : 'none';
  el('_pf').style.display = p === 'form' ? 'block' : 'none';
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('active'));
  if (p === 'list') el('_nl')?.classList.add('active');
  if (p === 'form') el('_nf')?.classList.add('active');
}

// ── Load Menus ────────────────────────────────
async function loadMenus() {
  el('_mlb').innerHTML = '<div style="padding:50px;text-align:center"><div class="spinner" style="margin:0 auto 12px"></div><p>กำลังโหลด...</p></div>';
  try {
    const q = query(collection(db, 'menus'), orderBy('createdAt', 'desc'));
    menus = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    try { menus = (await getDocs(collection(db, 'menus'))).docs.map(d => ({ id: d.id, ...d.data() })); }
    catch (e) { toast('โหลดไม่สำเร็จ: ' + e.message, 'error'); menus = []; }
  }
  updateStats(); renderTable();
}

function updateStats() {
  el('_st0').textContent = menus.length;
  el('_st1').textContent = menus.filter(m => m.category === 'อาหาร').length;
  el('_st2').textContent = menus.filter(m => m.category === 'เครื่องดื่ม').length;
  el('_st3').textContent = menus.filter(m => m.category === 'Snacks' || m.category === 'Sauce').length;
  el('_mcb').textContent = menus.length;
}

function doFilter(c) { filterCat = c; el('_fl').textContent = c ? `กรอง: ${c}` : 'แสดงทุกหมวดหมู่'; showPage('list'); renderTable(); }

function catClass(c) { return c === 'อาหาร' ? 'ca' : c === 'เครื่องดื่ม' ? 'ck' : c === 'Snacks' ? 'cs' : 'csa'; }

function renderTable() {
  const list = filterCat ? menus.filter(m => m.category === filterCat) : menus;
  if (!list.length) {
    el('_mlb').innerHTML = '<div style="padding:50px;text-align:center"><div style="font-size:40px;margin-bottom:12px">🍽️</div><div style="font-size:16px;font-weight:700;margin-bottom:5px">ยังไม่มีเมนู</div><div style="font-size:13px;color:var(--ts)">กด "เพิ่มเมนูใหม่" เพื่อเริ่มต้น</div></div>';
    return;
  }
  const tbody = make('tbody', {},
    ...list.map(m => make('tr', {},
      make('td', {}, m.images?.[0] ? make('img', { class:'mthumb', src: esc(m.images[0]) }) : make('div', { class:'mtp' }, '🍽️')),
      make('td', {},
        make('div', { style:{ fontWeight:'600' } }, esc((m.name || '').replace(/\\n/g, ' '))),
        make('div', { style:{ fontSize:'11px', color:'var(--tm)' } }, esc(m.subtitle || ''))
      ),
      make('td', {}, make('span', { class:`cb ${catClass(m.category)}` }, esc(m.category) || '-')),
      make('td', {}, `${m.kcal || '-'} kcal`),
      make('td', {}, `${m.protein || '-'}g`),
      make('td', {}, m.videoUrl ? '✅' : '—'),
      make('td', {}, `${(m.images || []).length} รูป`),
      make('td', {},
        make('div', { style:{ display:'flex', gap:'7px' } },
          make('button', { class:'btn bs bsm', onclick: () => editMenu(m.id) }, '✏️ แก้ไข'),
          make('button', { class:'btn bd_ bsm', onclick: () => delMenu(m.id, m.name || '') }, '🗑️')
        )
      )
    ))
  );
  el('_mlb').innerHTML = '';
  el('_mlb').appendChild(make('table', {},
    make('thead', {}, make('tr', {},
      ...['', 'ชื่อเมนู', 'หมวดหมู่', 'kcal', 'โปรตีน', 'วิดีโอ', 'รูป', ''].map(t => make('th', {}, t))
    )),
    tbody
  ));
}

// ── Delete ────────────────────────────────────
async function delMenu(id, name) {
  if (!confirm(`ลบเมนู "${name}" ใช่ไหม?`)) return;
  try { await deleteDoc(doc(db, 'menus', id)); toast('ลบสำเร็จ'); loadMenus(); }
  catch (e) { toast('ลบไม่สำเร็จ: ' + e.message, 'error'); }
}

// ── Edit ──────────────────────────────────────
function editMenu(id) {
  const m = menus.find(x => x.id === id); if (!m) return;
  editId = id; el('_fpt').textContent = '✏️ แก้ไขเมนู';
  showPage('form'); fillForm(m);
}

function fillForm(m) {
  resetForm(false);
  el('_fn').value = m.name || ''; el('_fsub').value = m.subtitle || '';
  el('_fcat').value = m.category || 'อาหาร'; el('_fdif').value = m.difficulty || 'ทำง่าย';
  el('_ftm').value = m.time || ''; el('_fk').value = m.kcal || '';
  el('_fp').value = m.protein || ''; el('_fc_').value = m.carb || '';
  el('_ff').value = m.fat || ''; el('_fsv').value = m.baseServings || 2;
  imgs = [...(m.images || [])]; renderPrev();
  if (m.videoUrl) { vid = m.videoUrl; showVidPreview(m.videoUrl); }
  (m.ingredientGroups?.length ? m.ingredientGroups : [null]).forEach(g => g ? addGroup(g.title, g.items) : addGroup());
  (m.equipment?.length ? m.equipment : [null]).forEach(e => e ? addEq(e.icon, e.text) : addEq());
  (m.manual?.length ? m.manual : [null]).forEach(s => s ? addStep(s.text, s.muted) : addStep());
}

// ── Reset Form ────────────────────────────────
function resetForm(clearId = true) {
  if (clearId) { editId = null; el('_fpt').textContent = '➕ เพิ่มเมนูใหม่'; }
  ['_fn','_fsub','_ftm','_fk','_fp','_fc_','_ff'].forEach(id => el(id).value = '');
  el('_fcat').value = 'อาหาร'; el('_fdif').value = 'ทำง่าย'; el('_fsv').value = 2;
  imgs = []; renderPrev(); vid = null;
  el('_vpc').style.display = 'none'; el('_vup').style.display = 'none'; el('_vi').value = '';
  el('_igc').innerHTML = ''; el('_eqc').innerHTML = ''; el('_mc_').innerHTML = '';
  gc = 0; rc = 0; addGroup(); addEq(); addStep();
}

// ── Images ────────────────────────────────────
async function handleImgs(files) { for (const f of files) if (f.type.startsWith('image/')) await uploadImg(f); }

async function uploadImg(f) {
  el('_iup').style.display = 'block'; el('_ipn').textContent = 'กำลังอัปโหลด: ' + f.name;
  const task = uploadBytesResumable(sRef(st, `menu-images/${Date.now()}-${f.name}`), f);
  return new Promise((res, rej) => task.on('state_changed',
    sn => { const p = Math.round(sn.bytesTransferred / sn.totalBytes * 100); el('_ipf').style.width = p + '%'; el('_ipp').textContent = p + '%'; },
    e => { toast('อัปโหลดรูปไม่สำเร็จ: ' + e.message, 'error'); el('_iup').style.display = 'none'; rej(e); },
    async () => { imgs.push(await getDownloadURL(task.snapshot.ref)); renderPrev(); el('_iup').style.display = 'none'; toast('อัปโหลดรูปสำเร็จ ✨'); res(); }
  ));
}

function renderPrev() {
  el('_ic').textContent = imgs.length;
  el('_iprev').innerHTML = '';
  imgs.forEach((u, i) => {
    const div = make('div', { class:'ipi' },
      make('img', { src: esc(u) }),
      make('button', { class:'ipr', onclick: () => { imgs.splice(i, 1); renderPrev(); } }, '×')
    );
    el('_iprev').appendChild(div);
  });
}

// ── Video ─────────────────────────────────────
function uploadVid(f) {
  el('_vup').style.display = 'block';
  const task = uploadBytesResumable(sRef(st, `menu-videos/${Date.now()}-${f.name}`), f);
  task.on('state_changed',
    sn => { const p = Math.round(sn.bytesTransferred / sn.totalBytes * 100); el('_vpf').style.width = p + '%'; el('_vpp').textContent = p + '%'; },
    e => { toast('อัปโหลดวิดีโอไม่สำเร็จ: ' + e.message, 'error'); el('_vup').style.display = 'none'; },
    async () => { vid = await getDownloadURL(task.snapshot.ref); el('_vup').style.display = 'none'; showVidPreview(vid); toast('อัปโหลดวิดีโอสำเร็จ 🎬'); }
  );
}

function showVidPreview(u) { el('_vpc').style.display = 'block'; el('_vut').textContent = u; el('_vp').src = u; }

// ── Ingredient Groups ─────────────────────────
const ICONS = ['grid-outline','reader-outline','flame-outline','restaurant-outline','cut-outline','cafe-outline','beaker-outline'];

function addGroup(title = '', items = []) {
  const id = ++gc;
  const rowsEl = make('div', { id: `_gr${id}` });
  const group = make('div', { class:'ig' },
    make('div', { class:'ig-head' },
      make('input', { type:'text', class:'gti', placeholder:'ชื่อกลุ่ม เช่น For the eggplant', value: esc(title) }),
      make('button', { class:'btn bd_ bsm', onclick: () => group.remove() }, '🗑️ ลบกลุ่ม')
    ),
    make('div', { class:'ig-body' },
      rowsEl,
      make('button', { class:'arb', onclick: () => addRow(id) }, '➕ เพิ่มวัตถุดิบ')
    )
  );
  el('_igc').appendChild(group);
  (items.length ? items : [null]).forEach(it => it ? addRow(id, it.name, it.amount, it.kcal, it.protein) : addRow(id));
}

function addRow(gid, name = '', amt = '', kcal = '', prot = '') {
  const rid = ++rc, c = el(`_gr${gid}`); if (!c) return;
  const row = make('div', { class:'ir', id:`_r${rid}` },
    make('input', { type:'text', class:'fi', placeholder:'ชื่อวัตถุดิบ', value: esc(name) }),
    make('input', { type:'text', class:'fi', placeholder:'ปริมาณ', value: esc(amt) }),
    make('input', { type:'number', class:'fi', placeholder:'kcal', value: esc(kcal), min:'0' }),
    make('input', { type:'number', class:'fi', placeholder:'โปรตีน', value: esc(prot), min:'0' }),
    make('button', { class:'rb', onclick: () => row.remove() }, '−')
  );
  c.appendChild(row);
}

function collectGroups() {
  return [...document.querySelectorAll('.ig')].map((g, gi) => ({
    title: g.querySelector('.gti')?.value.trim() || `กลุ่ม ${gi+1}`,
    items: [...g.querySelectorAll('.ir')].map((r, ii) => {
      const ins = r.querySelectorAll('input'), name = ins[0]?.value.trim(); if (!name) return null;
      const it = { id:`${gi}-${ii}`, name, amount: ins[1]?.value.trim()||'', status:'add' };
      const k = parseFloat(ins[2]?.value), pr = parseFloat(ins[3]?.value);
      if (!isNaN(k)) it.kcal = k; if (!isNaN(pr)) it.protein = pr; return it;
    }).filter(Boolean)
  }));
}

// ── Equipment ─────────────────────────────────
function addEq(icon = 'grid-outline', text = '') {
  const rid = ++rc;
  const row = make('div', { class:'er_', id:`_eq${rid}` },
    make('select', { class:'fi', style:{ padding:'7px 10px', fontSize:'12px', borderRadius:'7px' } },
      ...ICONS.map(ic => { const o = make('option', { value:ic }, ic); if (ic === icon) o.selected = true; return o; })
    ),
    make('input', { type:'text', class:'fi', placeholder:'เช่น stove, knife, cutting board', value: esc(text), style:{ padding:'7px 10px', fontSize:'12px', borderRadius:'7px' } }),
    make('button', { class:'rb', onclick: () => row.remove() }, '−')
  );
  el('_eqc').appendChild(row);
}

function collectEq() {
  return [...document.querySelectorAll('.er_')].map((r, i) => ({
    id: `e${i}`, icon: r.querySelector('select')?.value || 'grid-outline', text: r.querySelector('input')?.value.trim() || ''
  })).filter(e => e.text);
}

// ── Manual ────────────────────────────────────
function addStep(text = '', muted = false) {
  const rid = ++rc, w = el('_mc_'), n = w.querySelectorAll('.mr').length + 1;
  const numEl = make('div', { class:'sn' }, String(n));
  const mutBtn = make('button', { class:`mt_ ${muted ? 'mu' : ''}` }, muted ? 'หรี่' : 'ปกติ');
  mutBtn.onclick = () => { const m = mutBtn.classList.toggle('mu'); mutBtn.textContent = m ? 'หรี่' : 'ปกติ'; };
  const row = make('div', { class:'mr', id:`_st${rid}` },
    numEl,
    make('textarea', { class:'fi', rows:'2', placeholder:`ขั้นตอนที่ ${n}...` }, text),
    mutBtn,
    make('button', { class:'rb', onclick: () => { row.remove(); document.querySelectorAll('.mr').forEach((r, i) => { const s = r.querySelector('.sn'); if (s) s.textContent = i + 1; }); } }, '−')
  );
  w.appendChild(row);
}

function collectManual() {
  return [...document.querySelectorAll('.mr')].map((r, i) => {
    const text = r.querySelector('textarea')?.value.trim(); if (!text) return null;
    return { id:`m${i}`, text, muted: r.querySelector('.mt_')?.classList.contains('mu') || false };
  }).filter(Boolean);
}

// ── Save ──────────────────────────────────────
async function saveMenu() {
  const name = el('_fn').value.trim(); if (!name) { toast('กรุณาใส่ชื่อเมนู', 'error'); return; }
  const b = el('_svb'), t = el('_svt'); b.disabled = true; t.innerHTML = '<span class="spinner"></span> กำลังบันทึก...';
  const data = { name, subtitle: el('_fsub').value.trim(), category: el('_fcat').value, difficulty: el('_fdif').value, time: el('_ftm').value.trim(), kcal: parseFloat(el('_fk').value)||0, protein: parseFloat(el('_fp').value)||0, carb: parseFloat(el('_fc_').value)||0, fat: parseFloat(el('_ff').value)||0, baseServings: parseInt(el('_fsv').value)||2, images:[...imgs], videoUrl: vid||null, ingredientGroups: collectGroups(), equipment: collectEq(), manual: collectManual(), updatedAt: serverTimestamp() };
  try {
    if (editId) { await updateDoc(doc(db,'menus',editId), data); toast('แก้ไขสำเร็จ 🎉'); }
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'menus'), data); toast('เพิ่มเมนูสำเร็จ 🎉'); }
    await loadMenus(); showPage('list'); resetForm();
  } catch(e) { toast('บันทึกไม่สำเร็จ: ' + e.message, 'error'); }
  finally { b.disabled = false; t.textContent = '💾 บันทึกเมนู'; }
}

// ── Auth Listener ─────────────────────────────
function init() {
  injectCSS();
  buildLogin();
  buildApp();
  bindEvents();

  onAuthStateChanged(auth, u => {
    if (u) {
      el('_lp').style.display  = 'none';
      el('_app').style.display = 'block';
      el('_uem').textContent   = u.email;
      el('_uav').textContent   = (u.email || 'A')[0].toUpperCase();
      showPage('list'); loadMenus();
    } else {
      el('_lp').style.display  = 'flex';
      el('_app').style.display = 'none';
    }
  });
}

function bindEvents() {
  el('_ii').onchange  = e => handleImgs(e.target.files);
  el('_vi').onchange  = e => { const f = e.target.files[0]; if (f) uploadVid(f); };
  el('_rvb').onclick  = () => { vid = null; el('_vpc').style.display='none'; el('_vi').value=''; };
  el('_agb').onclick  = () => addGroup();
  el('_aeb').onclick  = () => addEq();
  el('_asb').onclick  = () => addStep();

  // drag & drop images
  const idz = el('_idz');
  idz.addEventListener('dragover', e => { e.preventDefault(); idz.classList.add('drag-over'); });
  idz.addEventListener('dragleave', () => idz.classList.remove('drag-over'));
  idz.addEventListener('drop', e => { e.preventDefault(); idz.classList.remove('drag-over'); handleImgs(e.dataTransfer.files); });

  // drag & drop video
  const vdz = el('_vdz');
  vdz.addEventListener('dragover', e => { e.preventDefault(); vdz.classList.add('drag-over'); });
  vdz.addEventListener('dragleave', () => vdz.classList.remove('drag-over'));
  vdz.addEventListener('drop', e => { e.preventDefault(); vdz.classList.remove('drag-over'); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) uploadVid(f); });
}

// ── Start ─────────────────────────────────────
init();