// src/pages/SchedulePage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

function parseYMD(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
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

  const d = parseYMD(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function getDateLabel(ymd: string) {
  const d = parseYMD(ymd);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

function getTodayMessage(total: number, done: number) {
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  if (total === 0) {
    return {
      eyebrow: "CONTINUE",
      title: "今日は余白があります",
      body: "予定がない日も大事です。カレンダーに小さな回復予定を1つ置くのも良さそうです。",
      tip: "何もしない時間も、整える時間です 🌱",
      progress,
    };
  }

  if (done === 0) {
    return {
      eyebrow: "START",
      title: "まず1つだけでOK",
      body: "まだ完了はありません。重いタスクではなく、すぐ終わる予定から始めると流れが作りやすいです。",
      tip: "5分で終わる行動でも、今日の走行はちゃんと動き始めます 🌿",
      progress,
    };
  }

  if (done >= total) {
    return {
      eyebrow: "COMPLETE",
      title: "今日の予定、整いました",
      body: "予定していた行動を完了できています。今日はここまででも十分。よく走り切りました。",
      tip: "明日はまた小さく始めればOKです ✨",
      progress,
    };
  }

  return {
    eyebrow: "IN PROGRESS",
    title: "いい流れができています",
    body: "すでに行動が積み上がっています。残りは全部見ず、次の1つだけ見れば大丈夫です。",
    tip: "完璧より、流れを切らないことが大事です ☕️",
    progress,
  };
}

function getProgressColor(progress: number) {
  if (progress >= 100) return "#74e05d";
  if (progress >= 50) return "#67d957";
  if (progress > 0) return "#5dca4f";
  return "rgba(255,255,255,0.18)";
}

function getNextStep(progress: number, remainingCount: number) {
  if (progress >= 100) {
    return {
      icon: "🌙",
      title: "回復を1つ足す",
      body: "今日は走れているので、明日のために軽い休憩を入れる。",
    };
  }

  if (progress >= 50) {
    return {
      icon: "🌿",
      title: "残りから1つ選ぶ",
      body: `残り${remainingCount}件。全部ではなく、次の1つだけでOKです。`,
    };
  }

  if (progress > 0) {
    return {
      icon: "☕️",
      title: "小さく続ける",
      body: "流れはできています。5分で終わる行動をもう1つだけ。",
    };
  }

  return {
    icon: "📖",
    title: "最初の1つを置く",
    body: "Kindle5分、メモ1行、外に1分。軽い行動から始める。",
  };
}

export default function SchedulePage() {
  const todayYmd = toYMD(new Date());

  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
    loadSchedules()
  );
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );
  const [, setReviewState] = useState<ReviewState>(() => loadReviewState());

  const [rainSeed, setRainSeed] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalBaseDate, setModalBaseDate] = useState(new Date());
  const [modalInitial, setModalInitial] =
    useState<Partial<ScheduleEvent> | null>(null);
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

  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    setBarsReady(false);

    const timer = window.setTimeout(() => {
      setBarsReady(true);
  }, 80);

  return () => window.clearTimeout(timer);
}, [todayYmd]);

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
  const progress =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const remainingCount = Math.max(totalCount - completedCount, 0);
  const message = getTodayMessage(totalCount, completedCount);
  const nextStep = getNextStep(progress, remainingCount);

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

  function openCreateModal() {
    const [y, m, d] = todayYmd.split("-").map(Number);
    setEditingId(undefined);
    setModalBaseDate(new Date(y, m - 1, d));
    setModalInitial(null);
    setModalClickedDate(todayYmd);
    setModalOpen(true);
  }

  function handleSaveSchedule(data: Omit<ScheduleEvent, "id">) {
    setSchedules((prev) => {
      const next = editingId
        ? prev.map((x) =>
            x.id === editingId ? { ...x, ...data, id: editingId } : x
          )
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
    navigator.vibrate?.(80);
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

  function handleToggleDoneForDate(
    scheduleId: string,
    dateStr: string,
    done: boolean
  ) {
    const target = schedules.find((s) => s.id === scheduleId);
    if (!target) return;

    if (done) {
      completeScheduleOnDate(target, dateStr);
    } else {
      undoScheduleOnDate(target, dateStr);
    }
  }

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
        <div style={styles.pageKicker}>TaskMoney</div>
          <h1 style={styles.pageTitle}>継続</h1>
        </div>

        <button
          style={styles.iconButton}
          onClick={openCreateModal}
          aria-label="予定追加"
        >
          ＋
        </button>
      </header>

      <section style={styles.heroCard}>
        <div style={styles.heroTop}>
          <div>
            <div style={styles.eyebrow}>{message.eyebrow}</div>
            <h2 style={styles.heroTitle}>{message.title}</h2>
          </div>

          <div style={styles.percentBadge}>
            <span style={styles.percentNumber}>{progress}</span>
            <span style={styles.percentMark}>%</span>
          </div>
        </div>

        <p style={styles.heroBody}>{message.body}</p>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: barsReady ? `${progress}%` : "0%",
              background: getProgressColor(progress),
            }}
          />
        </div>

        <div style={styles.heroMetaRow}>
          <div>
            <div style={styles.metaLabel}>DATE</div>
            <div style={styles.metaValue}>{getDateLabel(todayYmd)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={styles.metaLabel}>TASKS</div>
            <div style={styles.metaValue}>
              {completedCount}/{totalCount}
            </div>
          </div>
        </div>

        <div style={styles.tipBox}>{message.tip}</div>
      </section>

      <section style={styles.conditionCard}>
        <div style={styles.sectionHeader}>
          <div>
            <div style={styles.darkEyebrow}>TODAY CONDITION</div>
            <h2 style={styles.sectionTitle}>今日の予定メーター</h2>
          </div>
          <div style={styles.bigCount}>
            {completedCount}/{totalCount}
          </div>
        </div>

        <MeterRow
          icon="🚗"
          label="今日の走行"
          value={progress}
          detail={`${completedCount}/${totalCount} 完了`}
          animated={barsReady}
        />
        <MeterRow
          icon="🌿"
          label="残りの予定"
          value={
            totalCount === 0
              ? 0
              : Math.round((remainingCount / totalCount) * 100)
          }
          detail={`${remainingCount}件`}
          muted
          animated={barsReady}
        />
        <MeterRow
          icon="🔥"
          label="継続"
          value={streakDays > 0 ? Math.min(100, streakDays * 14) : 0}
          detail={streakDays > 0 ? `${streakDays}日` : "0日"}
          animated={barsReady}
        />
      </section>

      <section style={styles.valueCard}>
        <div style={styles.valueTop}>
          <div>
            <div style={styles.valueEyebrow}>TODAY VALUE</div>
            <h2 style={styles.valueHeading}>今日の積み上げ</h2>
          </div>

          <div style={styles.valueIcon}>💰</div>
        </div>

        <div style={styles.valueAmount}>+{todayEarned.toLocaleString()}円</div>

        <div style={styles.valueDivider} />

        <div style={styles.valueMetaGrid}>
          <div style={styles.valueMetaBox}>
            <div style={styles.valueMetaLabel}>今月見込み</div>
            <div style={styles.valueMetaValue}>
              +{monthlyPace.toLocaleString()}円
            </div>
          </div>

          <div style={styles.valueMetaBox}>
            <div style={styles.valueMetaLabel}>目標まで</div>
            <div style={styles.valueMetaValue}>
              あと{remainingToTarget.toLocaleString()}円
            </div>
          </div>
        </div>

        <p style={styles.valueNote}>
          完了した行動を、未来の価値として積み上げています。
        </p>
      </section>

      <section style={styles.nextStepCard}>
        <div style={styles.nextEyebrow}>NEXT STEP</div>
        <h2 style={styles.nextTitle}>次の一歩</h2>

        <div style={styles.nextItem}>
          <div style={styles.nextIcon}>{nextStep.icon}</div>
          <div>
            <div style={styles.nextItemTitle}>{nextStep.title}</div>
            <div style={styles.nextItemBody}>{nextStep.body}</div>
          </div>
        </div>
      </section>

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

function MeterRow({
  icon,
  label,
  value,
  detail,
  muted = false,
  animated = true,
}: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  muted?: boolean;
  animated?: boolean;
}) {
  return (
    <div style={styles.meterRow}>
      <div style={styles.meterTop}>
        <div style={styles.meterLabel}>
          <span style={styles.meterIcon}>{icon}</span>
          {label}
        </div>
        <div style={styles.meterDetail}>
          {detail} ・ {value}%
        </div>
      </div>

      <div style={styles.meterTrack}>
        <div
          style={{
            ...styles.meterFill,
            width: animated
            ? `${Math.max(0, Math.min(100, value))}%`
            : "0%",
            opacity: muted ? 0.78 : 1,
          }}
        />
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "48px 20px calc(126px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 28% -10%, rgba(84, 214, 89, 0.28), transparent 34%), linear-gradient(180deg, #092514 0%, #07110c 46%, #050806 100%)",
    color: "#fff",
    overflowX: "hidden",
  },
  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 72% 18%, rgba(97, 220, 82, 0.16), transparent 26%)",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 26,
  },
  brand: {
    color: "#69d65e",
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "0.02em",
  },
  title: {
    margin: "6px 0 0",
    fontSize: 52,
    lineHeight: 0.95,
    fontWeight: 950,
    letterSpacing: "-0.08em",
  },
  iconButton: {
    width: 58,
    height: 58,
    minWidth: 58,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    fontSize: 30,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 26px rgba(0,0,0,0.18)",
    backdropFilter: "blur(18px)",
  },
  heroCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 36,
    padding: "26px 24px",
    marginBottom: 18,
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.055))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow:
      "0 24px 60px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
  },
  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 18,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "0.24em",
    marginBottom: 10,
  },
  heroTitle: {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.07em",
  },
  percentBadge: {
    flex: "0 0 auto",
    width: 112,
    height: 112,
    borderRadius: 34,
    background:
      "linear-gradient(145deg, rgba(103, 217, 87, 0.34), rgba(255,255,255,0.10))",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow:
      "0 18px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  percentNumber: {
    fontSize: 44,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  percentMark: {
    fontSize: 20,
    fontWeight: 950,
    marginLeft: 2,
    opacity: 0.86,
  },
  heroBody: {
    margin: "20px 0 18px",
    color: "rgba(255,255,255,0.72)",
    fontSize: 17,
    fontWeight: 850,
    lineHeight: 1.9,
  },
  progressTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    marginBottom: 18,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    boxShadow: "0 0 20px rgba(116,224,93,0.45)",
    transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
  heroMetaRow: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  metaLabel: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 5,
  },
  metaValue: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
    fontWeight: 900,
  },
  tipBox: {
    padding: "18px 18px",
    borderRadius: 24,
    background: "rgba(0,0,0,0.36)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    lineHeight: 1.75,
  },
  conditionCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 34,
    padding: "26px 24px",
    marginBottom: 18,
    background: "rgba(12, 17, 14, 0.82)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 22px 55px rgba(0,0,0,0.24)",
    backdropFilter: "blur(20px)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 22,
  },
  darkEyebrow: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: "0.22em",
    marginBottom: 8,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  bigCount: {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  meterRow: {
    marginTop: 20,
  },
  meterTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 10,
  },
  meterLabel: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
  },
  meterIcon: {
    fontSize: 24,
  },
  meterDetail: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 15,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  meterTrack: {
    height: 11,
    borderRadius: 999,
    background: "rgba(255,255,255,0.13)",
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
    background: "#74e05d",
    boxShadow: "0 0 18px rgba(116,224,93,0.35)",
    transition: "width 900ms cubic-bezier(0.16, 1, 0.3, 1)",
  },
  valueCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 34,
    padding: "24px 24px",
    marginBottom: 18,
    background:
      "linear-gradient(145deg, rgba(116,224,93,0.12), rgba(255,255,255,0.045))",
    border: "1px solid rgba(116,224,93,0.20)",
    boxShadow:
      "0 22px 55px rgba(0,0,0,0.24), 0 0 44px rgba(116,224,93,0.08)",
    backdropFilter: "blur(20px)",
  },
  valueTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  valueEyebrow: {
    color: "#9CF27F",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 8,
  },
  valueHeading: {
    margin: 0,
    color: "#fff",
    fontSize: 30,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  valueIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    background: "rgba(116,224,93,0.13)",
    border: "1px solid rgba(116,224,93,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  valueAmount: {
    marginTop: 4,
    color: "#fff",
    fontSize: 48,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.08em",
    textShadow: "0 0 24px rgba(116,224,93,0.22)",
  },
  valueDivider: {
    height: 1,
    background: "rgba(255,255,255,0.10)",
    margin: "20px 0 16px",
  },
  valueMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  valueMetaBox: {
    borderRadius: 20,
    padding: "14px 14px",
    background: "rgba(0,0,0,0.24)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  valueMetaLabel: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 6,
  },
  valueMetaValue: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  valueNote: {
    margin: "16px 0 0",
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 800,
  },
  nextStepCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 34,
    padding: "24px 24px",
    marginBottom: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.97), rgba(238,242,236,0.92))",
    color: "#111",
    boxShadow: "0 22px 55px rgba(0,0,0,0.20)",
  },
  nextEyebrow: {
    color: "rgba(0,0,0,0.13)",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 8,
  },
  nextTitle: {
    margin: "0 0 18px",
    color: "#111",
    fontSize: 34,
    lineHeight: 1.06,
    fontWeight: 950,
    letterSpacing: "-0.07em",
  },
  nextItem: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "18px 18px",
    borderRadius: 24,
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  nextIcon: {
    width: 54,
    height: 54,
    minWidth: 54,
    borderRadius: 18,
    background: "#0f1110",
    color: "#74e05d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 28,
  },
  nextItemTitle: {
    color: "#111",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  nextItemBody: {
    marginTop: 6,
    color: "#777",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.6,
  },
  pageKicker: {
    color: "rgba(142,230,111,0.78)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.14em",
  },
  
  pageTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
};
