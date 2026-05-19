// src/pages/GoalsPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearToken,
  listGoals,
  createGoal,
  addTask,
  listTasks,
  completeTask,
  deleteAccount,
  GoalListItem,
  TaskItem,
} from "../lib/api";

import MoneyRainOverlay from "../components/MoneyRainOverlay";

type ScheduleHistoryItem = {
  id: string;
  scheduleId: string;
  date: string;
  doneAt: string;
  title: string;
};

type LocalSchedule = {
  id: string;
  title: string;
  memo?: string;
  startDate: string;
  endDate: string;
  weekdays?: boolean[];
  oneShot?: boolean;
  completedDates?: string[];
  tags?: string[];
  taskRef?: {
    goalId: number;
    taskId: number;
  };
};

type GoalScheduleProgress = {
  scheduleId: string;
  goalId: number;
  goalTitle: string;
  title: string;
  startDate: string;
  endDate: string;
  total: number;
  done: number;
  percent: number;
  cells: boolean[];
};

type TabId = "todo" | "history";
type LifeTagId = "side_business" | "health" | "study" | "output" | "sleep";

type LifeTag = {
  id: LifeTagId;
  label: string;
  statusName: string;
  emoji: string;
};

const LIFE_TAGS: LifeTag[] = [
  { id: "side_business", label: "副業", statusName: "副業力", emoji: "💰" },
  { id: "health", label: "健康", statusName: "健康", emoji: "💪" },
  { id: "study", label: "学習", statusName: "学習", emoji: "📚" },
  { id: "output", label: "発信", statusName: "発信", emoji: "📣" },
  { id: "sleep", label: "睡眠", statusName: "睡眠", emoji: "🌙" },
];

type GoalTagMap = Record<number, LifeTagId>;

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "https://todo-money-api.onrender.com";

function getToken() {
  return localStorage.getItem("todoMoneyToken") ?? "";
}

function getCurrentUserKey() {
  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    return (
      payload.sub ??
      payload.email ??
      payload.userId ??
      payload.id ??
      "user"
    );
  } catch {
    return "user";
  }
}

function scheduleKey() {
  return `todo-money:schedules:v1:${getCurrentUserKey()}`;
}

function scheduleHistoryKey() {
  return `todo-money:scheduleHistory:v1:${getCurrentUserKey()}`;
}

function goalTagKey() {
  return `todo-money:goalTags:v1:${getCurrentUserKey()}`;
}

function loadGoalTags(): GoalTagMap {
  try {
    const raw = localStorage.getItem(goalTagKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGoalTags(map: GoalTagMap) {
  localStorage.setItem(goalTagKey(), JSON.stringify(map));
}

function loadSchedules(): LocalSchedule[] {
  try {
    const raw = localStorage.getItem(scheduleKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchedules(list: LocalSchedule[]) {
  localStorage.setItem(scheduleKey(), JSON.stringify(list));
}

function loadHistory(): ScheduleHistoryItem[] {
  try {
    const raw = localStorage.getItem(scheduleHistoryKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(list: ScheduleHistoryItem[]) {
  localStorage.setItem(scheduleHistoryKey(), JSON.stringify(list));
}

function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function ymdToNum(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function occursOnDate(s: LocalSchedule, dateStr: string) {
  if (s.oneShot || !s.weekdays || s.weekdays.length === 0) {
    return s.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(s.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(s.endDate)) return false;

  const d = parseYMD(dateStr);
  return !!s.weekdays[d.getDay()];
}

function getOccurrenceDates(s: LocalSchedule) {
  const dates: string[] = [];
  if (!s.startDate) return dates;

  if (s.oneShot || !s.weekdays || s.weekdays.length === 0 || !s.endDate) {
    dates.push(s.startDate);
    return dates;
  }

  let current = parseYMD(s.startDate);
  const end = parseYMD(s.endDate);

  while (current <= end) {
    const dateStr =
      current.getFullYear() +
      "-" +
      String(current.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(current.getDate()).padStart(2, "0");

    if (occursOnDate(s, dateStr)) dates.push(dateStr);
    current = addDays(current, 1);
  }

  return dates;
}

function calcGoalScheduleProgresses(
  goalId: number,
  goalTitle: string,
  schedules: LocalSchedule[]
): GoalScheduleProgress[] {
  return schedules
    .filter((s) => s.taskRef?.goalId === goalId)
    .map((s) => {
      const dates = getOccurrenceDates(s);
      const cells = dates.map((dateStr) =>
        s.completedDates?.includes(dateStr) ?? false
      );

      const done = cells.filter(Boolean).length;
      const total = cells.length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);

      return {
        scheduleId: s.id,
        goalId,
        goalTitle,
        title: s.title,
        startDate: s.startDate,
        endDate: s.endDate,
        total,
        done,
        percent,
        cells,
      };
    })
    .filter((x) => x.total > 0);
}

async function deleteGoalApi(goalId: number) {
  const token = getToken();

  const res = await fetch(`${API_BASE}/api/goals/${goalId}`, {
    method: "DELETE",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Goal削除に失敗しました: ${res.status}`);
  }
}

function getTag(tagId?: LifeTagId) {
  return LIFE_TAGS.find((t) => t.id === tagId) ?? LIFE_TAGS[0];
}

export default function GoalsPage() {
  const nav = useNavigate();

  const [showSplash, setShowSplash] = useState(true);
  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>({});
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("副業で月5万");
  const [newIncome, setNewIncome] = useState(600000);
  const [newGoalTag, setNewGoalTag] = useState<LifeTagId>("side_business");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [goalTags, setGoalTags] = useState<GoalTagMap>(() => loadGoalTags());
  const [activeTab, setActiveTab] = useState<TabId>("todo");

  const [rainSeed, setRainSeed] = useState(0);
  const [moneyGain, setMoneyGain] = useState("");
  const [showMoneyGain, setShowMoneyGain] = useState(false);
  const prevTotalEarnedRef = useRef<number>(0);

  const [openGoals, setOpenGoals] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );
  const [schedules, setSchedules] = useState<LocalSchedule[]>(() =>
    loadSchedules()
  );

  function refreshToday() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
    setGoalTags(loadGoalTags());
  }

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onFocus = () => refreshToday();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  async function refreshGoals() {
    const g = await listGoals();
    setGoals(g);
  }

  async function loadTasks(goalId: number) {
    const t = await listTasks(goalId);
    setTasksByGoal((m) => ({ ...m, [goalId]: t }));
  }

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        await refreshGoals();
        refreshToday();
      } catch (e: any) {
        setError(e?.message ?? "読み込みに失敗しました");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const map: Record<number, TaskItem[]> = {};
      for (const g of goals) {
        try {
          map[g.id] = await listTasks(g.id);
        } catch {
          map[g.id] = [];
        }
      }
      setTasksByGoal(map);
    })();
  }, [goals]);

  useEffect(() => {
    const total = goals.reduce(
      (sum: number, g: any) => sum + (g.earnedAmount ?? g.earned ?? 0),
      0
    );
    if (total > prevTotalEarnedRef.current) setRainSeed(Date.now());
    prevTotalEarnedRef.current = total;
  }, [goals]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    saveGoalTags(goalTags);
  }, [goalTags]);

  const allProgressItems = useMemo(() => {
    return goals.flatMap((g: any) =>
      calcGoalScheduleProgresses(g.id, g.title, schedules)
    );
  }, [goals, schedules]);

  const allProgressTotal = allProgressItems.reduce((sum, x) => sum + x.total, 0);
  const allProgressDone = allProgressItems.reduce((sum, x) => sum + x.done, 0);
  const allProgressPercent =
    allProgressTotal === 0
      ? 0
      : Math.round((allProgressDone / allProgressTotal) * 100);

  const statusItems = useMemo(() => {
    return LIFE_TAGS.map((tag) => {
      const goalIds = goals
        .filter((g: any) => (goalTags[g.id] ?? "side_business") === tag.id)
        .map((g: any) => g.id);

      const items = allProgressItems.filter((item) =>
        goalIds.includes(item.goalId)
      );

      const total = items.reduce((sum, x) => sum + x.total, 0);
      const done = items.reduce((sum, x) => sum + x.done, 0);
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      const level = Math.floor(done / 5) + 1;

      return {
        tag,
        total,
        done,
        percent,
        level,
      };
    }).filter(
      (x) =>
        x.total > 0 ||
        goals.some(
          (g: any) => (goalTags[g.id] ?? "side_business") === x.tag.id
        )
    );
  }, [goals, goalTags, allProgressItems]);

  async function onCreateGoal() {
    setError(null);
    try {
      await createGoal(newTitle, Number(newIncome));
      const latest = await listGoals();
      setGoals(latest);

      const created = latest
        .slice()
        .sort((a: any, b: any) => Number(b.id) - Number(a.id))[0] as any;

      if (created?.id) {
        const next = { ...goalTags, [created.id]: newGoalTag };
        setGoalTags(next);
        saveGoalTags(next);
      }

      setShowCreateModal(false);
    } catch (e: any) {
      setError(e?.message ?? "Goal作成に失敗しました");
    }
  }

  async function onDeleteGoal(goalId: number, title: string) {
    if (
      !confirm(
        `「${title}」を削除しますか？\n紐づくカレンダースケジュールも削除されます。`
      )
    ) {
      return;
    }

    setError(null);

    try {
      await deleteGoalApi(goalId);

      const deletedScheduleIds = schedules
        .filter((s) => s.taskRef?.goalId === goalId)
        .map((s) => s.id);

      const nextSchedules = schedules.filter((s) => s.taskRef?.goalId !== goalId);
      setSchedules(nextSchedules);
      saveSchedules(nextSchedules);

      const nextHistory = history.filter(
        (h) => !deletedScheduleIds.includes(h.scheduleId)
      );
      setHistory(nextHistory);
      saveHistory(nextHistory);

      setOpenGoals((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });

      setTasksByGoal((prev) => {
        const next = { ...prev };
        delete next[goalId];
        return next;
      });

      setGoalTags((prev) => {
        const next = { ...prev };
        delete next[goalId];
        saveGoalTags(next);
        return next;
      });

      await refreshGoals();
    } catch (e: any) {
      setError(e?.message ?? "Goal削除に失敗しました");
    }
  }

  function onChangeGoalTag(goalId: number, tagId: LifeTagId) {
    setGoalTags((prev) => {
      const next = { ...prev, [goalId]: tagId };
      saveGoalTags(next);
      return next;
    });
  }

  async function onAddTask(goalId: number) {
    const title = prompt("タスク名を入力してください");
    if (!title) return;

    setError(null);
    try {
      await addTask(goalId, title);
      await refreshGoals();
      await loadTasks(goalId);
    } catch (e: any) {
      setError(e?.message ?? "タスク追加に失敗しました");
    }
  }

  async function onComplete(taskId: number, goalId: number) {
    setError(null);

    try {
      const result: any = await completeTask(taskId);
      const reward = result?.rewardAmount ?? result?.amount ?? 0;

      setMoneyGain(`💰 +${Math.round(reward)}円`);
      setShowMoneyGain(true);
      navigator.vibrate?.(120);

      window.setTimeout(() => setShowMoneyGain(false), 1800);

      await refreshGoals();
      await loadTasks(goalId);
      refreshToday();
      setRainSeed(Date.now());
    } catch (e: any) {
      setError(e?.message ?? "完了処理に失敗しました");
    }
  }

  function onEditTask(task: TaskItem, goalId: number) {
    const next = prompt("タスク名を編集", task.title);
    if (next == null) return;

    const trimmed = next.trim();
    if (!trimmed) {
      alert("タスク名が空です");
      return;
    }

    setTasksByGoal((prev) => ({
      ...prev,
      [goalId]: (prev[goalId] ?? []).map((t) =>
        t.id === task.id ? { ...t, title: trimmed } : t
      ),
    }));
  }

  function logout() {
    clearToken();
    nav("/login", { replace: true });
  }

  async function onDeleteAccount() {
    if (!confirm("アカウントを削除します。この操作は取り消せません。よろしいですか？")) return;

    try {
      await deleteAccount();
      clearToken();
      alert("アカウントを削除しました。");
      nav("/login", { replace: true });
    } catch (e: any) {
      alert(e?.message ?? "アカウント削除に失敗しました");
    }
  }

  async function handleToggleTasks(goalId: number) {
    setError(null);
    const isOpen = openGoals[goalId];

    if (isOpen) {
      setOpenGoals((m) => ({ ...m, [goalId]: false }));
      return;
    }

    try {
      if (!tasksByGoal[goalId]) await loadTasks(goalId);
      setOpenGoals((m) => ({ ...m, [goalId]: true }));
    } catch (e: any) {
      setError(e?.message ?? "タスク読み込みに失敗しました");
    }
  }

  if (showSplash) {
    return (
      <div className="splash-root">
        <div className="splash-bunny">Goal</div>
        <div className="splash-title">lifeRabbit</div>
        <div className="splash-sub">Earn money by completing daily tasks</div>
      </div>
    );
  }

  return (
    <div className="container" style={ui.container}>
      <MoneyRainOverlay seed={rainSeed} />

      {showMoneyGain && <div style={ui.moneyGain}>{moneyGain}</div>}

      <style>
        {`
          @keyframes gainPop {
            0% { opacity: 0; transform: translateX(-50%) scale(0.6); }
            15% { opacity: 1; transform: translateX(-50%) scale(1.15); }
            70% { opacity: 1; transform: translateX(-50%) scale(1); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-40px) scale(0.95); }
          }
        `}
      </style>

      <div className="card" style={{ ...ui.progressCard, marginBottom: 14 }}>
        <div style={ui.topButtons}>
          <button onClick={onDeleteAccount} style={ui.deleteMini}>
            Delete
          </button>
          <button onClick={logout} style={ui.logoutMini}>
            Logout
          </button>
        </div>

        <div className="row-between" style={{ marginBottom: 8 }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>目標の進捗</h1>
            <div style={ui.progressMuted}>
              {allProgressDone}/{allProgressTotal}日 完了
            </div>
          </div>
          <div style={ui.progressPercent}>
            {allProgressPercent}%
          </div>
        </div>

        {allProgressItems.length === 0 ? (
         <div style={ui.progressMuted}>
            カレンダーでタスクをスケジュール登録すると、ここに小タスク進捗が表示されます。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {allProgressItems.slice(0, 3).map((item) => (
              <div key={item.scheduleId}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={ui.progressItemTitle}>{item.title}</div>
                    <div className="small muted">
                      {item.goalTitle} / {item.total}日計画
                    </div>
                  </div>

                  <div className="small muted">
                    {item.done}/{item.total}日・{item.percent}%
                  </div>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(
                      item.total,
                      28
                    )}, minmax(8px, 1fr))`,
                    gap: 3,
                  }}
                >
                  {item.cells.map((done, idx) => (
                    <div
                      key={idx}
                      title={done ? "完了" : "未完了"}
                      style={{
                        height: 16,
                        borderRadius: 4,
                        background: done ? "#22C55E" : "rgba(0,0,0,0.08)",
                        boxShadow: done
                          ? "0 0 6px rgba(34,197,94,0.28)"
                          : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
        <div style={ui.statusTitle}>
          人生ステータス
        </div>

          {statusItems.length === 0 ? (
            <div className="small muted">
              目標にタグを付けると、副業力・健康・学習などのステータスが育ちます。
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {statusItems.map((s) => (
                <div key={s.tag.id}>
                  <div className="row-between" style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {s.tag.emoji} {s.tag.statusName} Lv{s.level}
                    </div>
                    <div className="small muted">
                      {s.done}/{s.total}日・{s.percent}%
                    </div>
                  </div>

                  <div style={ui.statusBar}>
                    <div
                      style={{
                        height: "100%",
                        width: `${s.percent}%`,
                        borderRadius: 999,
                        background: "#22C55E",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={ui.segmentCard}>
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "todo" as TabId, label: "ToDo" },
            { id: "history" as TabId, label: "履歴" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                refreshToday();
              }}
              style={{
                ...ui.segmentButton,
                background: activeTab === tab.id ? "black" : "rgba(0,0,0,0.04)",
                color: activeTab === tab.id ? "white" : "#555",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "todo" && (
        <>
          {error && <div className="error">{error}</div>}

          {goals.length === 0 ? (
            <div style={ui.emptyArea}>
              <div style={ui.emptyIcon}>🎯</div>
              <h2 style={ui.emptyTitle}>目標を追加しよう</h2>
              <p style={ui.emptyText}>
                右下の＋ボタンから
                <br />
                目標を登録できます
              </p>
            </div>
          ) : (
            <>
              <div style={ui.sectionHeader}>
                <div>
                  <div style={ui.sectionLabel}>登録中の目標</div>
                  <h2 style={ui.sectionTitle}>{goals.length}件</h2>
                </div>
              </div>

              {goals.map((g: any) => {
                const tag = getTag(goalTags[g.id]);

                return (
                  <div className="card" key={g.id} style={{ ...ui.card, marginBottom: 14 }}>
                    <div style={ui.goalHeader}>
                      <div style={{ minWidth: 0 }}>
                        <div style={ui.goalTitle}>{g.title}</div>

                        <div style={{ marginTop: 8 }}>
                          <select
                            value={goalTags[g.id] ?? "side_business"}
                            onChange={(e) =>
                              onChangeGoalTag(g.id, e.target.value as LifeTagId)
                            }
                            style={ui.goalSelect}
                          >
                            {LIFE_TAGS.map((tag) => (
                              <option key={tag.id} value={tag.id}>
                                {tag.emoji} {tag.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="small muted" style={{ marginTop: 8 }}>
                          {tag.statusName}を育てる目標
                        </div>
                      </div>
                    </div>

                    <div style={ui.goalActions}>
                      <button onClick={() => onAddTask(g.id)} style={ui.actionBtn}>
                        + Task
                      </button>
                      <button onClick={() => handleToggleTasks(g.id)} style={ui.actionBtn}>
                        {openGoals[g.id] ? "Hide Tasks" : "Show Tasks"}
                      </button>
                      <button
                        onClick={() => onDeleteGoal(g.id, g.title)}
                        style={ui.dangerBtn}
                      >
                        削除
                      </button>
                    </div>

                    {openGoals[g.id] && tasksByGoal[g.id] && (
                      <>
                        <hr />
                        {tasksByGoal[g.id].length === 0 ? (
                          <div className="small">タスクがありません</div>
                        ) : (
                          tasksByGoal[g.id].map((t) => (
                            <div key={t.id} style={ui.taskRow}>
                              <div style={ui.taskMain}>
                                <div style={ui.taskTitle}>{t.title}</div>
                                <span style={ui.taskBadge}>
                                  {t.completed ? "completed" : "todo"}
                                </span>
                              </div>

                              <div style={ui.taskActions}>
                                <button onClick={() => onEditTask(t, g.id)} style={ui.taskEditBtn}>
                                  Edit
                                </button>

                                {!t.completed && (
                                  <button
                                    onClick={() => onComplete(t.id, g.id)}
                                    style={ui.taskCompleteBtn}
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {activeTab === "history" && (
        <>
          {history.length === 0 ? (
            <div className="card" style={ui.card}>
              <h2 style={{ marginTop: 0 }}>タスク履歴</h2>
              <div className="small muted">まだ履歴はありません</div>
            </div>
          ) : (
            <div className="card" style={{ ...ui.card, marginBottom: 16 }}>
              <h2 style={{ marginTop: 0 }}>タスク履歴</h2>
              <ul style={ui.historyList}>
                {history
                  .slice()
                  .reverse()
                  .slice(0, 50)
                  .map((h) => (
                    <li key={h.id} className="small">
                      <span>{h.date} </span>
                      <span>{h.title}</span>
                      <span style={{ opacity: 0.6 }}>
                        {" "}
                        ({new Date(h.doneAt).toLocaleString()})
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}

      <button style={ui.fab} onClick={() => setShowCreateModal(true)}>
        +
      </button>

      {showCreateModal && (
        <div style={ui.modalBackdrop} onClick={() => setShowCreateModal(false)}>
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div style={ui.modalHeader}>
              <h2 style={ui.modalTitle}>新規目標</h2>
              <button style={ui.closeButton} onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>

            <div style={ui.modalBody}>
              <label>Title</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />

              <label>タグ</label>
              <select
                value={newGoalTag}
                onChange={(e) => setNewGoalTag(e.target.value as LifeTagId)}
                style={ui.inputLike}
              >
                {LIFE_TAGS.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.emoji} {tag.label}
                  </option>
                ))}
              </select>

              <label>Annual Income（JPY換算でもOK）</label>
              <input
                value={newIncome}
                onChange={(e) => setNewIncome(Number(e.target.value))}
                inputMode="numeric"
              />

              <button style={ui.createButton} onClick={onCreateGoal}>
                目標を作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ui: Record<string, React.CSSProperties> = {

  progressCard: {
    borderRadius: 28,
    overflow: "hidden",
    background: "#111",
    color: "#fff",
    border: "none",
    boxShadow: "0 20px 44px rgba(0,0,0,0.18)",
  },
  
  progressMainTitle: {
    margin: "0 0 4px",
    color: "#fff",
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: "-0.05em",
  },
  
  progressPercent: {
    fontSize: 48,
    fontWeight: 900,
    color: "#fff",
    letterSpacing: "-0.05em",
  },
  
  progressMuted: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.7,
  },
  
  statusTitle: {
    color: "#fff",
    fontWeight: 900,
    marginBottom: 8,
    fontSize: 22,
  },
  taskRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "14px 0",
    borderBottom: "1px solid #eef0f5",
  },
  
  taskMain: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  
  taskTitle: {
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.35,
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  
  taskBadge: {
    display: "inline-flex",
    marginTop: 8,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid #e1e5ef",
    color: "#666",
    fontSize: 13,
    fontWeight: 700,
  },
  
  taskActions: {
    flex: "0 0 auto",
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  
  taskEditBtn: {
    minWidth: 70,
    borderRadius: 14,
    padding: "12px 14px",
    background: "#fff",
    color: "#111",
  },
  
  taskCompleteBtn: {
    minWidth: 112,
    borderRadius: 14,
    padding: "12px 14px",
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
  },
  container: {
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
    paddingBottom: 120,
    
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  topButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  deleteMini: {
    color: "#b91c1c",
    borderColor: "#fecaca",
    fontSize: 12,
    padding: "8px 10px",
  },
  logoutMini: {
    fontSize: 12,
    padding: "8px 10px",
  },
  progressItemTitle: {
    fontWeight: 800,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statusBar: {
    height: 10,
    borderRadius: 999,
    background: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  segmentCard: {
    marginBottom: 14,
    padding: "6px 8px",
    borderRadius: 22,
    overflow: "hidden",
  },
  segmentButton: {
    flex: 1,
    padding: "13px 0",
    borderRadius: 999,
    border: "none",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
  },
  emptyArea: {
    minHeight: 360,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "36px 16px 80px",
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    background: "#f5f5f5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 40,
    marginBottom: 28,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: "0 0 16px",
    color: "#111",
  },
  emptyText: {
    fontSize: 17,
    lineHeight: 1.8,
    color: "#9b9b9b",
    margin: 0,
    fontWeight: 600,
  },
  sectionHeader: {
    margin: "18px 0 12px",
  },
  sectionLabel: {
    color: "#999",
    fontWeight: 800,
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: "4px 0 0",
  },
  goalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  goalTitle: {
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  goalSelect: {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(0,0,0,0.12)",
    fontWeight: 700,
    maxWidth: "100%",
  },
  goalActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },
  actionBtn: {
    borderRadius: 14,
    padding: "12px 14px",
    color: "#007aff",
    background: "#fff",
  },
  dangerBtn: {
    borderRadius: 14,
    padding: "12px 14px",
    color: "#b91c1c",
    borderColor: "#fecaca",
    background: "#fff",
  },
  historyList: {
    marginTop: 8,
    paddingLeft: 16,
    maxHeight: 260,
    overflowY: "auto",
  },
  fab: {
    position: "fixed",
    right: 28,
    bottom: "calc(92px + env(safe-area-inset-bottom))",
    width: 64,
    height: 64,
    minWidth: 64,
    minHeight: 64,
    maxWidth: 64,
    maxHeight: 64,
    padding: 0,
    borderRadius: "50%",
    border: "none",
    background: "#222",
    color: "#fff",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 400,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 16px 28px rgba(0,0,0,0.18)",
    zIndex: 20,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.32)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100000,
    overflow: "hidden",
    padding: "24px 16px calc(24px + env(safe-area-inset-bottom))",
  },
  modal: {
    width: "min(520px, calc(100vw - 32px))",
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100dvh - 160px)",
    background: "#fff",
    borderRadius: 32,
    boxShadow: "0 24px 70px rgba(0,0,0,0.24)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  modalHeader: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "26px 24px 10px",
  },
  modalBody: {
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
    padding: "0 24px 28px",
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 900,
    margin: 0,
  },
  closeButton: {
    width: 56,
    height: 56,
    minWidth: 56,
    minHeight: 56,
    maxWidth: 56,
    maxHeight: 56,
    padding: 0,
    borderRadius: "50%",
    border: "none",
    background: "#f2f2f2",
    color: "#111",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 900,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  inputLike: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #d7dbe7",
  },
  createButton: {
    width: "100%",
    minHeight: 56,
    marginTop: 22,
    marginBottom: 0,
    border: "none",
    borderRadius: 18,
    background: "#111",
    color: "#fff",
    padding: "16px 18px",
    fontSize: 17,
    fontWeight: 900,
  },
  moneyGain: {
    position: "fixed",
    top: "22%",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 100000,
    background: "rgba(0,0,0,0.86)",
    color: "#FFD700",
    padding: "16px 28px",
    borderRadius: 18,
    fontSize: 34,
    fontWeight: 900,
    boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
    animation: "gainPop 1.8s ease forwards",
    pointerEvents: "none",
  },
};