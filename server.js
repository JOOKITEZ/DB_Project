require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');
const { startDeadlineChecker } = require('./jobs/deadlineChecker');

const app = express();
const PORT = process.env.PORT || 3000;

// 업로드 폴더가 없으면 생성
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// API 라우트
app.use('/api/auth', require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/projects', require('./routes/tasks'));
app.use('/api/projects', require('./routes/resources'));
app.use('/api/projects', require('./routes/ppts'));
app.use('/api/projects', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));

// SPA 진입점
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

connectDB().then(() => {
  startDeadlineChecker();
  app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
  });
});
