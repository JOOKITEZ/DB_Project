const mongoose = require('mongoose');

// 프로젝트 내 메시지(채팅)
const messageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

messageSchema.index({ project: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);
