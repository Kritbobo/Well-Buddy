// ══════════════════════════════════════════════════
//  WellBuddy Admin — Admin Chat Screen Logic
// ══════════════════════════════════════════════════

let chatSessions = [];
let userProfilesMap = {}; // { uid: { name, photoURL } }
let activeChatUserId = null;
let unsubActiveChatDoc = null;
let unsubAdminMessages = null;
let unsubBotMessages = null;

// ── Auth Guard & Admin Sync ──
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = 'Login.html';
    return;
  }
  const adminSnap = await db.collection('admin').doc(user.uid).get();
  if (!adminSnap.exists) {
    await auth.signOut();
    window.location.href = 'Login.html';
    return;
  }
  const adminData = adminSnap.data() || {};
  const customName = localStorage.getItem('admin_custom_name');
  const customPhoto = localStorage.getItem('admin_custom_photo');
  const adminNameEl = document.getElementById('adminName');
  const adminAvatarEl = document.getElementById('adminAvatar');
  if (adminNameEl) adminNameEl.textContent = customName || adminData.name || user.displayName || user.email || 'Admin';
  const avatarSrc = customPhoto || adminData.photoURL || user.photoURL;
  if (adminAvatarEl && avatarSrc) adminAvatarEl.src = avatarSrc;

  initApp();
});

async function initApp() {
  await preloadUserProfiles();
  listenToChats();

  const urlParams = new URLSearchParams(window.location.search);
  const paramUserId = urlParams.get('userId');
  if (paramUserId) {
    openChatRoom(paramUserId, urlParams.get('userName'));
  }
}

function getSafeAvatarUrl(url, seed) {
  if (!url || typeof url !== 'string' || url.startsWith('file://') || url.startsWith('content://')) {
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'user')}`;
  }
  return url;
}

async function preloadUserProfiles() {
  try {
    const usersSnap = await db.collection('users').get();
    usersSnap.forEach(doc => {
      const d = doc.data();
      userProfilesMap[doc.id] = {
        name: d.name || d.displayName || 'ผู้ใช้งาน',
        photoURL: getSafeAvatarUrl(d.photoURL || d.imageUri || d.avatar, d.name || doc.id)
      };
    });
  } catch(e) {
    console.warn('Preload user profiles:', e);
  }
}

// ── Listen to all chat sessions ──
function listenToChats() {
  db.collection('chats').orderBy('lastAt', 'desc').onSnapshot(snap => {
    chatSessions = snap.docs.map(doc => {
      const data = doc.data();
      const uid = doc.id;
      const prof = userProfilesMap[uid] || {};
      return {
        id: uid,
        userName: data.userName || prof.name || 'ผู้ใช้งาน',
        userAvatar: prof.photoURL || getSafeAvatarUrl(data.userAvatar, data.userName || uid),
        lastMessage: data.lastMessage || 'ไม่มีข้อความ',
        lastAt: data.lastAt,
        unreadAdmin: data.unreadAdmin || 0,
        ...data
      };
    });

    renderChatList();
  });
}

// ── Render View 1: Chat List ──
function renderChatList() {
  const listEl = document.getElementById('chatUserList');
  if (!listEl) return;
  if (chatSessions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-comments" style="font-size:36px;margin-bottom:12px;color:#cbd5e1;display:block;"></i>
        ยังไม่มีรายการแชทจากผู้ใช้งาน
      </div>
    `;
    return;
  }

  listEl.innerHTML = chatSessions.map(session => {
    const timeFormatted = formatTimeHHMM(session.lastAt);
    const avatarSrc = getSafeAvatarUrl(session.userAvatar, session.userName || session.id);
    const badgeHtml = session.unreadAdmin > 0
      ? `<div class="row-badge">${session.unreadAdmin}</div>`
      : '';

    return `
      <div class="chat-row" onclick="openChatRoom('${session.id}', '${escapeQuotes(session.userName)}')">
        <div class="row-avatar">
          <img src="${avatarSrc}" alt="${escapeHtml(session.userName)}" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${session.id}'" />
        </div>
        <div class="row-center">
          <div class="row-name">${escapeHtml(session.userName)}</div>
          <div class="row-last-msg">${escapeHtml(session.lastMessage)}</div>
        </div>
        <div class="row-right">
          <div class="row-time">${timeFormatted}</div>
          ${badgeHtml}
        </div>
      </div>
    `;
  }).join('');
}

// ── Open View 2: Chat Room ──
window.openChatRoom = function(userId, userNameHint) {
  activeChatUserId = userId;

  const viewList = document.getElementById('viewList');
  const viewRoom = document.getElementById('viewRoom');
  const topTitle = document.getElementById('topPageTitle');
  if (viewList) viewList.style.display = 'none';
  if (viewRoom) viewRoom.style.display = 'flex';
  if (topTitle) topTitle.textContent = 'Desktop - 7';

  const session = chatSessions.find(s => s.id === userId) || {};
  const prof = userProfilesMap[userId] || {};
  const finalName = session.userName || prof.name || userNameHint || 'ผู้ใช้งาน';
  const finalAvatar = getSafeAvatarUrl(prof.photoURL || session.userAvatar, finalName || userId);

  const roomUserName = document.getElementById('roomUserName');
  const roomUserAvatar = document.getElementById('roomUserAvatar');
  if (roomUserName) roomUserName.textContent = finalName;
  if (roomUserAvatar) {
    roomUserAvatar.innerHTML = `
      <img src="${finalAvatar}" alt="" onerror="this.onerror=null; this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}'" />
    `;
  }

  db.collection('chats').doc(userId).update({ unreadAdmin: 0 }).catch(() => {});

  listenToRoomMessages(userId);

  const input = document.getElementById('inputReplyText');
  if (input) input.focus();
};

// Back to List Button
const btnBackToList = document.getElementById('btnBackToList');
if (btnBackToList) {
  btnBackToList.addEventListener('click', () => {
    activeChatUserId = null;
    const viewRoom = document.getElementById('viewRoom');
    const viewList = document.getElementById('viewList');
    const topTitle = document.getElementById('topPageTitle');
    if (viewRoom) viewRoom.style.display = 'none';
    if (viewList) viewList.style.display = 'flex';
    if (topTitle) topTitle.textContent = 'Desktop - 5';

    if (unsubAdminMessages) unsubAdminMessages();
    if (unsubBotMessages) unsubBotMessages();
  });
}

// ── Realtime Messages Listener ──
function listenToRoomMessages(userId) {
  if (unsubAdminMessages) unsubAdminMessages();
  if (unsubBotMessages) unsubBotMessages();

  const container = document.getElementById('roomMessagesArea');
  if (!container) return;
  container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดข้อความ...</div>';

  let adminMsgs = [];
  let botMsgs = [];

  function mergeAndRender() {
    const allMsgs = [...adminMsgs, ...botMsgs];
    allMsgs.sort((a, b) => {
      const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tA - tB;
    });

    const unique = [];
    const seen = new Set();
    allMsgs.forEach(m => {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        unique.push(m);
      }
    });

    if (unique.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-comments" style="font-size:32px;margin-bottom:8px;color:#cbd5e1;display:block;"></i>
          ยังไม่มีข้อความในการสนทนานี้
        </div>
      `;
      return;
    }

    container.innerHTML = unique.map(msg => {
      const timeStr = formatTimeHHMM(msg.createdAt);
      const isAdmin = (msg.role === 'admin');

      if (isAdmin) {
        return `
          <div class="msg-item-right">
            <div class="bubble-right">${escapeHtml(msg.text)}</div>
            <div class="time-outside">${timeStr}</div>
          </div>
        `;
      } else {
        return `
          <div class="msg-item-left">
            <div class="bubble-left">${escapeHtml(msg.text)}</div>
            <div class="time-outside">${timeStr}</div>
          </div>
        `;
      }
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  unsubAdminMessages = db.collection('chats').doc(userId)
    .collection('adminMessages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      adminMsgs = snap.docs.map(d => ({ id: 'adm_' + d.id, ...d.data() }));
      mergeAndRender();
    }, () => {});

  unsubBotMessages = db.collection('chats').doc(userId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      botMsgs = snap.docs.map(d => ({ id: 'bot_' + d.id, ...d.data() }));
      mergeAndRender();
    }, () => {});
}

// ── Send Reply Message ──
async function handleSendReply() {
  const input = document.getElementById('inputReplyText');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !activeChatUserId) return;

  input.value = '';
  const sendBtn = document.getElementById('btnSendReply');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const chatRef = db.collection('chats').doc(activeChatUserId);

    await chatRef.collection('adminMessages').add({
      role: 'admin',
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    chatRef.collection('messages').add({
      role: 'admin',
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(() => {});

    await chatRef.update({
      lastMessage: text,
      lastAt: firebase.firestore.FieldValue.serverTimestamp(),
      unreadUser: firebase.firestore.FieldValue.increment(1)
    });

  } catch(err) {
    alert('ส่งข้อความไม่สำเร็จ: ' + err.message);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
  }
}

const btnSendReply = document.getElementById('btnSendReply');
if (btnSendReply) btnSendReply.addEventListener('click', handleSendReply);

const inputReplyText = document.getElementById('inputReplyText');
if (inputReplyText) {
  inputReplyText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendReply();
    }
  });
}

function formatTimeHHMM(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}.${m}`;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeQuotes(s) {
  return String(s || '').replace(/'/g, "\\'");
}
