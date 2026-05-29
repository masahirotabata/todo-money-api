// src/pages/DiagnosePage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import MoneyRainOverlay from "../components/MoneyRainOverlay";
import type { ScheduleEvent } from "./Calender";

type ScheduleHistoryItem = {
  id: string;
  scheduleId: string;
  date: string;
  doneAt: string;
  title: string;
};

type ReviewAction = "keep" | "reduce" | "quit" | "later" | "completed";
type ReviewState = Record<string, ReviewAction | boolean>;

type LifeTag = {
  id: string;
  label: string;
  statusName: string;
  emoji: string;
  custom?: boolean;
};

type GoalTagMap = Record<number, string>;

type ReviewItem = {
  schedule: ScheduleEvent;
  lastDoneDate: string | null;
  scheduledCount: number;
  doneCount: number;
  missedCount: number;
  tag: LifeTag;
  reason: string;
};

type TagDiagnostic = {
  tag: LifeTag;
  scheduled: number;
  done: number;
  rate: number;
};

type ReduceMode =
  | "week3"
  | "week1"
  | "shorter"
  | "noTime"
  | "notificationOnly";

const REVIEW_LOOKBACK_DAYS = 14;
const STALE_DAYS_THRESHOLD = 7;

const DEFAULT_LIFE_TAGS: LifeTag[] = [
  { id: "side_business", label: "副業", statusName: "副業力", emoji: "💰" },
  { id: "health", label: "健康", statusName: "健康力", emoji: "💪" },
  { id: "study", label: "学習", statusName: "学習力", emoji: "📚" },
  { id: "output", label: "発信", statusName: "発信力", emoji: "📣" },
  { id: "sleep", label: "睡眠", statusName: "睡眠力", emoji: "🌙" },
];

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

function scheduleKey() {
  return `todo-money:schedules:v1:${getCurrentUserKey()}`;
}

function scheduleHistoryKey() {
  return `todo-money:scheduleHistory:v1:${getCurrentUserKey()}`;
}

function reviewKey() {
  return `todo-money:scheduleReview:v2:${getCurrentUserKey()}`;
}

function goalTagKey() {
  return `todo-money:goalTags:v1:${getCurrentUserKey()}`;
}

function customTagKey() {
  return `todo-money:customLifeTags:v1:${getCurrentUserKey()}`;
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

function loadGoalTags(): GoalTagMap {
  try {
    const raw = localStorage.getItem(goalTagKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadCustomTags(): LifeTag[] {
  try {
    const raw = localStorage.getItem(customTagKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
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

function occursOnDate(ev: ScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = new Date(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function makeDateRange(days: number) {
  const today = new Date();
  return Array.from({ length: days }, (_, i) =>
    toYMD(addDays(today, -(days - 1) + i))
  );
}

function reviewId(scheduleId: string) {
  return `${scheduleId}:monthly-review`;
}

function isReviewed(value: ReviewState[string]) {
  return (
    value === true ||
    value === "keep" ||
    value === "reduce" ||
    value === "quit" ||
    value === "later" ||
    value === "completed"
  );
}

function getTagForSchedule(
  ev: ScheduleEvent,
  goalTags: GoalTagMap,
  allTags: LifeTag[]
) {
  const goalId = ev.taskRef?.goalId;
  const tagId =
    goalId != null ? goalTags[goalId] : ev.tags?.[0] ?? "side_business";

  return (
    allTags.find((t) => t.id === tagId) ?? allTags[0] ?? DEFAULT_LIFE_TAGS[0]
  );
}

function findLastDoneDate(ev: ScheduleEvent) {
  const dates = ev.completedDates ?? [];
  if (dates.length === 0) return null;
  return dates.slice().sort((a, b) => ymdToNum(b) - ymdToNum(a))[0] ?? null;
}

function daysSinceYmd(ymd: string | null) {
  if (!ymd) return 999;

  const today = new Date();
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function buildDiagnosisComment(tagStats: TagDiagnostic[]) {
  if (tagStats.length === 0) {
    return {
      title: "まずは行動データを育てましょう",
      body: "予定を登録して完了すると、タグ別の得意・不足が見えるようになります。",
      tip: "おすすめ：今日できる5分行動を1つだけ登録してみましょう。",
    };
  }

  const sortedByDone = tagStats.slice().sort((a, b) => b.done - a.done);
  const best = sortedByDone[0];
  const weak = tagStats
    .filter((x) => x.scheduled > 0)
    .sort((a, b) => a.rate - b.rate)[0];

  if (
    best &&
    best.done > 0 &&
    weak &&
    weak.rate < 50 &&
    weak.tag.id !== best.tag.id
  ) {
    return {
      title: `${best.tag.statusName}がよく伸びています`,
      body: `${best.tag.emoji}${best.tag.statusName}は今週かなり動けています。一方で、${weak.tag.emoji}${weak.tag.statusName}は少し止まり気味です。`,
      tip: `${weak.tag.label}系の行動は、いったん小さくして続けやすい形に変えるのがおすすめです。`,
    };
  }

  if (best && best.done > 0) {
    return {
      title: `${best.tag.statusName}が良い流れです`,
      body: `今週は${best.tag.emoji}${best.tag.statusName}の行動が一番多く完了しています。この調子で、来週も同じ方向を少しだけ積むと強いです。`,
      tip: "おすすめ：続いている行動は削らず、予定の時間帯だけ整えてみましょう。",
    };
  }

  return {
    title: "行動の整理タイミングです",
    body: "今週はまだ完了データが少なめです。できなかった行動を責めるより、来週続けやすい形に整えましょう。",
    tip: "おすすめ：続かない行動は“やめる”より先に“減らす”を試すと、習慣が残りやすいです。",
  };
}

function applyReduceMode(ev: ScheduleEvent, mode: ReduceMode): ScheduleEvent {
  const next: ScheduleEvent = { ...ev };

  if (mode === "week3") {
    next.weekdays = [false, true, false, true, false, true, false];
    next.oneShot = false;
    return next;
  }

  if (mode === "week1") {
    next.weekdays = [false, false, false, false, false, false, true];
    next.oneShot = false;
    return next;
  }

  if (mode === "noTime") {
    next.startTime = "";
    next.endTime = "";
    return next;
  }

  if (mode === "notificationOnly") {
    next.startTime = "";
    next.endTime = "";
    next.memo = [next.memo, "棚卸し：通知・メモだけ残す形に軽量化"]
      .filter(Boolean)
      .join("\n");
    return next;
  }

  if (mode === "shorter") {
    const memoLine = "棚卸し：時間を短くして続ける";
    next.memo = next.memo ? `${next.memo}\n${memoLine}` : memoLine;

    if (next.startTime && next.endTime) {
      const [sh, sm] = next.startTime.split(":").map(Number);
      const start = new Date();
      start.setHours(sh || 0, sm || 0, 0, 0);
      const end = new Date(start.getTime() + 10 * 60 * 1000);
      next.endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
    }

    return next;
  }

  return next;
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
  const [goalTags, setGoalTags] = useState<GoalTagMap>(() => loadGoalTags());
  const [customTags, setCustomTags] = useState<LifeTag[]>(() =>
    loadCustomTags()
  );

  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAdMock, setShowAdMock] = useState(false);
  const [rainSeed, setRainSeed] = useState(0);
  const [touchX, setTouchX] = useState<number | null>(null);
  const [reduceTarget, setReduceTarget] = useState<ReviewItem | null>(null);

  const allTags = useMemo(
    () => [...DEFAULT_LIFE_TAGS, ...customTags],
    [customTags]
  );

  function refreshFromStorage() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
    setReviewState(loadReviewState());
    setGoalTags(loadGoalTags());
    setCustomTags(loadCustomTags());
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

  const reviewItems = useMemo<ReviewItem[]>(() => {
    const dates = makeDateRange(REVIEW_LOOKBACK_DAYS);

    return schedules
      .map((ev) => {
        const scheduledDates = dates.filter((date) => occursOnDate(ev, date));
        const doneDates = scheduledDates.filter((date) =>
          ev.completedDates?.includes(date)
        );
        const missedCount = scheduledDates.length - doneDates.length;
        const lastDoneDate = findLastDoneDate(ev);
        const daysSinceDone = daysSinceYmd(lastDoneDate);
        const reviewed = isReviewed(reviewState[reviewId(ev.id)]);
        const tag = getTagForSchedule(ev, goalTags, allTags);

        if (reviewed) return null;
        if (scheduledDates.length === 0) return null;

        const shouldReview =
          daysSinceDone >= STALE_DAYS_THRESHOLD ||
          missedCount >= Math.min(STALE_DAYS_THRESHOLD, scheduledDates.length);

        if (!shouldReview) return null;

        const reason =
          lastDoneDate == null
            ? "まだ完了記録がありません"
            : `${daysSinceDone}日ほど止まっています`;

        return {
          schedule: ev,
          lastDoneDate,
          scheduledCount: scheduledDates.length,
          doneCount: doneDates.length,
          missedCount,
          tag,
          reason,
        };
      })
      .filter(Boolean) as ReviewItem[];
  }, [schedules, reviewState, goalTags, allTags]);

  const currentItem = reviewItems[reviewIndex];

  const tagDiagnostics = useMemo<TagDiagnostic[]>(() => {
    const dates = makeDateRange(7);
    const map: Record<string, TagDiagnostic> = {};

    for (const ev of schedules) {
      const tag = getTagForSchedule(ev, goalTags, allTags);

      if (!map[tag.id]) {
        map[tag.id] = {
          tag,
          scheduled: 0,
          done: 0,
          rate: 0,
        };
      }

      for (const date of dates) {
        if (!occursOnDate(ev, date)) continue;

        map[tag.id].scheduled++;

        if (ev.completedDates?.includes(date)) {
          map[tag.id].done++;
        }
      }
    }

    return Object.values(map)
      .map((x) => ({
        ...x,
        rate:
          x.scheduled === 0 ? 0 : Math.round((x.done / x.scheduled) * 100),
      }))
      .sort((a, b) => b.done - a.done);
  }, [schedules, goalTags, allTags]);

  const diagnosis = useMemo(
    () => buildDiagnosisComment(tagDiagnostics),
    [tagDiagnostics]
  );

  function completeScheduleToday(ev: ScheduleEvent) {
    const todayYmd = toYMD(new Date());

    setSchedules((prev) => {
      const next = prev.map((x) => {
        if (x.id !== ev.id) return x;

        const prevDates = x.completedDates ?? [];
        const nextDates = prevDates.includes(todayYmd)
          ? prevDates
          : [...prevDates, todayYmd];

        return { ...x, completedDates: nextDates };
      });

      saveSchedules(next);
      return next;
    });

    setHistory((prev) => {
      const exists = prev.some(
        (h) => h.scheduleId === ev.id && h.date === todayYmd
      );
      if (exists) return prev;

      const next = [
        ...prev,
        {
          id: uid(),
          scheduleId: ev.id,
          date: todayYmd,
          doneAt: new Date().toISOString(),
          title: ev.title,
        },
      ];

      saveHistory(next);
      return next;
    });

    setRainSeed(Date.now());
  }

  function moveNext() {
    const nextIndex = reviewIndex + 1;

    if (nextIndex >= reviewItems.length) {
      setReviewIndex(0);
      setShowAdMock(true);
    } else {
      setReviewIndex(nextIndex);
    }
  }

  function saveReviewAction(scheduleId: string, action: ReviewAction) {
    setReviewState((prev) => {
      const next = {
        ...prev,
        [reviewId(scheduleId)]: action,
      };
      saveReviewState(next);
      return next;
    });
  }

  function markReviewed(item: ReviewItem, action: ReviewAction) {
    if (action === "completed") {
      completeScheduleToday(item.schedule);
    }

    if (action === "quit") {
      if (!confirm(`「${item.schedule.title}」を行動から削除しますか？`)) {
        return;
      }

      setSchedules((prev) => {
        const next = prev.filter((x) => x.id !== item.schedule.id);
        saveSchedules(next);
        return next;
      });
    }

    saveReviewAction(item.schedule.id, action);
    moveNext();
  }

  function openReduceSheet(item: ReviewItem) {
    setReduceTarget(item);
  }

  function applyReduce(item: ReviewItem, mode: ReduceMode) {
    setSchedules((prev) => {
      const next = prev.map((x) =>
        x.id === item.schedule.id ? applyReduceMode(x, mode) : x
      );
      saveSchedules(next);
      return next;
    });

    saveReviewAction(item.schedule.id, "reduce");
    setReduceTarget(null);
    moveNext();
  }

  function resetReviews() {
    if (!confirm("直近の棚卸し履歴をリセットしますか？")) return;
    setReviewState({});
    saveReviewState({});
    setReviewIndex(0);
  }

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
        <div style={styles.pageKicker}>TaskMoney</div>
          <h1 style={styles.pageTitle}>診断</h1>
        </div>

        <button style={styles.backButton} onClick={resetReviews}>
          ↩
        </button>
      </header>

      <section style={styles.aiCard}>
        <div style={styles.aiLabel}>🌿 AI ACTION REVIEW</div>
        <h2 style={styles.aiTitle}>{diagnosis.title}</h2>
        <p style={styles.aiBody}>{diagnosis.body}</p>
        <div style={styles.aiTip}>{diagnosis.tip}</div>
      </section>

      {reviewItems.length === 0 || !currentItem ? (
        <section style={styles.emptyCard}>
          <div style={styles.emptyIcon}>✨</div>
          <h2 style={styles.emptyTitle}>棚卸し対象はありません</h2>
          <p style={styles.emptyText}>
            7日以上止まっている行動が出たら、ここで続ける・減らす・やめるを整理できます。
          </p>

          <button style={styles.subButton} onClick={resetReviews}>
            棚卸し履歴をリセット
          </button>
        </section>
      ) : (
        <section
          style={styles.reviewCard}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX == null) return;
            const diff = e.changedTouches[0].clientX - touchX;
            setTouchX(null);

            if (diff > 60) {
              markReviewed(currentItem, "keep");
            } else if (diff < -60) {
              markReviewed(currentItem, "quit");
            }
          }}
        >
          <div style={styles.counter}>
            {reviewIndex + 1}/{reviewItems.length}
          </div>

          <h2 style={styles.reviewTitle}>この行動、来週どうする？</h2>
          <p style={styles.reviewSub}>
            右スワイプで続ける / 左スワイプでやめる
          </p>

          <div style={styles.taskCard}>
            <div style={styles.tagPill}>
              {currentItem.tag.emoji} {currentItem.tag.statusName}
            </div>

            <div style={styles.taskTitle}>{currentItem.schedule.title}</div>

            <div style={styles.reasonText}>{currentItem.reason}</div>

            <div style={styles.taskMemo}>
              直近{REVIEW_LOOKBACK_DAYS}日：{currentItem.doneCount}/
              {currentItem.scheduledCount}回 完了
            </div>

            {currentItem.schedule.memo && (
              <div style={styles.memoText}>{currentItem.schedule.memo}</div>
            )}
          </div>

          <div style={styles.actionGrid}>
            <button
              onClick={() => markReviewed(currentItem, "quit")}
              style={styles.dangerButton}
            >
              やめる
            </button>

            <button
              onClick={() => openReduceSheet(currentItem)}
              style={styles.lightButton}
            >
              減らす
            </button>

            <button
              onClick={() => markReviewed(currentItem, "later")}
              style={styles.lightButton}
            >
              あとで
            </button>

            <button
              onClick={() => markReviewed(currentItem, "keep")}
              style={styles.keepButton}
            >
              続ける
            </button>
          </div>
        </section>
      )}

      <section style={styles.statusCard}>
        <div style={styles.sectionHead}>
          <h2 style={styles.sectionTitle}>タグ別の完了率</h2>
          <div style={styles.sectionCount}>{tagDiagnostics.length}件</div>
        </div>

        {tagDiagnostics.length === 0 ? (
          <div style={styles.emptyText}>
            カレンダーに行動を登録すると、タグごとの完了率が表示されます。
          </div>
        ) : (
          <div style={styles.statusList}>
            {tagDiagnostics.map((item) => (
              <div key={item.tag.id} style={styles.statusRow}>
                <div style={styles.statusTop}>
                  <div style={styles.statusName}>
                    {item.tag.emoji} {item.tag.statusName}
                  </div>
                  <div style={styles.statusCount}>
                    {item.done}/{item.scheduled}回・{item.rate}%
                  </div>
                </div>

                <div style={styles.statusBar}>
                  <div
                    style={{ ...styles.statusFill, width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reduceTarget && (
        <div style={styles.sheetBackdrop} onClick={() => setReduceTarget(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetLabel}>REDUCE ACTION</div>
            <h2 style={styles.sheetTitle}>行動を軽くしますか？</h2>
            <p style={styles.sheetText}>
              「{reduceTarget.schedule.title}」をやめずに、続けやすい形へ調整できます。
            </p>

            <div style={styles.reduceList}>
              {[
                {
                  mode: "week3" as ReduceMode,
                  title: "週3にする",
                  desc: "毎日が重い行動を、月・水・金だけにします。",
                },
                {
                  mode: "week1" as ReduceMode,
                  title: "週1にする",
                  desc: "まずは週1だけ残して、習慣の火を消さない形にします。",
                },
                {
                  mode: "shorter" as ReduceMode,
                  title: "時間を短くする",
                  desc: "10分だけやる前提にして、心理的な重さを減らします。",
                },
                {
                  mode: "noTime" as ReduceMode,
                  title: "時間未設定にする",
                  desc: "時間のプレッシャーを外して、できる時にやる形にします。",
                },
                {
                  mode: "notificationOnly" as ReduceMode,
                  title: "通知・メモだけ残す",
                  desc: "予定として縛らず、意識だけ残す軽い形にします。",
                },
              ].map((item) => (
                <button
                  key={item.mode}
                  style={styles.reduceButton}
                  onClick={() => applyReduce(reduceTarget, item.mode)}
                >
                  <div style={styles.reduceTitle}>{item.title}</div>
                  <div style={styles.reduceDesc}>{item.desc}</div>
                </button>
              ))}
            </div>

            <button
              style={styles.sheetCancelButton}
              onClick={() => setReduceTarget(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {showAdMock && (
        <div style={styles.overlay}>
          <div style={styles.adCard}>
            <h2 style={{ marginTop: 0 }}>棚卸しが完了しました</h2>
            <div style={styles.adText}>来週の行動が少し整いました。</div>

            <div style={styles.adBox}>AD</div>

            <button style={styles.adButton} onClick={() => setShowAdMock(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "48px 20px calc(112px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 30% -10%, rgba(84,214,89,0.10), transparent 34%), linear-gradient(180deg, #0f1110 0%, #0a0c0b 100%)",
    color: "#fff",
    overflowX: "hidden",
  },

  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 72% 18%, rgba(97,220,82,0.08), transparent 26%)",
  },

  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 20,
  },

  headerLabel: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 900,
    fontSize: 15,
    marginBottom: 6,
  },

  headerTitle: {
    margin: 0,
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  backButton: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 900,
  },

  aiCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  },

  aiLabel: {
    color: "#9CF27F",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.12em",
    marginBottom: 10,
  },

  aiTitle: {
    margin: "0 0 10px",
    color: "#fff",
    fontSize: 26,
    lineHeight: 1.25,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  aiBody: {
    margin: 0,
    color: "rgba(255,255,255,0.74)",
    fontSize: 14,
    lineHeight: 1.7,
    fontWeight: 750,
  },

  aiTip: {
    marginTop: 14,
    padding: "14px 14px",
    borderRadius: 16,
    background: "rgba(0,0,0,0.34)",
    border: "1px solid rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.6,
  },

  emptyCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 22,
    textAlign: "center",
    marginBottom: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.06)",
  },

  emptyIcon: {
    fontSize: 44,
    marginBottom: 14,
  },

  emptyTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
    margin: "0 0 10px",
  },

  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 750,
    lineHeight: 1.7,
    fontSize: 14,
  },

  reviewCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  },

  counter: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 900,
    marginBottom: 8,
  },

  reviewTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 27,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  reviewSub: {
    color: "rgba(255,255,255,0.52)",
    fontWeight: 800,
    marginTop: 7,
    fontSize: 13,
  },

  taskCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "linear-gradient(135deg, rgba(255,255,255,0.90), rgba(255,255,255,0.64))",
    color: "#111",
    boxShadow: "0 16px 34px rgba(0,0,0,0.14)",
  },

  tagPill: {
    width: "fit-content",
    padding: "7px 12px",
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 12,
  },

  taskTitle: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    wordBreak: "break-word",
  },

  reasonText: {
    marginTop: 10,
    color: "#111",
    fontWeight: 900,
  },

  taskMemo: {
    marginTop: 8,
    color: "#777",
    fontWeight: 750,
  },

  memoText: {
    marginTop: 8,
    color: "#888",
    fontWeight: 700,
    lineHeight: 1.6,
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginTop: 16,
  },

  lightButton: {
    minHeight: 44,
    borderRadius: 14,
    background: "rgba(255,255,255,0.92)",
    color: "#111",
    border: "none",
    fontWeight: 950,
    fontSize: 13,
  },

  keepButton: {
    minHeight: 44,
    borderRadius: 14,
    border: "none",
    background: "#74e05d",
    color: "#07110c",
    fontWeight: 950,
    fontSize: 13,
    boxShadow: "0 12px 26px rgba(116,224,93,0.24)",
  },

  dangerButton: {
    minHeight: 44,
    borderRadius: 14,
    border: "none",
    background: "rgba(255,255,255,0.92)",
    color: "#b91c1c",
    fontWeight: 950,
    fontSize: 13,
  },

  subButton: {
    marginTop: 16,
    border: "none",
    background: "transparent",
    color: "#9CF27F",
    fontWeight: 900,
  },

  statusCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
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
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  sectionCount: {
    color: "rgba(255,255,255,0.55)",
    fontWeight: 900,
    fontSize: 14,
  },

  statusList: {
    display: "grid",
    gap: 14,
  },

  statusRow: {
    display: "grid",
    gap: 8,
  },

  statusTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
  },

  statusName: {
    fontWeight: 900,
    fontSize: 16,
    color: "#fff",
  },

  statusCount: {
    color: "rgba(255,255,255,0.52)",
    fontWeight: 800,
    fontSize: 13,
  },

  statusBar: {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },

  statusFill: {
    height: "100%",
    borderRadius: 999,
    background: "#74e05d",
    transition: "0.3s ease",
  },

  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
  },

  sheet: {
    width: "100%",
    maxWidth: 560,
    maxHeight: "82dvh",
    overflowY: "auto",
    background: "#f7f8f6",
    color: "#111",
    borderRadius: "30px 30px 0 0",
    padding: "12px 22px calc(24px + env(safe-area-inset-bottom))",
    boxShadow: "0 -18px 50px rgba(0,0,0,0.28)",
  },

  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    background: "rgba(0,0,0,0.14)",
    margin: "0 auto 18px",
  },

  sheetLabel: {
    color: "#999",
    letterSpacing: "0.16em",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 8,
  },

  sheetTitle: {
    margin: "0 0 10px",
    fontSize: 27,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "#111",
  },

  sheetText: {
    color: "#666",
    fontSize: 15,
    fontWeight: 750,
    lineHeight: 1.7,
    margin: "0 0 16px",
  },

  reduceList: {
    display: "grid",
    gap: 10,
  },

  reduceButton: {
    width: "100%",
    textAlign: "left",
    border: "1px solid #e3e6ef",
    background: "#fff",
    borderRadius: 18,
    padding: "14px 16px",
  },

  reduceTitle: {
    color: "#111",
    fontSize: 17,
    fontWeight: 950,
    marginBottom: 4,
  },

  reduceDesc: {
    color: "#777",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.6,
  },

  sheetCancelButton: {
    width: "100%",
    minHeight: 54,
    marginTop: 14,
    borderRadius: 18,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
  },

  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  adCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    background: "#f7f8f6",
    color: "#111",
    padding: 22,
    textAlign: "center",
  },

  adText: {
    color: "#777",
    marginBottom: 14,
    fontWeight: 800,
  },

  adBox: {
    borderRadius: 18,
    background: "rgba(0,0,0,0.04)",
    padding: 18,
    marginBottom: 16,
    color: "#777",
    fontWeight: 950,
  },

  adButton: {
    width: "100%",
    minHeight: 52,
    border: "none",
    borderRadius: 18,
    background: "#111",
    color: "#fff",
    fontWeight: 950,
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
