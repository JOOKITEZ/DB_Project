const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authRequired, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), userId: user.userId, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 회원가입: id / pw / 닉네임 / 이메일
router.post('/signup', async (req, res) => {
  try {
    const { userId, password, nickname, email } = req.body;
    if (!userId || !password || !nickname || !email) {
      return res.status(400).json({ error: 'id, 비밀번호, 닉네임, 이메일을 모두 입력하세요.' });
    }
    const dup = await User.findOne({ $or: [{ userId }, { email }] });
    if (dup) {
      return res.status(409).json({ error: '이미 사용 중인 id 또는 이메일입니다.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ userId, password: hashed, nickname, email });
    res.status(201).json({ token: signToken(user), user: { id: user._id, userId, nickname, email } });
  } catch (err) {
    res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'id 또는 비밀번호가 올바르지 않습니다.' });
    }
    res.json({
      token: signToken(user),
      user: { id: user._id, userId: user.userId, nickname: user.nickname, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 내 정보
router.get('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ user });
});

module.exports = router;
