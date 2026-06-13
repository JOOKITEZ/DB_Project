const express = require('express');
const { Notification } = require('../models');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 내 알림 목록 (최신순)
router.get('/', async (req, res) => {
  const notifications = await Notification.find({ user: req.user.id })
    .populate('project', 'name')
    .sort({ createdAt: -1 })
    .limit(50);
  const unreadCount = await Notification.countDocuments({ user: req.user.id, read: false });
  res.json({ notifications, unreadCount });
});

// 모두 읽음 처리
router.put('/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
  res.json({ ok: true });
});

module.exports = router;
