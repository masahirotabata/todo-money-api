// src/pages/CalendarPage.tsx
import { useEffect, useMemo, useState } from "react";
import MoneyRainOverlay from "../components/MoneyRainOverlay";

import { listGoals, listTasks, GoalListItem, TaskItem } from "../lib/api";

import { ScheduleEvent } from "./Calender";

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
  const savedUserKey = localStorage.getItem("todoMoneyUserKey");
  if (savedUserKey) return savedUserKey;

  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(
      payload.email ??
        payload.sub ??
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

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function occursOnDate(ev: ScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = parseYMD(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function getTimeLabel(ev: ScheduleEvent) {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`;
  if (ev.startTime) return `${ev.startTime}〜`;
  return "時間指定なし";
}

function getScheduleEmoji(ev: ScheduleEvent) {
  const text = `${ev.title ?? ""} ${ev.memo ?? ""}`;

  if (text.includes("睡眠") || text.includes("寝") || text.includes("休")) return "🌙";
  if (text.includes("読書") || text.includes("講義") || text.includes("学習") || text.includes("勉強")) return "📚";
  if (text.includes("動画") || text.includes("配信") || text.includes("発信")) return "💻";
  if (text.includes("筋トレ") || text.includes("運動") || text.includes("散歩")) return "💪";
  if (text.includes("カフェ") || text.includes("休憩")) return "☕️";
  if (text.includes("仕事") || text.includes("作業")) return "🛠️";
  return "🌿";
}

function getTaskEmoji(candidate: TaskCandidate) {
  const text = `${candidate.goalTitle ?? ""} ${candidate.task.title ?? ""}`;

  if (text.includes("睡眠") || text.includes("寝") || text.includes("休")) return "🌙";
  if (text.includes("読書") || text.includes("講義") || text.includes("学習") || text.includes("勉強")) return "📚";
  if (text.includes("動画") || text.includes("配信") || text.includes("発信")) return "💻";
  if (text.includes("筋トレ") || text.includes("運動") || text.includes("散歩")) return "💪";
  if (text.includes("カフェ") || text.includes("休憩")) return "☕️";
  if (text.includes("仕事") || text.includes("作業")) return "🛠️";
  return "🌿";
}

function getDateLabel(ymd: string) {
  const d = parseYMD(ymd);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

function getWeekDays(base: Date) {
  const day = base.getDay();
  const start = addDays(base, -day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export default function CalendarPage() {
  const today = new Date();
  const todayYmd = toYMD(today);

  const [selectedDate, setSelectedDate] = useState(todayYmd);

  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
    loadSchedules()
  );

  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );

  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>({});
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);

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

  const weekDays = useMemo(() => getWeekDays(parseYMD(selectedDate)), [selectedDate]);

  const selectedSchedules = useMemo(() => {
    return schedules
      .filter((ev) => occursOnDate(ev, selectedDate))
      .sort((a, b) => {
        const at = a.startTime ?? "";
        const bt = b.startTime ?? "";
        if (at !== bt) return at.localeCompare(bt);
        return (a.title ?? "").localeCompare(b.title ?? "");
      });
  }, [schedules, selectedDate]);

  const completedCount = selectedSchedules.filter((ev) =>
    ev.completedDates?.includes(selectedDate)
  ).length;

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

  function openTaskScheduleModal(candidate: TaskCandidate, baseDate = parseYMD(selectedDate)) {
    setShowTaskDrawer(false);

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
      navigator.vibrate?.(80);

      setHistory((prev) => {
        const exists = prev.some(
          (h) => h.scheduleId === scheduleId && h.date === dateStr
        );

        if (exists) return prev;

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

  function toggleScheduleDone(ev: ScheduleEvent) {
    const done = !(ev.completedDates?.includes(selectedDate) ?? false);
    handleToggleDoneForDate(ev.id, selectedDate, done);
  }

  function openSelectedDateModal() {
    openNewSchedule(parseYMD(selectedDate), undefined, selectedDate);
  }

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>予定</h1>
        </div>

        <button
          style={styles.calendarButton}
          onClick={openSelectedDateModal}
          aria-label="予定追加"
        >
          カレンダー
        </button>
      </header>

      <section style={styles.weekStrip}>
        {weekDays.map((d) => {
          const ymd = toYMD(d);
          const selected = ymd === selectedDate;
          const hasEvents = schedules.some((ev) => occursOnDate(ev, ymd));
          const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];

          return (
            <button
              key={ymd}
              style={selected ? styles.dayButtonActive : styles.dayButton}
              onClick={() => setSelectedDate(ymd)}
            >
              <span style={styles.dayWeek}>{weekday}</span>
              <span style={styles.dayNum}>{d.getDate()}</span>
              {selected ? <span style={styles.activeBar} /> : hasEvents ? <span style={styles.eventDot} /> : null}
            </button>
          );
        })}
      </section>

      <section style={styles.todaySection}>
        <h2 style={styles.dateTitle}>{getDateLabel(selectedDate)}</h2>

        <div style={styles.subHeader}>
          <span>今日の予定 {selectedSchedules.length}件</span>
          {selectedSchedules.length > 0 && (
            <span>
              {completedCount}/{selectedSchedules.length} 完了
            </span>
          )}
        </div>

        {selectedSchedules.length === 0 ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIcon}>☕️</div>
            <div>
              <div style={styles.emptyTitle}>予定はありません</div>
              <div style={styles.emptyText}>小さな回復予定を1つ置いてもOKです。</div>
            </div>
          </div>
        ) : (
          <div style={styles.scheduleList}>
            {selectedSchedules.map((ev) => {
              const done = ev.completedDates?.includes(selectedDate) ?? false;
              const emoji = getScheduleEmoji(ev);

              return (
                <article key={ev.id} style={done ? styles.scheduleCardDone : styles.scheduleCard}>
                  <button
                    style={styles.scheduleMain}
                    onClick={() => handleEventClick(ev, selectedDate)}
                  >
                    <div style={styles.scheduleIcon}>{emoji}</div>

                    <div style={styles.scheduleText}>
                      <div style={styles.timeText}>{getTimeLabel(ev)}</div>
                      <div style={styles.scheduleTitle}>{ev.title}</div>
                      {ev.memo && <div style={styles.memoText}>{ev.memo}</div>}
                    </div>

                    <div style={done ? styles.donePill : styles.todoPill}>
                      {done ? "完了" : "未完了"}
                    </div>
                  </button>

                  <div style={styles.scheduleActions}>
                    <button
                      style={done ? styles.doneButton : styles.completeButton}
                      onClick={() => toggleScheduleDone(ev)}
                    >
                      {done ? "戻す" : "完了"}
                    </button>
                    <button
                      style={styles.editButton}
                      onClick={() => handleEventClick(ev, selectedDate)}
                    >
                      編集
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <button style={styles.fab} onClick={() => setShowTaskDrawer(true)} aria-label="タスクから予定追加">
        ＋
      </button>

      {showTaskDrawer && (
        <div style={styles.drawerOverlay} onClick={() => setShowTaskDrawer(false)}>
          <section style={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHandle} />

            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerEyebrow}>SCHEDULE TASKS</div>
                <h2 style={styles.drawerTitle}>配置するタスク</h2>
              </div>
              <div style={styles.drawerCount}>{taskCandidates.length}件</div>
            </div>

            {loadingTasks ? (
              <div style={styles.drawerEmpty}>読み込み中...</div>
            ) : taskCandidates.length === 0 ? (
              <div style={styles.drawerEmpty}>未完了タスクはありません</div>
            ) : (
              <div style={styles.drawerList}>
                {taskCandidates.map((candidate) => {
                  const emoji = getTaskEmoji(candidate);

                  return (
                    <button
                      key={`${candidate.goalId}-${candidate.task.id}`}
                      style={styles.taskSelectCard}
                      onClick={() => openTaskScheduleModal(candidate)}
                    >
                      <div style={styles.taskSelectIcon}>{emoji}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={styles.taskSelectTitle}>{candidate.task.title}</div>
                        <div style={styles.taskSelectSub}>{candidate.goalTitle}</div>
                      </div>
                      <div style={styles.taskSelectPlus}>＋</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

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

const styles: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "48px 20px calc(112px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 30% -10%, rgba(84, 214, 89, 0.12), transparent 34%), linear-gradient(180deg, #111312 0%, #0d100e 48%, #0a0c0b 100%)",
    color: "#fff",
    overflowX: "hidden",
  },
  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 78% 28%, rgba(97, 220, 82, 0.08), transparent 28%)",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  calendarButton: {
    minHeight: 42,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 16px",
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(0,0,0,0.20)",
  },
  weekStrip: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 28,
  },
  dayButton: {
    position: "relative",
    minHeight: 58,
    border: "none",
    borderRadius: 18,
    background: "transparent",
    color: "rgba(255,255,255,0.72)",
    display: "grid",
    placeItems: "center",
    gap: 5,
    padding: "7px 0",
  },
  dayButtonActive: {
    position: "relative",
    minHeight: 58,
    border: "none",
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(116,224,93,0.95), rgba(91,201,75,0.82))",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    gap: 5,
    padding: "7px 0",
    boxShadow: "0 12px 26px rgba(116,224,93,0.24)",
  },
  dayWeek: {
    fontSize: 13,
    fontWeight: 900,
    opacity: 0.86,
  },
  dayNum: {
    fontSize: 17,
    fontWeight: 950,
    lineHeight: 1,
  },
  activeBar: {
    position: "absolute",
    left: "50%",
    bottom: -8,
    width: 22,
    height: 4,
    borderRadius: 999,
    background: "#74e05d",
    transform: "translateX(-50%)",
    boxShadow: "0 0 16px rgba(116,224,93,0.55)",
  },
  eventDot: {
    position: "absolute",
    left: "50%",
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 999,
    background: "rgba(116,224,93,0.76)",
    transform: "translateX(-50%)",
  },
  todaySection: {
    position: "relative",
    zIndex: 1,
  },
  dateTitle: {
    margin: "0 0 12px",
    color: "#fff",
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  subHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
    color: "rgba(255,255,255,0.52)",
    fontSize: 14,
    fontWeight: 850,
  },
  scheduleList: {
    display: "grid",
    gap: 12,
  },
  scheduleCard: {
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  scheduleCardDone: {
    borderRadius: 18,
    background:
      "linear-gradient(180deg, rgba(116,224,93,0.16), rgba(255,255,255,0.045))",
    border: "1px solid rgba(116,224,93,0.18)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  scheduleMain: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 13,
    padding: "15px 16px",
    textAlign: "left",
  },
  scheduleIcon: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 15,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  scheduleText: {
    minWidth: 0,
    flex: 1,
  },
  timeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.25,
  },
  scheduleTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.25,
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  memoText: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.4,
    marginTop: 4,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  todoPill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: 950,
  },
  donePill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(116,224,93,0.20)",
    color: "#9df58d",
    fontSize: 12,
    fontWeight: 950,
  },
  scheduleActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    padding: "0 16px 15px",
  },
  completeButton: {
    minHeight: 46,
    border: "none",
    borderRadius: 16,
    background: "#74e05d",
    color: "#07110c",
    fontSize: 15,
    fontWeight: 950,
  },
  doneButton: {
    minHeight: 46,
    border: "none",
    borderRadius: 16,
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    fontSize: 15,
    fontWeight: 950,
  },
  editButton: {
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
  },
  emptyCard: {
    borderRadius: 20,
    padding: "18px 16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
    display: "flex",
    alignItems: "center",
    gap: 13,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 16,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
  },
  emptyText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  fab: {
    position: "fixed",
    right: 22,
    bottom: "calc(86px + env(safe-area-inset-bottom))",
    zIndex: 30,
    width: 64,
    height: 64,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    fontSize: 34,
    fontWeight: 400,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 36px rgba(0,0,0,0.32)",
    backdropFilter: "blur(18px)",
  },
  drawerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "flex-end",
  },
  drawer: {
    width: "100%",
    maxHeight: "72vh",
    overflowY: "auto",
    borderRadius: "32px 32px 0 0",
    background: "#f7f8f6",
    color: "#0d0f0d",
    padding: "12px 22px calc(28px + env(safe-area-inset-bottom))",
    boxShadow: "0 -20px 50px rgba(0,0,0,0.28)",
  },
  drawerHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: "rgba(0,0,0,0.12)",
    margin: "0 auto 22px",
  },
  drawerHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  drawerEyebrow: {
    color: "rgba(0,0,0,0.18)",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.20em",
    marginBottom: 7,
  },
  drawerTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.07em",
    lineHeight: 1.05,
  },
  drawerCount: {
    color: "#777",
    fontSize: 22,
    fontWeight: 950,
  },
  drawerEmpty: {
    borderRadius: 22,
    padding: 22,
    background: "rgba(0,0,0,0.04)",
    color: "#777",
    fontWeight: 900,
    textAlign: "center",
  },
  drawerList: {
    display: "grid",
    gap: 12,
  },
  taskSelectCard: {
    width: "100%",
    minHeight: 86,
    padding: "16px 16px",
    borderRadius: 26,
    background: "linear-gradient(180deg, #ffffff, #eef1ed)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.055)",
    color: "#111",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
  },
  taskSelectIcon: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: 17,
    background: "#0f1110",
    color: "#74e05d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 950,
  },
  taskSelectTitle: {
    color: "#111",
    fontWeight: 950,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 18,
    letterSpacing: "-0.04em",
  },
  taskSelectSub: {
    marginTop: 4,
    color: "#777",
    fontSize: 14,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  taskSelectPlus: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
    fontWeight: 700,
  },
};
