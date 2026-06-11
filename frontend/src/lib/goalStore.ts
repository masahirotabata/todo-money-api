// src/lib/goalStore.ts
// Goal/TaskデータをサーバではなくlocalStorageに保存するローカルファースト実装

export type GoalListItem = {
  id: number;
  title: string;
  annualIncome: number;
  daysPerYear: number;
  achieved: boolean;
  taskCount: number;
  completedTaskCount: number;
  perTaskReward: number;
  earnedAmount: number;
};

export type TaskItem = {
  id: number;
  goalId: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
};

type StoredGoal = {
  id: number;
  title: string;
  annualIncome: number;
  daysPerYear: number;
  achieved: boolean;
  createdAt: string;
};

type StoredTask = {
  id: number;
  goalId: number;
  title: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
};

function getCurrentUserKey() {
  const savedUserKey = localStorage.getItem("todoMoneyUserKey");
  if (savedUserKey) return savedUserKey;

  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(
      payload.email ?? payload.sub ?? payload.userId ?? payload.id ?? "user"
    );
  } catch {
    return "user";
  }
}

function goalsKey() {
  return `todo-money:goals:v1:${getCurrentUserKey()}`;
}

function tasksKey() {
  return `todo-money:tasks:v1:${getCurrentUserKey()}`;
}

function goalSeqKey() {
  return `todo-money:goalSeq:v1:${getCurrentUserKey()}`;
}

function taskSeqKey() {
  return `todo-money:taskSeq:v1:${getCurrentUserKey()}`;
}

function loadGoals(): StoredGoal[] {
  try {
    const raw = localStorage.getItem(goalsKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGoals(list: StoredGoal[]) {
  localStorage.setItem(goalsKey(), JSON.stringify(list));
}

function loadTasks(): StoredTask[] {
  try {
    const raw = localStorage.getItem(tasksKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTasks(list: StoredTask[]) {
  localStorage.setItem(tasksKey(), JSON.stringify(list));
}

function nextGoalId(): number {
  const current = Number(localStorage.getItem(goalSeqKey()) ?? "0");
  const next = current + 1;
  localStorage.setItem(goalSeqKey(), String(next));
  return next;
}

function nextTaskId(): number {
  const current = Number(localStorage.getItem(taskSeqKey()) ?? "0");
  const next = current + 1;
  localStorage.setItem(taskSeqKey(), String(next));
  return next;
}

function toGoalListItem(goal: StoredGoal, tasks: StoredTask[]): GoalListItem {
  const goalTasks = tasks.filter((t) => t.goalId === goal.id);
  const taskCount = goalTasks.length;
  const completedTaskCount = goalTasks.filter((t) => t.completed).length;

  const dailyIncome = goal.annualIncome / goal.daysPerYear;
  const perTaskReward = taskCount === 0 ? 0 : dailyIncome / taskCount;
  const earnedAmount = perTaskReward * completedTaskCount;

  return {
    id: goal.id,
    title: goal.title,
    annualIncome: goal.annualIncome,
    daysPerYear: goal.daysPerYear,
    achieved: goal.achieved,
    taskCount,
    completedTaskCount,
    perTaskReward,
    earnedAmount,
  };
}

export async function listGoals(): Promise<GoalListItem[]> {
  const goals = loadGoals();
  const tasks = loadTasks();
  return goals.map((g) => toGoalListItem(g, tasks));
}

export async function createGoal(
  title: string,
  annualIncome: number
): Promise<GoalListItem> {
  const goal: StoredGoal = {
    id: nextGoalId(),
    title,
    annualIncome,
    daysPerYear: 365,
    achieved: false,
    createdAt: new Date().toISOString(),
  };

  const goals = loadGoals();
  goals.push(goal);
  saveGoals(goals);

  return toGoalListItem(goal, loadTasks());
}

export async function deleteGoal(goalId: number): Promise<void> {
  const goals = loadGoals().filter((g) => g.id !== goalId);
  saveGoals(goals);

  const tasks = loadTasks().filter((t) => t.goalId !== goalId);
  saveTasks(tasks);
}

export async function listTasks(goalId: number): Promise<TaskItem[]> {
  return loadTasks()
    .filter((t) => t.goalId === goalId)
    .map((t) => ({
      id: t.id,
      goalId: t.goalId,
      title: t.title,
      completed: t.completed,
      completedAt: t.completedAt,
    }));
}

export async function addTask(
  goalId: number,
  title: string
): Promise<TaskItem> {
  const task: StoredTask = {
    id: nextTaskId(),
    goalId,
    title,
    completed: false,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };

  const tasks = loadTasks();
  tasks.push(task);
  saveTasks(tasks);

  return {
    id: task.id,
    goalId: task.goalId,
    title: task.title,
    completed: task.completed,
    completedAt: task.completedAt,
  };
}

export async function completeTask(
  taskId: number
): Promise<{ rewardAmount: number; currency: string }> {
  const tasks = loadTasks();
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    throw { status: 404, message: "タスクが見つかりません。" };
  }

  if (task.completed) {
    return { rewardAmount: 0, currency: "USD" };
  }

  const goals = loadGoals();
  const goal = goals.find((g) => g.id === task.goalId);

  const taskCount = tasks.filter((t) => t.goalId === task.goalId).length;
  const dailyIncome = goal ? goal.annualIncome / goal.daysPerYear : 0;
  const perTaskReward = taskCount === 0 ? 0 : dailyIncome / taskCount;

  task.completed = true;
  task.completedAt = new Date().toISOString();
  saveTasks(tasks);

  return { rewardAmount: perTaskReward, currency: "USD" };
}
