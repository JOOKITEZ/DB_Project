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

// 메시지 목록 (after 파라미터로 폴링 지원)
router.get('/:projectId/messages', projectMemberRequired, async (req, res) => {
  const filter = { project: req.project._id };
  if (req.query.after) filter.createdAt = { $gt: new Date(req.query.after) };
  const messages = await Message.find(filter)
    .populate('sender', 'nickname avatar')
    .sort({ createdAt: 1 })
    .limit(200);
  res.json({ messages });
});

module.exports = router;
