const mongoose = require('mongoose');

// 해야 하는 일(할 일)
// - order: 진행 순서. 한 일이 완료되면 다음 order의 담당자에게 알림이 간다.
// - dueDate: 최대 기한. D-2 / D-1 시점에 알림, 초과 시 지분 차감.
// - category: 할 일 종류. 해당 종류의 할 일을 배정받은 사람만
//   자료조사(기사/논문/영상) 등록, PPT 업로드, 대본 작성을 할 수 있다.
const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: {
      type: String,
      enum: ['기사', '논문', '영상', 'PPT', '대본', '기타'],
      default: '기타',
    },
    order: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ['진행전', '진행중', '완료', '기한초과'],
      default: '진행전',
    },
    completedAt: { type: Date },
    // 중복 알림/중복 가감점 방지용 플래그
    notifiedTwoDays: { type: Boolean, default: false },
    notifiedOneDay: { type: Boolean, default: false },
    penaltyApplied: { type: Boolean, default: false },
    rewardApplied: { type: Boolean, default: false }, // 기한 내 완료로 +10을 받았는지
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, order: 1 });

module.exports = mongoose.model('Task', taskSchema);
