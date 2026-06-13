const mongoose = require('mongoose');

// 지분 점수 변동 내역 (왜 +10 / −10 되었는지 투명하게 보여주기 위함)
const scoreLogSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    delta: { type: Number, required: true }, // +10, -10 등
    reason: { type: String, required: true }, // 예: "기한 내 완료: PPT 제작"
    task: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  },
  { timestamps: true }
);

scoreLogSchema.index({ project: 1, createdAt: -1 });

module.exports = mongoose.model('ScoreLog', scoreLogSchema);
