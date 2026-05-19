// src/pages/SchedulePage.tsx
import { useEffect, useMemo, useState } from "react";

import ScheduleModal from "../components/ScheduleModel";
import MoneyRainOverlay from "../components/MoneyRainOverlay";
import type { ScheduleEvent } from "./Calender";

type ScheduleHistoryItem = {
  id: string;
  scheduleId: string;
  date: string;
  doneAt: string;
  title: string;
};

type ReviewState = Record<string, boolean>;

const DAILY_REWARD_YEN = 164;
const MONTHLY_TARGET_YEN = 50000;

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

function reviewKey() {
  return `todo-money:scheduleReview:v1:${getCurrentUserKey()}`;
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

function loadReviewState(): ReviewState {
  try {
    const raw = localStorage.getItem(reviewKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
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

function ymdToNum(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function daysInThisMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function occursOnDate(ev: ScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = new Date(dateStr);
  return !!ev.weekdays[d.getDay()];
}

export default function SchedulePage() {
  const todayYmd = toYMD(new Date());

  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() => loadSchedules());
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() => loadHistory());
  const [, setReviewState] = useState<ReviewState>(() => loadReviewState());

  const [rainSeed, setRainSeed] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalBaseDate, setModalBaseDate] = useState(new Date());
  const [modalInitial, setModalInitial] = useState<Partial<ScheduleEvent> | null>(null);
  const [modalClickedDate, setModalClickedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);

  function refreshFromStorage() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
    setReviewState(loadReviewState());
  }

  useEffect(() => {
    refreshFromStorage();

    const onFocus = () => refreshFromStorage();
    const onVisible = () => {
      if (!document.hidden) refreshFromStorage();
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

  const todaySchedules = useMemo(() => {
    return schedules
      .filter((ev) => occursOnDate(ev, todayYmd))
      .sort((a, b) => {
        const at = a.startTime ?? "";
        const bt = b.startTime ?? "";
        if (at !== bt) return at.localeCompare(bt);
        return (a.title ?? "").localeCompare(b.title ?? "");
      });
  }, [schedules, todayYmd]);

  const completedCount = todaySchedules.filter((ev) =>
    ev.completedDates?.includes(todayYmd)
  ).length;

  const totalCount = todaySchedules.length;
  const progress = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

  const todayEarned = completedCount * DAILY_REWARD_YEN;
  const monthlyPace = todayEarned * daysInThisMonth();
  const remainingToTarget = Math.max(0, MONTHLY_TARGET_YEN - monthlyPace);

  const streakDays = useMemo(() => {
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const dateStr = toYMD(addDays(today, -i));
      const daySchedules = schedules.filter((ev) => occursOnDate(ev, dateStr));

      if (daySchedules.length === 0) continue;

      const completed = daySchedules.some((ev) =>
        ev.completedDates?.includes(dateStr)
      );

      if (completed) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, [schedules]);

  function openEditModal(ev: ScheduleEvent) {
    const [y, m, d] = todayYmd.split("-").map(Number);

    setEditingId(ev.id);
    setModalBaseDate(new Date(y, m - 1, d));
    setModalInitial(ev);
    setModalClickedDate(todayYmd);
    setModalOpen(true);
  }

  function handleSaveSchedule(data: Omit<ScheduleEvent, "id">) {
    setSchedules((prev) => {
      const next = editingId
        ? prev.map((x) => (x.id === editingId ? { ...x, ...data, id: editingId } : x))
        : [...prev, { ...data, id: uid() }];

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

  function completeScheduleOnDate(ev: ScheduleEvent, dateStr: string) {
    setSchedules((prev) => {
      const next = prev.map((x) => {
        if (x.id !== ev.id) return x;

        const prevDates = x.completedDates ?? [];
        const nextDates = prevDates.includes(dateStr)
          ? prevDates
          : [...prevDates, dateStr];

        return { ...x, completedDates: nextDates };
      });

      saveSchedules(next);
      return next;
    });

    setHistory((prev) => {
      const exists = prev.some((h) => h.scheduleId === ev.id && h.date === dateStr);
      if (exists) return prev;

      const next = [
        ...prev,
        {
          id: uid(),
          scheduleId: ev.id,
          date: dateStr,
          doneAt: new Date().toISOString(),
          title: ev.title,
        },
      ];

      saveHistory(next);
      return next;
    });

    setRainSeed(Date.now());
  }

  function undoScheduleOnDate(ev: ScheduleEvent, dateStr: string) {
    setSchedules((prev) => {
      const next = prev.map((x) => {
        if (x.id !== ev.id) return x;
        return {
          ...x,
          completedDates: (x.completedDates ?? []).filter((d) => d !== dateStr),
        };
      });

      saveSchedules(next);
      return next;
    });

    setHistory((prev) => {
      const next = prev.filter(
        (h) => !(h.scheduleId === ev.id && h.date === dateStr)
      );

      saveHistory(next);
      return next;
    });
  }

  function toggleDone(ev: ScheduleEvent) {
    const alreadyDone = ev.completedDates?.includes(todayYmd) ?? false;

    if (alreadyDone) {
      undoScheduleOnDate(ev, todayYmd);
    } else {
      completeScheduleOnDate(ev, todayYmd);
    }
  }

  function handleToggleDoneForDate(scheduleId: string, dateStr: string, done: boolean) {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    if (done) {
      completeScheduleOnDate(target, dateStr);
    } else {
      undoScheduleOnDate(target, dateStr);
    }
  }

  return (
    <div className="container" style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />

      <div style={styles.heroCard}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.heroLabel}>今日の行動</div>
            <h1 style={styles.heroTitle}>今日の進捗</h1>
            <div style={styles.heroDate}>{todayYmd}</div>
          </div>

          <div style={styles.heroPercent}>{progress}%</div>
        </div>

        <div style={styles.heroCount}>
          {completedCount}/{totalCount} 件完了
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`,
              background:
                progress === 100
                  ? "#FACC15"
                  : "linear-gradient(90deg, #38BDF8, #22C55E)",
            }}
          />
        </div>

        <div style={styles.valueBlock}>
          <div style={styles.valueTitle}>
            今日の行動価値 +{todayEarned.toLocaleString()}円
          </div>

          <div style={styles.heroMuted}>
            このペースなら 今月 +{monthlyPace.toLocaleString()}円
          </div>

          <div style={styles.heroMuted}>
            目標まで あと{remainingToTarget.toLocaleString()}円
          </div>

          <div style={styles.streakPill}>
            {streakDays > 0 ? `${streakDays}日継続🔥` : "今日から継続スタート"}
          </div>
        </div>
      </div>

      <div style={styles.scheduleCard}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>今日の予定</h2>
          <div style={styles.sectionCount}>{todaySchedules.length}件</div>
        </div>

        {todaySchedules.length === 0 ? (
          <div style={styles.emptyText}>
            今日の予定はありません。カレンダーから予定を登録できます。
          </div>
        ) : (
          <div style={styles.scheduleList}>
            {todaySchedules.map((ev) => {
              const done = ev.completedDates?.includes(todayYmd) ?? false;

              return (
                <div key={ev.id} style={styles.taskCard}>
                  <div style={styles.taskTop}>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          ...styles.taskTitle,
                          textDecoration: done ? "line-through" : "none",
                          opacity: done ? 0.72 : 1,
                        }}
                      >
                        {ev.title}
                      </div>

                      <div style={styles.taskTime}>
                        {ev.startTime
                          ? ev.endTime
                            ? `${ev.startTime}〜${ev.endTime}`
                            : ev.startTime
                          : "時間指定なし"}
                      </div>
                    </div>

                    <span style={done ? styles.doneBadge : styles.todoBadge}>
                      {done ? "完了" : "未完了"}
                    </span>
                  </div>

                  {ev.memo && <div style={styles.memoText}>{ev.memo}</div>}

                  <div style={styles.taskActions}>
                    <button
                      onClick={() => toggleDone(ev)}
                      style={done ? styles.lightButton : styles.darkButton}
                    >
                      {done ? "未完了に戻す" : "完了"}
                    </button>

                    <button onClick={() => openEditModal(ev)} style={styles.lightButton}>
                      編集
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    width: "100%",
    maxWidth: "100%",
    overflowX: "hidden",
  },
  heroCard: {
    background: "#111",
    color: "#fff",
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    boxShadow: "0 20px 44px rgba(0,0,0,0.18)",
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },
  heroLabel: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 800,
    fontSize: 14,
    marginBottom: 6,
  },
  heroTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 42,
    fontWeight: 900,
    letterSpacing: "-0.05em",
    lineHeight: 1.05,
  },
  heroDate: {
    color: "rgba(255,255,255,0.62)",
    fontWeight: 700,
    marginTop: 8,
    fontSize: 15,
  },
  heroPercent: {
    color: "#fff",
    fontSize: 48,
    fontWeight: 900,
    letterSpacing: "-0.05em",
    lineHeight: 1,
  },
  heroCount: {
    color: "rgba(255,255,255,0.68)",
    fontWeight: 800,
    marginTop: 22,
    marginBottom: 10,
  },
  progressTrack: {
    height: 14,
    background: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    transition: "0.4s ease",
  },
  valueBlock: {
    marginTop: 20,
    display: "grid",
    gap: 9,
  },
  valueTitle: {
    color: "#fff",
    fontWeight: 900,
    fontSize: 22,
    letterSpacing: "-0.03em",
  },
  heroMuted: {
    color: "rgba(255,255,255,0.62)",
    fontWeight: 700,
    fontSize: 15,
  },
  streakPill: {
    marginTop: 6,
    padding: "9px 14px",
    borderRadius: 999,
    background: "rgba(250, 204, 21, 0.18)",
    color: "#fff",
    fontWeight: 900,
    width: "fit-content",
  },
  scheduleCard: {
    background: "#fff",
    borderRadius: 28,
    border: "1px solid #e7e9f2",
    padding: 22,
    boxShadow: "0 16px 36px rgba(0,0,0,0.04)",
    marginBottom: 24,
  },
  sectionHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.04em",
  },
  sectionCount: {
    color: "#777",
    fontWeight: 800,
    fontSize: 16,
  },
  emptyText: {
    color: "#777",
    fontWeight: 700,
    lineHeight: 1.7,
  },
  scheduleList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  taskCard: {
    padding: 16,
    borderRadius: 22,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.02)",
  },
  taskTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  taskTitle: {
    fontWeight: 900,
    fontSize: 21,
    lineHeight: 1.25,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  taskTime: {
    color: "#888",
    fontWeight: 700,
    marginTop: 4,
    fontSize: 15,
  },
  doneBadge: {
    flex: "0 0 auto",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#fff",
    border: "1px solid #e1e5ef",
    color: "#777",
    fontWeight: 800,
    fontSize: 13,
  },
  todoBadge: {
    flex: "0 0 auto",
    padding: "6px 12px",
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
  },
  memoText: {
    marginTop: 10,
    color: "#777",
    fontWeight: 700,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  taskActions: {
    display: "flex",
    gap: 10,
    marginTop: 14,
  },
  lightButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    background: "#fff",
    color: "#111",
    border: "1px solid #dbe0ea",
    fontWeight: 900,
  },
  darkButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
  },
};