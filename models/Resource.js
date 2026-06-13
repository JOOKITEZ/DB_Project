const mongoose = require('mongoose');

// 자료조사 모음: 기사 / 논문 / 영상링크 / 기타(메모 중심, url 선택)
const resourceSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['기사', '논문', '영상', '기타'], required: true },
    title: { type: String, required: true, trim: true },
    url: { type: String, default: '', trim: true }, // 기타는 선택사항
    memo: { type: String, default: '' },
    fileName: { type: String, default: '' }, // 첨부파일 저장명 (선택)
    originalName: { type: String, default: '' }, // 첨부파일 원본명
  },
  { timestamps: true }
);

module.exports = mongoose.model('Resource', resourceSchema);
