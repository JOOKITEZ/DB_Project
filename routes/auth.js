const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const { authRequired, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 프로필 이미지 업로드 (이미지 파일만, 2MB 제한)
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname).toLowerCase()}`),
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(path.extname(file.originalname).toLowerCase());
    ok ? cb(null, true) : cb(new Error('이미지 파일(png/jpg/gif/webp)만 업로드할 수 있습니다.'));
  },
});

function publicUser(user) {
  return {
    id: user._id,
    userId: user.userId,
    nickname: user.nickname,
    email: user.email,
    avatar: user.avatar,
    school: user.school,
    major: user.major,
    studentId: user.studentId,
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), userId: user.userId, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 비밀번호 규칙: 6자 이상 + 영문/숫자/특수기호 모두 포함
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

// 회원가입: id / pw / 닉네임 / 이메일 (비밀번호는 bcrypt 해시로 저장)
router.post('/signup', async (req, res) => {
  try {
    const { userId, password, nickname, email } = req.body;
    if (!userId || !password || !nickname || !email) {
      return res.status(400).json({ error: 'id, 비밀번호, 닉네임, 이메일을 모두 입력하세요.' });
    }
    if (!PASSWORD_RULE.test(password)) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이며 영문, 숫자, 특수기호를 모두 포함해야 합니다.' });
    }
    const dup = await User.findOne({ $or: [{ userId }, { email }] });
    if (dup) {
      return res.status(409).json({ error: '이미 사용 중인 id 또는 이메일입니다.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ userId, password: hashed, nickname, email });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
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
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 내 정보
router.get('/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json({ user: publicUser(user) });
});

// 프로필 수정: 닉네임 + 학교/학과/학번 (선택)
router.put('/profile', authRequired, async (req, res) => {
  const { nickname, school, major, studentId } = req.body;
  if (nickname !== undefined && !String(nickname).trim()) {
    return res.status(400).json({ error: '닉네임은 비워둘 수 없습니다.' });
  }
  const user = await User.findById(req.user.id);
  if (nickname !== undefined) user.nickname = String(nickname).trim();
  if (school !== undefined) user.school = String(school).trim();
  if (major !== undefined) user.major = String(major).trim();
  if (studentId !== undefined) user.studentId = String(studentId).trim();
  await user.save();
  res.json({ user: publicUser(user) });
});

// 프로필 이미지 업로드
router.post('/avatar', authRequired, avatarUpload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '이미지 파일을 선택하세요.' });
  const user = await User.findById(req.user.id);
  user.avatar = req.file.filename;
  await user.save();
  res.json({ avatar: user.avatar });
});

module.exports = router;
