// src/pages/CalendarPage.tsx
import { useEffect, useMemo, useState } from "react";
import MoneyRainOverlay from "../components/MoneyRainOverlay";

import {
  listGoals,
  listTasks,
  GoalListItem,
  TaskItem,
} from "../lib/api";

import Calender, {
  DragTaskPayload,
  ScheduleEvent,
} from "./Calender";

import ScheduleModal from "../components/ScheduleModel";

type ScheduleHistoryItem = {
  id: string;
  scheduleId: string;
  date: string;
  doneAt: string;
  title: string;
};

type TaskCandidate = {
  goalId: number;
  goalTitle: string;
  task: TaskItem;
};

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

function loadSchedules(): ScheduleEvent[] {
  try {
    const raw = localStorage.getItem(scheduleKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchedules(list: ScheduleEvent[]) {
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

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export default function CalendarPage() {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
    loadSchedules()
  );

  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );

  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [rainSeed, setRainSeed] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalBaseDate, setModalBaseDate] = useState<Date>(new Date());
  const [modalInitial, setModalInitial] =
    useState<Partial<ScheduleEvent> | null>(null);
  const [modalClickedDate, setModalClickedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  async function loadTaskCandidates() {
    setLoadingTasks(true);
  
    try {
      const g = await listGoals();
      setGoals(g);
  
      const map: Record<number, TaskItem[]> = {};
  
      await Promise.all(
        g.map(async (goal) => {
          try {
            map[goal.id] = await listTasks(goal.id);
          } catch {
            map[goal.id] = [];
          }
        })
      );
  
      setTasksByGoal(map);
    } finally {
      setLoadingTasks(false);
    }
  }

  function refreshFromStorage() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
  }

  useEffect(() => {
    refreshFromStorage();
    loadTaskCandidates();

    const onFocus = () => {
      refreshFromStorage();
      loadTaskCandidates();
    };

    const onVisible = () => {
      if (!document.hidden) {
        refreshFromStorage();
        loadTaskCandidates();
      }
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    saveSchedules(schedules);
  }, [schedules]);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  const taskCandidates = useMemo(() => {
    const items: TaskCandidate[] = [];

    for (const g of goals) {
      const ts = tasksByGoal[g.id] ?? [];

      ts.filter((t) => !t.completed).forEach((t) => {
        items.push({
          goalId: g.id,
          goalTitle: g.title,
          task: t,
        });
      });
    }

    return items;
  }, [goals, tasksByGoal]);

  function openNewSchedule(
    date: Date,
    initial?: Partial<ScheduleEvent>,
    clickedDate?: string,
    id?: string
  ) {
    setEditingId(id);
    setModalBaseDate(date);
    setModalInitial(initial ?? null);
    setModalClickedDate(clickedDate ?? null);
    setModalOpen(true);
  }

  function openTaskScheduleModal(candidate: TaskCandidate, baseDate = new Date()) {
    openNewSchedule(
      baseDate,
      {
        title: candidate.task.title,
        memo: "",
        startDate: toYMD(baseDate),
        endDate: toYMD(addMonths(baseDate, 1)),
        taskRef: {
          goalId: candidate.goalId,
          taskId: candidate.task.id,
        },
      },
      toYMD(baseDate)
    );
  }

  function handleDropTask(date: Date, task: DragTaskPayload) {
    openNewSchedule(
      date,
      {
        title: task.title,
        memo: "",
        startDate: toYMD(date),
        endDate: toYMD(addMonths(date, 1)),
        taskRef: {
          goalId: task.goalId,
          taskId: task.taskId,
        },
      },
      toYMD(date)
    );
  }

  function handleSaveSchedule(data: Omit<ScheduleEvent, "id">) {
    setSchedules((prev) => {
      let next: ScheduleEvent[];

      if (editingId) {
        next = prev.map((x) =>
          x.id === editingId ? { ...x, ...data, id: editingId } : x
        );
      } else {
        next = [...prev, { ...data, id: uid() }];
      }

      saveSchedules(next);
      return next;
    });

    setEditingId(undefined);
    setModalOpen(false);
  }

  function handleDeleteSchedule(id: string) {
    if (!confirm("このスケジュールを削除しますか？")) return;

    setSchedules((prev) => {
      const next = prev.filter((x) => x.id !== id);
      saveSchedules(next);
      return next;
    });

    setEditingId(undefined);
    setModalOpen(false);
  }

  function handleEventClick(ev: ScheduleEvent, dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    openNewSchedule(new Date(y, m - 1, d), ev, dateStr, ev.id);
  }

  function handleToggleDoneForDate(
    scheduleId: string,
    dateStr: string,
    done: boolean
  ) {
    let scheduleTitle = "";

    setSchedules((prev) => {
      const next = prev.map((ev) => {
        if (ev.id !== scheduleId) return ev;

        scheduleTitle = ev.title;

        const prevDates = ev.completedDates ?? [];
        const nextDates = done
          ? prevDates.includes(dateStr)
            ? prevDates
            : [...prevDates, dateStr]
          : prevDates.filter((d) => d !== dateStr);

        return { ...ev, completedDates: nextDates };
      });

      saveSchedules(next);
      return next;
    });

    if (done) {
      setRainSeed(Date.now());

      setHistory((prev) => {
        const next = [
          ...prev,
          {
            id: uid(),
            scheduleId,
            date: dateStr,
            doneAt: new Date().toISOString(),
            title: scheduleTitle,
          },
        ];

        saveHistory(next);
        return next;
      });
    } else {
      setHistory((prev) => {
        const next = prev.filter(
          (h) => !(h.scheduleId === scheduleId && h.date === dateStr)
        );

        saveHistory(next);
        return next;
      });
    }
  }

  function renderTaskCard(candidate: TaskCandidate, compact = false) {
    const payload: DragTaskPayload = {
      kind: "task",
      goalId: candidate.goalId,
      taskId: candidate.task.id,
      title: candidate.task.title,
    };

    return (
      <div
        key={`${candidate.goalId}-${candidate.task.id}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("application/json", JSON.stringify(payload));
          e.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => openTaskScheduleModal(candidate)}
        style={{
          padding: compact ? "8px 10px" : "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(0,0,0,0.02)",
          cursor: "grab",
          userSelect: "none",
          minWidth: 0,
        }}
        title="クリックで登録 / ドラッグでカレンダーへ配置"
      >
        <div
          style={{
            fontWeight: 800,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: compact ? 13 : 14,
          }}
        >
          {candidate.task.title}
        </div>

        <div className="small muted" style={{ marginTop: 3 }}>
          {candidate.goalTitle}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <MoneyRainOverlay seed={rainSeed} />

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row-between">
          <h2 style={{ margin: 0 }}>カレンダー</h2>
          <button
            onClick={() =>
              openNewSchedule(new Date(), undefined, toYMD(new Date()))
            }
          >
            予定追加
          </button>
        </div>

        <div className="small muted" style={{ marginTop: 6 }}>
          日付クリックで追加、タスクをドラッグして配置できます
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "minmax(180px, 240px) 1fr",
            gap: 14,
            alignItems: "start",
          }}
          className="calendar-main-layout"
        >
          <div
            style={{
              borderRadius: 14,
              background: "rgba(0,0,0,0.025)",
              padding: 10,
              maxHeight: 520,
              overflowY: "auto",
            }}
            className="calendar-task-sidebar"
          >
            <div className="row-between" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 800 }}>タスク一覧</div>
              <div className="small muted">{taskCandidates.length}件</div>
            </div>

            <div className="small muted" style={{ marginBottom: 8 }}>
              右側のカレンダーへドラッグして登録
            </div>

            {loadingTasks ? (
  <div className="small muted">読み込み中...</div>
) : taskCandidates.length === 0 ? (
  <div className="small muted">未完了タスクはありません</div>
) : (
              <div style={{ display: "grid", gap: 8 }}>
                {taskCandidates.map((candidate) =>
                  renderTaskCard(candidate, true)
                )}
              </div>
            )}
          </div>

          <Calender
            events={schedules}
            onDayClick={(d) => openNewSchedule(d, undefined, toYMD(d))}
            onDropTask={handleDropTask}
            onEventClick={handleEventClick}
          />
        </div>
      </div>

      <div
        className="card calendar-task-shelf"
        style={{ marginBottom: 12, display: "none" }}
      >
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              スケジュール登録タスク
            </h2>
            <div className="small muted">
              横スクロールしてカレンダーへドラッグできます
            </div>
          </div>

          <div className="small muted">{taskCandidates.length}件</div>
        </div>

        {loadingTasks ? (
          <div className="small muted">読み込み中...</div>
        ) : taskCandidates.length === 0 ? (
          <div className="small muted">未完了タスクはありません</div>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 10,
              overflowX: "auto",
              paddingBottom: 6,
              WebkitOverflowScrolling: "touch",
              scrollSnapType: "x mandatory",
            }}
          >
            {taskCandidates.map((candidate) => (
              <div
                key={`${candidate.goalId}-${candidate.task.id}`}
                style={{
                  flex: "0 0 168px",
                  scrollSnapAlign: "start",
                }}
              >
                {renderTaskCard(candidate)}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>
        {`
          @media (max-width: 760px) {
            .calendar-main-layout {
              display: block !important;
            }

            .calendar-task-sidebar {
              display: none !important;
            }

            .calendar-task-shelf {
              display: block !important;
            }
          }
        `}
      </style>

      <ScheduleModal
        open={modalOpen}
        baseDate={modalBaseDate}
        initial={modalInitial}
        clickedDate={modalClickedDate ?? undefined}
        onClose={() => {
          setEditingId(undefined);
          setModalOpen(false);
        }}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
        onToggleDoneForDate={handleToggleDoneForDate}
      />
    </div>
  );
}