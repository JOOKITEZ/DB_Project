// 인증코드 이메일 발송 유틸
// SMTP 환경변수가 있으면 실제 메일을 보내고, 없으면(또는 nodemailer 미설치 시)
// 콘솔에 코드를 출력하는 개발 모드로 동작한다.
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  // nodemailer 미설치 — 콘솔 폴백으로 동작
}

let transporter = null;
if (nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// 반환값 { sent } — 실제 메일 발송 여부
async function sendVerificationEmail(to, code) {
  const subject = '[조각] 인증코드 안내';
  const text = `조각(JOGAK) 인증코드는 ${code} 입니다.\n10분 이내에 입력해주세요.`;
  const html = `<div style="font-family:sans-serif">
    <h2>🧩 조각 인증코드</h2>
    <p>아래 4자리 인증코드를 입력해주세요. (10분 이내 유효)</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
  </div>`;

  if (!transporter) {
    console.log(`\n[메일 미설정] ${to} 로 보낼 인증코드: ${code}\n`);
    return { sent: false };
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return { sent: true };
}

module.exports = { sendVerificationEmail };
