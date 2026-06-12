// 스모크 테스트: 인메모리 MongoDB로 전체 API 흐름 검증
// 실행: npm test (첫 실행 시 mongod 바이너리를 자동 다운로드하므로 인터넷 필요)
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('team_project_db');
  process.env.JWT_SECRET = 'test-secret';
  process.env.PORT = '3456';

  require('./server');
  await new Promise((r) => setTimeout(r, 1500));

  const BASE = 'http://localhost:3456/api';
  const call = async (method, path, body, token) => {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { status: res.status, data };
  };
  const assert = (cond, name) => {
    if (!cond) { console.error('❌ FAIL:', name); process.exitCode = 1; }
    else console.log('✅', name);
  };

  // 1. 회원가입 (팀장, 팀원) — 비밀번호는 6자 이상 + 영문/숫자/특수기호
  let r = await call('POST', '/auth/signup', { userId: 'leader1', password: 'pw1234!', nickname: '팀장님', email: 'leader@test.com' });
  assert(r.status === 201 && r.data.token, '회원가입(팀장)');
  const leaderToken = r.data.token;
  const leaderId = r.data.user.id;

  r = await call('POST', '/auth/signup', { userId: 'member1', password: 'pw1234!', nickname: '팀원A', email: 'member@test.com' });
  assert(r.status === 201, '회원가입(팀원)');
  const memberToken = r.data.token;
  const memberId = r.data.user.id;

  // 약한 비밀번호 거부 (특수기호 없음)
  r = await call('POST', '/auth/signup', { userId: 'weakpw', password: 'abc123', nickname: 'x', email: 'weak@x.com' });
  assert(r.status === 400, '약한 비밀번호 거부');

  // 중복 가입 거부
  r = await call('POST', '/auth/signup', { userId: 'leader1', password: 'abc123!', nickname: 'x', email: 'x@x.com' });
  assert(r.status === 409, '중복 id 거부');

  // 로그인
  r = await call('POST', '/auth/login', { userId: 'leader1', password: 'pw1234!' });
  assert(r.status === 200 && r.data.token, '로그인');

  // 2. 프로젝트 생성 → 4자리 초대코드, 생성자가 팀장
  r = await call('POST', '/projects', { name: 'DB 발표', description: '기말 발표' }, leaderToken);
  assert(r.status === 201 && /^\d{4}$/.test(r.data.project.inviteCode), '프로젝트 생성 + 4자리 초대코드');
  assert(r.data.project.members[0].isLeader === true, '생성자가 팀장');
  const project = r.data.project;

  // 3. 초대코드로 참가
  r = await call('POST', '/projects/join', { inviteCode: project.inviteCode }, memberToken);
  assert(r.status === 200, '초대코드로 참가');

  // 4. 역할 부여
  r = await call('PUT', `/projects/${project._id}/members/${memberId}/role`, { role: '자료조사' }, leaderToken);
  assert(r.status === 200, '역할 부여(팀장)');
  r = await call('PUT', `/projects/${project._id}/members/${leaderId}/role`, { role: 'x' }, memberToken);
  assert(r.status === 403, '팀원의 역할 부여 거부');

  // 5. 할 일 생성 (순서 1, 2) — 종류(category) 포함
  const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
  r = await call('POST', `/projects/${project._id}/tasks`, { assignee: memberId, title: '자료 수집', category: '논문', order: 1, dueDate: future }, leaderToken);
  assert(r.status === 201, '할 일 1 생성');
  const task1 = r.data.task;
  r = await call('POST', `/projects/${project._id}/tasks`, { assignee: leaderId, title: 'PPT 제작', category: 'PPT', order: 2, dueDate: future }, leaderToken);
  assert(r.status === 201, '할 일 2 생성');

  // 팀원도 할 일을 추가할 수 있다
  r = await call('POST', `/projects/${project._id}/tasks`, { assignee: memberId, title: '팀원이 만든 일', category: '기타', order: 10, dueDate: future }, memberToken);
  assert(r.status === 201, '팀원의 할 일 추가');

  // 순서 1 배정 알림이 팀원에게 갔는지
  r = await call('GET', '/notifications', null, memberToken);
  assert(r.data.notifications.some((n) => n.type === '다음순서'), '첫 할 일 배정 알림');

  // 6. 할 일 완료 → 다음 순서 담당자(팀장)에게 알림 + 지분 가산
  r = await call('PUT', `/projects/${project._id}/tasks/${task1._id}/status`, { status: '완료' }, memberToken);
  assert(r.status === 200 && r.data.task.status === '완료', '할 일 완료 처리');
  r = await call('GET', '/notifications', null, leaderToken);
  assert(r.data.notifications.some((n) => n.message.includes('PPT 제작')), '다음 순서 알림(팀장에게)');

  // 7. 지분: 기한 내 완료한 팀원 점수 110, 팀장 100
  r = await call('GET', `/projects/${project._id}/shares`, null, leaderToken);
  const memberShare = r.data.shares.find((s) => s.user._id === memberId);
  assert(memberShare.score === 110, '기한 내 완료 시 +10점');

  // 7-1. 가산점 받은 할 일을 삭제하면 점수도 회수 (110→100)
  r = await call('DELETE', `/projects/${project._id}/tasks/${task1._id}`, null, leaderToken);
  assert(r.status === 200, '완료된 할 일 삭제');
  r = await call('GET', `/projects/${project._id}/shares`, null, leaderToken);
  const afterDelete = r.data.shares.find((s) => s.user._id === memberId);
  assert(afterDelete.score === 100, '할 일 삭제 시 가산점 회수 (110→100)');

  // 8. 기한 초과 시나리오: 과거 기한 할 일 → 스케줄러 → 지분 차감 + 알림
  const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  r = await call('POST', `/projects/${project._id}/tasks`, { assignee: memberId, title: '늦은 일', order: 3, dueDate: past }, leaderToken);
  const { checkDeadlines } = require('./jobs/deadlineChecker');
  await checkDeadlines();
  r = await call('GET', `/projects/${project._id}/shares`, null, leaderToken);
  const after = r.data.shares.find((s) => s.user._id === memberId);
  assert(after.score === 90, '기한 초과 시 -10점 (100→90)');
  r = await call('GET', '/notifications', null, memberToken);
  assert(r.data.notifications.some((n) => n.type === '기한초과'), '기한 초과 알림');

  // 9. D-1 알림 시나리오
  const tomorrow = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
  await call('POST', `/projects/${project._id}/tasks`, { assignee: memberId, title: '내일 마감', order: 4, dueDate: tomorrow }, leaderToken);
  await checkDeadlines();
  r = await call('GET', '/notifications', null, memberToken);
  assert(r.data.notifications.some((n) => n.message.includes('하루 남았습니다')), 'D-1 마감 임박 알림');

  // 10. 자료조사: 해당 종류의 할 일을 배정받은 사람만 등록 가능
  r = await call('POST', `/projects/${project._id}/resources`, { type: '논문', title: 'NoSQL 연구', url: 'https://example.com/paper' }, memberToken);
  assert(r.status === 201, "자료 등록 ('논문' 할 일 배정자)");
  r = await call('POST', `/projects/${project._id}/resources`, { type: '기사', title: '기사', url: 'https://example.com/news' }, leaderToken);
  assert(r.status === 403, "'기사' 할 일 없는 사람의 등록 거부");
  r = await call('GET', `/projects/${project._id}/resources?type=논문`, null, leaderToken);
  assert(r.data.resources.length === 1, '자료 종류 필터');

  // 11. 메시지
  r = await call('POST', `/projects/${project._id}/messages`, { content: '안녕하세요!' }, memberToken);
  assert(r.status === 201, '메시지 전송');
  r = await call('GET', `/projects/${project._id}/messages`, null, leaderToken);
  assert(r.data.messages.length === 1 && r.data.messages[0].content === '안녕하세요!', '메시지 조회');

  // 12. 비멤버 접근 차단
  r = await call('POST', '/auth/signup', { userId: 'outsider', password: 'out123!', nickname: '외부인', email: 'out@test.com' });
  r = await call('GET', `/projects/${project._id}/tasks`, null, r.data.token);
  assert(r.status === 403, '비멤버 접근 차단');

  console.log(process.exitCode ? '\n일부 테스트 실패' : '\n전체 스모크 테스트 통과 🎉');
  await mongod.stop();
  process.exit(process.exitCode || 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
