const cron = require('node-cron');
const { Task, Project, Notification, ScoreLog } = require('../models');

const DAY_MS = 24 * 60 * 60 * 1000;
const PENALTY = 10; // 기한 초과 시 차감 점수

// 미완료 할 일들을 검사해서
// 1) 기한 2일 전 / 1일 전 알림 (각 1회)
// 2) 기한 초과 시 상태 변경 + 지분(점수) 차감 + 알림
async function checkDeadlines() {
  const now = new Date();
  const tasks = await Task.find({ status: { $ne: '완료' } }).populate('project', 'name');

  for (const task of tasks) {
    if (!task.project) continue;
    const remaining = task.dueDate.getTime() - now.getTime();
    const dueStr = task.dueDate.toLocaleDateString('ko-KR');

    if (remaining <= 0) {
      // 기한 초과: 지분 차감은 1회만
      if (!task.penaltyApplied) {
        task.status = '기한초과';
        task.penaltyApplied = true;
        await task.save();
        await Project.updateOne(
          { _id: task.project._id, 'members.user': task.assignee },
          { $inc: { 'members.$.score': -PENALTY } }
        );
        await ScoreLog.create({
          project: task.project._id, user: task.assignee, delta: -PENALTY,
          reason: `기한 초과: ${task.title}`, task: task._id,
        });
        await Notification.create({
          user: task.assignee,
          project: task.project._id,
          type: '기한초과',
          message: `[${task.project.name}] "${task.title}"의 기한(${dueStr})이 지났습니다. 프로젝트 지분이 차감되었습니다.`,
        });
      }
    } else if (remaining <= DAY_MS && !task.notifiedOneDay) {
      // 하루 남았을 때 알림
      task.notifiedOneDay = true;
      await task.save();
      await Notification.create({
        user: task.assignee,
        project: task.project._id,
        type: '마감임박',
        message: `[${task.project.name}] "${task.title}"의 기한이 하루 남았습니다! (기한: ${dueStr})`,
      });
    } else if (remaining <= 2 * DAY_MS && !task.notifiedTwoDays) {
      // 이틀 남았을 때 알림
      task.notifiedTwoDays = true;
      await task.save();
      await Notification.create({
        user: task.assignee,
        project: task.project._id,
        type: '마감임박',
        message: `[${task.project.name}] "${task.title}"의 기한이 이틀 남았습니다. (기한: ${dueStr})`,
      });
    }
  }
}

// 매시 정각마다 검사 + 서버 시작 시 1회 즉시 실행
function startDeadlineChecker() {
  checkDeadlines().catch((err) => console.error('마감 검사 오류:', err.message));
  cron.schedule('0 * * * *', () => {
    checkDeadlines().catch((err) => console.error('마감 검사 오류:', err.message));
  });
  console.log('마감 알림 스케줄러 시작 (매시 정각 실행)');
}

module.exports = { startDeadlineChecker, checkDeadlines };
