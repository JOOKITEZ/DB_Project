const mongoose = require('mongoose');

// ─── User ────────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    userId:    { type: String, required: true, unique: true, trim: true },
    password:  { type: String, required: true }, // bcrypt 해시 저장
    nickname:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar:    { type: String, default: '' },    // 프로필 이미지 파일명 (uploads/)
    school:    { type: String, default: '' },
    major:     { type: String, default: '' },
    studentId: { type: String, default: '' },
  },
  { timestamps: true }
);

// ─── Project ─────────────────────────────────────────────────────────────────
// score: 기본 100점 시작, 기한 내 완료 +10 / 기한 초과 -10 으로 지분 변동
const memberSchema = new mongoose.Schema(
  {
    user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role:     { type: String, default: '' },
    isLeader: { type: Boolean, default: false },
    score:    { type: Number, default: 100 },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // 초대용 고유 4자리 번호 (생성 시 부여)
    inviteCode:  { type: String, required: true, unique: true, length: 4 },
    leader:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members:     [memberSchema],
  },
  { timestamps: true }
);

// ─── Task ─────────────────────────────────────────────────────────────────────
// order: 진행 순서 — 완료 시 다음 order 담당자에게 알림
// dueDate: D-2 / D-1 알림, 초과 시 지분 차감
// category: 해당 종류 할 일을 배정받은 사람만 자료·PPT·대본 작업 가능
const taskSchema = new mongoose.Schema(
  {
    project:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignee:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    title:           { type: String, required: true, trim: true },
    description:     { type: String, default: '' },
    category: {
      type: String,
      enum: ['기사', '논문', '영상', 'PPT', '대본', '기타'],
      default: '기타',
    },
    order:   { type: Number, required: true },
    dueDate: { type: Date,   required: true },
    status: {
      type: String,
      enum: ['진행전', '진행중', '완료', '기한초과'],
      default: '진행전',
    },
    completedAt: { type: Date },
    // 중복 알림·중복 가감점 방지 플래그
    notifiedTwoDays: { type: Boolean, default: false },
    notifiedOneDay:  { type: Boolean, default: false },
    penaltyApplied:  { type: Boolean, default: false },
    rewardApplied:   { type: Boolean, default: false }, // 기한 내 완료로 +10을 받았는지
  },
  { timestamps: true }
);
taskSchema.index({ project: 1, order: 1 });

// ─── Resource ─────────────────────────────────────────────────────────────────
// 자료조사 모음: 기사 / 논문 / 영상링크 / 기타(메모 중심, url 선택)
const resourceSchema = new mongoose.Schema(
  {
    project:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploader:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    type:         { type: String, enum: ['기사', '논문', '영상', '기타'], required: true },
    title:        { type: String, required: true, trim: true },
    url:          { type: String, default: '', trim: true }, // 기타는 선택사항
    memo:         { type: String, default: '' },
    fileName:     { type: String, default: '' }, // 첨부파일 저장명 (선택)
    originalName: { type: String, default: '' }, // 첨부파일 원본명
  },
  { timestamps: true }
);

// ─── ScoreLog ─────────────────────────────────────────────────────────────────
// 지분 점수 변동 내역 (+10 / -10 이유를 투명하게 기록)
const scoreLogSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    delta:   { type: Number, required: true }, // +10, -10 등
    reason:  { type: String, required: true }, // 예: "기한 내 완료: PPT 제작"
    task:    { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  },
  { timestamps: true }
);
scoreLogSchema.index({ project: 1, createdAt: -1 });

// ─── Ppt ──────────────────────────────────────────────────────────────────────
const slideScriptSchema = new mongoose.Schema(
  {
    slideNumber: { type: Number, required: true },
    script:      { type: String, default: '' },
  },
  { _id: false }
);

const pptSchema = new mongoose.Schema(
  {
    project:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    uploader:     { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    originalName: { type: String, required: true },
    fileName:     { type: String, required: true }, // 서버 저장 파일명
    scripts:      [slideScriptSchema],
  },
  { timestamps: true }
);

// ─── Message ──────────────────────────────────────────────────────────────────
// deleted 메시지는 content를 비우고 표시만 남기는 소프트 삭제
const messageSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    sender:  { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    content: { type: String, trim: true, required: function () { return !this.deleted; } },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);
messageSchema.index({ project: 1, createdAt: 1 });

// ─── Notification ─────────────────────────────────────────────────────────────
const notificationSchema = new mongoose.Schema(
  {
    user:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    type: {
      type: String,
      enum: ['마감임박', '기한초과', '다음순서', '멘션', '일반'],
      default: '일반',
    },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

// ─── VerificationCode ─────────────────────────────────────────────────────────
// 아이디/비밀번호 찾기용 이메일 인증코드 (이메일당 1건, TTL 10분 자동 만료)
const verificationCodeSchema = new mongoose.Schema(
  {
    email:     { type: String, required: true, unique: true },
    code:      { type: String, required: true }, // 4자리 숫자
    expiresAt: { type: Date,   required: true },
  },
  { timestamps: true }
);
verificationCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─── Exports ──────────────────────────────────────────────────────────────────
const User             = mongoose.model('User',             userSchema);
const Project          = mongoose.model('Project',          projectSchema);
const Task             = mongoose.model('Task',             taskSchema);
const Resource         = mongoose.model('Resource',         resourceSchema);
const ScoreLog         = mongoose.model('ScoreLog',         scoreLogSchema);
const Ppt              = mongoose.model('Ppt',              pptSchema);
const Message          = mongoose.model('Message',          messageSchema);
const Notification     = mongoose.model('Notification',     notificationSchema);
const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

module.exports = { User, Project, Task, Resource, ScoreLog, Ppt, Message, Notification, VerificationCode };
