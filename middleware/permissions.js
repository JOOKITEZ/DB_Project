const Task = require('../models/Task');

// 해당 종류(category)의 할 일을 배정받은 사람만 그 작업을 수행할 수 있다.
// 예: '논문' 할 일을 배정받아야 논문 자료를 등록할 수 있음.
async function hasCategoryTask(projectId, userId, category) {
  const exists = await Task.exists({ project: projectId, assignee: userId, category });
  return !!exists;
}

module.exports = { hasCategoryTask };
