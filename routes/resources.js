const express = require('express');
const Resource = require('../models/Resource');
const { authRequired, projectMemberRequired } = require('../middleware/auth');
const { hasCategoryTask } = require('../middleware/permissions');

const router = express.Router();
router.use(authRequired);

// 자료 등록 (기사 / 논문 / 영상링크)
// 해당 종류의 할 일을 배정받은 사람만 등록 가능
router.post('/:projectId/resources', projectMemberRequired, async (req, res) => {
  const { type, title, url, memo } = req.body;
  if (!type || !title || !url) {
    return res.status(400).json({ error: '종류, 제목, 링크를 모두 입력하세요.' });
  }
  if (!(await hasCategoryTask(req.project._id, req.user.id, type))) {
    return res.status(403).json({ error: `'${type}' 종류의 할 일을 배정받은 사람만 등록할 수 있습니다. 할 일 탭에서 먼저 추가하세요.` });
  }
  const resource = await Resource.create({
    project: req.project._id,
    uploader: req.user.id,
    type,
    title,
    url,
    memo: memo || '',
  });
  await resource.populate('uploader', 'nickname');
  res.status(201).json({ resource });
});

// 자료 목록
router.get('/:projectId/resources', projectMemberRequired, async (req, res) => {
  const filter = { project: req.project._id };
  if (req.query.type) filter.type = req.query.type;
  const resources = await Resource.find(filter)
    .populate('uploader', 'nickname')
    .sort({ createdAt: -1 });
  res.json({ resources });
});

// 자료 삭제 (등록자 본인 또는 팀장)
router.delete('/:projectId/resources/:resourceId', projectMemberRequired, async (req, res) => {
  const resource = await Resource.findOne({ _id: req.params.resourceId, project: req.project._id });
  if (!resource) return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });
  const isOwner = resource.uploader.toString() === req.user.id;
  const isLeader = req.project.leader.toString() === req.user.id;
  if (!isOwner && !isLeader) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  await resource.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
