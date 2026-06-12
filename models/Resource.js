const mongoose = require('mongoose');

// 자료조사 모음: 기사 / 논문 / 영상링크
const resourceSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['기사', '논문', '영상'], required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    memo: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
