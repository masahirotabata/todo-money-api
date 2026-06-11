// src/pages/SchedulePage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import MoneyRainOverlay from "../components/MoneyRainOverlay";
import DrivePage from "./DrivePage";
import {
  listGoals,
  listTasks,
  type GoalListItem,
  type TaskItem,
} from "../lib/api";
import { createFuturePlan } from "../api";
import { ScheduleEvent } from "./Calender";
import ScheduleModal from "../components/ScheduleModel";
import {
  cancelScheduleNotifications,
  refreshAllNotifications,
  requestNotificationPermission,
} from "../lib/localNotifications";

type ProgressTab = "today" | "drive" | "future";

type ReminderType =
  | "none"
  | "sameDayMorning"
  | "previousDay20"
  | "threeDays20"
  | "oneWeek20"
  | "dailyMorningNight";

type PlanType = "side_business" | "study" | "health" | "output";

type CalendarScheduleEvent = ScheduleEvent & {
  reminderType?: ReminderType;
  must?: boolean;
};

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

type FuturePlanItem = {
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  memo: string;
};

type QuickModalState = {
  open: boolean;
  mode: "new" | "edit";
  editingId?: string;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  memo: string;
  reminderType: ReminderType;
  must: boolean;
};


const REMINDER_OPTIONS: { value: ReminderType; label: string; sub: string }[] =
  [
    { value: "none", label: "通知なし", sub: "通知は設定しません" },
    { value: "sameDayMorning", label: "当日 朝8時", sub: "当日の朝に思い出す" },
    { value: "previousDay20", label: "前日 夜20時", sub: "前日の夜に準備する" },
    {
      value: "threeDays20",
      label: "3日前 夜20時",
      sub: "少し余裕を持って思い出す",
    },
    {
      value: "oneWeek20",
      label: "1週間前 夜20時",
      sub: "早めに予定を把握する",
    },
    {
      value: "dailyMorningNight",
      label: "毎日 朝8時・夜20時",
      sub: "予定日まで毎日リマインド",
    },
  ];

const PLAN_TYPES = [
  { id: "side_business", label: "副業", emoji: "💰" },
  { id: "study", label: "資格・学習", emoji: "📚" },
  { id: "health", label: "健康・筋トレ", emoji: "💪" },
  { id: "output", label: "発信", emoji: "📣" },
] as const;


const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

function getCurrentUserKey() {
  const savedUserKey = localStorage.getItem("todoMoneyUserKey");
  if (savedUserKey) return savedUserKey;

  const token = localStorage.getItem("todoMoneyToken");
  if (!token) return "guest";

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(
      payload.email ?? payload.sub ?? payload.userId ?? payload.id ?? "user",
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


function loadSchedules(): CalendarScheduleEvent[] {
  try {
    const raw = localStorage.getItem(scheduleKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSchedules(list: CalendarScheduleEvent[]) {
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

function occursOnDate(ev: CalendarScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = parseYMD(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function getOccurrenceDates(s: CalendarScheduleEvent) {
  const dates: string[] = [];
  if (!s.startDate) return dates;

  if (s.oneShot || !s.weekdays || s.weekdays.length === 0 || !s.endDate) {
    dates.push(s.startDate);
    return dates;
  }

  let current = parseYMD(s.startDate);
  const end = parseYMD(s.endDate);

  while (current <= end) {
    const dateStr = toYMD(current);
    if (occursOnDate(s, dateStr)) dates.push(dateStr);
    current = addDays(current, 1);
  }

  return dates;
}

function getTimeLabel(ev: CalendarScheduleEvent) {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`;
  if (ev.startTime) return `${ev.startTime}〜`;
  return "終日";
}

function getReminderLabel(type?: ReminderType) {
  return (
    REMINDER_OPTIONS.find((x) => x.value === (type ?? "none"))?.label ??
    "通知なし"
  );
}

function getDateLabel(ymd: string) {
  const d = parseYMD(ymd);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

function getScheduleEmoji(ev: CalendarScheduleEvent) {
  const text = `${ev.title ?? ""} ${ev.memo ?? ""}`;
  if (text.includes("睡眠") || text.includes("寝") || text.includes("休"))
    return "🌙";
  if (
    text.includes("読書") ||
    text.includes("講義") ||
    text.includes("学習") ||
    text.includes("勉強")
  )
    return "📚";
  if (text.includes("動画") || text.includes("配信") || text.includes("発信"))
    return "💻";
  if (text.includes("筋トレ") || text.includes("運動") || text.includes("散歩"))
    return "💪";
  if (text.includes("カフェ") || text.includes("休憩")) return "☕️";
  if (text.includes("仕事") || text.includes("作業")) return "🛠️";
  if (text.includes("病院") || text.includes("歯医者") || text.includes("通院"))
    return "🏥";
  if (text.includes("買い物") || text.includes("支払い")) return "🛒";
  return "🌿";
}

function getTaskEmoji(candidate: TaskCandidate) {
  const text = `${candidate.goalTitle ?? ""} ${candidate.task.title ?? ""}`;
  if (text.includes("睡眠") || text.includes("寝") || text.includes("休"))
    return "🌙";
  if (
    text.includes("読書") ||
    text.includes("講義") ||
    text.includes("学習") ||
    text.includes("勉強")
  )
    return "📚";
  if (text.includes("動画") || text.includes("配信") || text.includes("発信"))
    return "💻";
  if (text.includes("筋トレ") || text.includes("運動") || text.includes("散歩"))
    return "💪";
  if (text.includes("カフェ") || text.includes("休憩")) return "☕️";
  if (text.includes("仕事") || text.includes("作業")) return "🛠️";
  return "🌿";
}

function makeQuickModal(date: string): QuickModalState {
  return {
    open: true,
    mode: "new",
    date,
    title: "",
    startTime: "",
    endTime: "",
    memo: "",
    reminderType: "previousDay20",
    must: false,
  };
}

function generatePlan(type: PlanType, minutes: number): FuturePlanItem[] {
  const short = minutes <= 30;

  if (type === "side_business") {
    return [
      {
        title: "市場調査",
        weekday: 1,
        startTime: "21:00",
        endTime: short ? "21:30" : "22:00",
        memo: "作りたいアプリ・投稿ネタ・競合を調べる",
      },
      {
        title: "実装・制作",
        weekday: 3,
        startTime: "21:00",
        endTime: short ? "21:30" : "22:00",
        memo: "小さく1機能だけ進める",
      },
      {
        title: "発信・振り返り",
        weekday: 5,
        startTime: "21:00",
        endTime: short ? "21:30" : "22:00",
        memo: "進捗を投稿して反応を見る",
      },
    ];
  }

  if (type === "study") {
    return [
      {
        title: "テキスト学習",
        weekday: 2,
        startTime: "21:00",
        endTime: short ? "21:30" : "22:00",
        memo: "基礎範囲を少し進める",
      },
      {
        title: "問題演習",
        weekday: 4,
        startTime: "21:00",
        endTime: short ? "21:30" : "22:00",
        memo: "過去問・演習問題を解く",
      },
      {
        title: "復習",
        weekday: 0,
        startTime: "10:00",
        endTime: short ? "10:30" : "11:00",
        memo: "間違えたところを復習する",
      },
    ];
  }

  if (type === "health") {
    return [
      {
        title: "筋トレ",
        weekday: 1,
        startTime: "20:30",
        endTime: short ? "21:00" : "21:30",
        memo: "胸・背中・脚のどれかを軽く実施",
      },
      {
        title: "散歩",
        weekday: 3,
        startTime: "20:30",
        endTime: short ? "21:00" : "21:30",
        memo: "外に出るだけでもOK",
      },
      {
        title: "ストレッチ",
        weekday: 6,
        startTime: "10:00",
        endTime: short ? "10:30" : "11:00",
        memo: "疲労を残さないための回復日",
      },
    ];
  }

  return [
    {
      title: "投稿ネタ作成",
      weekday: 1,
      startTime: "21:00",
      endTime: short ? "21:30" : "22:00",
      memo: "投稿ネタを3つ書き出す",
    },
    {
      title: "動画・文章作成",
      weekday: 3,
      startTime: "21:00",
      endTime: short ? "21:30" : "22:00",
      memo: "1本だけ作る",
    },
    {
      title: "投稿・分析",
      weekday: 5,
      startTime: "21:00",
      endTime: short ? "21:30" : "22:00",
      memo: "投稿して反応を見る",
    },
  ];
}


export default function SchedulePage() {
  const today = new Date();
  const todayYmd = toYMD(today);

  const [activeTab, setActiveTab] = useState<ProgressTab>("today");
  const [selectedDate, setSelectedDate] = useState(todayYmd);

  const [schedules, setSchedules] = useState<CalendarScheduleEvent[]>(() =>
    loadSchedules(),
  );
  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory(),
  );
  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>(
    {},
  );
  const [loadingTasks, setLoadingTasks] = useState(true);

  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [rainSeed, setRainSeed] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalBaseDate, setModalBaseDate] = useState<Date>(new Date());
  const [modalInitial, setModalInitial] =
    useState<Partial<ScheduleEvent> | null>(null);
  const [modalClickedDate, setModalClickedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [quickModal, setQuickModal] = useState<QuickModalState>(() => ({
    ...makeQuickModal(todayYmd),
    open: false,
  }));

  const [futureGoal, setFutureGoal] = useState("資格試験に合格する");
  const [futureDetail, setFutureDetail] = useState("");
  const [futureDeadline, setFutureDeadline] = useState("");
  const [futureMinutes, setFutureMinutes] = useState(30);
  const [futureType, setFutureType] = useState<PlanType>("side_business");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [createdPlan, setCreatedPlan] = useState(false);
  const [moneyGain, setMoneyGain] = useState("");
  const [showMoneyGain, setShowMoneyGain] = useState(false);

  const templatePlan = useMemo(
    () => generatePlan(futureType, futureMinutes),
    [futureType, futureMinutes],
  );
  const [editablePlan, setEditablePlan] =
    useState<FuturePlanItem[]>(templatePlan);

  useEffect(() => {
    setEditablePlan(templatePlan);
    setAiSummary("");
    setCreatedPlan(false);
  }, [templatePlan]);


  async function loadEverything() {
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
        }),
      );
      setTasksByGoal(map);
      setSchedules(loadSchedules());
      setHistory(loadHistory());

    } finally {
      setLoadingTasks(false);
    }
  }

  useEffect(() => {
    loadEverything();
    void (async () => {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await refreshAllNotifications(loadSchedules());
    })();

    const onFocus = () => loadEverything();
    const onVisible = () => {
      if (!document.hidden) loadEverything();
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

  useEffect(() => saveSchedules(schedules), [schedules]);
  useEffect(() => saveHistory(history), [history]);

  const taskCandidates = useMemo(() => {
    const items: TaskCandidate[] = [];
    for (const g of goals) {
      const ts = tasksByGoal[g.id] ?? [];
      ts.filter((t) => !t.completed).forEach((t) =>
        items.push({ goalId: g.id, goalTitle: g.title, task: t }),
      );
    }
    return items;
  }, [goals, tasksByGoal]);

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
    ev.completedDates?.includes(selectedDate),
  ).length;
  const selectedIsToday = selectedDate === todayYmd;
  const completionRate =
    selectedSchedules.length === 0
      ? 0
      : Math.round((completedCount / selectedSchedules.length) * 100);


  const focusMessage = (() => {
    if (selectedSchedules.length === 0)
      return "今日は予定を詰めすぎず、余白を残して進めましょう。";
    if (completionRate === 100)
      return "今日のやりたいタスクは完了済み。かなり良い走行です。";
    if (selectedSchedules.length >= 4)
      return "予定が多めです。まずは1つだけできればOKです。";
    return "今日やりたいことを1つずつ選んで、前へ進みましょう。";
  })();

  function persistSchedulesAndRefreshNotifications(
    next: CalendarScheduleEvent[],
  ) {
    saveSchedules(next);
    void refreshAllNotifications(next);
  }

  function openNewSchedule(
    date: Date,
    initial?: Partial<ScheduleEvent>,
    clickedDate?: string,
    id?: string,
  ) {
    setEditingId(id);
    setModalBaseDate(date);
    setModalInitial(initial ?? null);
    setModalClickedDate(clickedDate ?? null);
    setModalOpen(true);
  }

  function openQuickNew(dateStr = selectedDate) {
    setShowAddMenu(false);
    setQuickModal(makeQuickModal(dateStr));
  }

  function openQuickEdit(ev: CalendarScheduleEvent, dateStr: string) {
    setQuickModal({
      open: true,
      mode: "edit",
      editingId: ev.id,
      date: dateStr,
      title: ev.title ?? "",
      startTime: ev.startTime ?? "",
      endTime: ev.endTime ?? "",
      memo: ev.memo ?? "",
      reminderType: ev.reminderType ?? "none",
      must: ev.must ?? false,
    });
  }

  function openTaskScheduleModal(
    candidate: TaskCandidate,
    baseDate = parseYMD(selectedDate),
  ) {
    setShowTaskDrawer(false);
    openNewSchedule(
      baseDate,
      {
        title: candidate.task.title,
        memo: "",
        startDate: toYMD(baseDate),
        endDate: toYMD(addMonths(baseDate, 1)),
        taskRef: { goalId: candidate.goalId, taskId: candidate.task.id },
      },
      toYMD(baseDate),
    );
  }

  function handleSaveSchedule(data: Omit<ScheduleEvent, "id">) {
    setSchedules((prev) => {
      const next = editingId
        ? prev.map((x) =>
            x.id === editingId
              ? ({
                  ...data,
                  id: editingId,
                  completedDates: x.completedDates ?? [],
                  must: x.must ?? false,
                } as CalendarScheduleEvent)
              : x,
          )
        : [...prev, { ...data, id: uid() } as CalendarScheduleEvent];
      persistSchedulesAndRefreshNotifications(next);
      return next;
    });
    setEditingId(undefined);
    setModalOpen(false);
  }

  function handleSaveQuickSchedule() {
    const title = quickModal.title.trim();
    if (!title) return;

    const ev: CalendarScheduleEvent = {
      id: quickModal.editingId ?? uid(),
      title,
      memo: quickModal.memo.trim(),
      startDate: quickModal.date,
      endDate: quickModal.date,
      startTime: quickModal.startTime || undefined,
      endTime: quickModal.endTime || undefined,
      weekdays: [],
      oneShot: true,
      completedDates:
        schedules.find((x) => x.id === quickModal.editingId)?.completedDates ??
        [],
      reminderType: quickModal.reminderType,
      must: quickModal.must,
    } as CalendarScheduleEvent;

    setSchedules((prev) => {
      const next =
        quickModal.mode === "edit" && quickModal.editingId
          ? prev.map((x) => (x.id === quickModal.editingId ? ev : x))
          : [...prev, ev];
      persistSchedulesAndRefreshNotifications(next);
      return next;
    });

    setSelectedDate(quickModal.date);
    setQuickModal((prev) => ({ ...prev, open: false }));
  }

  function handleDeleteSchedule(id: string) {
    if (!confirm("このスケジュールを削除しますか？")) return;
    void cancelScheduleNotifications(id);
    setSchedules((prev) => {
      const next = prev.filter((x) => x.id !== id);
      persistSchedulesAndRefreshNotifications(next);
      return next;
    });
    setEditingId(undefined);
    setModalOpen(false);
    setQuickModal((prev) => ({ ...prev, open: false }));
  }

  function handleEventClick(ev: CalendarScheduleEvent, dateStr: string) {
    if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
      openQuickEdit(ev, dateStr);
      return;
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    openNewSchedule(new Date(y, m - 1, d), ev, dateStr, ev.id);
  }

  function handleToggleDoneForDate(
    scheduleId: string,
    dateStr: string,
    done: boolean,
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
        if (prev.some((h) => h.scheduleId === scheduleId && h.date === dateStr))
          return prev;
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
          (h) => !(h.scheduleId === scheduleId && h.date === dateStr),
        );
        saveHistory(next);
        return next;
      });
    }
  }

  function toggleScheduleDone(ev: CalendarScheduleEvent) {
    const done = !(ev.completedDates?.includes(selectedDate) ?? false);
    handleToggleDoneForDate(ev.id, selectedDate, done);
  }

  function goPrevDay() {
    setSelectedDate(toYMD(addDays(parseYMD(selectedDate), -1)));
  }

  function goNextDay() {
    setSelectedDate(toYMD(addDays(parseYMD(selectedDate), 1)));
  }

  async function createAiPlan() {
    setAiLoading(true);
    try {
      const data = await createFuturePlan({
        goal: `目標:\n${futureGoal}\n\n興味・補足:\n${futureDetail}\n\n条件:\n・初心者でも継続できる\n・最初の一歩を小さくする\n・週3回以内\n・挫折しにくい計画`,
        deadline: futureDeadline,
        minutes: futureMinutes,
        type: futureType,
      });

      if (data.items?.length) {
        setEditablePlan(data.items);
        setAiSummary(data.summary ?? "");
        setCreatedPlan(false);
      } else {
        alert("AIプランが空でした。テンプレプランを使ってください。");
      }
    } catch (e) {
      console.error(e);
      alert("AIプラン作成に失敗しました。テンプレプランを使ってください。");
    } finally {
      setAiLoading(false);
    }
  }

  async function replanAiPlan() {
    setAiLoading(true);
    try {
      const data = await createFuturePlan({
        goal: `${futureGoal}\n\n現在の予定:\n${editablePlan.map((p) => p.title).join("\n")}\n\n予定通りできなかったため、より無理なく継続できる形へ再計画してください。`,
        deadline: futureDeadline,
        minutes: futureMinutes,
        type: futureType,
      });
      if (data.items?.length) {
        setEditablePlan(data.items);
        setAiSummary(data.summary ?? "");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }

  function updatePlan(
    index: number,
    field: keyof FuturePlanItem,
    value: string | number,
  ) {
    setEditablePlan((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  function addPlanItem() {
    setEditablePlan((prev) => [
      ...prev,
      {
        title: "新しい行動",
        weekday: 1,
        startTime: "21:00",
        endTime: futureMinutes <= 30 ? "21:30" : "22:00",
        memo: "必要に応じて内容を編集してください",
      },
    ]);
  }

  function removePlanItem(index: number) {
    setEditablePlan((prev) => prev.filter((_, i) => i !== index));
  }

  function registerPlan() {
    const startDate = toYMD(new Date());
    const endDate = futureDeadline || toYMD(addMonths(new Date(), 3));
    const validItems = editablePlan.filter((item) => item.title.trim());

    const newSchedules: CalendarScheduleEvent[] = validItems.map((item) => {
      const weekdays = [false, false, false, false, false, false, false];
      weekdays[item.weekday] = true;
      return {
        id: uid(),
        title: item.title.trim(),
        memo: `Future目標：${futureGoal}\n${item.memo}`,
        startDate,
        endDate,
        startTime: item.startTime,
        endTime: item.endTime,
        weekdays,
        oneShot: false,
        completedDates: [],
        tags: [futureType],
        must: false,
        reminderType: "none",
      } as CalendarScheduleEvent;
    });

    setSchedules((prev) => {
      const next = [...prev, ...newSchedules];
      persistSchedulesAndRefreshNotifications(next);
      return next;
    });
    setCreatedPlan(true);
    setActiveTab("today");
  }

  function renderTabs() {
    const tabs: {
      id: ProgressTab;
      label: string;
      emoji: string;
      sub: string;
    }[] = [
      { id: "today", label: "Today", emoji: "➡️", sub: "今日やる" },
      { id: "drive", label: "Drive", emoji: "🚗", sub: "走行感" },
      { id: "future", label: "Future", emoji: "🚀", sub: "未来を作る" },
    ];

    return (
      <div style={styles.segmentWrap}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            style={activeTab === tab.id ? styles.segmentActive : styles.segment}
            onClick={() => setActiveTab(tab.id)}
          >
            <span style={styles.segmentEmoji}>{tab.emoji}</span>
            <span style={styles.segmentLabel}>{tab.label}</span>
            <span style={styles.segmentSub}>{tab.sub}</span>
          </button>
        ))}
      </div>
    );
  }

  function renderToday() {
    return (
      <>
        <section style={styles.dateCard}>
          <button style={styles.dayNavButton} onClick={goPrevDay}>
            ‹
          </button>
          <button
            style={styles.dateCenter}
            onClick={() => setSelectedDate(todayYmd)}
          >
            <div style={styles.dateTitle}>{getDateLabel(selectedDate)}</div>
            <div style={styles.subHeader}>
              <span>{selectedSchedules.length}件</span>
              {selectedSchedules.length > 0 && (
                <span>
                  {completedCount}/{selectedSchedules.length} 完了
                </span>
              )}
            </div>
          </button>
          <button style={styles.dayNavButton} onClick={goNextDay}>
            ›
          </button>
        </section>

        <section style={styles.driveFocusCard}>
          <div style={styles.focusIcon}>🌿</div>
          <div style={{ minWidth: 0 }}>
            <div style={styles.focusTitle}>今日やりたいことに集中</div>
            <div style={styles.focusText}>{focusMessage}</div>
          </div>
          <div style={styles.progressBubble}>{completionRate}%</div>
        </section>

        <section style={styles.selectedPanel}>
          <div style={styles.selectedPanelHandle} />
          <div style={styles.selectedHeader}>
            <div>
              <h2 style={styles.panelTitle}>
                {selectedIsToday ? "今日の前進タスク" : "この日の前進タスク"}
              </h2>
              <div style={styles.panelSub}>{getDateLabel(selectedDate)}</div>
            </div>
          </div>

          {selectedSchedules.length === 0 ? (
            <div
              style={styles.emptyCard}
              onClick={() => openQuickNew(selectedDate)}
            >
              <div style={styles.emptyIcon}>☕️</div>
              <div>
                <div style={styles.emptyTitle}>前進タスクはありません</div>
                <div style={styles.emptyText}>
                  今日やりたいことを、さっと追加できます。
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.scheduleList}>
              {selectedSchedules.map((ev) => {
                const done = ev.completedDates?.includes(selectedDate) ?? false;
                const emoji = getScheduleEmoji(ev);
                return (
                  <article
                    key={ev.id}
                    style={done ? styles.scheduleCardDone : styles.scheduleCard}
                  >
                    <button
                      style={styles.scheduleMain}
                      onClick={() => handleEventClick(ev, selectedDate)}
                    >
                      <div style={styles.scheduleIcon}>{emoji}</div>
                      <div style={styles.scheduleText}>
                        <div style={styles.timeText}>{getTimeLabel(ev)}</div>
                        <div style={styles.scheduleTitle}>{ev.title}</div>
                        <div style={styles.reminderText}>
                          🔔 {getReminderLabel(ev.reminderType)}
                        </div>
                        {ev.memo && (
                          <div style={styles.memoText}>{ev.memo}</div>
                        )}
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
      </>
    );
  }

  function renderFuture() {
    const selectedType = PLAN_TYPES.find((x) => x.id === futureType);
    return (
      <section style={styles.panelBlock}>
        <div style={styles.blockKicker}>FUTURE PLAN</div>
        <h2 style={styles.blockTitle}>未来を作る</h2>
        <p style={styles.blockLead}>
          将来こうなりたい、を今日できる行動に分解します。
        </p>

        <label style={styles.formLabelDark}>達成したいこと</label>
        <input
          style={styles.darkInput}
          value={futureGoal}
          onChange={(e) => setFutureGoal(e.target.value)}
          placeholder="例：資格試験に合格する"
        />

        <label style={styles.formLabelDark}>興味・補足</label>
        <textarea
          style={styles.darkTextarea}
          value={futureDetail}
          onChange={(e) => setFutureDetail(e.target.value)}
          placeholder="例：午後問題中心、散歩も入れたい"
        />

        <div style={styles.formGrid2}>
          <div>
            <label style={styles.formLabelDark}>期限</label>
            <input
              style={styles.darkInput}
              type="date"
              value={futureDeadline}
              onChange={(e) => setFutureDeadline(e.target.value)}
            />
          </div>
          <div>
            <label style={styles.formLabelDark}>1回あたり</label>
            <select
              style={styles.darkInput}
              value={futureMinutes}
              onChange={(e) => setFutureMinutes(Number(e.target.value))}
            >
              <option value={15}>15分</option>
              <option value={30}>30分</option>
              <option value={60}>60分</option>
            </select>
          </div>
        </div>

        <label style={styles.formLabelDark}>方向性</label>
        <div style={styles.typeGrid}>
          {PLAN_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFutureType(item.id)}
              style={
                futureType === item.id
                  ? styles.typeButtonActive
                  : styles.typeButton
              }
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>

        {aiSummary && <div style={styles.aiSummary}>{aiSummary}</div>}

        <button
          style={styles.aiButton}
          onClick={createAiPlan}
          disabled={aiLoading}
        >
          {aiLoading ? "AIが作成中..." : "AIプラン作成"}
        </button>
        <button
          style={styles.replanButton}
          onClick={replanAiPlan}
          disabled={aiLoading}
        >
          今日はできなかった → 再計画
        </button>

        <div style={styles.planList}>
          {editablePlan.map((item, index) => (
            <article key={index} style={styles.planItemCard}>
              <div style={styles.planIndex}>STEP {index + 1}</div>
              <input
                style={styles.planTitleInput}
                value={item.title}
                onChange={(e) => updatePlan(index, "title", e.target.value)}
              />
              <div style={styles.planMiniGrid}>
                <select
                  style={styles.planMiniInput}
                  value={item.weekday}
                  onChange={(e) =>
                    updatePlan(index, "weekday", Number(e.target.value))
                  }
                >
                  {WEEKDAY_LABELS.map((label, i) => (
                    <option key={i} value={i}>
                      {label}曜
                    </option>
                  ))}
                </select>
                <input
                  style={styles.planMiniInput}
                  type="time"
                  value={item.startTime}
                  onChange={(e) =>
                    updatePlan(index, "startTime", e.target.value)
                  }
                />
                <input
                  style={styles.planMiniInput}
                  type="time"
                  value={item.endTime}
                  onChange={(e) => updatePlan(index, "endTime", e.target.value)}
                />
              </div>
              <textarea
                style={styles.planMemoInput}
                value={item.memo}
                onChange={(e) => updatePlan(index, "memo", e.target.value)}
              />
              <button
                style={styles.removePlanButton}
                onClick={() => removePlanItem(index)}
              >
                削除
              </button>
            </article>
          ))}
        </div>

        <button style={styles.addPlanButton} onClick={addPlanItem}>
          ＋ 行動を追加
        </button>
        <button style={styles.registerButton} onClick={registerPlan}>
          {createdPlan
            ? "登録しました"
            : `${selectedType?.emoji ?? "🚀"} Progressに登録`}
        </button>
      </section>
    );
  }

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />
      {showMoneyGain && <div style={styles.moneyGain}>{moneyGain}</div>}

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>PROGRESS HUB</div>
          <h1 style={styles.title}>Progress</h1>
        </div>
        {/* 追加ボタンはGoalsページと同じ右下フローティングに統一 */}
      </header>

      {renderTabs()}
      {activeTab === "today" && renderToday()}
      {activeTab === "drive" && (
        <section style={styles.driveEmbed}>
          <DrivePage />
        </section>
      )}
      {activeTab === "future" && renderFuture()}

      <button
        type="button"
        style={styles.floatingAddButton}
        onClick={() => setShowAddMenu(true)}
        aria-label="Progressに追加"
      >
        +
      </button>

      {showAddMenu && (
        <div style={styles.drawerOverlay} onClick={() => setShowAddMenu(false)}>
          <section style={styles.addMenu} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHandle} />
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerEyebrow}>ADD TASK</div>
                <h2 style={styles.drawerTitle}>Progressへ追加</h2>
              </div>
            </div>

            <button
              style={styles.addMenuCard}
              onClick={() => openQuickNew(selectedDate)}
            >
              <div style={styles.addMenuIcon}>📝</div>
              <div style={styles.addMenuText}>
                <div style={styles.addMenuTitle}>今日やりたいタスクを作る</div>
                <div style={styles.addMenuSub}>
                  日付・通知・メモだけで、さっと追加できます。
                </div>
              </div>
              <div style={styles.taskSelectArrow}>›</div>
            </button>

            <button
              style={styles.addMenuCard}
              onClick={() => {
                setShowAddMenu(false);
                setShowTaskDrawer(true);
              }}
            >
              <div style={styles.addMenuIcon}>✅</div>
              <div style={styles.addMenuText}>
                <div style={styles.addMenuTitle}>既存タスクから選ぶ</div>
                <div style={styles.addMenuSub}>
                  目標に登録済みの小タスクをProgressへ配置できます。
                </div>
              </div>
              <div style={styles.taskSelectArrow}>›</div>
            </button>

            <button
              style={styles.addMenuGhost}
              onClick={() => {
                setShowAddMenu(false);
                openNewSchedule(
                  parseYMD(selectedDate),
                  undefined,
                  selectedDate,
                );
              }}
            >
              繰り返しタスクを作る
            </button>
          </section>
        </div>
      )}

      {showTaskDrawer && (
        <div
          style={styles.drawerOverlayRaised}
          onClick={() => setShowTaskDrawer(false)}
        >
          <section style={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHandle} />
            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerEyebrow}>SELECT FROM GOALS</div>
                <h2 style={styles.drawerTitle}>目標から選ぶ</h2>
              </div>
              <div style={styles.drawerCount}>{taskCandidates.length}件</div>
            </div>

            {loadingTasks ? (
              <div style={styles.drawerEmpty}>読み込み中...</div>
            ) : taskCandidates.length === 0 ? (
              <div style={styles.drawerEmpty}>
                追加できる未完了タスクはありません
              </div>
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
                        <div style={styles.taskSelectTitle}>
                          {candidate.task.title}
                        </div>
                        <div style={styles.taskSelectSub}>
                          {candidate.goalTitle}
                        </div>
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

      {quickModal.open && (
        <div
          style={styles.quickOverlay}
          onClick={() => setQuickModal((prev) => ({ ...prev, open: false }))}
        >
          <section
            style={styles.quickModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.drawerHandle} />
            <div style={styles.quickHeader}>
              <button
                style={styles.closeButton}
                onClick={() =>
                  setQuickModal((prev) => ({ ...prev, open: false }))
                }
              >
                ×
              </button>
              <div style={styles.quickTitle}>
                {quickModal.mode === "edit" ? "予定編集" : "予定作成"}
              </div>
              <button
                style={{
                  ...styles.saveButton,
                  opacity: quickModal.title.trim() ? 1 : 0.35,
                }}
                disabled={!quickModal.title.trim()}
                onClick={handleSaveQuickSchedule}
              >
                保存
              </button>
            </div>

            <input
              style={styles.titleInput}
              value={quickModal.title}
              onChange={(e) =>
                setQuickModal((prev) => ({ ...prev, title: e.target.value }))
              }
              placeholder="予定名を入力"
              autoFocus
            />
            <div style={styles.quickRow}>
              <div>
                <div style={styles.formLabel}>日付</div>
                <input
                  style={styles.dateInput}
                  type="date"
                  value={quickModal.date}
                  onChange={(e) =>
                    setQuickModal((prev) => ({ ...prev, date: e.target.value }))
                  }
                />
              </div>
            </div>

            <div style={styles.timeRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.formLabel}>開始</div>
                <input
                  style={styles.timeInput}
                  type="time"
                  value={quickModal.startTime}
                  onChange={(e) =>
                    setQuickModal((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                />
              </div>
              <div style={styles.timeArrow}>›</div>
              <div style={{ flex: 1 }}>
                <div style={styles.formLabel}>終了</div>
                <input
                  style={styles.timeInput}
                  type="time"
                  value={quickModal.endTime}
                  onChange={(e) =>
                    setQuickModal((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div style={styles.sectionLabel}>通知</div>
            <div style={styles.reminderGrid}>
              {REMINDER_OPTIONS.map((option) => {
                const active = quickModal.reminderType === option.value;
                return (
                  <button
                    key={option.value}
                    style={
                      active ? styles.reminderCardActive : styles.reminderCard
                    }
                    onClick={() =>
                      setQuickModal((prev) => ({
                        ...prev,
                        reminderType: option.value,
                      }))
                    }
                  >
                    <div style={styles.reminderLabel}>{option.label}</div>
                    <div style={styles.reminderSub}>{option.sub}</div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              style={
                quickModal.must ? styles.mustToggleActive : styles.mustToggle
              }
              onClick={() =>
                setQuickModal((prev) => ({ ...prev, must: !prev.must }))
              }
            >
              <div>
                <div style={styles.mustTitle}>カレンダーに常に表示</div>
                <div style={styles.mustSub}>
                  歯医者・荷物受取など、忘れたくない予定だけONにします。
                </div>
              </div>
              <div
                style={
                  quickModal.must ? styles.mustPillActive : styles.mustPill
                }
              >
                {quickModal.must ? "Must" : "任意"}
              </div>
            </button>

            <div style={styles.sectionLabel}>メモ</div>
            <textarea
              style={styles.memoInput}
              value={quickModal.memo}
              onChange={(e) =>
                setQuickModal((prev) => ({ ...prev, memo: e.target.value }))
              }
              placeholder="場所・持ち物・補足など"
            />

            {quickModal.mode === "edit" && quickModal.editingId && (
              <button
                style={styles.deleteButton}
                onClick={() => handleDeleteSchedule(quickModal.editingId!)}
              >
                この予定を削除
              </button>
            )}
            <div style={styles.quickNotice}>
              ※Mustにしたタスクはカレンダーに常に表示されます。任意タスクは完了後だけカレンダーに残ります。
            </div>
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

const styles: Record<string, CSSProperties> = {
  driveEmbed: {
    position: "relative",
    zIndex: 1,
    marginTop: 8,
    borderRadius: 32,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(0,0,0,0.20)",
  },
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "38px 14px calc(92px + env(safe-area-inset-bottom))",
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
    marginBottom: 12,
  },
  eyebrow: {
    color: "#72d85b",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "0.04em",
    marginBottom: 5,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 44,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.08em",
  },
  calendarButton: {
    minHeight: 50,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 18px",
    fontSize: 16,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(0,0,0,0.20)",
  },
  floatingAddButton: {
    position: "fixed",
    right: 24,
    bottom: "calc(92px + env(safe-area-inset-bottom))",
    zIndex: 900,
    width: 72,
    height: 72,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.08))",
    color: "#fff",
    fontSize: 42,
    fontWeight: 900,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 18px 44px rgba(0,0,0,0.36)",
    WebkitBackdropFilter: "blur(18px)",
    backdropFilter: "blur(18px)",
  },
  segmentWrap: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  segment: {
    minHeight: 68,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.045)",
    color: "rgba(255,255,255,0.68)",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 2,
  },
  segmentActive: {
    minHeight: 68,
    borderRadius: 20,
    border: "1px solid rgba(116,224,93,0.35)",
    background:
      "linear-gradient(180deg, rgba(116,224,93,0.20), rgba(255,255,255,0.06))",
    color: "#fff",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: 2,
    boxShadow: "0 0 0 1px rgba(116,224,93,0.12) inset",
  },
  segmentEmoji: { fontSize: 18, lineHeight: 1 },
  segmentLabel: { fontSize: 14, fontWeight: 950, lineHeight: 1.1 },
  segmentSub: {
    fontSize: 10,
    fontWeight: 850,
    color: "rgba(255,255,255,0.48)",
  },
  dateCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 22px 42px rgba(0,0,0,0.20)",
    padding: 14,
    marginBottom: 12,
    display: "grid",
    gridTemplateColumns: "48px 1fr 48px",
    alignItems: "center",
    gap: 10,
  },
  dayNavButton: {
    width: 48,
    height: 48,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    fontSize: 34,
    fontWeight: 600,
    lineHeight: 1,
  },
  dateCenter: {
    border: "none",
    background: "transparent",
    color: "#fff",
    display: "grid",
    justifyItems: "center",
    gap: 6,
    minWidth: 0,
  },
  dateTitle: {
    color: "#fff",
    fontSize: 24,
    lineHeight: 1.15,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "100%",
  },
  subHeader: {
    display: "flex",
    gap: 12,
    color: "rgba(255,255,255,0.52)",
    fontSize: 14,
    fontWeight: 850,
  },
  driveFocusCard: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "52px 1fr 62px",
    alignItems: "center",
    gap: 12,
    borderRadius: 26,
    border: "1px solid rgba(116,224,93,0.14)",
    background:
      "linear-gradient(135deg, rgba(116,224,93,0.13), rgba(255,255,255,0.045))",
    padding: "16px 16px",
    marginBottom: 14,
  },
  focusIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
  },
  focusTitle: { color: "#fff", fontSize: 17, fontWeight: 950, marginBottom: 4 },
  focusText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.5,
  },
  progressBubble: {
    width: 58,
    height: 58,
    borderRadius: 22,
    background: "rgba(116,224,93,0.16)",
    color: "#8df277",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontWeight: 950,
  },
  selectedPanel: {
    position: "relative",
    zIndex: 1,
    borderRadius: 30,
    background: "rgba(8,10,9,0.78)",
    border: "1px solid rgba(255,255,255,0.07)",
    padding: "12px 14px 18px",
    boxShadow: "0 -14px 34px rgba(0,0,0,0.25)",
  },
  selectedPanelHandle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    margin: "0 auto 14px",
  },
  selectedHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  panelTitle: {
    margin: "0 0 6px",
    color: "#fff",
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  panelSub: { color: "rgba(255,255,255,0.52)", fontSize: 13, fontWeight: 850 },
  scheduleList: { display: "grid", gap: 12 },
  scheduleCard: {
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  scheduleCardDone: {
    borderRadius: 22,
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
    padding: "17px 16px",
    textAlign: "left",
  },
  scheduleIcon: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: 17,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 25,
  },
  scheduleText: { minWidth: 0, flex: 1 },
  timeText: { color: "#fff", fontSize: 13, fontWeight: 950, lineHeight: 1.25 },
  scheduleTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.25,
    marginTop: 2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  reminderText: {
    marginTop: 5,
    color: "rgba(157,245,141,0.88)",
    fontSize: 12,
    fontWeight: 900,
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
    padding: "8px 12px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    fontWeight: 950,
  },
  donePill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(116,224,93,0.20)",
    color: "#9df58d",
    fontSize: 12,
    fontWeight: 950,
  },
  scheduleActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    padding: "0 16px 16px",
  },
  completeButton: {
    minHeight: 50,
    border: "none",
    borderRadius: 17,
    background: "#74e05d",
    color: "#07110c",
    fontSize: 16,
    fontWeight: 950,
  },
  doneButton: {
    minHeight: 50,
    border: "none",
    borderRadius: 17,
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    fontSize: 16,
    fontWeight: 950,
  },
  editButton: {
    minHeight: 50,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 16,
    fontWeight: 950,
  },
  emptyCard: {
    borderRadius: 22,
    padding: "18px 16px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
    display: "flex",
    alignItems: "center",
    gap: 13,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    minWidth: 48,
    borderRadius: 17,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: 950 },
  emptyText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.48)",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.5,
  },
  panelBlock: {
    position: "relative",
    zIndex: 1,
    borderRadius: 30,
    background: "rgba(8,10,9,0.78)",
    border: "1px solid rgba(255,255,255,0.07)",
    padding: "20px 16px",
    boxShadow: "0 -14px 34px rgba(0,0,0,0.25)",
  },
  blockKicker: {
    color: "#72d85b",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 8,
  },
  blockTitle: {
    margin: "0 0 8px",
    color: "#fff",
    fontSize: 30,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.07em",
  },
  blockLead: {
    margin: "0 0 18px",
    color: "rgba(255,255,255,0.58)",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.6,
  },
  formLabelDark: {
    display: "block",
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: 950,
    margin: "14px 0 7px",
  },
  darkInput: {
    width: "100%",
    minHeight: 50,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 14px",
    fontSize: 15,
    fontWeight: 850,
    outline: "none",
    boxSizing: "border-box",
  },
  darkTextarea: {
    width: "100%",
    minHeight: 96,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: 14,
    fontSize: 15,
    fontWeight: 850,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
  },
  formGrid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 9,
    marginBottom: 14,
  },
  typeButton: {
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.74)",
    fontSize: 13,
    fontWeight: 950,
  },
  typeButtonActive: {
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(116,224,93,0.45)",
    background: "rgba(116,224,93,0.18)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  aiSummary: {
    margin: "12px 0",
    borderRadius: 18,
    padding: 14,
    background: "rgba(116,224,93,0.12)",
    border: "1px solid rgba(116,224,93,0.20)",
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.6,
  },
  aiButton: {
    width: "100%",
    minHeight: 52,
    border: "none",
    borderRadius: 18,
    background: "#74e05d",
    color: "#07110c",
    fontSize: 16,
    fontWeight: 950,
    marginBottom: 10,
  },
  replanButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 950,
    marginBottom: 14,
  },
  planList: { display: "grid", gap: 12, marginTop: 12 },
  planItemCard: {
    borderRadius: 22,
    padding: 14,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
  },
  planIndex: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#0f1110",
    color: "#9df58d",
    fontSize: 11,
    fontWeight: 950,
    marginBottom: 10,
  },
  planTitleInput: {
    width: "100%",
    minHeight: 44,
    border: "none",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "transparent",
    color: "#fff",
    fontSize: 20,
    fontWeight: 950,
    outline: "none",
    boxSizing: "border-box",
  },
  planMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 8,
    marginTop: 12,
  },
  planMiniInput: {
    width: "100%",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 8px",
    fontSize: 13,
    fontWeight: 850,
    boxSizing: "border-box",
  },
  planMemoInput: {
    width: "100%",
    minHeight: 70,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: 10,
    fontSize: 13,
    fontWeight: 800,
    marginTop: 10,
    boxSizing: "border-box",
  },
  removePlanButton: {
    marginTop: 10,
    minHeight: 38,
    borderRadius: 14,
    border: "1px solid rgba(255,80,80,0.26)",
    background: "rgba(255,80,80,0.10)",
    color: "#ff7c7c",
    fontSize: 12,
    fontWeight: 950,
  },
  addPlanButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 14,
    borderRadius: 17,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 950,
  },
  registerButton: {
    width: "100%",
    minHeight: 54,
    marginTop: 12,
    border: "none",
    borderRadius: 18,
    background: "#74e05d",
    color: "#07110c",
    fontSize: 16,
    fontWeight: 950,
  },
  statusGrid: { display: "grid", gap: 10, marginBottom: 16 },
  statusEmpty: {
    borderRadius: 18,
    padding: 16,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: 850,
  },
  statusCard: {
    borderRadius: 22,
    padding: 14,
    background: "rgba(255,255,255,0.065)",
    border: "1px solid rgba(255,255,255,0.07)",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  statusEmoji: {
    width: 44,
    height: 44,
    borderRadius: 16,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 23,
  },
  statusName: { color: "#fff", fontSize: 17, fontWeight: 950 },
  statusSub: {
    marginTop: 3,
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    fontWeight: 850,
  },
  statusPercent: { color: "#8df277", fontSize: 18, fontWeight: 950 },
  goalCreateCard: {
    borderRadius: 24,
    padding: 14,
    background: "rgba(255,255,255,0.055)",
    border: "1px solid rgba(255,255,255,0.07)",
    marginBottom: 16,
  },
  cardMiniTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    marginBottom: 10,
  },
  errorBox: {
    marginTop: 10,
    borderRadius: 14,
    padding: 10,
    background: "rgba(255,80,80,0.12)",
    color: "#ff9b9b",
    fontSize: 12,
    fontWeight: 850,
  },
  goalList: { display: "grid", gap: 12 },
  goalCard: {
    borderRadius: 24,
    padding: 15,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.055)",
  },
  goalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    alignItems: "flex-start",
  },
  goalTag: {
    display: "inline-flex",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#0f1110",
    color: "#9df58d",
    fontSize: 11,
    fontWeight: 950,
    marginBottom: 8,
  },
  goalTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  goalSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.52)",
    fontSize: 13,
    fontWeight: 850,
  },
  goalTagSelect: {
    maxWidth: 112,
    minHeight: 38,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 850,
  },
  goalProgressTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    margin: "14px 0",
  },
  goalProgressFill: {
    height: "100%",
    borderRadius: 999,
    background: "#74e05d",
  },
  goalTasks: { display: "grid", gap: 8 },
  goalTaskRow: {
    minHeight: 42,
    borderRadius: 15,
    background: "rgba(255,255,255,0.055)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: "8px 10px",
  },
  goalTaskTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: 850,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  goalTaskDone: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 14,
    fontWeight: 850,
    textDecoration: "line-through",
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  goalTaskButton: {
    minHeight: 32,
    border: "none",
    borderRadius: 12,
    background: "rgba(116,224,93,0.20)",
    color: "#9df58d",
    fontSize: 12,
    fontWeight: 950,
  },
  goalEmpty: { color: "rgba(255,255,255,0.48)", fontSize: 13, fontWeight: 850 },
  addTaskButton: {
    width: "100%",
    minHeight: 44,
    marginTop: 12,
    borderRadius: 15,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  moneyGain: {
    position: "fixed",
    top: 78,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 200,
    borderRadius: 999,
    padding: "10px 18px",
    background: "rgba(116,224,93,0.94)",
    color: "#07110c",
    fontSize: 18,
    fontWeight: 950,
    boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
  },
  drawerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "flex-end",
  },
  drawerOverlayRaised: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(0,0,0,0.52)",
    display: "flex",
    alignItems: "flex-end",
    paddingBottom: "calc(76px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },
  drawer: {
    width: "100%",
    maxHeight: "56vh",
    overflowY: "auto",
    borderRadius: "32px 32px 0 0",
    background: "#f7f8f6",
    color: "#0d0f0d",
    padding: "12px 22px 24px",
    boxShadow: "0 -20px 50px rgba(0,0,0,0.28)",
    boxSizing: "border-box",
  },
  addMenu: {
    width: "100%",
    maxHeight: "62vh",
    overflowY: "auto",
    borderRadius: "32px 32px 0 0",
    background: "#f7f8f6",
    color: "#0d0f0d",
    padding: "12px 22px calc(28px + env(safe-area-inset-bottom))",
    boxShadow: "0 -20px 50px rgba(0,0,0,0.28)",
    boxSizing: "border-box",
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
    marginBottom: 8,
  },
  drawerEyebrow: {
    color: "rgba(0,0,0,0.18)",
    fontSize: 12,
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
  drawerCount: { color: "#777", fontSize: 22, fontWeight: 950 },
  drawerEmpty: {
    borderRadius: 22,
    padding: 22,
    background: "rgba(0,0,0,0.04)",
    color: "#777",
    fontWeight: 900,
    textAlign: "center",
  },
  drawerList: { display: "grid", gap: 12 },
  addMenuCard: {
    width: "100%",
    minHeight: 92,
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
    marginBottom: 12,
  },
  addMenuGhost: {
    width: "100%",
    minHeight: 50,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.04)",
    color: "#333",
    fontSize: 14,
    fontWeight: 900,
  },
  addMenuIcon: {
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
  addMenuText: { minWidth: 0, flex: 1 },
  addMenuTitle: {
    color: "#111",
    fontWeight: 950,
    fontSize: 18,
    letterSpacing: "-0.04em",
  },
  addMenuSub: {
    marginTop: 4,
    color: "#777",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.45,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
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
  taskSelectArrow: {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    color: "#111",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 34,
    fontWeight: 900,
    lineHeight: 1,
  },
  quickOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 120,
    background: "rgba(0,0,0,0.64)",
    display: "flex",
    alignItems: "flex-end",
  },
  quickModal: {
    width: "100%",
    maxHeight: "88vh",
    overflowY: "auto",
    borderRadius: "34px 34px 0 0",
    background: "#f7f8f6",
    color: "#0d0f0d",
    padding: "12px 20px calc(26px + env(safe-area-inset-bottom))",
    boxShadow: "0 -24px 60px rgba(0,0,0,0.34)",
    boxSizing: "border-box",
  },
  quickHeader: {
    height: 48,
    display: "grid",
    gridTemplateColumns: "52px 1fr 64px",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  closeButton: {
    border: "none",
    background: "transparent",
    color: "#111",
    fontSize: 34,
    lineHeight: 1,
  },
  quickTitle: {
    textAlign: "center",
    color: "#111",
    fontSize: 20,
    fontWeight: 950,
  },
  saveButton: {
    minHeight: 38,
    border: "none",
    borderRadius: 14,
    background: "#111",
    color: "#fff",
    fontSize: 14,
    fontWeight: 950,
  },
  titleInput: {
    width: "100%",
    minHeight: 56,
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    background: "transparent",
    color: "#111",
    fontSize: 20,
    fontWeight: 900,
    outline: "none",
    marginBottom: 16,
  },
  quickRow: { display: "grid", gap: 12, marginBottom: 14 },
  formLabel: {
    color: "rgba(0,0,0,0.36)",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 6,
  },
  dateInput: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    padding: "0 12px",
    fontSize: 16,
    fontWeight: 900,
  },
  timeRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 16 },
  timeInput: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    padding: "0 12px",
    fontSize: 16,
    fontWeight: 900,
  },
  timeArrow: {
    color: "rgba(0,0,0,0.18)",
    fontSize: 34,
    fontWeight: 900,
    paddingTop: 18,
  },
  sectionLabel: {
    color: "#111",
    fontSize: 16,
    fontWeight: 950,
    margin: "18px 0 10px",
  },
  reminderGrid: { display: "grid", gap: 9 },
  reminderCard: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    padding: "12px 14px",
    textAlign: "left",
  },
  reminderCardActive: {
    width: "100%",
    borderRadius: 18,
    border: "1px solid rgba(116,224,93,0.80)",
    background: "rgba(116,224,93,0.18)",
    padding: "12px 14px",
    textAlign: "left",
    boxShadow: "0 0 0 1px rgba(116,224,93,0.32) inset",
  },
  reminderLabel: { color: "#111", fontSize: 15, fontWeight: 950 },
  reminderSub: { marginTop: 3, color: "#777", fontSize: 12, fontWeight: 800 },
  memoInput: {
    width: "100%",
    minHeight: 94,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    padding: 14,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
  },
  mustToggle: {
    width: "100%",
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    padding: "13px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
  },
  mustToggleActive: {
    width: "100%",
    marginTop: 14,
    marginBottom: 4,
    borderRadius: 18,
    border: "1px solid rgba(116,224,93,0.80)",
    background: "rgba(116,224,93,0.18)",
    padding: "13px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
    boxShadow: "0 0 0 1px rgba(116,224,93,0.30) inset",
  },
  mustTitle: { color: "#111", fontSize: 15, fontWeight: 950 },
  mustSub: {
    marginTop: 3,
    color: "#777",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  mustPill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 10px",
    background: "rgba(0,0,0,0.06)",
    color: "#555",
    fontSize: 12,
    fontWeight: 950,
  },
  mustPillActive: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 10px",
    background: "#111",
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
  },
  deleteButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 16,
    borderRadius: 16,
    border: "1px solid rgba(255,80,80,0.26)",
    background: "rgba(255,80,80,0.10)",
    color: "#dc3b3b",
    fontSize: 14,
    fontWeight: 950,
  },
  quickNotice: {
    marginTop: 16,
    borderRadius: 16,
    padding: 12,
    background: "rgba(0,0,0,0.04)",
    color: "#777",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.55,
  },
};
