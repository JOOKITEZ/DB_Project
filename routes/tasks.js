const express = require('express');
const Task = require('../models/Task');
const Notification = require('../models/Notification');
const { authRequired, projectMemberRequired, leaderRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 할 일 생성 (팀장·팀원 모두 가능): 담당자, 종류, 순서, 최대 기한 설정
router.post('/:projectId/tasks', projectMemberRequired, async (req, res) => {
  const { assignee, title, description, category, order, dueDate } = req.body;
  if (!assignee || !title || order === undefined || !dueDate) {
    return res.status(400).json({ error: '담당자, 제목, 순서, 기한을 모두 입력하세요.' });
  }
  if (!req.project.members.some((m) => m.user.toString() === assignee)) {
    return res.status(400).json({ error: '담당자는 프로젝트 멤버여야 합니다.' });
  }
  const task = await Task.create({
    project: req.project._id,
    assignee,
    title,
    description: description || '',
    category: category || '기타',
    order: Number(order),
    dueDate: new Date(dueDate),
  });
  // 순서 1번 할 일이면 담당자에게 바로 시작 알림
  if (Number(order) === 1) {
    await Notification.create({
      user: assignee,
      project: req.project._id,
      type: '다음순서',
      message: `[${req.project.name}] 첫 번째 할 일 "${title}"이(가) 배정되었습니다. 기한: ${new Date(dueDate).toLocaleDateString('ko-KR')}`,
    });
  }
  res.status(201).json({ task });
});

// 프로젝트의 할 일 목록 (순서대로)
router.get('/:projectId/tasks', projectMemberRequired, async (req, res) => {
  const tasks = await Task.find({ project: req.project._id })
    .populate('assignee', 'nickname userId')
    .sort({ order: 1 });
  res.json({ tasks });
});

// 할 일 상태 변경 (담당자 본인 또는 팀장)
// 완료 처리 시: 다음 순서 담당자에게 알림 + 기한 내 완료면 지분 가산
router.put('/:projectId/tasks/:taskId/status', projectMemberRequired, async (req, res) => {
  const { status } = req.body;
  const task = await Task.findOne({ _id: req.params.taskId, project: req.project._id });
  if (!task) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });

  const isAssignee = task.assignee.toString() === req.user.id;
  const isLeader = req.project.leader.toString() === req.user.id;
  if (!isAssignee && !isLeader) {
    return res.status(403).json({ error: '담당자 또는 팀장만 변경할 수 있습니다.' });
  }
  if (!['진행전', '진행중', '완료'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
  }

  const wasDone = task.status === '완료';
  task.status = status;

  if (status === '완료' && !wasDone) {
    task.completedAt = new Date();

    // 기한 내 완료면 기여도 가산 (+10) — rewardApplied로 중복 가산 방지
    if (task.completedAt <= task.dueDate && !task.rewardApplied && !task.penaltyApplied) {
      const member = req.project.members.find((m) => m.user.toString() === task.assignee.toString());
      if (member) {
        member.score += 10;
        task.rewardApplied = true;
        await req.project.save();
      }
    }

    // 다음 순서의 할 일 담당자에게 알림
    const nextTask = await Task.findOne({
      project: req.project._id,
      order: { $gt: task.order },
      status: { $ne: '완료' },
    }).sort({ order: 1 });
    if (nextTask) {
      await Notification.create({
        user: nextTask.assignee,
        project: req.project._id,
        type: '다음순서',
        message: `[${req.project.name}] 이전 단계 "${task.title}"이(가) 완료되었습니다. 이제 "${nextTask.title}"을(를) 시작하세요! 기한: ${nextTask.dueDate.toLocaleDateString('ko-KR')}`,
      });
    }
  } else if (status !== '완료' && wasDone && task.rewardApplied) {
    // 완료를 취소하면 받았던 가산점도 회수
    const member = req.project.members.find((m) => m.user.toString() === task.assignee.toString());
    if (member) {
      member.score -= 10;
      task.rewardApplied = false;
      await req.project.save();
    }
  }

  await task.save();
  res.json({ task });
});

// 할 일 삭제 (팀장 전용)
// 기한 내 완료로 가산점(+10)을 받은 할 일이면, 삭제 시 가산점도 함께 회수한다
router.delete('/:projectId/tasks/:taskId', projectMemberRequired, leaderRequired, async (req, res) => {
  const task = await Task.findOne({ _id: req.params.taskId, project: req.project._id });
  if (!task) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });

  // rewardApplied 플래그가 없던 예전 데이터도 완료 조건으로 판별
  const rewarded = task.rewardApplied ||
    (task.status === '완료' && task.completedAt && task.completedAt <= task.dueDate && !task.penaltyApplied);
  if (rewarded) {
    const member = req.project.members.find((m) => m.user.toString() === task.assignee.toString());
    if (member) {
      member.score -= 10;
      await req.project.save();
    }
  }

  await task.deleteOne();

  // 남은 할 일을 순서(order)대로 1,2,3,… 으로 다시 매겨, 삭제로 생긴 빈 번호를 앞으로 당긴다
  const remaining = await Task.find({ project: req.project._id }).sort({ order: 1, createdAt: 1 });
  const ops = [];
  remaining.forEach((t, i) => {
    if (t.order !== i + 1) ops.push(t.updateOne({ order: i + 1 }));
  });
  if (ops.length) await Promise.all(ops);

  res.json({ ok: true });
});

module.exports = router;
