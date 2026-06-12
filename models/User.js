const mongoose = require('mongoose');

// 회원: id / pw / 닉네임 / 이메일
const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true }, // bcrypt 해시 저장
    nickname: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
