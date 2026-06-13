const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Resource = require('../models/Resource');
const { authRequired, projectMemberRequired } = require('../middleware/auth');
const { hasCategoryTask } = require('../middleware/permissions');

const router = express.Router();
router.use(authRequired);

// 자료 첨부파일 업로드 (20MB 제한)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `res-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// 자료 등록 (기사 / 논문 / 영상링크 / 기타) — 파일 첨부 선택 가능
// 기사·논문·영상은 해당 종류의 할 일을 배정받은 사람만 등록 가능
// 기타는 누구나 등록 가능하며 url은 선택, 메모가 본문 역할을 한다
router.post('/:projectId/resources', projectMemberRequired, upload.single('file'), async (req, res) => {
  const { type, title, url, memo } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: '종류와 제목을 입력하세요.' });
  }
  if (type !== '기타') {
    if (!url && !req.file) return res.status(400).json({ error: '링크(URL) 또는 첨부파일이 필요합니다.' });
    if (!(await hasCategoryTask(req.project._id, req.user.id, type))) {
      return res.status(403).json({ error: `'${type}' 종류의 할 일을 배정받은 사람만 등록할 수 있습니다. 할 일 탭에서 먼저 추가하세요.` });
    }
  }
  const resource = await Resource.create({
    project: req.project._id,
    uploader: req.user.id,
    type,
    title,
    url: url || '',
    memo: memo || '',
    fileName: req.file ? req.file.filename : '',
    originalName: req.file ? Buffer.from(req.file.originalname, 'latin1').toString('utf8') : '',
  });
  await resource.populate('uploader', 'nickname');
  res.status(201).json({ resource });
});

// 자료 목록 (?type= 종류 필터, ?q= 제목 검색)
router.get('/:projectId/resources', projectMemberRequired, async (req, res) => {
  const filter = { project: req.project._id };
  if (req.query.type) filter.type = req.query.type;
  if (req.query.q && req.query.q.trim()) {
    filter.title = { $regex: req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }
  const resources = await Resource.find(filter)
    .populate('uploader', 'nickname')
    .sort({ createdAt: -1 });
  res.json({ resources });
});

// 자료 삭제 (등록자 본인만 가능 — 팀장도 남의 자료는 삭제 불가)
router.delete('/:projectId/resources/:resourceId', projectMemberRequired, async (req, res) => {
  const resource = await Resource.findOne({ _id: req.params.resourceId, project: req.project._id });
  if (!resource) return res.status(404).json({ error: '자료를 찾을 수 없습니다.' });
  if (resource.uploader.toString() !== req.user.id) {
    return res.status(403).json({ error: '본인이 등록한 자료만 삭제할 수 있습니다.' });
  }
  if (resource.fileName) {
    const filePath = path.join(__dirname, '..', 'uploads', resource.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await resource.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
