const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Ppt } = require('../models');
const { authRequired, projectMemberRequired } = require('../middleware/auth');
const { hasCategoryTask } = require('../middleware/permissions');

const router = express.Router();
router.use(authRequired);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.ppt', '.pptx', '.pdf'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('ppt, pptx, pdf 파일만 업로드할 수 있습니다.'));
  },
});

// PPT 업로드: 'PPT' 종류의 할 일을 배정받은 사람만 가능
router.post('/:projectId/ppts', projectMemberRequired, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일을 선택하세요.' });
  if (!(await hasCategoryTask(req.project._id, req.user.id, 'PPT'))) {
    return res.status(403).json({ error: "'PPT' 종류의 할 일을 배정받은 사람만 업로드할 수 있습니다. 할 일 탭에서 먼저 추가하세요." });
  }
  const ppt = await Ppt.create({
    project: req.project._id,
    uploader: req.user.id,
    originalName: Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
    fileName: req.file.filename,
    scripts: [],
  });
  await ppt.populate('uploader', 'nickname');
  res.status(201).json({ ppt });
});

// PPT 목록
router.get('/:projectId/ppts', projectMemberRequired, async (req, res) => {
  const ppts = await Ppt.find({ project: req.project._id })
    .populate('uploader', 'nickname')
    .sort({ createdAt: -1 });
  res.json({ ppts });
});

// 슬라이드(장)별 대본 추가/수정: '대본' 종류의 할 일을 배정받은 사람만 가능
router.put('/:projectId/ppts/:pptId/scripts', projectMemberRequired, async (req, res) => {
  const { slideNumber, script } = req.body;
  if (!slideNumber) return res.status(400).json({ error: '슬라이드 번호를 입력하세요.' });
  if (!(await hasCategoryTask(req.project._id, req.user.id, '대본'))) {
    return res.status(403).json({ error: "'대본' 종류의 할 일을 배정받은 사람만 대본을 작성할 수 있습니다. 할 일 탭에서 먼저 추가하세요." });
  }
  const ppt = await Ppt.findOne({ _id: req.params.pptId, project: req.project._id });
  if (!ppt) return res.status(404).json({ error: 'PPT를 찾을 수 없습니다.' });

  const existing = ppt.scripts.find((s) => s.slideNumber === Number(slideNumber));
  if (existing) existing.script = script || '';
  else ppt.scripts.push({ slideNumber: Number(slideNumber), script: script || '' });
  ppt.scripts.sort((a, b) => a.slideNumber - b.slideNumber);

  await ppt.save();
  res.json({ ppt });
});

// PPT 삭제 (업로더 본인 또는 팀장)
router.delete('/:projectId/ppts/:pptId', projectMemberRequired, async (req, res) => {
  const ppt = await Ppt.findOne({ _id: req.params.pptId, project: req.project._id });
  if (!ppt) return res.status(404).json({ error: 'PPT를 찾을 수 없습니다.' });
  const isOwner = ppt.uploader.toString() === req.user.id;
  const isLeader = req.project.leader.toString() === req.user.id;
  if (!isOwner && !isLeader) return res.status(403).json({ error: '삭제 권한이 없습니다.' });
  const filePath = path.join(__dirname, '..', 'uploads', ppt.fileName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await ppt.deleteOne();
  res.json({ ok: true });
});

module.exports = router;
