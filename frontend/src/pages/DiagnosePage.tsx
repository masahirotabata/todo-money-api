import { useEffect, useMemo, useState } from "react";
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

type BacklogItem = {
  schedule: ScheduleEvent;
  date: string;
};

const BACKLOG_LOOKBACK_DAYS = 7;

function getCurrentUserKey() {
  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? payload.userId ?? payload.id ?? token;
  } catch {
    return token;
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

function saveReviewState(state: ReviewState) {
  localStorage.setItem(reviewKey(), JSON.stringify(state));
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

function occursOnDate(ev: ScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = new Date(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function reviewId(scheduleId: string, date: string) {
  return `${scheduleId}:${date}`;
}

export default function DiagnosePage() {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
    loadSchedules()
  );
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );
  const [reviewState, setReviewState] = useState<ReviewState>(() =>
    loadReviewState()
  );

  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAdMock, setShowAdMock] = useState(false);
  const [rainSeed, setRainSeed] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);

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

  useEffect(() => {
    saveReviewState(reviewState);
  }, [reviewState]);

  const backlogItems = useMemo<BacklogItem[]>(() => {
    const items: BacklogItem[] = [];
    const today = new Date();

    for (let i = BACKLOG_LOOKBACK_DAYS; i >= 1; i--) {
      const dateStr = toYMD(addDays(today, -i));

      schedules.forEach((ev) => {
        const done = ev.completedDates?.includes(dateStr) ?? false;
        const reviewed = reviewState[reviewId(ev.id, dateStr)] ?? false;

        if (occursOnDate(ev, dateStr) && !done && !reviewed) {
          items.push({ schedule: ev, date: dateStr });
        }
      });
    }

    return items;
  }, [schedules, reviewState]);

  const currentBacklog = backlogItems[reviewIndex];

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
      const exists = prev.some(
        (h) => h.scheduleId === ev.id && h.date === dateStr
      );

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

  function markBacklogReviewed(item: BacklogItem, done: boolean) {
    if (done) completeScheduleOnDate(item.schedule, item.date);

    setReviewState((prev) => {
      const next = {
        ...prev,
        [reviewId(item.schedule.id, item.date)]: true,
      };
      saveReviewState(next);
      return next;
    });

    const nextIndex = reviewIndex + 1;

    if (nextIndex >= backlogItems.length) {
      setReviewIndex(0);
      setShowAdMock(true);
    } else {
      setReviewIndex(nextIndex);
    }
  }

  function resetReviews() {
    if (!confirm("直近の診断履歴をリセットしますか？")) return;
    setReviewState({});
    saveReviewState({});
    setReviewIndex(0);
  }

  return (
    <div className="container">
      <MoneyRainOverlay seed={rainSeed} />

      <div style={styles.heroCard}>
        <div>
          <div style={styles.heroLabel}>行動の棚卸し</div>
          <h1 style={styles.heroTitle}>診断</h1>
          <p style={styles.heroText}>
            昨日までの未完了タスクを整理して、今日の行動価値に変えましょう。
          </p>
        </div>

        <div style={styles.heroCount}>{backlogItems.length}件</div>
      </div>

      {backlogItems.length === 0 || !currentBacklog ? (
        <div style={styles.emptyCard}>
          <div style={styles.emptyIcon}>✨</div>
          <h2 style={styles.emptyTitle}>整理するタスクはありません</h2>
          <p style={styles.emptyText}>
            未完了タスクが出たら、ここでまとめて診断できます。
          </p>

          <button style={styles.subButton} onClick={resetReviews}>
            診断履歴をリセット
          </button>
        </div>
      ) : (
        <div
          style={styles.reviewCard}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX == null) return;
            const diff = e.changedTouches[0].clientX - touchX;
            setTouchX(null);

            if (diff > 60) {
              markBacklogReviewed(currentBacklog, true);
            } else if (diff < -60) {
              markBacklogReviewed(currentBacklog, false);
            }
          }}
        >
          <div style={styles.counter}>
            {reviewIndex + 1}/{backlogItems.length}
          </div>

          <h2 style={styles.reviewTitle}>未完了タスクを整理しよう</h2>
          <p style={styles.reviewSub}>
            右スワイプで完了 / 左スワイプで未完了
          </p>

          <div style={styles.taskCard}>
            <div style={styles.dateText}>{currentBacklog.date}</div>
            <div style={styles.taskTitle}>{currentBacklog.schedule.title}</div>
            <div style={styles.taskMemo}>
              {currentBacklog.schedule.memo || "メモなし"}
            </div>
          </div>

          <div style={styles.actionRow}>
            <button
              onClick={() => markBacklogReviewed(currentBacklog, false)}
              style={styles.lightButton}
            >
              未完了
            </button>

            <button
              onClick={() => markBacklogReviewed(currentBacklog, true)}
              style={styles.darkButton}
            >
              完了
            </button>
          </div>
        </div>
      )}

      <div style={styles.proCard}>
        <div style={styles.proLabel}>PRO</div>
        <h2 style={styles.proTitle}>行動をもっと深く管理</h2>

        <div style={styles.proList}>
          <div style={styles.proItem}>
            <span style={styles.check}>✓</span>
            <span>行動診断を何度でも</span>
          </div>
          <div style={styles.proItem}>
            <span style={styles.check}>✓</span>
            <span>カテゴリ別の分析グラフ</span>
          </div>
          <div style={styles.proItem}>
            <span style={styles.check}>✓</span>
            <span>行動実績を記録・可視化</span>
          </div>
          <div style={styles.proItem}>
            <span style={styles.check}>✓</span>
            <span>行動カテゴリカスタマイズ</span>
          </div>
        </div>

        <button style={styles.proButton}>
          Proにアップグレード →
        </button>
      </div>

      {showAdMock && (
        <div style={styles.overlay}>
          <div style={styles.adCard}>
            <h2 style={{ marginTop: 0 }}>今日の収益が更新されました</h2>
            <div className="small muted" style={{ marginBottom: 14 }}>
              ここに広告表示を入れる予定
            </div>

            <div style={styles.adBox}>AD</div>

            <button className="primary" onClick={() => setShowAdMock(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heroCard: {
    background: "#111",
    color: "#fff",
    borderRadius: 28,
    padding: 24,
    marginBottom: 18,
    boxShadow: "0 20px 44px rgba(0,0,0,0.18)",
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
    fontSize: 44,
    fontWeight: 900,
    letterSpacing: "-0.05em",
  },
  heroText: {
    color: "rgba(255,255,255,0.72)",
    fontWeight: 700,
    lineHeight: 1.7,
    margin: "12px 0 0",
  },
  heroCount: {
    fontSize: 36,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  emptyCard: {
    background: "#fff",
    borderRadius: 28,
    padding: 28,
    textAlign: "center",
    border: "1px solid #e7e9f2",
    marginBottom: 18,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 900,
    margin: "0 0 10px",
  },
  emptyText: {
    color: "#777",
    fontWeight: 700,
    lineHeight: 1.7,
  },
  reviewCard: {
    background: "#fff",
    borderRadius: 28,
    padding: 24,
    border: "1px solid #e7e9f2",
    boxShadow: "0 16px 36px rgba(0,0,0,0.06)",
    marginBottom: 18,
  },
  counter: {
    color: "#777",
    fontWeight: 800,
    marginBottom: 8,
  },
  reviewTitle: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
  },
  reviewSub: {
    color: "#777",
    fontWeight: 700,
    marginTop: 8,
  },
  taskCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.02)",
  },
  dateText: {
    color: "#777",
    fontWeight: 700,
  },
  taskTitle: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: 900,
    wordBreak: "break-word",
  },
  taskMemo: {
    marginTop: 8,
    color: "#777",
    fontWeight: 700,
  },
  actionRow: {
    display: "flex",
    gap: 12,
    marginTop: 20,
  },
  lightButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    background: "#fff",
    color: "#111",
    fontWeight: 900,
  },
  darkButton: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    border: "none",
    background: "#111",
    color: "#fff",
    fontWeight: 900,
  },
  subButton: {
    marginTop: 16,
    border: "none",
    background: "transparent",
    color: "#777",
    fontWeight: 800,
  },
  proCard: {
    background: "#1b1b1b",
    color: "#fff",
    borderRadius: 28,
    padding: 28,
    marginTop: 18,
    marginBottom: 24,
    boxShadow: "0 20px 48px rgba(0,0,0,0.16)",
  },
  proLabel: {
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.22em",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 10,
  },
  proTitle: {
    margin: "0 0 20px",
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: "-0.03em",
  },
  proList: {
    display: "grid",
    gap: 13,
    marginBottom: 24,
  },
  proItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "rgba(255,255,255,0.82)",
    fontSize: 16,
    fontWeight: 700,
  },
  check: {
    color: "#27c7bd",
    fontSize: 22,
    lineHeight: 1,
  },
  proButton: {
    width: "100%",
    minHeight: 58,
    borderRadius: 999,
    border: "none",
    background: "#fff",
    color: "#111",
    fontSize: 17,
    fontWeight: 900,
  },
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  adCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    background: "white",
    padding: 22,
    textAlign: "center",
  },
  adBox: {
    borderRadius: 18,
    background: "rgba(0,0,0,0.04)",
    padding: 18,
    marginBottom: 16,
  },
};