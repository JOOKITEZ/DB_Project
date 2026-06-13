const mongoose = require('mongoose');

// 알림: 마감 D-2 / D-1, 기한 초과(지분 차감), 다음 순서 시작
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    type: {
      type: String,
      enum: ['마감임박', '기한초과', '다음순서', '멘션', '일반'],
      default: '일반',
    },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
