// src/pages/FootprintsPage.tsx
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

type MonthlyFootprint = {
  title: string;
  emoji: string;
  count: number;
  lastDate: string;
};

type DayFootprint = {
  id: string;
  title: string;
  emoji: string;
  status: "前進" | "予定";
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

function loadHistory(): ScheduleHistoryItem[] {
  try {
    const raw = localStorage.getItem(scheduleHistoryKey());
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

function ymdToNum(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function getMonthKey(ymd: string) {
  return ymd.slice(0, 7);
}

function getMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${y}年${m}月`;
}

function getEnglishMonthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[(m || 1) - 1]}, ${y}`;
}

function getDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const week = ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
  return `${y}年${m}月${d}日(${week})`;
}

function occursOnDate(ev: ScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return !!ev.weekdays[date.getDay()];
}

function isChallengeSchedule(ev?: Partial<ScheduleEvent> | null) {
  if (!ev) return false;

  const text = `${ev.title ?? ""} ${ev.memo ?? ""}`;

  return (
    text.includes("挑戦者") ||
    text.includes("挑戦者ミッション") ||
    text.includes("MISSION EVENT") ||
    text.includes("チャレンジミッション")
  );
}

function getFootprintTitle(evOrTitle?: ScheduleEvent | string | null) {
  if (typeof evOrTitle === "string") return evOrTitle || "前進";
  if (isChallengeSchedule(evOrTitle)) return "挑戦成功";
  return evOrTitle?.title || "前進";
}

function getDayFootprintTitle(ev: ScheduleEvent) {
  if (isChallengeSchedule(ev)) {
    return `挑戦成功：${ev.title || "ミッション達成"}`;
  }

  return ev.title || "前進";
}

function getFootprintEmoji(input: ScheduleEvent | string = "") {
  if (typeof input !== "string" && isChallengeSchedule(input)) return "🏆";

  const title = typeof input === "string" ? input : input.title ?? "";
  const text = title.toLowerCase();

  if (title.includes("挑戦成功") || title.includes("挑戦者")) return "🏆";
  if (title.includes("勉強") || title.includes("学習") || title.includes("資格") || title.includes("読書")) return "📚";
  if (title.includes("開発") || title.includes("制作") || title.includes("実装") || title.includes("AI") || text.includes("code")) return "🌿";
  if (title.includes("筋トレ") || title.includes("運動") || title.includes("ジム")) return "💪";
  if (title.includes("散歩") || title.includes("ランニング") || title.includes("走")) return "🏃";
  if (title.includes("歯医者") || title.includes("病院") || title.includes("通院")) return "🏥";
  if (title.includes("買い物") || title.includes("スーパー") || title.includes("支払い")) return "🛒";
  if (title.includes("子供") || title.includes("家族") || title.includes("公園")) return "🏠";
  if (title.includes("睡眠") || title.includes("休") || title.includes("寝")) return "🌙";
  if (title.includes("カフェ") || title.includes("外食") || title.includes("ご飯")) return "☕️";

  return "🌿";
}

function buildMonthlyFootprints(schedules: ScheduleEvent[], history: ScheduleHistoryItem[], monthKey: string) {
  const map = new Map<string, MonthlyFootprint>();

  for (const ev of schedules) {
    const completedDates = ev.completedDates ?? [];

    for (const date of completedDates) {
      if (getMonthKey(date) !== monthKey) continue;

      const title = getFootprintTitle(ev);
      const prev = map.get(title);
      map.set(title, {
        title,
        emoji: getFootprintEmoji(ev),
        count: (prev?.count ?? 0) + 1,
        lastDate: prev && ymdToNum(prev.lastDate) > ymdToNum(date) ? prev.lastDate : date,
      });
    }
  }

  // 古いバージョンで completedDates に入っていない完了履歴も拾う。
  for (const item of history) {
    if (getMonthKey(item.date) !== monthKey) continue;

    const schedule = schedules.find((ev) => ev.id === item.scheduleId);
    const alreadyCounted = schedule?.completedDates?.includes(item.date);
    if (alreadyCounted) continue;

    const title = schedule ? getFootprintTitle(schedule) : item.title || "前進";
    const prev = map.get(title);
    map.set(title, {
      title,
      emoji: schedule ? getFootprintEmoji(schedule) : getFootprintEmoji(title),
      count: (prev?.count ?? 0) + 1,
      lastDate: prev && ymdToNum(prev.lastDate) > ymdToNum(item.date) ? prev.lastDate : item.date,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return ymdToNum(b.lastDate) - ymdToNum(a.lastDate);
  });
}

function buildRecentFootprints(schedules: ScheduleEvent[], history: ScheduleHistoryItem[]) {
  const fromSchedules = schedules.flatMap((ev) =>
    (ev.completedDates ?? []).map((date) => ({
      id: `${ev.id}:${date}`,
      date,
      title: getFootprintTitle(ev),
      emoji: getFootprintEmoji(ev),
    }))
  );

  const fromHistory = history.map((item) => {
    const schedule = schedules.find((ev) => ev.id === item.scheduleId);
    const title = schedule ? getFootprintTitle(schedule) : item.title || "前進";
    return {
      id: item.id,
      date: item.date,
      title,
      emoji: schedule ? getFootprintEmoji(schedule) : getFootprintEmoji(title),
    };
  });

  const unique = new Map<string, { id: string; date: string; title: string; emoji: string }>();

  for (const item of [...fromSchedules, ...fromHistory]) {
    unique.set(`${item.date}:${item.title}`, item);
  }

  return Array.from(unique.values()).sort((a, b) => ymdToNum(b.date) - ymdToNum(a.date));
}

function buildDayFootprints(
  schedules: ScheduleEvent[],
  date: string
): DayFootprint[] {
  return schedules
    .filter((ev) => occursOnDate(ev, date) || ev.completedDates?.includes(date))
    .map((ev): DayFootprint => {
      const done = ev.completedDates?.includes(date) ?? false;
      const status: DayFootprint["status"] = done ? "前進" : "予定";

      return {
        id: `${ev.id}:${date}`,
        title: done ? getDayFootprintTitle(ev) : ev.title,
        emoji: done ? getFootprintEmoji(ev) : getFootprintEmoji(ev.title),
        status,
      };
    })
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === "前進" ? -1 : 1
    );
}

type ChallengeRank = {
  threshold: number;
  icon: string;
  title: string;
  subtitle: string;
};

const CHALLENGE_RANKS: ChallengeRank[] = [
  {
    threshold: 0,
    icon: "🚗",
    title: "新人ドライバー",
    subtitle: "まずは小さな挑戦を走り出した段階です。",
  },
  {
    threshold: 10,
    icon: "🏎️",
    title: "ストリートレーサー",
    subtitle: "日常の中で挑戦を拾えるようになってきました。",
  },
  {
    threshold: 30,
    icon: "🔥",
    title: "峠の走り屋",
    subtitle: "迷っても前に進む走り方が身についています。",
  },
  {
    threshold: 50,
    icon: "⚡️",
    title: "ドリフトマスター",
    subtitle: "予定外の道も、自分の前進に変えられます。",
  },
  {
    threshold: 100,
    icon: "👑",
    title: "レジェンドドライバー",
    subtitle: "挑戦を積み重ねて、自分だけの道を作っています。",
  },
];

function countChallengeSuccesses(
  schedules: ScheduleEvent[],
  history: ScheduleHistoryItem[]
) {
  const unique = new Set<string>();

  for (const ev of schedules) {
    if (!isChallengeSchedule(ev)) continue;

    for (const date of ev.completedDates ?? []) {
      unique.add(`${ev.id}:${date}`);
    }
  }

  for (const item of history) {
    const schedule = schedules.find((ev) => ev.id === item.scheduleId);
    const isChallenge =
      isChallengeSchedule(schedule) ||
      item.title.includes("挑戦者") ||
      item.title.includes("挑戦成功");

    if (!isChallenge) continue;
    unique.add(`${item.scheduleId}:${item.date}`);
  }

  return unique.size;
}

function getChallengeRank(count: number) {
  const current =
    CHALLENGE_RANKS.slice()
      .reverse()
      .find((rank) => count >= rank.threshold) ?? CHALLENGE_RANKS[0];

  const next = CHALLENGE_RANKS.find((rank) => rank.threshold > count) ?? null;
  const previousThreshold = current.threshold;
  const nextThreshold = next?.threshold ?? current.threshold;
  const range = Math.max(1, nextThreshold - previousThreshold);
  const progress = next
    ? Math.min(100, Math.round(((count - previousThreshold) / range) * 100))
    : 100;

  return {
    current,
    next,
    progress,
    remaining: next ? Math.max(0, next.threshold - count) : 0,
  };
}

export default function FootprintsPage() {
  const todayYmd = toYMD(new Date());
  const currentMonth = todayYmd.slice(0, 7);

  const [schedules, setSchedules] = useState<ScheduleEvent[]>(() => loadSchedules());
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() => loadHistory());
  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [rainSeed, setRainSeed] = useState(0);

  function refreshFromStorage() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
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

  const monthlyFootprints = useMemo(
    () => buildMonthlyFootprints(schedules, history, currentMonth),
    [schedules, history, currentMonth]
  );

  const recentFootprints = useMemo(
    () => buildRecentFootprints(schedules, history),
    [schedules, history]
  );

  const selectedDayFootprints = useMemo(
    () => buildDayFootprints(schedules, selectedDate),
    [schedules, selectedDate]
  );

  const totalSteps = monthlyFootprints.reduce((sum, item) => sum + item.count, 0);
  const topFootprint = monthlyFootprints[0];
  const longestLike = monthlyFootprints.find((item) => item.count >= 2) ?? monthlyFootprints[1];
  const newChallenge = monthlyFootprints[monthlyFootprints.length - 1];
  const challengeFootprint = monthlyFootprints.find((item) => item.title === "挑戦成功");
  const challengeSuccessCount = useMemo(
    () => countChallengeSuccesses(schedules, history),
    [schedules, history]
  );
  const challengeRank = useMemo(
    () => getChallengeRank(challengeSuccessCount),
    [challengeSuccessCount]
  );

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>FOOTPRINTS</div>
          <h1 style={styles.title}>今月はこれらを達成しました!!</h1>
          <p style={styles.lead}>あなたの一歩一歩が、確かな前進です。</p>
        </div>
      </header>

      <section style={styles.mapCard}>
        <div style={styles.mapOverlay} />
        <div style={styles.mapDatePlate}>{getEnglishMonthLabel(currentMonth)}</div>

        <div style={styles.mapCenter}>
          <div style={styles.crown}>♛</div>
          <div style={styles.mapMonth}>{getMonthLabel(currentMonth)} の足跡</div>
          <div style={styles.ribbon}>今月はこれらを達成しました!!</div>
        </div>

        {monthlyFootprints.length === 0 ? (
          <div style={styles.emptyMapState}>
            <div style={styles.emptyMapIcon}>🗺️</div>
            <div style={styles.emptyMapTitle}>まだ今月の足跡はありません</div>
            <div style={styles.emptyMapText}>Todayで行動を完了すると、ここに人生の前進として残ります。</div>
          </div>
        ) : (
          <>
            <div style={styles.achievementGrid}>
              {monthlyFootprints.slice(0, 6).map((item) => (
                <div key={item.title} style={styles.achievementItem}>
                  <div style={styles.achievementIcon}>{item.emoji}</div>
                  <div style={styles.achievementTitle}>{item.title}</div>
                  <div style={styles.achievementCount}>{item.count}<span>回</span></div>
                </div>
              ))}
            </div>

            <div style={styles.highlightArea}>
              <div style={styles.highlightTitle}>今月のハイライト</div>

              <div style={styles.highlightRow}>
                <div style={styles.highlightBadge}>👑</div>
                <div>
                  <div style={styles.highlightLabel}>最も取り組んだこと</div>
                  <div style={styles.highlightValue}>
                    {topFootprint ? `${topFootprint.title}（${topFootprint.count}回）` : "-"}
                  </div>
                </div>
              </div>

              <div style={styles.highlightRow}>
                <div style={styles.highlightBadge}>🎯</div>
                <div>
                  <div style={styles.highlightLabel}>よく続いたこと</div>
                  <div style={styles.highlightValue}>
                    {longestLike ? `${longestLike.title}（${longestLike.count}回）` : "-"}
                  </div>
                </div>
              </div>

              <div style={styles.highlightRow}>
                <div style={styles.highlightBadge}>⭐️</div>
                <div>
                  <div style={styles.highlightLabel}>挑戦者ミッション</div>
                  <div style={styles.highlightValue}>
                    {challengeFootprint
                      ? `挑戦成功（${challengeFootprint.count}回）`
                      : newChallenge
                      ? `${newChallenge.title} に取り組んだ！`
                      : "これから記録されます"}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div style={styles.generalIllustration}>♞</div>
        <div style={styles.waxSeal}>🌍</div>
      </section>

      <section style={styles.challengeRankCard}>
        <div style={styles.challengeRankTop}>
          <div>
            <div style={styles.challengeRankEyebrow}>CHALLENGER RANK</div>
            <h2 style={styles.challengeRankTitle}>挑戦者ランク</h2>
          </div>
          <div style={styles.challengeRankIcon}>{challengeRank.current.icon}</div>
        </div>

        <div style={styles.challengeRankBody}>
          <div>
            <div style={styles.challengeRankLabel}>現在の称号</div>
            <div style={styles.challengeRankName}>{challengeRank.current.title}</div>
            <div style={styles.challengeRankSub}>{challengeRank.current.subtitle}</div>
          </div>

          <div style={styles.challengeCountBox}>
            <div style={styles.challengeCount}>{challengeSuccessCount}</div>
            <div style={styles.challengeCountLabel}>成功</div>
          </div>
        </div>

        <div style={styles.challengeProgressTrack}>
          <div
            style={{
              ...styles.challengeProgressFill,
              width: `${challengeRank.progress}%`,
            }}
          />
        </div>

        <div style={styles.challengeNextRow}>
          {challengeRank.next ? (
            <>
              <span>次の称号：{challengeRank.next.icon} {challengeRank.next.title}</span>
              <span>あと{challengeRank.remaining}回</span>
            </>
          ) : (
            <>
              <span>最高ランク到達</span>
              <span>走り続けよう</span>
            </>
          )}
        </div>
      </section>

      <section style={styles.recentCard}>
        <div style={styles.cardHead}>
          <h2 style={styles.cardTitle}>最近の足跡</h2>
          <div style={styles.stepBadge}>{Math.max(totalSteps, recentFootprints.length)}歩</div>
        </div>

        {recentFootprints.length === 0 ? (
          <p style={styles.mutedText}>完了した行動がここに並びます。</p>
        ) : (
          <div style={styles.recentStrip}>
            {recentFootprints.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                style={styles.recentItem}
                onClick={() => {
                  setSelectedDate(item.date);
                  setRainSeed(Date.now());
                }}
              >
                <span style={styles.recentEmoji}>{item.emoji}</span>
                <span style={styles.recentDate}>{item.date.slice(5).replace("-", "/")}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={styles.dayCard}>
        <div style={styles.cardHead}>
          <h2 style={styles.cardTitle}>{getDateLabel(selectedDate)} の足跡</h2>
          <button style={styles.textButton} onClick={() => setSelectedDate(todayYmd)}>
            今日へ
          </button>
        </div>

        {selectedDayFootprints.length === 0 ? (
          <div style={styles.dayEmpty}>この日の予定・前進はまだありません。</div>
        ) : (
          <div style={styles.dayList}>
            {selectedDayFootprints.slice(0, 8).map((item) => (
              <div key={item.id} style={styles.dayRow}>
                <div style={styles.dayLeft}>
                  <div style={styles.dayIcon}>{item.emoji}</div>
                  <div style={styles.dayTitle}>{item.title}</div>
                </div>
                <div style={item.status === "前進" ? styles.donePill : styles.planPill}>
                  {item.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "44px 12px calc(96px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 32% -12%, rgba(99,220,87,0.14), transparent 34%), linear-gradient(180deg, #111612 0%, #07100b 54%, #050806 100%)",
    color: "#fff",
    overflowX: "hidden",
  },
  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 72% 20%, rgba(116,224,93,0.10), transparent 28%)",
  },
  header: {
    position: "relative",
    zIndex: 1,
    marginBottom: 18,
    padding: "0 4px",
  },
  eyebrow: {
    color: "#74e05d",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "0.20em",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 31,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  lead: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.55,
  },
  mapCard: {
    position: "relative",
    zIndex: 1,
    minHeight: 560,
    borderRadius: 24,
    padding: "22px 16px 20px",
    overflow: "hidden",
    backgroundColor: "#d5bd8b",
    backgroundImage:
      "linear-gradient(180deg, rgba(252,232,182,0.42), rgba(119,78,32,0.18)), url('/vintage_map_letter_style.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    border: "1px solid rgba(83,54,22,0.56)",
    boxShadow: "0 22px 52px rgba(0,0,0,0.38)",
    color: "#20160d",
    marginBottom: 18,
  },
  mapOverlay: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 50% 0%, rgba(255,241,199,0.30), transparent 36%), linear-gradient(180deg, rgba(255,246,217,0.24), rgba(104,65,22,0.20))",
  },
  mapDatePlate: {
    position: "absolute",
    top: 24,
    right: 18,
    padding: "10px 18px",
    borderRadius: 10,
    border: "2px double rgba(55,35,15,0.52)",
    background: "rgba(244,226,181,0.55)",
    fontFamily: "Georgia, serif",
    fontStyle: "italic",
    fontSize: 18,
    color: "#3c260f",
  },
  mapCenter: {
    position: "relative",
    zIndex: 2,
    textAlign: "center",
    paddingTop: 88,
    marginBottom: 26,
  },
  crown: {
    fontSize: 28,
    color: "#89621e",
    lineHeight: 1,
  },
  mapMonth: {
    color: "#2b1c0d",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  ribbon: {
    width: "fit-content",
    maxWidth: "100%",
    margin: "0 auto",
    padding: "10px 22px",
    borderRadius: 999,
    background: "linear-gradient(180deg, #163b25, #082016)",
    color: "#fff4b7",
    border: "1px solid rgba(220,177,74,0.75)",
    boxShadow: "0 10px 18px rgba(0,0,0,0.28)",
    fontSize: 18,
    fontWeight: 950,
  },
  achievementGrid: {
    position: "relative",
    zIndex: 2,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginBottom: 24,
  },
  achievementItem: {
    minHeight: 108,
    borderRadius: 18,
    padding: "10px 7px",
    background: "rgba(255,238,193,0.42)",
    border: "1px solid rgba(84,62,27,0.25)",
    textAlign: "center",
    boxSizing: "border-box",
  },
  achievementIcon: {
    width: 42,
    height: 42,
    borderRadius: 999,
    margin: "0 auto 7px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.32)",
    border: "1px solid rgba(66,47,22,0.22)",
    fontSize: 25,
  },
  achievementTitle: {
    minHeight: 28,
    fontSize: 11,
    lineHeight: 1.25,
    fontWeight: 950,
    color: "#2d1d0e",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  },
  achievementCount: {
    marginTop: 5,
    color: "#1f5f2c",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  achievementCountSpan: {},
  highlightArea: {
    position: "relative",
    zIndex: 2,
    maxWidth: "70%",
    display: "grid",
    gap: 14,
    padding: "14px 10px 84px",
  },
  highlightTitle: {
    color: "#3a2915",
    fontSize: 16,
    fontWeight: 950,
    textAlign: "center",
    marginBottom: 2,
  },
  highlightRow: {
    display: "grid",
    gridTemplateColumns: "40px 1fr",
    gap: 10,
    alignItems: "center",
  },
  highlightBadge: {
    width: 34,
    height: 34,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,245,210,0.50)",
    border: "1px solid rgba(66,47,22,0.20)",
    fontSize: 20,
  },
  highlightLabel: {
    color: "rgba(45,29,14,0.68)",
    fontSize: 11,
    fontWeight: 950,
    marginBottom: 3,
  },
  highlightValue: {
    color: "#24180c",
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1.35,
  },
  generalIllustration: {
    position: "absolute",
    zIndex: 1,
    right: 26,
    bottom: 70,
    color: "rgba(45,29,14,0.66)",
    fontSize: 112,
    lineHeight: 1,
    transform: "scaleX(-1)",
    filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.20))",
  },
  waxSeal: {
    position: "absolute",
    zIndex: 3,
    left: "50%",
    bottom: 18,
    transform: "translateX(-50%)",
    width: 52,
    height: 52,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "radial-gradient(circle, #9a7a4c, #5d4224)",
    border: "2px solid rgba(58,35,14,0.55)",
    boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
    fontSize: 24,
  },
  emptyMapState: {
    position: "relative",
    zIndex: 2,
    margin: "36px 10px 120px",
    padding: 22,
    borderRadius: 20,
    background: "rgba(255,238,193,0.48)",
    border: "1px solid rgba(84,62,27,0.25)",
    textAlign: "center",
  },
  emptyMapIcon: { fontSize: 42, marginBottom: 8 },
  emptyMapTitle: { fontSize: 18, fontWeight: 950, color: "#24180c" },
  emptyMapText: { marginTop: 8, color: "rgba(45,29,14,0.70)", fontSize: 13, fontWeight: 850, lineHeight: 1.55 },
  challengeRankCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    background:
      "linear-gradient(135deg, rgba(116,224,93,0.18), rgba(255,255,255,0.055))",
    border: "1px solid rgba(116,224,93,0.26)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.26)",
    overflow: "hidden",
  },
  challengeRankTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  challengeRankEyebrow: {
    color: "#8df277",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 5,
  },
  challengeRankTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 23,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  challengeRankIcon: {
    width: 54,
    height: 54,
    minWidth: 54,
    borderRadius: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(116,224,93,0.16)",
    border: "1px solid rgba(116,224,93,0.28)",
    fontSize: 29,
    boxShadow: "0 12px 24px rgba(0,0,0,0.16)",
  },
  challengeRankBody: {
    display: "grid",
    gridTemplateColumns: "1fr 82px",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  challengeRankLabel: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 4,
  },
  challengeRankName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.05em",
    lineHeight: 1.15,
  },
  challengeRankSub: {
    marginTop: 7,
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.55,
  },
  challengeCountBox: {
    minHeight: 82,
    borderRadius: 22,
    background: "rgba(0,0,0,0.20)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  challengeCount: {
    color: "#9df58d",
    fontSize: 32,
    fontWeight: 950,
    lineHeight: 1,
  },
  challengeCountLabel: {
    marginTop: 5,
    color: "rgba(255,255,255,0.52)",
    fontSize: 11,
    fontWeight: 950,
  },
  challengeProgressTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(0,0,0,0.24)",
    border: "1px solid rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginBottom: 10,
  },
  challengeProgressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #74e05d, #b9ff8d)",
    boxShadow: "0 0 18px rgba(116,224,93,0.45)",
  },
  challengeNextRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: 900,
  },
  recentCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    background: "linear-gradient(180deg, rgba(34,84,43,0.56), rgba(13,31,20,0.74))",
    border: "1px solid rgba(116,224,93,0.22)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.25)",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  stepBadge: {
    minWidth: 62,
    height: 42,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(116,224,93,0.18)",
    color: "#9df58d",
    fontSize: 20,
    fontWeight: 950,
  },
  mutedText: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 14,
    fontWeight: 850,
    margin: 0,
  },
  recentStrip: {
    display: "flex",
    gap: 12,
    overflowX: "auto",
    paddingBottom: 2,
  },
  recentItem: {
    flex: "0 0 auto",
    width: 52,
    border: "none",
    background: "transparent",
    color: "#fff",
    display: "grid",
    gap: 5,
    justifyItems: "center",
  },
  recentEmoji: { fontSize: 26, lineHeight: 1 },
  recentDate: { color: "rgba(255,255,255,0.56)", fontSize: 12, fontWeight: 950 },
  dayCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    padding: 16,
    background: "linear-gradient(180deg, rgba(24,58,35,0.55), rgba(11,22,15,0.86))",
    border: "1px solid rgba(116,224,93,0.20)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.25)",
  },
  textButton: {
    border: "none",
    background: "transparent",
    color: "#74dfff",
    fontSize: 13,
    fontWeight: 950,
  },
  dayEmpty: {
    borderRadius: 18,
    padding: 18,
    background: "rgba(255,255,255,0.05)",
    color: "rgba(255,255,255,0.56)",
    fontSize: 14,
    fontWeight: 850,
    textAlign: "center",
  },
  dayList: { display: "grid", gap: 10 },
  dayRow: {
    minHeight: 54,
    borderRadius: 18,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dayLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
  dayIcon: {
    width: 38,
    height: 38,
    minWidth: 38,
    borderRadius: 14,
    background: "rgba(116,224,93,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },
  dayTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  donePill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 12px",
    background: "rgba(116,224,93,0.20)",
    color: "#9df58d",
    fontSize: 13,
    fontWeight: 950,
  },
  planPill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 12px",
    background: "rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    fontWeight: 950,
  },
};
