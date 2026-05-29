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
type LifeTagId = string;

type LifeTag = {
  id: LifeTagId;
  label: string;
  statusName: string;
  emoji: string;
  custom?: boolean;
};

const DEFAULT_LIFE_TAGS: LifeTag[] = [
  { id: "side_business", label: "副業", statusName: "副業力", emoji: "💰" },
  { id: "health", label: "健康", statusName: "健康力", emoji: "💪" },
  { id: "study", label: "学習", statusName: "学習力", emoji: "📚" },
  { id: "output", label: "発信", statusName: "発信力", emoji: "📣" },
  { id: "sleep", label: "睡眠", statusName: "睡眠力", emoji: "🌙" },
];

type GoalTagMap = Record<number, LifeTagId>;

type HiddenBalanceType = "skill" | "recovery" | "play" | "connection" | "life";

type TodayMessage = {
  icon: string;
  title: string;
  body: string;
  tip: string;
};

const HIDDEN_TAG_TYPES: Record<string, HiddenBalanceType> = {
  side_business: "skill",
  study: "skill",
  output: "skill",
  health: "recovery",
  sleep: "recovery",
};

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

function buildTodayMessage(params: {
  total: number;
  done: number;
  percent: number;
  streakLikeDone: number;
  skillDone: number;
  recoveryDone: number;
  playDone: number;
}) : TodayMessage {
  const { total, done, percent, streakLikeDone, skillDone, recoveryDone, playDone } = params;

  if (total === 0) {
    return {
      icon: "🌱",
      title: "今日は小さく始められます",
      body: "まだ今日の流れは空いています。5分で終わる行動を1つ置くだけでも十分です 🌱",
      tip: "TaskMoneyは、あなたの積み上げを記録しています ✨",
    };
  }

  if (done === 0) {
    return {
      icon: "🌿",
      title: "今日は小さくてもOKです",
      body: "まだ完了はありません。1つだけ積めば、今日の流れはちゃんと動き始めます ☕️",
      tip: "止まりそうな行動は、あとで一緒に軽くできます 🌿",
    };
  }

  if (percent >= 100) {
    return {
      icon: "✨",
      title: "今日の行動、かなり整っています",
      body: "予定していた行動を完了できています。積み上げた行動、ちゃんと残っています ✨",
      tip: "今日はここまででも十分。余力があれば回復系を入れるとさらに安定します 🌙",
    };
  }

  if (skillDone >= 2 && recoveryDone === 0) {
    return {
      icon: "🛌",
      title: "かなり前に進めています",
      body: "スキル向上系の行動が進んでいます。少し張り詰め気味にならないよう、回復も1つ入れると良さそうです 🌿",
      tip: "休むことも、長く続けるための前進です ☕️",
    };
  }

  if (recoveryDone > 0 && skillDone > 0) {
    return {
      icon: "⚖️",
      title: "今日のバランス、良い感じです",
      body: "前に進む行動と整える行動の両方が入っています。無理なく続けやすい流れです 🌱",
      tip: "昨日の努力、少しずつ形になっています ✨",
    };
  }

  if (recoveryDone > 0 && skillDone === 0) {
    return {
      icon: "🌿",
      title: "回復できています",
      body: "今日は整える行動が入っています。余力が戻ってきたら、小さな前進行動を1つ足しても良さそうです 🍃",
      tip: "回復している。その調子です 🌙",
    };
  }

  if (playDone > 0 && done === playDone) {
    return {
      icon: "🎮",
      title: "気分転換も大事です",
      body: "今日は遊び・エモ系の行動が進んでいます。余力があれば、5分だけ前進行動を足すとさらに良い流れになります ☕️",
      tip: "楽しむことも、人生ステータスの一部です ✨",
    };
  }

  if (streakLikeDone >= 7) {
    return {
      icon: "🔥",
      title: "流れが続いています",
      body: "継続の土台ができ始めています。今日も1つ積めば、流れはさらに強くなります 🌱",
      tip: "あなたの努力は、TaskMoneyがちゃんと覚えています ✨",
    };
  }

  return {
    icon: "💡",
    title: "今日の流れができています",
    body: "すでに行動が積み上がっています。完璧より、流れを切らないことが大事です 🌿",
    tip: "積み上げた行動、ちゃんと残っています ✨",
  };
}


const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "https://todo-money-api.onrender.com";

function getToken() {
  return localStorage.getItem("todoMoneyToken") ?? "";
}

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

  try {
    const res = await fetch(`${API_BASE}/api/goals/${goalId}`, {
      method: "DELETE",
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearToken();
        throw new Error("ログインの有効期限が切れました。再度ログインしてください。");
      }

      if (res.status >= 500) {
        throw new Error("通信に失敗しました。時間をおいて再度お試しください。");
      }

      if (res.status === 404) {
        throw new Error("削除対象のデータが見つかりませんでした。");
      }

      throw new Error("削除に失敗しました。");
    }
  } catch (e: any) {
    throw new Error(e?.message ?? "通信に失敗しました。時間をおいて再度お試しください。");
  }
}

function customTagKey() {
  return `todo-money:customLifeTags:v1:${getCurrentUserKey()}`;
}

function loadCustomTags(): LifeTag[] {
  try {
    const raw = localStorage.getItem(customTagKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomTags(tags: LifeTag[]) {
  localStorage.setItem(customTagKey(), JSON.stringify(tags));
}

function getTag(tags: LifeTag[], tagId?: LifeTagId) {
  return tags.find((t) => t.id === tagId) ?? tags[0] ?? DEFAULT_LIFE_TAGS[0];
}

function toStatusName(label: string) {
  const base = label.trim().replace(/力$/, "");
  return `${base}力`;
}

export default function GoalsPage() {
  const nav = useNavigate();
  const isGuest = localStorage.getItem("todoMoneyUserKey") === "guest";

  const [showSplash, setShowSplash] = useState(true);
  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>({});
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("副業で月5万");
  const [newIncome, setNewIncome] = useState(600000);
  const [newGoalTag, setNewGoalTag] = useState<LifeTagId>("side_business");
  const [customLifeTags, setCustomLifeTags] = useState<LifeTag[]>(() =>
    loadCustomTags()
  );

  const allLifeTags = useMemo(
    () => [...DEFAULT_LIFE_TAGS, ...customLifeTags],
    [customLifeTags]
  );

  const [showTagModal, setShowTagModal] = useState(false);
  const [newTagEmoji, setNewTagEmoji] = useState("✨");
  const [newTagLabel, setNewTagLabel] = useState("エモ");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [goalTags, setGoalTags] = useState<GoalTagMap>(() => loadGoalTags());
  const [activeTab, setActiveTab] = useState<TabId>("todo");

  const [rainSeed, setRainSeed] = useState(0);
  const [moneyGain, setMoneyGain] = useState("");
  const [showMoneyGain, setShowMoneyGain] = useState(false);
  const prevTotalEarnedRef = useRef<number>(0);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const visibleGoals = showAllGoals ? goals : goals.slice(0, 3);

  const [openGoals, setOpenGoals] = useState<Record<number, boolean>>({});
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );
  const [schedules, setSchedules] = useState<LocalSchedule[]>(() =>
    loadSchedules()
  );

  function onCreateCustomTag() {
    const label = newTagLabel.trim();

    if (!label) {
      alert("タグ名を入力してください");
      return;
    }

    const emoji = newTagEmoji.trim() || "✨";

    const tag: LifeTag = {
      id: `custom_${Date.now()}`,
      label,
      statusName: toStatusName(label),
      emoji,
      custom: true,
    };

    const next = [...customLifeTags, tag];
    setCustomLifeTags(next);
    saveCustomTags(next);

    setNewGoalTag(tag.id);
    setShowTagModal(false);
  }

  function refreshToday() {
    setSchedules(loadSchedules());
    setHistory(loadHistory());
    setGoalTags(loadGoalTags());
    setCustomLifeTags(loadCustomTags());
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
    (async () => 
    {
      try {
        setError(null);
        await refreshGoals();
        refreshToday();
      } catch (e: any) {
        setError(friendlyErrorMessage(e, "読み込みに失敗しました"));
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
    return allLifeTags.map((tag) => {
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
  }, [goals, goalTags, allProgressItems, allLifeTags]);


  const todayMessage = useMemo(() => {
    const today = new Date();
    const todayYmd =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    let todayTotal = 0;
    let todayDone = 0;
    let skillDone = 0;
    let recoveryDone = 0;
    let playDone = 0;

    for (const s of schedules) {
      if (!occursOnDate(s, todayYmd)) continue;

      todayTotal++;

      const done = s.completedDates?.includes(todayYmd) ?? false;
      if (!done) continue;

      todayDone++;

      const goalId = s.taskRef?.goalId;
      const tagId =
        goalId != null ? goalTags[goalId] ?? "side_business" : s.tags?.[0] ?? "side_business";
      const tag = getTag(allLifeTags, tagId);
      const hiddenType = getHiddenType(tag);

      if (hiddenType === "skill") skillDone++;
      if (hiddenType === "recovery") recoveryDone++;
      if (hiddenType === "play") playDone++;
    }

    const percent = todayTotal === 0 ? 0 : Math.round((todayDone / todayTotal) * 100);
    const streakLikeDone = statusItems.reduce((sum, x) => sum + x.done, 0);

    return buildTodayMessage({
      total: todayTotal,
      done: todayDone,
      percent,
      streakLikeDone,
      skillDone,
      recoveryDone,
      playDone,
    });
  }, [schedules, goalTags, allLifeTags, statusItems]);

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

  function friendlyErrorMessage(e: any, fallback: string) {
    const message = String(e?.message ?? "");
  
    if (
      message.includes("Internal Server Error") ||
      message.includes("500") ||
      message.includes("Network Error")
    ) {
      return "データの取得に失敗しました。少し時間をおいて、もう一度開いてみてください 🌿";
    }
    return message || fallback;
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

      <header style={ui.pageHeader}>
        <div>
          <div style={ui.pageKicker}>TaskMoney</div>
          <h1 style={ui.pageTitle}>目標</h1>
        </div>
        <div style={ui.headerActions}>
          <button type="button" onClick={refreshToday} style={ui.iconButton}>🌿</button>
          <button type="button" onClick={logout} style={ui.iconButton}>⚙️</button>
        </div>
      </header>

      <div className="card" style={ui.todayMessageCard}>
        <div style={ui.todayMessageTop}>
          <div style={ui.todayMessageIcon}>{todayMessage.icon}</div>
          <div>
            <div style={ui.todayMessageLabel}>TODAY MESSAGE</div>
            <h2 style={ui.todayMessageTitle}>{todayMessage.title}</h2>
          </div>
        </div>

        <p style={ui.todayMessageBody}>{todayMessage.body}</p>
        <div style={ui.todayMessageTip}>{todayMessage.tip}</div>
      </div>

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
                        background: done ? "#72D957" : "rgba(255,255,255,0.06)",
                        boxShadow: done
                          ? "0 0 12px rgba(114,217,87,0.42)"
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
                        background: "#72D957",
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
                background: activeTab === tab.id ? "rgba(88, 166, 65, 0.20)" : "rgba(255,255,255,0.05)",
                color: activeTab === tab.id ? "#8EE66F" : "rgba(255,255,255,0.52)",
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

              {visibleGoals.map((g: any) => {
                const tag = getTag(allLifeTags, goalTags[g.id]);

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
                            {allLifeTags.map((tag) => (
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
                      タスク追加
                      </button>
                      <button onClick={() => handleToggleTasks(g.id)} style={ui.actionBtn}>
                        {openGoals[g.id] ? "閉じる" : "詳細"}
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
              {goals.length > 3 && (
            <div style={{ textAlign: "center", marginTop: 12, marginBottom: 20 }}>
       <button
        onClick={() => setShowAllGoals((v) => !v)}
        style={{
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.86)",
          fontWeight: 900,
          fontSize: 15,
          borderRadius: 18,
          padding: "14px 18px",
          minWidth: 220,
          boxShadow: "0 14px 32px rgba(0,0,0,0.18)",
        }}
      >
      {showAllGoals
        ? "閉じる"
        : `すべての目標を見る（${goals.length}件）`}
    </button>
  </div>
)}
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
                {allLifeTags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.emoji} {tag.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                style={ui.tagCreateButton}
                onClick={() => setShowTagModal(true)}
              >
                ＋ 新しい人生ステータスを作る
              </button>

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

      {showTagModal && (
        <div style={ui.modalBackdrop} onClick={() => setShowTagModal(false)}>
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div style={ui.modalHeader}>
              <h2 style={ui.modalTitle}>新しいタグ</h2>
              <button style={ui.closeButton} onClick={() => setShowTagModal(false)}>
                ×
              </button>
            </div>

            <div style={ui.modalBody}>
              <label>絵文字</label>
              <input
                value={newTagEmoji}
                onChange={(e) => setNewTagEmoji(e.target.value)}
                placeholder="例：✨"
                style={ui.inputLike}
              />

              <label>タグ名</label>
              <input
                value={newTagLabel}
                onChange={(e) => setNewTagLabel(e.target.value)}
                placeholder="例：エモ"
                style={ui.inputLike}
              />

              <div style={ui.previewTag}>
                {newTagEmoji.trim() || "✨"} {toStatusName(newTagLabel || "エモ")} Lv1
              </div>

              <button style={ui.createButton} onClick={onCreateCustomTag}>
                タグを作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ui: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "100%",
    minHeight: "100dvh",
    overflowX: "hidden",
    padding: "18px 16px 120px",
    background:
      "radial-gradient(circle at 20% 0%, rgba(90, 180, 80, 0.16), transparent 28%), linear-gradient(180deg, #090B09 0%, #111311 52%, #090A09 100%)",
    color: "#F4F7F2",
  },

  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    margin: "4px 0 18px",
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
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    minWidth: 42,
    minHeight: 42,
    padding: 0,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    boxShadow: "0 12px 28px rgba(0,0,0,0.22)",
  },

  todayMessageCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.09), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.26)",
    backdropFilter: "blur(18px)",
  },
  todayMessageTop: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  todayMessageIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background:
      "radial-gradient(circle at 30% 20%, rgba(142,230,111,0.36), rgba(32,68,29,0.70))",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 23,
    flex: "0 0 auto",
    boxShadow: "0 0 24px rgba(114,217,87,0.18)",
  },
  todayMessageLabel: {
    color: "rgba(255,255,255,0.46)",
    letterSpacing: "0.14em",
    fontSize: 10,
    fontWeight: 900,
    marginBottom: 4,
  },
  todayMessageTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    lineHeight: 1.18,
  },
  todayMessageBody: {
    margin: 0,
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.75,
  },
  todayMessageTip: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 17,
    background: "rgba(0,0,0,0.38)",
    color: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(255,255,255,0.06)",
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.6,
  },

  progressCard: {
    borderRadius: 28,
    overflow: "hidden",
    padding: 20,
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 22px 54px rgba(0,0,0,0.30)",
    backdropFilter: "blur(18px)",
  },
  progressMainTitle: {
    margin: "0 0 4px",
    color: "#fff",
    fontSize: 38,
    fontWeight: 950,
    letterSpacing: "-0.055em",
  },
  progressPercent: {
    fontSize: 50,
    fontWeight: 950,
    color: "#fff",
    letterSpacing: "-0.06em",
    textShadow: "0 0 28px rgba(255,255,255,0.12)",
  },
  progressMuted: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.7,
  },
  progressItemTitle: {
    fontWeight: 900,
    color: "rgba(255,255,255,0.92)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  statusTitle: {
    color: "#fff",
    fontWeight: 950,
    marginBottom: 12,
    fontSize: 24,
    letterSpacing: "-0.04em",
  },
  statusBar: {
    height: 10,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },

  topButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    marginBottom: 10,
  },
  deleteMini: {
    color: "#ff8b8b",
    border: "1px solid rgba(255,139,139,0.24)",
    background: "rgba(255,139,139,0.08)",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 999,
  },
  logoutMini: {
    color: "rgba(255,255,255,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.05)",
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 999,
  },

  segmentCard: {
    marginBottom: 14,
    padding: "6px 8px",
    borderRadius: 22,
    overflow: "hidden",
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 14px 34px rgba(0,0,0,0.18)",
  },
  segmentButton: {
    flex: 1,
    padding: "13px 0",
    borderRadius: 999,
    border: "none",
    fontSize: 15,
    fontWeight: 950,
    cursor: "pointer",
  },

  sectionHeader: {
    margin: "20px 2px 12px",
  },
  sectionLabel: {
    color: "rgba(255,255,255,0.45)",
    fontWeight: 900,
    fontSize: 13,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 30,
    fontWeight: 950,
    margin: "4px 0 0",
    letterSpacing: "-0.05em",
  },

  card: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 18,
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.075)",
    boxShadow: "0 18px 42px rgba(0,0,0,0.24)",
  },
  goalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  goalTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.045em",
    lineHeight: 1.18,
  },
  goalSelect: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
    color: "#fff",
    fontWeight: 850,
    maxWidth: "100%",
  },
  goalActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginTop: 16,
  },
  actionBtn: {
    borderRadius: 14,
    padding: "11px 10px",
    color: "rgba(255,255,255,0.86)",
    background: "rgba(255,255,255,0.045)",
    border: "1px solid rgba(255,255,255,0.09)",
    fontWeight: 900,
  },
  dangerBtn: {
    borderRadius: 14,
    padding: "11px 10px",
    color: "#ff8b8b",
    border: "1px solid rgba(255,139,139,0.22)",
    background: "rgba(255,139,139,0.08)",
    fontWeight: 900,
  },

  taskRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    width: "100%",
    padding: "14px 0",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  taskMain: {
    flex: "1 1 auto",
    minWidth: 0,
  },
  taskTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    lineHeight: 1.35,
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  taskBadge: {
    display: "inline-flex",
    marginTop: 8,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.56)",
    fontSize: 12,
    fontWeight: 800,
  },
  taskActions: {
    flex: "0 0 auto",
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  taskEditBtn: {
    minWidth: 60,
    borderRadius: 14,
    padding: "11px 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#fff",
    fontWeight: 900,
  },
  taskCompleteBtn: {
    minWidth: 102,
    borderRadius: 14,
    padding: "11px 12px",
    border: "none",
    background: "#72D957",
    color: "#071006",
    fontWeight: 950,
    boxShadow: "0 0 22px rgba(114,217,87,0.24)",
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
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 40,
    marginBottom: 28,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: 950,
    margin: "0 0 16px",
    color: "#fff",
  },
  emptyText: {
    fontSize: 16,
    lineHeight: 1.8,
    color: "rgba(255,255,255,0.52)",
    margin: 0,
    fontWeight: 750,
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
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    fontSize: 34,
    lineHeight: 1,
    fontWeight: 400,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 38px rgba(0,0,0,0.38)",
    zIndex: 20,
    backdropFilter: "blur(18px)",
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.58)",
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
    background: "#151715",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 32,
    boxShadow: "0 24px 70px rgba(0,0,0,0.46)",
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
    fontWeight: 950,
    margin: 0,
    color: "#fff",
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
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
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
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.22)",
    color: "#fff",
  },
  createButton: {
    width: "100%",
    minHeight: 56,
    marginTop: 22,
    marginBottom: 0,
    border: "none",
    borderRadius: 18,
    background: "#72D957",
    color: "#071006",
    padding: "16px 18px",
    fontSize: 17,
    fontWeight: 950,
    boxShadow: "0 0 26px rgba(114,217,87,0.24)",
  },
  tagCreateButton: {
    width: "100%",
    marginTop: 10,
    marginBottom: 14,
    borderRadius: 14,
    padding: "12px 14px",
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontWeight: 900,
  },
  previewTag: {
    marginTop: 16,
    padding: "14px 16px",
    borderRadius: 18,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
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
    fontWeight: 950,
    boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
    animation: "gainPop 1.8s ease forwards",
    pointerEvents: "none",
  },
};