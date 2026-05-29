// src/pages/AnalysisPage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { ScheduleEvent } from "./Calender";

type LifeTag = {
  id: string;
  label: string;
  statusName: string;
  emoji: string;
  custom?: boolean;
};

type GoalTagMap = Record<number, string>;

type HiddenBalanceType =
  | "skill"
  | "recovery"
  | "play"
  | "connection"
  | "life";

type BalanceDiagnostic = {
  type: HiddenBalanceType;
  label: string;
  emoji: string;
  done: number;
  scheduled: number;
  rate: number;
};

const DEFAULT_LIFE_TAGS: LifeTag[] = [
  { id: "side_business", label: "副業", statusName: "副業力", emoji: "💰" },
  { id: "health", label: "健康", statusName: "健康力", emoji: "💪" },
  { id: "study", label: "学習", statusName: "学習力", emoji: "📚" },
  { id: "output", label: "発信", statusName: "発信力", emoji: "📣" },
  { id: "sleep", label: "睡眠", statusName: "睡眠力", emoji: "🌙" },
];

const HIDDEN_TAG_TYPES: Record<string, HiddenBalanceType> = {
  side_business: "skill",
  study: "skill",
  output: "skill",
  health: "recovery",
  sleep: "recovery",
};

const BALANCE_META: Record<
  HiddenBalanceType,
  { label: string; emoji: string }
> = {
  skill: {
    label: "スキル向上",
    emoji: "🔥",
  },
  recovery: {
    label: "回復",
    emoji: "🌿",
  },
  play: {
    label: "遊び",
    emoji: "🎮",
  },
  connection: {
    label: "つながり",
    emoji: "🤝",
  },
  life: {
    label: "生活",
    emoji: "🏠",
  },
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function ymdToNum(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return y * 10000 + m * 100 + d;
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

function makeWeeklyDates() {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => toYMD(addDays(today, -6 + i)));
}

function getTagForSchedule(
  ev: ScheduleEvent,
  goalTags: GoalTagMap,
  allTags: LifeTag[]
) {
  const goalId = ev.taskRef?.goalId;
  const tagId =
    goalId != null ? goalTags[goalId] : ev.tags?.[0] ?? "side_business";

  return allTags.find((t) => t.id === tagId) ?? allTags[0] ?? DEFAULT_LIFE_TAGS[0];
}

function getHiddenType(tag: LifeTag): HiddenBalanceType {
  if (HIDDEN_TAG_TYPES[tag.id]) return HIDDEN_TAG_TYPES[tag.id];

  const text = `${tag.label}${tag.statusName}`.toLowerCase();

  if (
    text.includes("休") ||
    text.includes("睡眠") ||
    text.includes("健康") ||
    text.includes("回復") ||
    text.includes("散歩") ||
    text.includes("筋トレ")
  ) {
    return "recovery";
  }

  if (
    text.includes("遊") ||
    text.includes("エモ") ||
    text.includes("趣味") ||
    text.includes("旅行") ||
    text.includes("ゲーム")
  ) {
    return "play";
  }

  if (
    text.includes("家族") ||
    text.includes("友") ||
    text.includes("人間") ||
    text.includes("交流")
  ) {
    return "connection";
  }

  if (
    text.includes("勉強") ||
    text.includes("学習") ||
    text.includes("副業") ||
    text.includes("発信") ||
    text.includes("仕事") ||
    text.includes("開発")
  ) {
    return "skill";
  }

  return tag.custom ? "life" : "skill";
}

export default function AnalysisPage() {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
    loadSchedules()
  );
  const [goalTags, setGoalTags] = useState<GoalTagMap>(() => loadGoalTags());
  const [customTags, setCustomTags] = useState<LifeTag[]>(() =>
    loadCustomTags()
  );

  function refresh() {
    setSchedules(loadSchedules());
    setGoalTags(loadGoalTags());
    setCustomTags(loadCustomTags());
  }

  useEffect(() => {
    refresh();

    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  const allTags = useMemo(
    () => [...DEFAULT_LIFE_TAGS, ...customTags],
    [customTags]
  );

  const weeklyDates = useMemo(() => makeWeeklyDates(), []);

  const weeklyStats = useMemo(() => {
    const tagMap: Record<
      string,
      { tag: LifeTag; scheduled: number; done: number }
    > = {};

    let scheduledTotal = 0;
    let completedTotal = 0;

    for (const ev of schedules) {
      const tag = getTagForSchedule(ev, goalTags, allTags);

      if (!tagMap[tag.id]) {
        tagMap[tag.id] = { tag, scheduled: 0, done: 0 };
      }

      for (const date of weeklyDates) {
        if (!occursOnDate(ev, date)) continue;

        scheduledTotal++;
        tagMap[tag.id].scheduled++;

        if (ev.completedDates?.includes(date)) {
          completedTotal++;
          tagMap[tag.id].done++;
        }
      }
    }

    const tagStats = Object.values(tagMap).sort((a, b) => b.done - a.done);

    return {
      scheduledTotal,
      completedTotal,
      completionRate:
        scheduledTotal === 0
          ? 0
          : Math.round((completedTotal / scheduledTotal) * 100),
      tagStats,
    };
  }, [schedules, goalTags, allTags, weeklyDates]);

  const balanceStats = useMemo<BalanceDiagnostic[]>(() => {
    const base: Record<HiddenBalanceType, BalanceDiagnostic> = {
      skill: {
        type: "skill",
        label: BALANCE_META.skill.label,
        emoji: BALANCE_META.skill.emoji,
        scheduled: 0,
        done: 0,
        rate: 0,
      },
      recovery: {
        type: "recovery",
        label: BALANCE_META.recovery.label,
        emoji: BALANCE_META.recovery.emoji,
        scheduled: 0,
        done: 0,
        rate: 0,
      },
      play: {
        type: "play",
        label: BALANCE_META.play.label,
        emoji: BALANCE_META.play.emoji,
        scheduled: 0,
        done: 0,
        rate: 0,
      },
      connection: {
        type: "connection",
        label: BALANCE_META.connection.label,
        emoji: BALANCE_META.connection.emoji,
        scheduled: 0,
        done: 0,
        rate: 0,
      },
      life: {
        type: "life",
        label: BALANCE_META.life.label,
        emoji: BALANCE_META.life.emoji,
        scheduled: 0,
        done: 0,
        rate: 0,
      },
    };

    for (const ev of schedules) {
      const tag = getTagForSchedule(ev, goalTags, allTags);
      const type = getHiddenType(tag);

      for (const date of weeklyDates) {
        if (!occursOnDate(ev, date)) continue;

        base[type].scheduled++;

        if (ev.completedDates?.includes(date)) {
          base[type].done++;
        }
      }
    }

    const totalDone = Object.values(base).reduce((sum, x) => sum + x.done, 0);

    return Object.values(base)
      .map((x) => ({
        ...x,
        rate: totalDone === 0 ? 0 : Math.round((x.done / totalDone) * 100),
      }))
      .filter((x) => x.scheduled > 0 || x.done > 0)
      .sort((a, b) => b.done - a.done);
  }, [schedules, goalTags, allTags, weeklyDates]);

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

  const topTagStat = weeklyStats.tagStats[0];

  return (
    <div style={styles.page}>
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <h1 style={styles.title}>分析</h1>
      </header>

      <section style={styles.segmentWrap}>
        <button style={styles.segmentActive}>行動分析</button>
      </section>

      <section style={styles.balanceCard}>
        <div style={styles.balanceTop}>
          <div>
            <div style={styles.balanceTitle}>今週のバランス</div>
            <div style={styles.balanceSub}>
              回復を増やすと、より良いバランスになります。
            </div>
          </div>

          <div style={styles.adjustBadge}>調整中</div>
        </div>

        <div style={styles.balanceList}>
          {balanceStats.slice(0, 3).map((item, index) => {
            const colors = ["#9CF27F", "#F6A23C", "#78A9FF"];

            return (
              <div key={item.type} style={styles.balanceItem}>
                <div style={styles.balanceRow}>
                  <span style={styles.balanceName}>{item.label}</span>
                  <span style={styles.balanceRate}>{item.rate}%</span>
                </div>

                <div style={styles.balanceBar}>
                  <div
                    style={{
                      ...styles.balanceFill,
                      width: `${item.rate}%`,
                      background: colors[index] ?? "#9CF27F",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.summarySection}>
        <h2 style={styles.sectionTitle}>今週のサマリー</h2>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>完了した行動</div>
            <div style={styles.summaryValue}>
              {weeklyStats.completedTotal}件
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>達成率</div>
            <div style={styles.summaryValue}>
              {weeklyStats.completionRate}%
            </div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>連続記録</div>
            <div style={styles.summaryValue}>{streakDays}日</div>
          </div>
        </div>
      </section>

      <section style={styles.statusSection}>
        <h2 style={styles.sectionTitle}>人生ステータス</h2>

        <div style={styles.statusList}>
          {weeklyStats.tagStats.map((item) => {
            const rate =
              item.scheduled === 0
                ? 0
                : Math.round((item.done / item.scheduled) * 100);

            return (
              <div key={item.tag.id} style={styles.statusRow}>
                <div style={styles.statusLeft}>
                  <span style={styles.statusEmoji}>{item.tag.emoji}</span>

                  <div>
                    <div style={styles.statusName}>
                      {item.tag.statusName} Lv2
                    </div>

                    <div style={styles.statusSub}>
                      {item.done}/{item.scheduled}日 • {rate}%
                    </div>
                  </div>
                </div>

                <div style={styles.statusRight}>{rate}%</div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.aiReviewCard}>
        <div style={styles.aiReviewLabel}>AIレビュー</div>

        <h2 style={styles.aiReviewTitle}>
          {topTagStat
            ? `${topTagStat.tag.statusName}が伸びています`
            : "行動を積み上げ中です"}
        </h2>

        <p style={styles.aiReviewText}>
          今週は{topTagStat?.tag.emoji ?? "🌿"}
          {topTagStat?.tag.statusName ?? "行動"}の完了数が多く、
          良い流れで継続できています。
        </p>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "48px 20px calc(110px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 30% -10%, rgba(84,214,89,0.10), transparent 34%), linear-gradient(180deg, #0f1110 0%, #0a0c0b 100%)",
    color: "#fff",
    position: "relative",
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
    marginBottom: 22,
  },

  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  segmentWrap: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 22,
  },

  segmentActive: {
    border: "none",
    minWidth: 150,
    minHeight: 44,
    borderRadius: 999,
    background:
      "linear-gradient(90deg, rgba(91,201,75,0.12), rgba(116,224,93,0.40))",
    color: "#9CF27F",
    fontWeight: 900,
    fontSize: 15,
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  },

  segmentButton: {
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.7)",
    fontWeight: 800,
    fontSize: 15,
    padding: "0 10px",
  },

  balanceCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 20px 48px rgba(0,0,0,0.22)",
    backdropFilter: "blur(18px)",
  },

  balanceTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 18,
  },

  balanceTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
    marginBottom: 6,
  },

  balanceSub: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    lineHeight: 1.5,
    fontWeight: 700,
  },

  adjustBadge: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "6px 10px",
    background: "rgba(246,162,60,0.18)",
    color: "#F6A23C",
    fontSize: 12,
    fontWeight: 900,
  },

  balanceList: {
    display: "grid",
    gap: 16,
  },

  balanceItem: {
    display: "grid",
    gap: 8,
  },

  balanceRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },

  balanceName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
  },

  balanceRate: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 900,
  },

  balanceBar: {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },

  balanceFill: {
    height: "100%",
    borderRadius: 999,
  },

  summarySection: {
    position: "relative",
    zIndex: 1,
    marginBottom: 22,
  },

  sectionTitle: {
    margin: "0 0 16px",
    color: "#fff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },

  summaryCard: {
    borderRadius: 20,
    padding: "18px 14px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 16px 32px rgba(0,0,0,0.18)",
  },

  summaryLabel: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
  },

  summaryValue: {
    color: "#fff",
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  statusSection: {
    position: "relative",
    zIndex: 1,
    marginBottom: 22,
  },

  statusList: {
    display: "grid",
    gap: 12,
  },

  statusRow: {
    borderRadius: 22,
    padding: "16px 18px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.05)",
    boxShadow: "0 16px 36px rgba(0,0,0,0.16)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },

  statusLeft: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    minWidth: 0,
  },

  statusEmoji: {
    fontSize: 24,
  },

  statusName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: 900,
  },

  statusSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: 700,
  },

  statusRight: {
    color: "#9CF27F",
    fontSize: 16,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  aiReviewCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    padding: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
  },

  aiReviewLabel: {
    color: "#9CF27F",
    fontSize: 13,
    fontWeight: 900,
    letterSpacing: "0.14em",
    marginBottom: 12,
  },

  aiReviewTitle: {
    margin: "0 0 12px",
    color: "#fff",
    fontSize: 28,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },

  aiReviewText: {
    margin: 0,
    color: "rgba(255,255,255,0.74)",
    fontSize: 15,
    lineHeight: 1.8,
    fontWeight: 700,
  },
  
};
