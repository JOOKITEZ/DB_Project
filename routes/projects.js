const express = require('express');
const path = require('path');
const fs = require('fs');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Resource = require('../models/Resource');
const Ppt = require('../models/Ppt');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const ScoreLog = require('../models/ScoreLog');
const { authRequired, projectMemberRequired, leaderRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 고유 4자리 초대 코드 생성 (0000~9999, 중복 검사)
async function generateInviteCode() {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const exists = await Project.findOne({ inviteCode: code });
    if (!exists) return code;
  }
  throw new Error('초대 코드를 생성할 수 없습니다. (코드가 모두 사용 중)');
}

// 프로젝트 생성 → 생성자가 팀장, 4자리 초대 코드 부여
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: '프로젝트 이름을 입력하세요.' });
    const inviteCode = await generateInviteCode();
    const project = await Project.create({
      name,
      description: description || '',
      inviteCode,
      leader: req.user.id,
      members: [{ user: req.user.id, role: '팀장', isLeader: true }],
    });
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 초대 코드로 프로젝트 참가
router.post('/join', async (req, res) => {
  const { inviteCode } = req.body;
  const project = await Project.findOne({ inviteCode });
  if (!project) return res.status(404).json({ error: '해당 코드의 프로젝트가 없습니다.' });
  if (project.members.some((m) => m.user.toString() === req.user.id)) {
    return res.status(409).json({ error: '이미 참가한 프로젝트입니다.' });
  }
  project.members.push({ user: req.user.id, role: '팀원', isLeader: false });
  await project.save();
  res.json({ project });
});

// 내가 속한 프로젝트 목록
router.get('/', async (req, res) => {
  const projects = await Project.find({ 'members.user': req.user.id })
    .populate('leader', 'nickname userId')
    .sort({ createdAt: -1 });
  res.json({ projects });
});

// 여러 프로젝트에 걸친 "내가 맡은 미완료 할 일" 모아보기 (마감 임박순)
// 주의: '/:projectId'보다 먼저 선언해야 'my-tasks'가 projectId로 잡히지 않는다
router.get('/my-tasks', async (req, res) => {
  const myProjects = await Project.find({ 'members.user': req.user.id }).select('_id name');
  const projectMap = new Map(myProjects.map((p) => [p._id.toString(), p.name]));
  const tasks = await Task.find({
    assignee: req.user.id,
    project: { $in: myProjects.map((p) => p._id) },
    status: { $ne: '완료' },
  })
    .sort({ dueDate: 1 })
    .limit(50);
  const result = tasks.map((t) => ({
    _id: t._id,
    title: t.title,
    category: t.category,
    dueDate: t.dueDate,
    status: t.status,
    project: { _id: t.project, name: projectMap.get(t.project.toString()) || '' },
  }));
  res.json({ tasks: result });
});

// 프로젝트 상세
router.get('/:projectId', projectMemberRequired, async (req, res) => {
  await req.project.populate('members.user', 'nickname userId email avatar school major studentId');
  res.json({ project: req.project });
});

// 멤버 역할 부여/변경 (팀장 전용)
router.put('/:projectId/members/:memberId/role', projectMemberRequired, leaderRequired, async (req, res) => {
  const { role } = req.body;
  const member = req.project.members.find((m) => m.user.toString() === req.params.memberId);
  if (!member) return res.status(404).json({ error: '해당 멤버가 없습니다.' });
  member.role = role || '';
  await req.project.save();
  await req.project.populate('members.user', 'nickname userId avatar');
  res.json({ project: req.project });
});

// 프로젝트 삭제 (팀장 전용) — 관련 데이터(할 일·자료·PPT·메시지·알림)와 업로드 파일까지 함께 정리
router.delete('/:projectId', projectMemberRequired, leaderRequired, async (req, res) => {
  const projectId = req.project._id;
  // 업로드된 PPT 파일 삭제
  const ppts = await Ppt.find({ project: projectId });
  for (const ppt of ppts) {
    const filePath = path.join(__dirname, '..', 'uploads', ppt.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await Promise.all([
    Task.deleteMany({ project: projectId }),
    Resource.deleteMany({ project: projectId }),
    Ppt.deleteMany({ project: projectId }),
    Message.deleteMany({ project: projectId }),
    Notification.deleteMany({ project: projectId }),
    ScoreLog.deleteMany({ project: projectId }),
  ]);
  await req.project.deleteOne();
  res.json({ ok: true });
});

// 지분 산정 내역: 누가 언제 왜 +10/−10 되었는지
router.get('/:projectId/score-logs', projectMemberRequired, async (req, res) => {
  const logs = await ScoreLog.find({ project: req.project._id })
    .populate('user', 'nickname avatar')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json({ logs });
});

// 지분 조회: 멤버별 점수를 백분율로 환산해서 반환
router.get('/:projectId/shares', projectMemberRequired, async (req, res) => {
  await req.project.populate('members.user', 'nickname userId avatar');
  const total = req.project.members.reduce((sum, m) => sum + Math.max(m.score, 0), 0);
  const shares = req.project.members.map((m) => ({
    user: m.user,
    role: m.role,
    isLeader: m.isLeader,
    score: m.score,
    sharePercent: total > 0 ? Math.round((Math.max(m.score, 0) / total) * 1000) / 10 : 0,
  }));
  res.json({ shares });
});

module.exports = router;
