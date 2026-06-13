const express = require('express');
const Message = require('../models/Message');
const { authRequired, projectMemberRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 메시지 전송
router.post('/:projectId/messages', projectMemberRequired, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '내용을 입력하세요.' });
  const message = await Message.create({
    project: req.project._id,
    sender: req.user.id,
    content: content.trim(),
  });
  await message.populate('sender', 'nickname avatar');
  res.status(201).json({ message });
});

// 메시지 목록 (after 파라미터로 폴링 지원). 삭제된 메시지는 내용 없이 표시만 남긴다.
router.get('/:projectId/messages', projectMemberRequired, async (req, res) => {
  const filter = { project: req.project._id };
  if (req.query.after) filter.createdAt = { $gt: new Date(req.query.after) };
  const docs = await Message.find(filter)
    .populate('sender', 'nickname avatar')
    .sort({ createdAt: 1 })
    .limit(200);
  const messages = docs.map((m) => ({
    _id: m._id,
    sender: m.sender,
    content: m.deleted ? '' : m.content, // 삭제된 메시지는 원문을 내려주지 않음
    deleted: m.deleted,
    createdAt: m.createdAt,
  }));
  res.json({ messages });
});

// 메시지 삭제 (보낸 사람 본인만) — 실제로는 삭제 표시만 남기는 소프트 삭제
router.delete('/:projectId/messages/:messageId', projectMemberRequired, async (req, res) => {
  const message = await Message.findOne({ _id: req.params.messageId, project: req.project._id });
  if (!message) return res.status(404).json({ error: '메시지를 찾을 수 없습니다.' });
  if (message.sender.toString() !== req.user.id) {
    return res.status(403).json({ error: '본인이 보낸 메시지만 삭제할 수 있습니다.' });
  }
  message.deleted = true;
  message.content = '';
  await message.save();
  res.json({ ok: true });
});

module.exports = router;
