// src/pages/DrivePage.tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { listGoals } from "../lib/api";

type DriveKey = "stable" | "tired" | "stuck" | "recovery" | "goal";
type SceneryStageKey = "normal" | "green" | "bright" | "city";

type LocalSchedule = {
  id: string;
  title: string;
  startDate?: string;
  endDate?: string;
  weekdays?: Array<number | boolean>;
  oneShot?: boolean;
  completedDates?: string[];
  tags?: string[];
  taskRef?: {
    goalId?: number;
  };
};

type GoalScheduleProgress = {
  goalId: number;
  goalTitle: string;
  title: string;
  total: number;
  done: number;
  percent: number;
};

const DAILY_REWARD_YEN = 164;
const WEEKLY_TARGET_YEN = 50000;

type DriveState = {
  key: DriveKey;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  tip: string;
  shortLabel: string;
  roadLabel: string;
};

type SceneryStage = {
  key: SceneryStageKey;
  icon: string;
  title: string;
  subtitle: string;
  nextText: string;
  bg: string;
  glow: string;
  pillBg: string;
};

const SCENERY_STAGES: Record<SceneryStageKey, SceneryStage> = {
  normal: {
    key: "normal",
    icon: "🌱",
    title: "いつもの道",
    subtitle: "まずは今日の一歩から。景色はここから変わっていきます。",
    nextText: "3日継続で、道の横に緑が増えます",
    bg: "linear-gradient(180deg, rgba(24,38,28,0.96), rgba(8,10,9,0.96))",
    glow: "radial-gradient(circle at 50% 10%, rgba(111,211,92,0.22), transparent 38%)",
    pillBg: "rgba(255,255,255,0.12)",
  },
  green: {
    key: "green",
    icon: "🌳",
    title: "緑が増えてきた",
    subtitle: "3日継続。小さな行動が、少しずつ景色になっています。",
    nextText: "7日継続で、空が明るくなります",
    bg: "linear-gradient(180deg, rgba(24,70,34,0.98), rgba(7,20,12,0.98))",
    glow: "radial-gradient(circle at 50% 8%, rgba(124,255,139,0.30), transparent 42%)",
    pillBg: "rgba(111,211,92,0.22)",
  },
  bright: {
    key: "bright",
    icon: "☀️",
    title: "空が明るくなった",
    subtitle: "7日継続。続けることで、進む道が少し軽く見えてきました。",
    nextText: "30日継続で、街が発展します",
    bg: "linear-gradient(180deg, rgba(36,74,106,0.98), rgba(18,31,46,0.98))",
    glow: "radial-gradient(circle at 48% 4%, rgba(255,221,102,0.34), transparent 40%)",
    pillBg: "rgba(255,221,102,0.22)",
  },
  city: {
    key: "city",
    icon: "🏙️",
    title: "街が発展した",
    subtitle: "30日継続。積み上げた行動が、自分の世界を育てています。",
    nextText: "ここからは、さらに長い旅路へ",
    bg: "linear-gradient(180deg, rgba(79,61,113,0.98), rgba(21,18,29,0.98))",
    glow: "radial-gradient(circle at 50% 8%, rgba(255,174,102,0.32), transparent 42%)",
    pillBg: "rgba(255,174,102,0.22)",
  },
};

const DRIVE_STATES: Record<DriveKey, DriveState> = {
  stable: {
    key: "stable",
    alt: "安定ドライブ",
    eyebrow: "STABLE DRIVE",
    title: "流れは安定しています",
    body: "今の走行は大きく崩れていません。無理に加速せず、今日も小さく前に進めれば十分です。",
    tip: "今日は「維持する行動」を1つ積むだけでも、流れは切れにくくなります 🌱",
    shortLabel: "安定",
    roadLabel: "なめらかな道",
  },
  tired: {
    key: "tired",
    alt: "頑張りすぎドライブ",
    eyebrow: "OVERDRIVE",
    title: "少し頑張りすぎかも",
    body: "前に進む行動は積めていますが、回復系が少なめです。今日は休憩を予定に入れる方が長く走れます。",
    tip: "寝ながら読書、散歩、カフェでぼーっとするくらいがちょうど良さそうです ☕️",
    shortLabel: "過走行",
    roadLabel: "少し荒れた道",
  },
  stuck: {
    key: "stuck",
    alt: "停滞ドライブ",
    eyebrow: "ROUGH ROAD",
    title: "少しガタガタしています",
    body: "進みが止まり気味です。大きく取り返そうとせず、5分で終わる行動を1つだけ置くのが良さそうです。",
    tip: "今日はKindleを5分、講義を1本、メモを1行。寝ながら達成できる行動でもOKです 🌿",
    shortLabel: "ガタガタ",
    roadLabel: "でこぼこ道",
  },
  recovery: {
    key: "recovery",
    alt: "回復ドライブ",
    eyebrow: "RECOVERY ROUTE",
    title: "回復ルートに入っています",
    body: "整える行動が入っています。今は焦らず、生活の路面を少しずつならしていく流れが合っています。",
    tip: "回復している日も、ちゃんと前進です。今日はペースを上げすぎなくて大丈夫です 🌙",
    shortLabel: "回復中",
    roadLabel: "整備中の道",
  },
  goal: {
    key: "goal",
    alt: "ゴールドライブ",
    eyebrow: "SMOOTH DRIVE",
    title: "今日はスイスイ進んでいます",
    body: "予定していた行動をしっかり積めています。今日の走行はかなり良い流れです。",
    tip: "今日はよく走れています。余力があれば、回復系を1つ足すと明日も安定しやすいです ✨",
    shortLabel: "快走",
    roadLabel: "スイスイ走行",
  },
};

const DRIVE_VIDEO_FILES: Record<DriveKey, string> = {
  stable: "stable.mp4",
  tired: "tired.mp4",
  stuck: "stuck.mp4",
  recovery: "recovery.mp4",
  goal: "goal.mp4",
};

function getCurrentUserKey() {
  const savedUserKey = localStorage.getItem("todoMoneyUserKey");
  if (savedUserKey) return savedUserKey;

  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.email ?? payload.sub ?? payload.userId ?? payload.id ?? "user");
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

function parseYMD(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toYMD(date: Date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function ymdToNum(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return y * 10000 + m * 100 + d;
}

function occursOnDate(schedule: LocalSchedule, dateStr: string) {
  if (schedule.startDate && ymdToNum(dateStr) < ymdToNum(schedule.startDate)) return false;
  if (schedule.endDate && ymdToNum(dateStr) > ymdToNum(schedule.endDate)) return false;

  if (schedule.oneShot || !schedule.weekdays || schedule.weekdays.length === 0) {
    return schedule.startDate ? schedule.startDate === dateStr : true;
  }

  const date = parseYMD(dateStr);
  const day = date.getDay();

  if (typeof schedule.weekdays[0] === "boolean") {
    return Boolean(schedule.weekdays[day]);
  }

  return (schedule.weekdays as number[]).includes(day);
}

function getOccurrenceDates(schedule: LocalSchedule) {
  const dates: string[] = [];
  if (!schedule.startDate) return dates;

  if (schedule.oneShot || !schedule.weekdays || schedule.weekdays.length === 0 || !schedule.endDate) {
    dates.push(schedule.startDate);
    return dates;
  }

  let current = parseYMD(schedule.startDate);
  const end = parseYMD(schedule.endDate);

  while (current <= end) {
    const dateStr = toYMD(current);
    if (occursOnDate(schedule, dateStr)) dates.push(dateStr);
    current = addDays(current, 1);
  }

  return dates;
}

function calcGoalScheduleProgresses(goalId: number, goalTitle: string, schedules: LocalSchedule[]): GoalScheduleProgress[] {
  return schedules
    .filter((s) => s.taskRef?.goalId === goalId)
    .map((s) => {
      const dates = getOccurrenceDates(s);
      const done = dates.filter((dateStr) => s.completedDates?.includes(dateStr)).length;
      const total = dates.length;
      const percentValue = total === 0 ? 0 : Math.round((done / total) * 100);
      return { goalId, goalTitle, title: s.title, total, done, percent: percentValue };
    })
    .filter((x) => x.total > 0);
}

function readSchedulesFromLocalStorage(): LocalSchedule[] {
  const direct = localStorage.getItem(scheduleKey());

  if (direct) {
    try {
      const parsed = JSON.parse(direct);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  const candidates: LocalSchedule[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const array = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.schedules)
        ? parsed.schedules
        : Array.isArray(parsed?.data)
        ? parsed.data
        : [];

      if (!Array.isArray(array)) continue;

      const looksLikeSchedules = array.some(
        (x: any) =>
          x &&
          typeof x === "object" &&
          (x.taskRef?.goalId !== undefined || x.completedDates !== undefined || x.startDate !== undefined)
      );

      if (looksLikeSchedules) candidates.push(...array);
    } catch {}
  }

  return candidates;
}

function readGoalTagsFromLocalStorage(): Record<number, string> {
  const direct = localStorage.getItem(goalTagKey());

  if (direct) {
    try {
      const parsed = JSON.parse(direct);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const lowerKey = key.toLowerCase();
    if (!lowerKey.includes("goaltag") && !lowerKey.includes("goal-tag")) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {}
  }

  return {};
}

function isRecoveryGoal(goal: any, goalTags: Record<number, string>) {
  const tag = String(goalTags[goal.id] ?? "");
  const title = String(goal?.title ?? "");

  return (
    tag === "health" ||
    tag === "sleep" ||
    tag.includes("健康") ||
    tag.includes("睡眠") ||
    tag.includes("回復") ||
    title.includes("健康") ||
    title.includes("睡眠") ||
    title.includes("筋トレ") ||
    title.includes("散歩")
  );
}

function percent(done: number, total: number) {
  if (total === 0) return 0;
  return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
}

function decideDriveState(totalRate: number, recoveryRate: number, todayRate: number, total: number) {
  if (total === 0) return DRIVE_STATES.stable;
  if (todayRate >= 1) return DRIVE_STATES.goal;
  if (totalRate >= 0.45 && recoveryRate < 0.15) return DRIVE_STATES.tired;
  if (todayRate === 0 && totalRate < 0.25) return DRIVE_STATES.stuck;
  if (totalRate < 0.2) return DRIVE_STATES.stuck;
  if (recoveryRate >= 0.3 && totalRate < 0.8) return DRIVE_STATES.recovery;
  return DRIVE_STATES.stable;
}

function getSceneryStageKey(streakDays: number): SceneryStageKey {
  if (streakDays >= 30) return "city";
  if (streakDays >= 7) return "bright";
  if (streakDays >= 3) return "green";
  return "normal";
}

function calcStreakDays(schedules: LocalSchedule[]) {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const dateStr = toYMD(addDays(today, -i));
    const daySchedules = schedules.filter((s) => occursOnDate(s, dateStr));

    if (daySchedules.length === 0) continue;

    const completed = daySchedules.some((s) => s.completedDates?.includes(dateStr));

    if (completed) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function useCompletionFlash(todayDone: number) {
  const [isFlashing, setIsFlashing] = useState(false);
  const prevDone = useRef(todayDone);

  useEffect(() => {
    if (todayDone > prevDone.current) {
      setIsFlashing(true);
      const t = setTimeout(() => setIsFlashing(false), 1800);
      prevDone.current = todayDone;
      return () => clearTimeout(t);
    }

    prevDone.current = todayDone;
  }, [todayDone]);

  return isFlashing;
}

export default function DrivePage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<LocalSchedule[]>([]);
  const [goalTags, setGoalTags] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const [displayedPercents, setDisplayedPercents] = useState({
    today: 0,
    all: 0,
    recovery: 0,
    skill: 0,
  });

  const didInitMetersRef = useRef(false);
  const prevTodayDoneForMetersRef = useRef(0);

  function refreshLocalData() {
    setSchedules(readSchedulesFromLocalStorage());
    setGoalTags(readGoalTagsFromLocalStorage());
  }

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await listGoals();

        const goalList = Array.isArray(res)
          ? res
          : Array.isArray((res as any)?.goals)
          ? (res as any).goals
          : Array.isArray((res as any)?.data)
          ? (res as any).data
          : [];

        setGoals(goalList);
        refreshLocalData();
      } catch (e) {
        console.error(e);
        setError("データの取得に失敗しました。少し時間をおいて、もう一度開いてみてください 🌿");
      }
    })();
  }, []);

  useEffect(() => {
    const onFocus = () => refreshLocalData();

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.includes("schedule")) refreshLocalData();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stats = useMemo(() => {
    const allProgressItems = goals.flatMap((goal: any) =>
      calcGoalScheduleProgresses(goal.id, goal.title, schedules)
    );

    const allDone = allProgressItems.reduce((sum, x) => sum + x.done, 0);
    const allTotal = allProgressItems.reduce((sum, x) => sum + x.total, 0);

    const today = toYMD(new Date());
    const todaySchedules = schedules.filter((s) => occursOnDate(s, today));
    const todayTotal = todaySchedules.length;
    const todayDone = todaySchedules.filter((s) => s.completedDates?.includes(today)).length;
    const remainingToday = Math.max(todayTotal - todayDone, 0);

    const recoveryGoalIds = goals
      .filter((g: any) => isRecoveryGoal(g, goalTags))
      .map((g: any) => g.id);

    const recoveryItems = allProgressItems.filter((item) =>
      recoveryGoalIds.includes(item.goalId)
    );
    const skillItems = allProgressItems.filter((item) =>
      !recoveryGoalIds.includes(item.goalId)
    );

    const recoveryDone = recoveryItems.reduce((sum, x) => sum + x.done, 0);
    const recoveryTotal = recoveryItems.reduce((sum, x) => sum + x.total, 0);
    const skillDone = skillItems.reduce((sum, x) => sum + x.done, 0);
    const skillTotal = skillItems.reduce((sum, x) => sum + x.total, 0);

    const totalRate = allTotal === 0 ? 0 : allDone / allTotal;
    const recoveryRate = recoveryTotal === 0 ? 0 : recoveryDone / recoveryTotal;
    const todayRate = todayTotal === 0 ? 0 : todayDone / todayTotal;

    const todayProgress = percent(todayDone, todayTotal);
    const remainingProgress = percent(remainingToday, todayTotal);
    const streakDays = calcStreakDays(schedules);
    const streakProgress = streakDays > 0 ? Math.min(100, streakDays * 14) : 0;
    const sceneryStageKey = getSceneryStageKey(streakDays);

    const todayEarned = todayDone * DAILY_REWARD_YEN;
    const monthlyPace = todayEarned * 30;
    const remainingToTarget = Math.max(0, WEEKLY_TARGET_YEN - monthlyPace);

    const drive = decideDriveState(totalRate, recoveryRate, todayRate, allTotal);

    return {
      allDone,
      allTotal,
      todayDone,
      todayTotal,
      remainingToday,
      recoveryDone,
      recoveryTotal,
      skillDone,
      skillTotal,
      totalRate,
      recoveryRate,
      skillRate: skillTotal === 0 ? 0 : skillDone / skillTotal,
      todayRate,
      todayProgress,
      remainingProgress,
      streakDays,
      streakProgress,
      sceneryStageKey,
      todayEarned,
      monthlyPace,
      remainingToTarget,
      drive,
    };
  }, [goals, schedules, goalTags]);

  const isFlashing = useCompletionFlash(stats.todayDone);

  useEffect(() => {
    setVideoFailed(false);
    setImageFailed(false);
  }, [stats.drive.key, stats.sceneryStageKey]);

  useEffect(() => {
    const target = {
      today: percent(stats.todayDone, stats.todayTotal),
      all: percent(stats.allDone, stats.allTotal),
      recovery: percent(stats.recoveryDone, stats.recoveryTotal),
      skill: percent(stats.skillDone, stats.skillTotal),
    };

    const isCompletionIncrease =
      didInitMetersRef.current && stats.todayDone > prevTodayDoneForMetersRef.current;

    prevTodayDoneForMetersRef.current = stats.todayDone;

    if (!didInitMetersRef.current) {
      didInitMetersRef.current = true;
      setDisplayedPercents(target);
      return;
    }

    if (!isCompletionIncrease) {
      setDisplayedPercents(target);
      return;
    }

    const t1 = window.setTimeout(
      () => setDisplayedPercents((p) => ({ ...p, today: target.today })),
      720
    );
    const t2 = window.setTimeout(
      () => setDisplayedPercents((p) => ({ ...p, all: target.all })),
      840
    );
    const t3 = window.setTimeout(
      () => setDisplayedPercents((p) => ({ ...p, recovery: target.recovery })),
      960
    );
    const t4 = window.setTimeout(
      () => setDisplayedPercents((p) => ({ ...p, skill: target.skill })),
      1080
    );

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
    };
  }, [
    stats.todayDone,
    stats.todayTotal,
    stats.allDone,
    stats.allTotal,
    stats.recoveryDone,
    stats.recoveryTotal,
    stats.skillDone,
    stats.skillTotal,
  ]);

  const scenery = SCENERY_STAGES[stats.sceneryStageKey];
  const drivePercent = displayedPercents.today || displayedPercents.all;
  const videoSrc = `${import.meta.env.BASE_URL}drive/${DRIVE_VIDEO_FILES[stats.drive.key]}`;
  const imageSrc = `${import.meta.env.BASE_URL}drive/${stats.drive.key}.png`;

  return (
    <div style={ui.page}>
      <style>{`
        @keyframes driveGlow {
          0% { opacity:.44; transform:translate3d(-8px,-6px,0) scale(1); }
          50% { opacity:.72; transform:translate3d(8px,6px,0) scale(1.04); }
          100% { opacity:.44; transform:translate3d(-8px,-6px,0) scale(1); }
        }

        @keyframes roadMove {
          0% { transform:translateX(-20%); opacity:.34; }
          50% { opacity:.7; }
          100% { transform:translateX(20%); opacity:.34; }
        }

        @keyframes softFloat {
          0%,100% { transform:translateY(0); }
          50% { transform:translateY(-4px); }
        }

        @keyframes roadGlow {
          0%   { opacity:0; }
          20%  { opacity:1; }
          60%  { opacity:0.7; }
          100% { opacity:0; }
        }

        @keyframes visualFlash {
          0%   { box-shadow:inset 0 0 38px rgba(111,211,92,0.08); }
          25%  { box-shadow:inset 0 0 80px rgba(111,211,92,0.55), 0 0 40px rgba(111,211,92,0.22); }
          60%  { box-shadow:inset 0 0 50px rgba(111,211,92,0.3); }
          100% { box-shadow:inset 0 0 38px rgba(111,211,92,0.08); }
        }

        @keyframes sparkUp {
          0%   { opacity:1; transform:translate(0,0) scale(1); }
          100% { opacity:0; transform:translate(var(--sx),var(--sy)) scale(0.2); }
        }

        @keyframes badgePop {
          0%   { transform:scale(1); }
          30%  { transform:scale(1.18); }
          55%  { transform:scale(0.95); }
          75%  { transform:scale(1.07); }
          100% { transform:scale(1); }
        }

        @keyframes sceneryFloat {
          0%,100% { transform:translateY(0) rotate(0deg); }
          50% { transform:translateY(-6px) rotate(1deg); }
        }

        @keyframes sceneryShine {
          0% { transform:translateX(-120%); opacity:0; }
          35% { opacity:.9; }
          100% { transform:translateX(120%); opacity:0; }
        }
      `}</style>

      <div style={ui.greenBlurOne} />
      <div style={ui.greenBlurTwo} />

      <header style={ui.header}>
        <div>
          <div style={ui.pageKicker}>TaskMoney</div>
          <h1 style={ui.pageTitle}>ホーム</h1>
        </div>
        <div style={ui.headerActions}>
          <div style={ui.iconButton}>🌿</div>
          <div style={ui.iconButton}>⚙️</div>
        </div>
      </header>

      {error && <div style={ui.errorBox}>{error}</div>}

      <section style={ui.heroCard}>
        <div style={ui.heroTop}>
          <div>
            <div style={ui.eyebrow}>{stats.drive.eyebrow}</div>
            <h2 style={ui.heroTitle}>{stats.drive.title}</h2>
            <p style={ui.heroText}>{stats.drive.body}</p>
          </div>

          <div
            style={{
              ...ui.percentBadge,
              animation: isFlashing ? "badgePop 0.6s ease both" : undefined,
            }}
          >
            <span style={ui.percentNumber}>{drivePercent}</span>
            <span style={ui.percentUnit}>%</span>
          </div>
        </div>

        <div
          style={{
            ...ui.driveVisual,
            background: scenery.bg,
            animation: isFlashing ? "visualFlash 1.6s ease both" : undefined,
          }}
        >
          <div style={{ ...ui.visualGlow, background: scenery.glow }} />

          {isFlashing && <div style={ui.roadGlowOverlay} />}

          {!videoFailed ? (
            <video
              key={videoSrc}
              src={videoSrc}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label={stats.drive.alt}
              onError={() => setVideoFailed(true)}
              style={ui.driveVideo}
            />
          ) : !imageFailed ? (
            <img
              src={imageSrc}
              alt={stats.drive.alt}
              onError={() => setImageFailed(true)}
              style={ui.driveImage}
            />
          ) : (
            <div style={ui.fallbackVisual}>
              <div style={ui.roadSky}>{scenery.icon}</div>
              <div style={ui.roadLine} />
              <div style={ui.carDot}>🚗</div>
            </div>
          )}

          {isFlashing && <CompletionSparks />}

          <div style={ui.visualOverlay}>
            <div style={ui.statusPill}>{stats.drive.shortLabel}</div>
            <div style={{ ...ui.sceneryPill, background: scenery.pillBg }}>
              {scenery.icon} {scenery.title}
            </div>
            <div style={ui.roadPill}>{stats.drive.roadLabel}</div>
          </div>
        </div>

        <div style={ui.tipBox}>{stats.drive.tip}</div>
      </section>

      <section style={ui.meterCard}>
        <div style={ui.sectionRow}>
          <div>
            <div style={ui.sectionLabel}>TODAY CONDITION</div>
            <h2 style={ui.sectionTitle}>今日の予定メーター</h2>
          </div>
          <div style={ui.miniCount}>
            {stats.todayDone}/{stats.todayTotal || 0}
          </div>
        </div>

        <DriveMeter
          emoji="🚗"
          label="今日の走行"
          value={displayedPercents.today}
          detail={stats.todayTotal === 0 ? "予定なし" : `${stats.todayDone}/${stats.todayTotal} 完了`}
          flash={isFlashing}
        />

        <DriveMeter
          emoji="🌿"
          label="残りの予定"
          value={stats.remainingProgress}
          detail={`${stats.remainingToday}件`}
          flash={false}
          muted
        />

        <DriveMeter
          emoji="🔥"
          label="継続"
          value={stats.streakProgress}
          detail={stats.streakDays > 0 ? `${stats.streakDays}日` : "0日"}
          flash={false}
        />
      </section>

      <section style={ui.sceneryCard}>
        <div style={ui.sceneryShine} />

        <div style={ui.sectionRow}>
          <div>
            <div style={ui.sectionLabel}>JOURNEY</div>
            <h2 style={ui.sectionTitle}>継続で景色が変わる</h2>
          </div>
          <div style={ui.sceneryDays}>{stats.streakDays}日</div>
        </div>

        <div style={ui.sceneryHero}>
          <div style={ui.sceneryIcon}>{scenery.icon}</div>
          <div>
            <div style={ui.sceneryTitle}>{scenery.title}</div>
            <div style={ui.sceneryText}>{scenery.subtitle}</div>
            <div style={ui.sceneryNext}>{scenery.nextText}</div>
          </div>
        </div>

        <div style={ui.stageGrid}>
          <StageDot active={stats.streakDays >= 0} icon="🌱" label="開始" />
          <StageDot active={stats.streakDays >= 3} icon="🌳" label="3日" />
          <StageDot active={stats.streakDays >= 7} icon="☀️" label="7日" />
          <StageDot active={stats.streakDays >= 30} icon="🏙️" label="30日" />
        </div>
      </section>

      <section style={ui.valueCard}>
        <div style={ui.valueTop}>
          <div>
            <div style={ui.valueEyebrow}>TODAY VALUE</div>
            <h2 style={ui.valueHeading}>今日の積み上げ</h2>
          </div>
          <div style={ui.valueIcon}>💰</div>
        </div>

        <div style={ui.valueAmount}>+{stats.todayEarned.toLocaleString()}円</div>

        <div style={ui.valueDivider} />

        <div style={ui.valueMetaGrid}>
          <div style={ui.valueMetaBox}>
            <div style={ui.valueMetaLabel}>月見込み</div>
            <div style={ui.valueMetaValue}>+{stats.monthlyPace.toLocaleString()}円</div>
          </div>

          <div style={ui.valueMetaBox}>
            <div style={ui.valueMetaLabel}>目標まで</div>
            <div style={ui.valueMetaValue}>あと{stats.remainingToTarget.toLocaleString()}円</div>
          </div>
        </div>

        <p style={ui.valueNote}>完了した行動を、未来の価値として積み上げています。</p>
      </section>

      <section style={ui.recommendCard}>
        <div style={ui.sectionLabel}>ACTION RECOMMEND</div>
        <h2 style={ui.recommendTitle}>次の一歩</h2>
        <div style={ui.recommendList}>
          {getRecommendations(stats.drive.key).map((item) => (
            <div key={item.title} style={ui.recommendItem}>
              <div style={ui.recommendIcon}>{item.icon}</div>
              <div>
                <div style={ui.recommendItemTitle}>{item.title}</div>
                <div style={ui.recommendItemBody}>{item.body}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div style={ui.founderCard}>
        <div style={ui.founderLabel}>LIMITED BADGE</div>
        <h3 style={ui.founderTitle}>🏅 Founder</h3>
        <p style={ui.founderText}>TaskMoney初期ユーザー限定バッジ</p>
      </div>
    </div>
  );
}

const SPARKS = [
  { sx: "-28px", sy: "-36px", delay: "0ms", color: "#6fd35c" },
  { sx: "30px", sy: "-28px", delay: "60ms", color: "#a3f07a" },
  { sx: "-36px", sy: "-10px", delay: "30ms", color: "#4ade80" },
  { sx: "38px", sy: "-14px", delay: "90ms", color: "#6fd35c" },
  { sx: "-14px", sy: "-44px", delay: "15ms", color: "#d4fca8" },
  { sx: "16px", sy: "-40px", delay: "75ms", color: "#a3f07a" },
];

function CompletionSparks() {
  return (
    <div style={{ position: "absolute", left: "50%", bottom: 60, zIndex: 5, pointerEvents: "none" }}>
      {SPARKS.map((s, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 6px ${s.color}`,
            ["--sx" as any]: s.sx,
            ["--sy" as any]: s.sy,
            animation: `sparkUp 0.9s ease-out ${s.delay} both`,
          }}
        />
      ))}
    </div>
  );
}

function StageDot({ active, icon, label }: { active: boolean; icon: string; label: string }) {
  return (
    <div style={ui.stageDotWrap}>
      <div
        style={{
          ...ui.stageDot,
          opacity: active ? 1 : 0.35,
          transform: active ? "scale(1)" : "scale(.92)",
          background: active ? "rgba(111,211,92,0.22)" : "rgba(255,255,255,0.08)",
          border: active ? "1px solid rgba(111,211,92,0.42)" : "1px solid rgba(255,255,255,0.10)",
        }}
      >
        {icon}
      </div>
      <div style={{ ...ui.stageDotLabel, opacity: active ? 1 : 0.45 }}>{label}</div>
    </div>
  );
}

function getRecommendations(key: DriveKey) {
  if (key === "goal") {
    return [
      { icon: "🌙", title: "回復を1つ足す", body: "今日は走れているので、明日のために軽い休憩を入れる。" },
      { icon: "📝", title: "今日の勝ち筋をメモ", body: "何が良かったか1行だけ残すと、再現しやすくなります。" },
    ];
  }

  if (key === "tired") {
    return [
      { icon: "☕️", title: "カフェで軽く整える", body: "作業より、頭をほどく時間を少し入れる。" },
      { icon: "📖", title: "寝ながらKindle", body: "横になったまま5分だけ読めば、今日の行動にできます。" },
    ];
  }

  if (key === "stuck") {
    return [
      { icon: "📖", title: "寝ながら読書5分", body: "ガタガタの日は、達成ハードルをかなり下げる。" },
      { icon: "🌿", title: "外に1分だけ出る", body: "散歩まで行かなくてOK。空気を変えるだけでも十分です。" },
    ];
  }

  if (key === "recovery") {
    return [
      { icon: "🛌", title: "回復を削らない", body: "今は整える流れができています。無理に詰め込まない。" },
      { icon: "🔥", title: "前進を1つだけ", body: "余力があれば、講義1本やメモ1行だけ足す。" },
    ];
  }

  return [
    { icon: "🌱", title: "小さく継続", body: "今の流れを崩さず、今日も1つだけ積む。" },
    { icon: "☕️", title: "止まる前に休憩", body: "疲れる前に軽く整えると、明日も走りやすくなります。" },
  ];
}

function DriveMeter({
  emoji,
  label,
  value,
  detail,
  flash,
  muted = false,
}: {
  emoji: string;
  label: string;
  value: number;
  detail: string;
  flash: boolean;
  muted?: boolean;
}) {
  return (
    <div style={ui.meter}>
      <div style={ui.meterHeader}>
        <span style={ui.meterLabel}>
          <span style={ui.meterEmoji}>{emoji}</span>
          {label}
        </span>
        <span style={ui.meterValue}>
          {detail} ・ {value}%
        </span>
      </div>
      <div style={ui.meterTrack}>
        <div
          style={{
            ...ui.meterFill,
            width: `${value}%`,
            boxShadow: flash
              ? "0 0 28px rgba(111,211,92,0.8), 0 0 8px rgba(111,211,92,0.6)"
              : "0 0 18px rgba(111,211,92,0.34)",
            opacity: muted ? 0.72 : 1,
          }}
        />
      </div>
    </div>
  );
}

const ui: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "54px 18px calc(110px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 18% 0%, rgba(86,214,92,0.22), transparent 28%), linear-gradient(180deg, #07130c 0%, #090d0b 42%, #0b0c0b 100%)",
    color: "#f7fff7",
    overflowX: "hidden",
  },
  greenBlurOne: {
    position: "fixed",
    top: -90,
    left: -90,
    width: 230,
    height: 230,
    borderRadius: "50%",
    background: "rgba(99,224,92,0.18)",
    filter: "blur(34px)",
    animation: "driveGlow 7s ease-in-out infinite",
    pointerEvents: "none",
  },
  greenBlurTwo: {
    position: "fixed",
    right: -80,
    bottom: 120,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(99,224,92,0.12)",
    filter: "blur(42px)",
    animation: "driveGlow 9s ease-in-out infinite",
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 22,
  },
  pageKicker: {
    color: "#6fd35c",
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "0.08em",
    opacity: 0.9,
  },
  pageTitle: {
    margin: "3px 0 0",
    fontSize: 46,
    fontWeight: 1000,
    lineHeight: 1,
    letterSpacing: "-0.08em",
  },
  headerActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
  },
  iconButton: {
    width: 54,
    height: 54,
    borderRadius: 22,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
    fontSize: 25,
    backdropFilter: "blur(12px)",
  },
  errorBox: {
    position: "relative",
    zIndex: 1,
    marginBottom: 16,
    padding: 16,
    borderRadius: 22,
    background: "rgba(127,29,29,0.52)",
    border: "1px solid rgba(248,113,113,0.3)",
    color: "#fecaca",
    fontWeight: 800,
    lineHeight: 1.7,
  },
  heroCard: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    borderRadius: 34,
    background: "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(18px)",
    marginBottom: 16,
  },
  heroTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 18,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.48)",
    letterSpacing: "0.18em",
    fontSize: 12,
    fontWeight: 1000,
    marginBottom: 8,
  },
  heroTitle: {
    margin: 0,
    fontSize: 31,
    fontWeight: 1000,
    lineHeight: 1.14,
    letterSpacing: "-0.055em",
  },
  heroText: {
    margin: "12px 0 0",
    color: "rgba(255,255,255,0.68)",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.8,
  },
  percentBadge: {
    flex: "0 0 auto",
    width: 86,
    height: 86,
    borderRadius: 30,
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    paddingTop: 25,
    background: "radial-gradient(circle at 50% 20%, rgba(111,211,92,0.35), rgba(255,255,255,0.08))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.2)",
  },
  percentNumber: {
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "-0.07em",
  },
  percentUnit: {
    fontSize: 15,
    fontWeight: 1000,
    marginLeft: 2,
    opacity: 0.8,
  },
  driveVisual: {
    position: "relative",
    borderRadius: 30,
    overflow: "hidden",
    minHeight: 210,
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "inset 0 0 38px rgba(111,211,92,0.08)",
    transition: "background 500ms ease",
  },
  visualGlow: {
    position: "absolute",
    inset: "-20%",
    animation: "driveGlow 8s ease-in-out infinite",
  },
  roadGlowOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "55%",
    zIndex: 2,
    background: "linear-gradient(to top, rgba(111,211,92,0.28) 0%, rgba(111,211,92,0.08) 60%, transparent 100%)",
    animation: "roadGlow 1.35s ease 260ms both",
    pointerEvents: "none",
  },
  driveVideo: {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    height: 230,
    objectFit: "cover",
    opacity: 0.96,
    background: "#07130c",
  },

  driveImage: {
    position: "relative",
    zIndex: 1,
    display: "block",
    width: "100%",
    height: 230,
    objectFit: "cover",
    mixBlendMode: "screen",
    opacity: 0.78,
  },
  fallbackVisual: {
    position: "relative",
    zIndex: 1,
    height: 230,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  roadSky: {
    position: "absolute",
    top: 28,
    left: 28,
    fontSize: 42,
    opacity: 0.94,
    animation: "softFloat 4s ease-in-out infinite",
  },
  roadLine: {
    position: "absolute",
    bottom: 52,
    left: "-10%",
    width: "120%",
    height: 74,
    borderTop: "3px solid rgba(111,211,92,0.58)",
    borderRadius: "50%",
    animation: "roadMove 5s ease-in-out infinite",
  },
  carDot: {
    position: "absolute",
    bottom: 54,
    left: "50%",
    transform: "translateX(-50%)",
    width: 76,
    height: 76,
    borderRadius: 30,
    display: "grid",
    placeItems: "center",
    fontSize: 42,
    background: "rgba(0,0,0,0.24)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  visualOverlay: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  statusPill: {
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(111,211,92,0.88)",
    color: "#09200d",
    fontSize: 13,
    fontWeight: 1000,
    boxShadow: "0 10px 24px rgba(111,211,92,0.2)",
    whiteSpace: "nowrap",
  },
  sceneryPill: {
    padding: "9px 13px",
    borderRadius: 999,
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: 1000,
    border: "1px solid rgba(255,255,255,0.12)",
    backdropFilter: "blur(10px)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  roadPill: {
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(0,0,0,0.42)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: 900,
    backdropFilter: "blur(10px)",
    whiteSpace: "nowrap",
  },
  tipBox: {
    marginTop: 16,
    padding: "16px 18px",
    borderRadius: 22,
    background: "rgba(0,0,0,0.34)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 1000,
    lineHeight: 1.7,
  },
  meterCard: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    borderRadius: 32,
    background: "rgba(20,23,21,0.88)",
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.3)",
    marginBottom: 16,
  },
  sectionRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.16em",
    fontSize: 12,
    fontWeight: 1000,
  },
  sectionTitle: {
    margin: "6px 0 0",
    fontSize: 28,
    lineHeight: 1.14,
    fontWeight: 1000,
    letterSpacing: "-0.055em",
  },
  miniCount: {
    minWidth: 72,
    textAlign: "right",
    color: "#fff",
    fontSize: 26,
    fontWeight: 1000,
    letterSpacing: "-0.05em",
  },
  meter: {
    marginTop: 16,
  },
  meterHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 9,
  },
  meterLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#fff",
    fontSize: 16,
    fontWeight: 1000,
  },
  meterEmoji: {
    fontSize: 18,
  },
  meterValue: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 13,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  meterTrack: {
    height: 12,
    borderRadius: 999,
    background: "rgba(255,255,255,0.1)",
    overflow: "hidden",
  },
  meterFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(111,211,92,0.94), rgba(141,238,105,1))",
    boxShadow: "0 0 18px rgba(111,211,92,0.34)",
    transition: "width 700ms cubic-bezier(0.34,1.1,0.64,1), box-shadow 300ms ease",
  },
  sceneryCard: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    borderRadius: 32,
    background: "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)",
    marginBottom: 16,
    overflow: "hidden",
  },
  sceneryShine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "40%",
    background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)",
    animation: "sceneryShine 4.6s ease-in-out infinite",
    pointerEvents: "none",
  },
  sceneryDays: {
    minWidth: 72,
    textAlign: "right",
    color: "#9cff87",
    fontSize: 28,
    fontWeight: 1000,
    letterSpacing: "-0.06em",
  },
  sceneryHero: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: 16,
    borderRadius: 26,
    background: "rgba(0,0,0,0.26)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  sceneryIcon: {
    width: 70,
    height: 70,
    flex: "0 0 auto",
    borderRadius: 26,
    display: "grid",
    placeItems: "center",
    fontSize: 42,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.10)",
    animation: "sceneryFloat 4s ease-in-out infinite",
  },
  sceneryTitle: {
    color: "#fff",
    fontSize: 23,
    lineHeight: 1.15,
    fontWeight: 1000,
    letterSpacing: "-0.04em",
    marginBottom: 6,
  },
  sceneryText: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.6,
  },
  sceneryNext: {
    marginTop: 8,
    color: "#9cff87",
    fontSize: 13,
    fontWeight: 1000,
    lineHeight: 1.5,
  },
  stageGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    marginTop: 16,
  },
  stageDotWrap: {
    textAlign: "center",
  },
  stageDot: {
    height: 52,
    borderRadius: 18,
    display: "grid",
    placeItems: "center",
    fontSize: 25,
    transition: "all 250ms ease",
  },
  stageDotLabel: {
    marginTop: 7,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: 1000,
  },
  valueCard: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    borderRadius: 32,
    background: "linear-gradient(145deg, rgba(116,224,93,0.13), rgba(255,255,255,0.045))",
    border: "1px solid rgba(116,224,93,0.22)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.30), 0 0 44px rgba(116,224,93,0.08)",
    marginBottom: 16,
  },
  valueTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 12,
  },
  valueEyebrow: {
    color: "#9CF27F",
    fontSize: 12,
    fontWeight: 1000,
    letterSpacing: "0.16em",
    marginBottom: 8,
  },
  valueHeading: {
    margin: 0,
    color: "#fff",
    fontSize: 28,
    lineHeight: 1.12,
    fontWeight: 1000,
    letterSpacing: "-0.06em",
  },
  valueIcon: {
    width: 54,
    height: 54,
    borderRadius: 20,
    display: "grid",
    placeItems: "center",
    background: "rgba(116,224,93,0.16)",
    border: "1px solid rgba(116,224,93,0.22)",
    fontSize: 26,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  valueAmount: {
    marginTop: 10,
    color: "#fff",
    fontSize: 52,
    lineHeight: 1,
    fontWeight: 1000,
    letterSpacing: "-0.08em",
  },
  valueDivider: {
    height: 1,
    background: "rgba(255,255,255,0.10)",
    margin: "22px 0 16px",
  },
  valueMetaGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  valueMetaBox: {
    padding: "14px 12px",
    borderRadius: 20,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  valueMetaLabel: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 12,
    fontWeight: 1000,
    marginBottom: 8,
  },
  valueMetaValue: {
    color: "#fff",
    fontSize: 22,
    fontWeight: 1000,
    letterSpacing: "-0.05em",
    whiteSpace: "nowrap",
  },
  valueNote: {
    margin: "16px 0 0",
    color: "rgba(255,255,255,0.66)",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.8,
  },
  recommendCard: {
    position: "relative",
    zIndex: 1,
    padding: 22,
    borderRadius: 32,
    background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(241,246,242,0.96))",
    color: "#0d0f0e",
    border: "1px solid rgba(255,255,255,0.5)",
    boxShadow: "0 22px 50px rgba(0,0,0,0.22)",
  },
  recommendTitle: {
    margin: "7px 0 16px",
    color: "#0d0f0e",
    fontSize: 30,
    fontWeight: 1000,
    letterSpacing: "-0.06em",
  },
  recommendList: {
    display: "grid",
    gap: 12,
  },
  recommendItem: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: 14,
    borderRadius: 22,
    background: "rgba(0,0,0,0.045)",
    border: "1px solid rgba(0,0,0,0.05)",
  },
  recommendIcon: {
    width: 44,
    height: 44,
    flex: "0 0 auto",
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "#111",
    color: "#fff",
    fontSize: 22,
  },
  recommendItemTitle: {
    color: "#0d0f0e",
    fontSize: 17,
    fontWeight: 1000,
    marginBottom: 4,
  },
  recommendItemBody: {
    color: "rgba(13,15,14,0.58)",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.6,
  },
  founderCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 20,
    background: "linear-gradient(135deg,#2d2d2d,#1a1a1a)",
    border: "1px solid rgba(255,255,255,.12)",
  },
  founderLabel: {
    fontSize: 12,
    color: "#9cff87",
    fontWeight: 700,
  },
  founderTitle: {
    color: "#fff",
    marginTop: 8,
  },
  founderText: {
    color: "rgba(255,255,255,.75)",
  },
};