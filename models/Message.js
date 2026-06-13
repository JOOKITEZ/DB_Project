const mongoose = require('mongoose');

// 프로젝트 내 메시지(채팅)
const messageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // 삭제된 메시지는 내용을 비우므로, 삭제되지 않은 메시지에 한해 내용 필수
    content: { type: String, trim: true, required: function () { return !this.deleted; } },
    deleted: { type: Boolean, default: false }, // 삭제 시 내용은 비우고 표시만 남긴다
  },
  { timestamps: true }
);

messageSchema.index({ project: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
