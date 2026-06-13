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

// 프로필 이미지가 있으면 이미지, 없으면 닉네임 첫 글자 원형 아이콘
function avatarHtml(user) {
  if (user?.avatar) return `<img class="avatar-img" src="/uploads/${esc(user.avatar)}" alt="" />`;
  return `<span class="avatar-fallback">${esc((user?.nickname || '?').charAt(0))}</span>`;
}

function updateTopbarAvatar() {
  document.getElementById('avatarBtn').innerHTML = avatarHtml(me);
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
  document.getElementById('recoverForm').classList.toggle('hidden', mode !== 'recover');
}

// ===== 아이디 / 비밀번호 찾기 =====
let recoverMode = 'id'; // 'id' | 'pw'

function openRecover(mode) {
  recoverMode = mode;
  document.getElementById('recoverTitle').textContent = mode === 'id' ? '아이디 찾기' : '비밀번호 찾기';
  document.getElementById('recoverHint').textContent =
    mode === 'id' ? '가입한 이메일로 인증코드를 보내드립니다.' : '가입한 이메일로 인증코드를 보내 비밀번호를 변경합니다.';
  // 초기화
  document.getElementById('recoverEmail').value = '';
  document.getElementById('recoverCode').value = '';
  document.getElementById('recoverNewPw').value = '';
  document.getElementById('recoverNewPw2').value = '';
  document.getElementById('recoverStep2').classList.add('hidden');
  document.getElementById('recoverResultId').classList.add('hidden');
  document.getElementById('recoverResultPw').classList.add('hidden');
  document.getElementById('recoverSendBtn').textContent = '인증코드 받기';
  switchAuth('recover');
}

async function sendRecoverCode() {
  try {
    const email = document.getElementById('recoverEmail').value.trim();
    if (!email) return alert('이메일을 입력하세요.');
    const data = await api('POST', '/auth/find/send-code', { email });
    document.getElementById('recoverStep2').classList.remove('hidden');
    document.getElementById('recoverSendBtn').textContent = '인증코드 다시 받기';
    if (data.devCode) {
      // 메일이 설정되지 않은 개발 모드: 코드를 바로 안내
      alert(`인증코드: ${data.devCode}\n(메일 설정이 없어 화면에 표시합니다. 서버 콘솔에서도 확인 가능)`);
    } else {
      alert('이메일로 인증코드를 보냈습니다. 메일함을 확인하세요.');
    }
  } catch (e) { alert(e.message); }
}

async function verifyRecoverCode() {
  try {
    const email = document.getElementById('recoverEmail').value.trim();
    const code = document.getElementById('recoverCode').value.trim();
    if (code.length !== 4) return alert('인증코드 4자리를 입력하세요.');
    const data = await api('POST', '/auth/find/verify-code', { email, code });
    if (recoverMode === 'id') {
      document.getElementById('recoverFoundId').textContent = data.userId;
      document.getElementById('recoverResultId').classList.remove('hidden');
    } else {
      document.getElementById('recoverResultPw').classList.remove('hidden');
    }
  } catch (e) { alert(e.message); }
}

async function submitNewPassword() {
  try {
    const email = document.getElementById('recoverEmail').value.trim();
    const code = document.getElementById('recoverCode').value.trim();
    const newPassword = document.getElementById('recoverNewPw').value;
    const confirm2 = document.getElementById('recoverNewPw2').value;
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/.test(newPassword)) {
      return alert('비밀번호는 6자 이상이며 영문, 숫자, 특수기호를 모두 포함해야 합니다.');
    }
    if (newPassword !== confirm2) return alert('비밀번호 확인이 일치하지 않습니다.');
    await api('POST', '/auth/find/reset-password', { email, code, newPassword });
    alert('비밀번호가 변경되었습니다. 새 비밀번호로 로그인하세요.');
    switchAuth('login');
  } catch (e) { alert(e.message); }
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
  updateTopbarAvatar();
  startNotifPolling();
  showDashboard();
}

// ===== 프로필 =====
async function openProfile() {
  try {
    const { user } = await api('GET', '/auth/me');
    me = { ...me, ...user };
    localStorage.setItem('me', JSON.stringify(me));
    document.getElementById('profileNickname').value = user.nickname || '';
    document.getElementById('profileSchool').value = user.school || '';
    document.getElementById('profileMajor').value = user.major || '';
    document.getElementById('profileStudentId').value = user.studentId || '';
    document.getElementById('profileAvatarPreview').innerHTML = avatarHtml(user);
    document.getElementById('profileModal').classList.remove('hidden');
  } catch (e) { alert(e.message); }
}

function closeProfile() {
  document.getElementById('profileModal').classList.add('hidden');
}

async function saveProfile() {
  try {
    const { user } = await api('PUT', '/auth/profile', {
      nickname: document.getElementById('profileNickname').value.trim(),
      school: document.getElementById('profileSchool').value.trim(),
      major: document.getElementById('profileMajor').value.trim(),
      studentId: document.getElementById('profileStudentId').value.trim(),
    });
    me = { ...me, ...user };
    localStorage.setItem('me', JSON.stringify(me));
    updateTopbarAvatar();
    closeProfile();
  } catch (e) { alert(e.message); }
}

async function uploadAvatar() {
  const fileInput = document.getElementById('avatarFile');
  if (!fileInput.files.length) return;
  const form = new FormData();
  form.append('avatar', fileInput.files[0]);
  try {
    const { avatar } = await api('POST', '/auth/avatar', form, true);
    me.avatar = avatar;
    localStorage.setItem('me', JSON.stringify(me));
    document.getElementById('profileAvatarPreview').innerHTML = avatarHtml(me);
    updateTopbarAvatar();
    fileInput.value = '';
  } catch (e) { alert(e.message); }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('me');
  token = null; me = null;
  stopChatPolling();
  if (notifPollTimer) clearInterval(notifPollTimer);
  document.getElementById('notifPanel').classList.add('hidden');
  switchAuth('login'); // 로그아웃 시 항상 로그인 화면으로
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
    document.getElementById('projectDesc').textContent = project.description || '';
    document.getElementById('inviteCodeChip').textContent = `초대코드 ${project.inviteCode}`;
    show('projectView');
    document.getElementById('deleteProjectBtn').classList.toggle('hidden', !isLeader());
    switchTab('tasks');
  } catch (e) { alert(e.message); }
}

// 초대코드 복사
async function copyInviteCode() {
  if (!currentProject) return;
  const code = currentProject.inviteCode;
  const btn = document.getElementById('copyInviteBtn');
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    // clipboard API를 못 쓰는 환경(비보안 컨텍스트 등) 폴백
    const t = document.createElement('textarea');
    t.value = code; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch {}
    document.body.removeChild(t);
  }
  const label = btn.textContent;
  btn.textContent = '✓ 복사됨';
  setTimeout(() => { btn.textContent = label; }, 1500);
}

// 프로젝트 삭제 (팀장 전용)
async function deleteProject() {
  if (!currentProject) return;
  if (!confirm(`'${currentProject.name}' 프로젝트를 삭제할까요?\n할 일·자료·PPT·메시지·알림이 모두 사라지며 되돌릴 수 없습니다.`)) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}`);
    alert('프로젝트가 삭제되었습니다.');
    showDashboard();
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
  const icons = { 기사: '📰', 논문: '📄', 영상: '🎬', 기타: '📝' };
  list.innerHTML = resources.map((r) => `
    <div class="resource-item">
      <span>${icons[r.type] || '🔗'}</span>
      <div class="body">
        ${r.url
          ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>`
          : `<span class="res-title">${esc(r.title)}</span>`}
        <div class="meta">${r.type} · ${esc(r.uploader?.nickname || '')} · ${fmtDate(r.createdAt)}</div>
        ${r.memo ? `<p class="res-memo">${esc(r.memo)}</p>` : ''}
      </div>
      ${(r.uploader?._id === me.id || isLeader()) ? `<button class="danger-btn" onclick="deleteResource('${r._id}')">삭제</button>` : ''}
    </div>
  `).join('');
}

// 기타 선택 시 url은 선택사항임을 안내
function onResTypeChange() {
  const isEtc = document.getElementById('resType').value === '기타';
  document.getElementById('resUrl').placeholder = isEtc ? '링크 (선택)' : '링크 (URL)';
  document.getElementById('resMemo').placeholder = isEtc ? '메모를 자유롭게 남겨보세요' : '메모 (선택)';
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
// 업로드 영역 접기/펴기 — PPT가 있으면 접어서 슬라이드·대본이 바로 보이게 한다
function setPptUploadCollapsed(collapsed) {
  document.getElementById('pptUploadBody').classList.toggle('collapsed', collapsed);
  document.getElementById('pptUploadCaret').textContent = collapsed ? '▸' : '▾';
}
function togglePptUpload() {
  setPptUploadCollapsed(!document.getElementById('pptUploadBody').classList.contains('collapsed'));
}

async function loadPpts() {
  const { ppts } = await api('GET', `/projects/${currentProject._id}/ppts`);
  const list = document.getElementById('pptList');
  // PPT가 있으면 업로드 영역은 접어 두고, 없으면 펼쳐서 바로 올릴 수 있게 한다
  setPptUploadCollapsed(ppts.length > 0);
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
      <div class="ppt-toolbar">
        <button class="ghost-btn accent" id="pptViewBtn-${p._id}" onclick="togglePptView('${p._id}', this)">↔ 가로로 넘겨보기</button>
        <div class="ppt-nav hidden" id="pptNav-${p._id}">
          <button class="ghost-btn accent" onclick="pptScroll('${p._id}', -1)">← 이전</button>
          <button class="ghost-btn accent" onclick="pptScroll('${p._id}', 1)">다음 →</button>
        </div>
      </div>
      <div class="ppt-slides" id="pptSlides-${p._id}"></div>
    </div>
  `).join('');
  // 각 PPT의 슬라이드(미리보기 + 장별 대본)를 렌더링
  ppts.forEach((p) => renderPptSlides(p));
}

// 슬라이드를 한 장씩 보여주고 그 아래에 대본 입력칸을 배치한다
async function renderPptSlides(ppt) {
  const container = document.getElementById(`pptSlides-${ppt._id}`);
  if (!container) return;
  const scriptMap = {};
  ppt.scripts.forEach((s) => { scriptMap[s.slideNumber] = s.script; });

  // pdf만 브라우저에서 장별로 렌더링 가능
  if (!ppt.fileName.toLowerCase().endsWith('.pdf') || !window.pdfjsLib) {
    container.innerHTML =
      '<p class="hint">ppt·pptx는 브라우저 미리보기를 지원하지 않습니다. <b>PDF로 변환해 업로드</b>하면 슬라이드를 보며 장별 대본을 달 수 있어요.</p>'
      + renderManualScripts(ppt);
    return;
  }

  container.innerHTML = '<p class="hint">슬라이드를 불러오는 중…</p>';
  try {
    const pdf = await pdfjsLib.getDocument(`/uploads/${ppt.fileName}`).promise;
    container.innerHTML = '';
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

      const slide = document.createElement('div');
      slide.className = 'ppt-slide';
      slide.innerHTML = `
        <div class="slide-label">${n}장</div>
        <div class="slide-canvas-wrap"></div>
        <div class="slide-script">
          <textarea id="scr-${ppt._id}-${n}" rows="2" placeholder="${n}장의 대본을 입력하세요">${esc(scriptMap[n] || '')}</textarea>
          <button class="primary-btn" onclick="saveScript('${ppt._id}', ${n}, this)">대본 저장</button>
        </div>`;
      slide.querySelector('.slide-canvas-wrap').appendChild(canvas);
      container.appendChild(slide);
    }
  } catch (e) {
    container.innerHTML =
      `<p class="hint">슬라이드를 불러오지 못했습니다. <a href="/uploads/${esc(ppt.fileName)}" target="_blank" rel="noopener">파일 열기</a></p>`
      + renderManualScripts(ppt);
  }
}

// 미리보기를 못 쓰는 경우: 기존 대본을 편집하거나 장을 직접 추가
function renderManualScripts(ppt) {
  const rows = ppt.scripts.map((s) => `
    <div class="ppt-slide manual">
      <div class="slide-label">${s.slideNumber}장</div>
      <div class="slide-script">
        <textarea id="scr-${ppt._id}-${s.slideNumber}" rows="2">${esc(s.script)}</textarea>
        <button class="primary-btn" onclick="saveScript('${ppt._id}', ${s.slideNumber}, this)">저장</button>
      </div>
    </div>`).join('');
  return rows + `
    <div class="script-form">
      <input type="number" min="1" id="newSlideNo-${ppt._id}" placeholder="장" />
      <input id="newSlideScript-${ppt._id}" placeholder="이 장의 대본을 입력하세요" />
      <button class="primary-btn" onclick="addManualScript('${ppt._id}')">장 추가</button>
    </div>`;
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

// 특정 장의 대본 저장 (페이지 전체를 다시 렌더링하지 않고 버튼만 피드백)
async function saveScript(pptId, slideNumber, btn) {
  try {
    const script = document.getElementById(`scr-${pptId}-${slideNumber}`).value.trim();
    await api('PUT', `/projects/${currentProject._id}/ppts/${pptId}/scripts`, { slideNumber, script });
    if (btn) {
      const label = btn.textContent;
      btn.textContent = '저장됨 ✓'; btn.disabled = true;
      setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 1500);
    }
  } catch (e) { alert(e.message); }
}

// 미리보기를 못 쓰는 PPT에 장을 직접 추가
async function addManualScript(pptId) {
  try {
    const slideNumber = Number(document.getElementById(`newSlideNo-${pptId}`).value);
    const script = document.getElementById(`newSlideScript-${pptId}`).value.trim();
    if (!slideNumber) return alert('슬라이드 번호를 입력하세요.');
    await api('PUT', `/projects/${currentProject._id}/ppts/${pptId}/scripts`, { slideNumber, script });
    loadPpts();
  } catch (e) { alert(e.message); }
}

// 세로 스크롤 ↔ 가로 넘기기 전환
function togglePptView(pptId, btn) {
  const slides = document.getElementById(`pptSlides-${pptId}`);
  const nav = document.getElementById(`pptNav-${pptId}`);
  const horizontal = slides.classList.toggle('horizontal');
  nav.classList.toggle('hidden', !horizontal);
  btn.textContent = horizontal ? '↕ 세로로 보기' : '↔ 가로로 넘겨보기';
  slides.scrollLeft = 0;
}

// 가로 모드에서 한 장씩 이동
function pptScroll(pptId, dir) {
  const slides = document.getElementById(`pptSlides-${pptId}`);
  const slide = slides.querySelector('.ppt-slide');
  const step = slide ? slide.getBoundingClientRect().width + 16 : slides.clientWidth;
  slides.scrollBy({ left: dir * step, behavior: 'smooth' });
}

async function deletePpt(id) {
  if (!confirm('이 PPT를 삭제할까요?')) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}/ppts/${id}`);
    loadPpts();
  } catch (e) { alert(e.message); }
}

// ===== 메시지 =====
// 삭제가 모두에게 반영되도록 전체 목록을 불러오되, 변경이 없으면 다시 그리지 않아 스크롤이 튀지 않게 한다
let lastMsgSig = null;

function renderMessage(m) {
  const mine = m.sender?._id === me.id;
  const head = `<div class="sender">${esc(m.sender?.nickname || '')} · ${fmtDate(m.createdAt)}</div>`;
  if (m.deleted) {
    return `
    <div class="msg ${mine ? 'mine' : ''} deleted">
      <span class="avatar avatar-sm msg-avatar">${avatarHtml(m.sender)}</span>
      <div class="msg-content">${head}<div class="bubble">삭제된 메시지입니다</div></div>
    </div>`;
  }
  const delBtn = mine ? `<button class="msg-del" onclick="deleteMessage('${m._id}')" title="삭제">삭제</button>` : '';
  return `
    <div class="msg ${mine ? 'mine' : ''}">
      <span class="avatar avatar-sm msg-avatar">${avatarHtml(m.sender)}</span>
      <div class="msg-content">${head}<div class="bubble">${esc(m.content)}</div>${delBtn}</div>
    </div>`;
}

async function loadMessages(initial = false) {
  if (!currentProject) return;
  const { messages } = await api('GET', `/projects/${currentProject._id}/messages`);
  const sig = messages.map((m) => `${m._id}:${m.deleted ? 1 : 0}`).join(',');
  if (!initial && sig === lastMsgSig) return; // 변화 없으면 그대로 둔다
  lastMsgSig = sig;
  const box = document.getElementById('chatMessages');
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  box.innerHTML = messages.map(renderMessage).join('');
  if (initial || nearBottom) box.scrollTop = box.scrollHeight;
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

async function deleteMessage(id) {
  if (!confirm('이 메시지를 삭제할까요? 삭제하면 "삭제된 메시지입니다"로 표시됩니다.')) return;
  try {
    await api('DELETE', `/projects/${currentProject._id}/messages/${id}`);
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
          <span class="name"><span class="avatar avatar-sm">${avatarHtml(s.user)}</span> ${esc(s.user.nickname)} ${s.isLeader ? '<span class="leader-chip">팀장</span>' : ''}</span>
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
  document.getElementById('memberList').innerHTML = project.members.map((m) => {
    const info = [m.user.school, m.user.major, m.user.studentId].filter(Boolean).join(' · ');
    // 팀장은 모든 멤버(자신 포함)에게 역할을 배정할 수 있다
    return `
    <div class="member-item">
      <div class="member-main clickable" onclick="openMemberProfile('${m.user._id}')" title="클릭하면 프로필을 봅니다">
        <div class="avatar member-avatar">${avatarHtml(m.user)}</div>
        <div class="info">
          <div class="name">${esc(m.user.nickname)} ${m.isLeader ? '<span class="leader-chip">팀장</span>' : ''}</div>
          <div class="meta">@${esc(m.user.userId)} · 역할: ${esc(m.role || '미지정')}${info ? '<br>' + esc(info) : ''}</div>
        </div>
      </div>
      ${isLeader() ? `
        <div class="role-form" onclick="event.stopPropagation()">
          <input id="role-${m.user._id}" placeholder="역할 입력" value="${esc(m.role)}" />
          <button class="primary-btn" onclick="setRole('${m.user._id}')">저장</button>
        </div>` : ''}
    </div>`;
  }).join('');
}

// 멤버를 클릭하면 프로필을 읽기 전용으로 보여준다
function openMemberProfile(memberId) {
  const m = currentProject.members.find((x) => x.user._id === memberId);
  if (!m) return;
  const u = m.user;
  document.getElementById('memberModalAvatar').innerHTML = avatarHtml(u);
  document.getElementById('memberModalName').innerHTML =
    `${esc(u.nickname)} ${m.isLeader ? '<span class="leader-chip">팀장</span>' : ''}`;
  document.getElementById('memberModalId').textContent = `@${u.userId}`;
  const rows = [
    ['역할', m.role || '미지정'],
    ['학교', u.school],
    ['학과', u.major],
    ['학번', u.studentId],
    ['이메일', u.email],
  ].filter(([, v]) => v);
  document.getElementById('memberModalBody').innerHTML = rows
    .map(([k, v]) => `<div class="member-modal-row"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`)
    .join('');
  document.getElementById('memberModal').classList.remove('hidden');
}

function closeMemberProfile() {
  document.getElementById('memberModal').classList.add('hidden');
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

// 알림 패널을 열면 자동으로 모두 읽음 처리
function toggleNotifications() {
  const panel = document.getElementById('notifPanel');
  const willOpen = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (willOpen) {
    loadNotifications()
      .then(() => api('PUT', '/notifications/read-all'))
      .then(() => document.getElementById('bellBadge').classList.add('hidden'))
      .catch(() => {});
  }
}

function startNotifPolling() {
  loadNotifications();
  notifPollTimer = setInterval(loadNotifications, 15000);
}

// ===== 초기화 =====
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
}

// 알림 패널 바깥을 클릭하면 닫기
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notifPanel');
  if (panel.classList.contains('hidden')) return;
  if (!e.target.closest('.bell-wrap')) panel.classList.add('hidden');
});

(function init() {
  if (token && me) {
    updateTopbarAvatar();
    startNotifPolling();
    showDashboard();
  } else {
    show('authView');
  }
})();
