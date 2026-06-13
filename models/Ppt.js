const mongoose = require('mongoose');

// PPT 장(슬라이드)별 대본
const slideScriptSchema = new mongoose.Schema(
  {
    slideNumber: { type: Number, required: true },
    script: { type: String, default: '' },
  },
  { _id: false }
);

// 업로드된 PPT 파일 + 슬라이드별 대본
const pptSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalName: { type: String, required: true },
    fileName: { type: String, required: true }, // 서버 저장 파일명
    scripts: [slideScriptSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ppt', pptSchema);
