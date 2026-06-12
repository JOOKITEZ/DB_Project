const jwt = require('jsonwebtoken');
const Project = require('../models/Project');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// JWT 검증: Authorization: Bearer <token>
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, userId: payload.userId, nickname: payload.nickname };
    next();
  } catch {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

// 프로젝트 멤버인지 확인하고 req.project에 담는다
async function projectMemberRequired(req, res, next) {
  const project = await Project.findById(req.params.projectId);
  if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
  const isMember = project.members.some((m) => m.user.toString() === req.user.id);
  if (!isMember) return res.status(403).json({ error: '프로젝트 멤버가 아닙니다.' });
  req.project = project;
  next();
}

// 팀장만 가능한 작업
function leaderRequired(req, res, next) {
  if (req.project.leader.toString() !== req.user.id) {
    return res.status(403).json({ error: '팀장만 가능한 작업입니다.' });
  }
  next();
}

module.exports = { authRequired, projectMemberRequired, leaderRequired, JWT_SECRET };
