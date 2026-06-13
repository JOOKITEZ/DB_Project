const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { User, VerificationCode } = require('../models');
const { sendVerificationEmail } = require('../utils/mailer');
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

// ===== 아이디 / 비밀번호 찾기 (이메일 인증코드) =====

// 1단계: 이메일로 4자리 인증코드 발송 (가입된 이메일이어야 함)
router.post('/find/send-code', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!email) return res.status(400).json({ error: '이메일을 입력하세요.' });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: '가입된 이메일이 아닙니다.' });

    const code = String(Math.floor(1000 + Math.random() * 9000)); // 4자리
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분
    await VerificationCode.findOneAndUpdate(
      { email },
      { code, expiresAt },
      { upsert: true, new: true }
    );

    const { sent } = await sendVerificationEmail(email, code);
    // 메일 설정이 없으면 개발 편의를 위해 코드를 함께 내려준다 (서버 콘솔에도 출력됨)
    res.json({ ok: true, sent, ...(sent ? {} : { devCode: code }) });
  } catch (err) {
    res.status(500).json({ error: '인증코드 발송 중 오류가 발생했습니다.' });
  }
});

// 인증코드 검증 (공통)
async function checkCode(email, code) {
  const record = await VerificationCode.findOne({ email });
  if (!record) return '인증코드를 먼저 요청하세요.';
  if (record.expiresAt < new Date()) return '인증코드가 만료되었습니다. 다시 요청하세요.';
  if (record.code !== String(code).trim()) return '인증코드가 일치하지 않습니다.';
  return null;
}

// 2단계: 인증코드 확인 → 성공 시 아이디를 알려준다 (아이디 찾기)
router.post('/find/verify-code', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const error = await checkCode(email, req.body.code);
    if (error) return res.status(400).json({ error });
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: '가입된 이메일이 아닙니다.' });
    res.json({ ok: true, userId: user.userId });
  } catch (err) {
    res.status(500).json({ error: '인증 중 오류가 발생했습니다.' });
  }
});

// 3단계(비밀번호 찾기): 인증코드 재확인 후 비밀번호 변경
router.post('/find/reset-password', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    const { code, newPassword } = req.body;
    const error = await checkCode(email, code);
    if (error) return res.status(400).json({ error });
    if (!PASSWORD_RULE.test(newPassword || '')) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이며 영문, 숫자, 특수기호를 모두 포함해야 합니다.' });
    }
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: '가입된 이메일이 아닙니다.' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await VerificationCode.deleteOne({ email }); // 사용한 코드 폐기
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: '비밀번호 변경 중 오류가 발생했습니다.' });
  }
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
