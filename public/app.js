// ===== 상태 =====
let token = localStorage.getItem('token') || null;
let me = JSON.parse(localStorage.getItem('me') || 'null');
let currentProject = null;
let resourceFilter = '';
let lastMessageAt = null;
let chatPollTimer = null;
let notifPollTimer = null;

// ===== API 헬퍼 =====
async function api(method, path, body, isForm = false) {
  const headers = { Authorization: `Bearer ${token}` };
  if (!isForm) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '요청에 실패했습니다.');
  return data;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(d) {
  return new Date(d).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ===== 화면 전환 =====
function show(viewId) {
  ['authView', 'dashboardView', 'projectView'].forEach((id) => {
    document.getElementById(id).classList.toggle('hidden', id !== viewId);
  });
  document.getElementById('topbar').classList.toggle('hidden', viewId === 'authView');
}

function switchAuth(mode) {
  document.getElementById('loginForm').classList.toggle('hidden', mode !== 'login');
  document.getElementById('signupForm').classList.toggle('hidden', mode !== 'signup');
}

// ===== 인증 =====
async function signup() {
  try {
    const password = document.getElementById('signupPw').value;
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(password)) {
      return alert('비밀번호는 6자 이상이며 영문, 숫자, 특수기호를 모두 포함해야 합니다.');
    }
    const data = await api('POST', '/auth/signup', {
      userId: document.getElementById('signupId').value.trim(),
      password,
      nickname: document.getElementById('signupNickname').value.trim(),
      email: document.getElementById('signupEmail').value.trim(),
    });
    onLoggedIn(data);
  } catch (e) { alert(e.message); }
}

async function login() {
  try {
    const data = await api('POST', '/auth/login', {
      userId: document.getElementById('loginId').value.trim(),
      password: document.getElementById('loginPw').value,
    });
    onLoggedIn(data);
  } catch (e) { alert(e.message); }
}

function onLoggedIn(data) {
  token = data.token;
  me = data.user;
  localStorage.setItem('token', token);
  localStorage.setItem('me', JSON.stringify(me));
  document.getElementById('myNickname').textContent = me.nickname;
  startNotifPolling();
  showDashboard();
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('me');
  token = null; me = null;
  stopChatPolling();
  if (notifPollTimer) clearInterval(notifPollTimer);
  show('authView');
}

// ===== 대시보드 =====
async function showDashboard() {
  stopChatPolling();
  currentProject = null;
  show('dashboardView');
  try {
    const { projects } = await api('GET', '/projects');
    const list = document.getElementById('projectList');
    if (!projects.length) {
      list.innerHTML = '<p class="hint">아직 프로젝트가 없습니다. 새로 만들거나 초대 코드로 참가하세요!</p>';
      return;
    }
    list.innerHTML = projects.map((p) => `
      <div class="project-card" onclick="openProject('${p._id}')">
        <h3>${esc(p.name)}</h3>
        <p class="meta">팀장: ${esc(p.leader?.nickname || '')} · 멤버 ${p.members.length}명 · 초대코드 ${esc(p.inviteCode)}</p>
        <p class="meta">${esc(p.description || '')}</p>
      </div>
    `).join('');
  } catch (e) {
    if (e.message.includes('토큰') || e.message.includes('로그인')) logout();
    else alert(e.message);
  }
}

async function createProject() {
  try {
    const name = document.getElementById('newProjectName').value.trim();
    const description = document.getElementById('newProjectDesc').value.trim();
    if (!name) return alert('프로젝트 이름을 입력하세요.');
    const { project } = await api('POST', '/projects', { name, description });
    alert(`프로젝트가 생성되었습니다!\n초대 코드: ${project.inviteCode}\n팀원에게 이 코드를 공유하세요.`);
    document.getElementById('newProjectName').value = '';
    document.getElementById('newProjectDesc').value = '';
    showDashboard();
  } catch (e) { alert(e.message); }
}

async function joinProject() {
  try {
    const inviteCode = document.getElementById('joinCode').value.trim();
    if (inviteCode.length !== 4) return alert('4자리 초대 코드를 입력하세요.');
    await api('POST', '/projects/join', { inviteCode });
    document.getElementById('joinCode').value = '';
    showDashboard();
  } catch (e) { alert(e.message); }
}

// ===== 프로젝트 상세 =====
async function openProject(projectId) {
  try {
    const { project } = await api('GET', `/projects/${projectId}`);
    currentProject = project;
    document.getElementById('projectTitle').textContent = project.name;
    document.getElementById('inviteCodeChip').textContent = `초대코드 ${project.inviteCode}`;
    show('projectView');
    switchTab('tasks');
  } catch (e) { alert(e.message); }
}

function isLeader() {
  return currentProject && currentProject.leader === me.id;
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  ['tasks', 'resources', 'ppts', 'chat', 'shares', 'members'].forEach((t) => {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
  });
  stopChatPolling();
  if (tab === 'tasks') loadTasks();
  if (tab === 'resources') loadResources();
  if (tab === 'ppts') loadPpts();
  if (tab === 'chat') { loadMessages(true); startChatPolling(); }
  if (tab === 'shares') loadShares();
  if (tab === 'members') loadMembers();
}

// ===== 할 일 =====
const CATEGORY_ICONS = { 기사: '📰', 논문: '📄', 영상: '🎬', PPT: '📊', 대본: '🎤', 기타: '📌' };

// 할 일 종류를 누르면 해당 작업 화면으로 이동
function goToCategoryTab(category) {
  if (['기사', '논문', '영상'].includes(category)) {
    switchTab('resources');
    filterResources(category);
  } else if (category === 'PPT' || category === '대본') {
    switchTab('ppts');
  }
}

async function loadTasks() {
  // 팀장·팀원 모두 할 일을 추가할 수 있다
  document.getElementById('taskAssignee').innerHTML = currentProject.members
    .map((m) => `<option value="${m.user._id}">${esc(m.user.nickname)}</option>`)
    .join('');
  const { tasks } = await api('GET', `/projects/${currentProject._id}/tasks`);
  const list = document.getElementById('taskList');
  if (!tasks.length) {
    list.innerHTML = '<p class="hint">등록된 할 일이 없습니다.</p>';
    return;
  }
  list.innerHTML = tasks.map((t) => {
    const mineOrLeader = t.assignee._id === me.id || isLeader();
    const actions = mineOrLeader && t.status !== '완료'
      ? `<button class="ghost-btn accent" onclick="setTaskStatus('${t._id}','${t.status === '진행전' ? '진행중' : '완료'}')">${t.status === '진행전' ? '시작' : '완료 처리'}</button>`
      : '';
    const del = isLeader() ? `<button class="danger-btn" onclick="deleteTask('${t._id}')">삭제</button>` : '';
    const cat = t.category || '기타';
    return `
      <div class="task-item">
        <span class="task-order">${t.order}</span>
        <div class="task-body clickable" onclick="goToCategoryTab('${cat}')" title="클릭하면 해당 작업 화면으로 이동합니다">
          <div class="title">${CATEGORY_ICONS[cat] || ''} ${esc(t.title)} <span class="category-chip">${cat}</span></div>
          <div class="meta">담당: ${esc(t.assignee.nickname)} · 기한: ${fmtDate(t.dueDate)}${t.description ? ' · ' + esc(t.description) : ''}</div>
        </div>
        <span class="status-chip status-${t.status}">${t.status}</span>
        ${actions} ${del}
      </div>`;
  }).join('');
}

async function createTask() {
  try {
    await api('POST', `/projects/${currentProject._id}/tasks`, {
      title: document.getElementById('taskTitle').value.trim(),
      category: document.getElementById('taskCategory').value,
      assignee: document.getElementById('taskAssignee').value,
      order: Number(document.getElementById('taskOrder').value),
      dueDate: document.getElementById('taskDue').value,
      description: document.getElementById('taskDesc').value.trim(),
    });
    document.getElementById('taskTitle').value = '';
    document.getElementById('taskOrder').value = '';
    document.getElementById('taskDue').value = '';
    document.getElementById('taskDesc').value = '';
    loadTasks();
  } catch (e) { alert(e.message); }
}

async function setTaskStatus(taskId, status) {
  try {
    await api('PUT', `/projects/${currentProject._id}/tasks/${taskId}/status`, { status });
    loadTasks();
  } catch (e) { alert(e.message); }
}

async function deleteTask(taskId) {
  if (!confirm('이 할 일을 삭제할까요?')) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}/tasks/${taskId}`);
    loadTasks();
  } catch (e) { alert(e.message); }
}

// ===== 자료조사 =====
function filterResources(type) {
  resourceFilter = type;
  document.querySelectorAll('.chip-btn').forEach((b) => b.classList.toggle('active', b.dataset.filter === type));
  loadResources();
}

async function loadResources() {
  const q = resourceFilter ? `?type=${encodeURIComponent(resourceFilter)}` : '';
  const { resources } = await api('GET', `/projects/${currentProject._id}/resources${q}`);
  const list = document.getElementById('resourceList');
  if (!resources.length) {
    list.innerHTML = '<p class="hint">등록된 자료가 없습니다.</p>';
    return;
  }
  const icons = { 기사: '📰', 논문: '📄', 영상: '🎬' };
  list.innerHTML = resources.map((r) => `
    <div class="resource-item">
      <span>${icons[r.type] || '🔗'}</span>
      <div class="body">
        <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>
        <div class="meta">${r.type} · ${esc(r.uploader?.nickname || '')} · ${fmtDate(r.createdAt)}${r.memo ? ' · ' + esc(r.memo) : ''}</div>
      </div>
      ${(r.uploader?._id === me.id || isLeader()) ? `<button class="danger-btn" onclick="deleteResource('${r._id}')">삭제</button>` : ''}
    </div>
  `).join('');
}

async function addResource() {
  try {
    await api('POST', `/projects/${currentProject._id}/resources`, {
      type: document.getElementById('resType').value,
      title: document.getElementById('resTitle').value.trim(),
      url: document.getElementById('resUrl').value.trim(),
      memo: document.getElementById('resMemo').value.trim(),
    });
    document.getElementById('resTitle').value = '';
    document.getElementById('resUrl').value = '';
    document.getElementById('resMemo').value = '';
    loadResources();
  } catch (e) { alert(e.message); }
}

async function deleteResource(id) {
  if (!confirm('이 자료를 삭제할까요?')) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}/resources/${id}`);
    loadResources();
  } catch (e) { alert(e.message); }
}

// ===== PPT · 대본 =====
async function loadPpts() {
  const { ppts } = await api('GET', `/projects/${currentProject._id}/ppts`);
  const list = document.getElementById('pptList');
  if (!ppts.length) {
    list.innerHTML = '<p class="hint">업로드된 PPT가 없습니다.</p>';
    return;
  }
  list.innerHTML = ppts.map((p) => `
    <div class="ppt-item">
      <div class="ppt-head">
        <span>📊</span>
        <a href="/uploads/${esc(p.fileName)}" download="${esc(p.originalName)}">${esc(p.originalName)}</a>
        <span class="meta" style="font-size:12px;color:#6b7280">${esc(p.uploader?.nickname || '')} · ${fmtDate(p.createdAt)}</span>
        ${(p.uploader?._id === me.id || isLeader()) ? `<button class="danger-btn" onclick="deletePpt('${p._id}')">삭제</button>` : ''}
      </div>
      ${p.scripts.map((s) => `
        <div class="script-row">
          <span class="slide-no">${s.slideNumber}장</span>
          <p>${esc(s.script)}</p>
        </div>
      `).join('')}
      <div class="script-form">
        <input type="number" min="1" id="slideNo-${p._id}" placeholder="장" />
        <input id="slideScript-${p._id}" placeholder="이 장의 대본을 입력하세요" />
        <button class="primary-btn" onclick="saveScript('${p._id}')">대본 저장</button>
      </div>
    </div>
  `).join('');
}

async function uploadPpt() {
  const fileInput = document.getElementById('pptFile');
  if (!fileInput.files.length) return alert('파일을 선택하세요.');
  const form = new FormData();
  form.append('file', fileInput.files[0]);
  try {
    await api('POST', `/projects/${currentProject._id}/ppts`, form, true);
    fileInput.value = '';
    loadPpts();
  } catch (e) { alert(e.message); }
}

async function saveScript(pptId) {
  try {
    const slideNumber = Number(document.getElementById(`slideNo-${pptId}`).value);
    const script = document.getElementById(`slideScript-${pptId}`).value.trim();
    if (!slideNumber) return alert('슬라이드 번호를 입력하세요.');
    await api('PUT', `/projects/${currentProject._id}/ppts/${pptId}/scripts`, { slideNumber, script });
    loadPpts();
  } catch (e) { alert(e.message); }
}

async function deletePpt(id) {
  if (!confirm('이 PPT를 삭제할까요?')) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}/ppts/${id}`);
    loadPpts();
  } catch (e) { alert(e.message); }
}

// ===== 메시지 =====
async function loadMessages(initial = false) {
  if (!currentProject) return;
  const q = !initial && lastMessageAt ? `?after=${encodeURIComponent(lastMessageAt)}` : '';
  const { messages } = await api('GET', `/projects/${currentProject._id}/messages${q}`);
  const box = document.getElementById('chatMessages');
  if (initial) { box.innerHTML = ''; lastMessageAt = null; }
  if (!messages.length) return;
  lastMessageAt = messages[messages.length - 1].createdAt;
  box.insertAdjacentHTML('beforeend', messages.map((m) => `
    <div class="msg ${m.sender?._id === me.id ? 'mine' : ''}">
      <div class="sender">${esc(m.sender?.nickname || '')} · ${fmtDate(m.createdAt)}</div>
      <div class="bubble">${esc(m.content)}</div>
    </div>
  `).join(''));
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api('POST', `/projects/${currentProject._id}/messages`, { content });
    loadMessages();
  } catch (e) { alert(e.message); }
}

function startChatPolling() {
  chatPollTimer = setInterval(() => loadMessages().catch(() => {}), 3000);
}
function stopChatPolling() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
}

// ===== 지분 =====
async function loadShares() {
  const { shares } = await api('GET', `/projects/${currentProject._id}/shares`);
  document.getElementById('shareList').innerHTML = shares
    .sort((a, b) => b.sharePercent - a.sharePercent)
    .map((s) => `
      <div class="share-item">
        <div class="share-top">
          <span class="name">${esc(s.user.nickname)} ${s.isLeader ? '<span class="leader-chip">팀장</span>' : ''}</span>
          <span class="percent">${s.sharePercent}%</span>
        </div>
        <div class="share-bar"><div class="share-fill" style="width:${s.sharePercent}%"></div></div>
        <div class="meta">역할: ${esc(s.role || '미지정')} · 점수: ${s.score}점</div>
      </div>
    `).join('');
}

// ===== 멤버 · 역할 =====
async function loadMembers() {
  const { project } = await api('GET', `/projects/${currentProject._id}`);
  currentProject = project;
  document.getElementById('memberList').innerHTML = project.members.map((m) => `
    <div class="member-item">
      <div class="info">
        <div class="name">${esc(m.user.nickname)} ${m.isLeader ? '<span class="leader-chip">팀장</span>' : ''}</div>
        <div class="meta">@${esc(m.user.userId)} · 역할: ${esc(m.role || '미지정')}</div>
      </div>
      ${isLeader() && !m.isLeader ? `
        <div class="role-form">
          <input id="role-${m.user._id}" placeholder="역할 입력" value="${esc(m.role)}" />
          <button class="primary-btn" onclick="setRole('${m.user._id}')">저장</button>
        </div>` : ''}
    </div>
  `).join('');
}

async function setRole(memberId) {
  try {
    const role = document.getElementById(`role-${memberId}`).value.trim();
    await api('PUT', `/projects/${currentProject._id}/members/${memberId}/role`, { role });
    loadMembers();
  } catch (e) { alert(e.message); }
}

// ===== 알림 =====
async function loadNotifications() {
  if (!token) return;
  try {
    const { notifications, unreadCount } = await api('GET', '/notifications');
    const badge = document.getElementById('bellBadge');
    badge.textContent = unreadCount;
    badge.classList.toggle('hidden', unreadCount === 0);
    const list = document.getElementById('notifList');
    if (!notifications.length) {
      list.innerHTML = '<div class="notif-empty">알림이 없습니다.</div>';
      return;
    }
    list.innerHTML = notifications.map((n) => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div>${esc(n.message)}</div>
        <div class="time">${fmtDate(n.createdAt)}</div>
      </div>
    `).join('');
  } catch { /* 폴링 실패는 무시 */ }
}

function toggleNotifications() {
  document.getElementById('notifPanel').classList.toggle('hidden');
}

async function markAllRead() {
  await api('PUT', '/notifications/read-all');
  loadNotifications();
}

function startNotifPolling() {
  loadNotifications();
  notifPollTimer = setInterval(loadNotifications, 15000);
}

// ===== 초기화 =====
(function init() {
  if (token && me) {
    document.getElementById('myNickname').textContent = me.nickname;
    startNotifPolling();
    showDashboard();
  } else {
    show('authView');
  }
})();
