const mongoose = require('mongoose');

// 아이디/비밀번호 찾기용 이메일 인증코드 (이메일당 1건, 10분 후 TTL 자동 만료)
const verificationCodeSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    code: { type: String, required: true }, // 4자리 숫자
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL 인덱스: expiresAt 이 지나면 문서 자동 삭제
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);
