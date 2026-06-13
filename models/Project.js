const mongoose = require('mongoose');

// 프로젝트 멤버: 역할(role)과 기여도 점수(score)를 함께 보관
// score는 지분 계산의 기준값. 기본 100점에서 시작하며
// 기한 내 완료 시 +10, 기한 초과 시 -10 으로 변동한다.
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, default: '' },
    isLeader: { type: Boolean, default: false },
    score: { type: Number, default: 100 },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // 초대용 고유 4자리 번호 (생성 시 부여)
    inviteCode: { type: String, required: true, unique: true, length: 4 },
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [memberSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Project', projectSchema);
