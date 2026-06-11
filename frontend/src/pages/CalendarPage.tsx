// src/pages/CalendarPage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import MoneyRainOverlay from "../components/MoneyRainOverlay";
import { listGoals, listTasks, GoalListItem, TaskItem } from "../lib/api";
import ScheduleModal from "../components/ScheduleModel";

export type ScheduleEvent = {
  id: string;
  title: string;
  memo?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  weekdays?: boolean[];
  oneShot?: boolean;
  completedDates?: string[];
  tags?: string[];
  taskRef?: {
    goalId: number;
    taskId: number;
  };
};

type ReminderType =
  | "none"
  | "sameDayMorning"
  | "previousDay20"
  | "threeDays20"
  | "oneWeek20"
  | "dailyMorningNight";

type CalendarScheduleEvent = ScheduleEvent & {
  reminderType?: ReminderType;
  /**
   * true の予定だけ、未完了でもカレンダー上に常時表示する。
   * false/undefined の予定は、完了した日だけカレンダーに表示する。
   */
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

type FootprintItem = {
  id: string;
  scheduleId: string;
  date: string;
  title: string;
  emoji: string;
  must: boolean;
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
  repeatMode: "none" | "daily" | "weekly";
  weekdays: boolean[];
  endDate: string;
};

const REMINDER_OPTIONS: { value: ReminderType; label: string; sub: string }[] = [
  { value: "none", label: "通知なし", sub: "通知は設定しません" },
  { value: "sameDayMorning", label: "当日 朝8時", sub: "当日の朝に思い出す" },
  { value: "previousDay20", label: "前日 夜20時", sub: "前日の夜に準備する" },
  { value: "threeDays20", label: "3日前 夜20時", sub: "少し余裕を持って思い出す" },
  { value: "oneWeek20", label: "1週間前 夜20時", sub: "早めに予定を把握する" },
  {
    value: "dailyMorningNight",
    label: "毎日 朝8時・夜20時",
    sub: "予定日まで毎日リマインド",
  },
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

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthGrid(base: Date) {
  const first = startOfMonth(base);
  const gridStart = addDays(first, -first.getDay());

  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
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

function getTimeLabel(ev: CalendarScheduleEvent) {
  if (ev.startTime && ev.endTime) return `${ev.startTime} - ${ev.endTime}`;
  if (ev.startTime) return `${ev.startTime}〜`;
  return "終日";
}

function getReminderLabel(type?: ReminderType) {
  return REMINDER_OPTIONS.find((x) => x.value === (type ?? "none"))?.label ?? "通知なし";
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

function getDateLabel(ymd: string) {
  const d = parseYMD(ymd);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${
    weekdays[d.getDay()]
  })`;
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}


function isSelfGrowthSchedule(ev: CalendarScheduleEvent) {
  // 目標由来のタスクは「前進/未来」側で扱い、カレンダーには出さない。
  // カレンダーは歯医者・荷物受取・面談など、忘れたくない予定専用にする。
  return !!ev.taskRef;
}


function shouldShowOnCalendar(ev: CalendarScheduleEvent, dateStr: string) {
  // Must予定は未完了でも表示。
  if (ev.must) return true;

  // Mustでない予定は、完了した日だけカレンダーに表示。
  return ev.completedDates?.includes(dateStr) ?? false;
}

function isDoneOnDate(ev: CalendarScheduleEvent, dateStr: string) {
  return ev.completedDates?.includes(dateStr) ?? false;
}


function getCalendarDisplayPriority(ev: CalendarScheduleEvent, dateStr: string) {
  const done = isDoneOnDate(ev, dateStr);

  // 1. 未完了のMust予定は最優先で表示する。
  // 2. 完了済みMust予定は、その次。
  // 3. 任意の完了ログは最後。表示枠が足りない場合はここから押し出す。
  if (ev.must && !done) return 0;
  if (ev.must && done) return 1;
  return 2;
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
    // カレンダーから登録する予定は、忘れたくない予定として最初から表示対象にする。
    must: true,
    repeatMode: "none",
    weekdays: [false, false, false, false, false, false, false],
    endDate: date,
  };
}

export default function CalendarPage() {
  const today = new Date();
  const todayYmd = toYMD(today);

  const [selectedDate, setSelectedDate] = useState(todayYmd);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(today));

  const [schedules, setSchedules] = useState<CalendarScheduleEvent[]>(() =>
    loadSchedules()
  );

  const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
    loadHistory()
  );

  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [tasksByGoal, setTasksByGoal] = useState<Record<number, TaskItem[]>>({});
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

  const calendarSchedules = useMemo(() => {
    // カレンダーから作ったMust予定は常時表示。
    // 目標/予定タブ由来の任意タスクも、完了した日だけ二重線で表示する。
    return schedules;
  }, [schedules]);

  const monthDays = useMemo(() => getMonthGrid(visibleMonth), [visibleMonth]);

  const selectedSchedules = useMemo(() => {
    return calendarSchedules
      .filter((ev) => occursOnDate(ev, selectedDate))
      .sort((a, b) => {
        const at = a.startTime ?? "";
        const bt = b.startTime ?? "";
        if (at !== bt) return at.localeCompare(bt);
        return (a.title ?? "").localeCompare(b.title ?? "");
      });
  }, [calendarSchedules, selectedDate]);

  const todaySchedules = useMemo(() => {
    return calendarSchedules
      .filter((ev) => occursOnDate(ev, todayYmd))
      .sort((a, b) => (a.startTime ?? "").localeCompare(b.startTime ?? ""));
  }, [calendarSchedules, todayYmd]);

  const completedCount = selectedSchedules.filter((ev) =>
    ev.completedDates?.includes(selectedDate)
  ).length;

  const monthFootprints = useMemo<FootprintItem[]>(() => {
    const monthStart = toYMD(startOfMonth(visibleMonth));
    const monthEnd = toYMD(addDays(addMonths(startOfMonth(visibleMonth), 1), -1));
    const startNum = ymdToNum(monthStart);
    const endNum = ymdToNum(monthEnd);

    const map = new Map<string, FootprintItem>();

    calendarSchedules.forEach((ev) => {
      (ev.completedDates ?? []).forEach((date) => {
        const n = ymdToNum(date);
        if (n < startNum || n > endNum) return;

        map.set(`${date}-${ev.id}`, {
          id: `${date}-${ev.id}`,
          scheduleId: ev.id,
          date,
          title: ev.title,
          emoji: getScheduleEmoji(ev),
          must: ev.must ?? false,
        });
      });
    });

    // 旧データや別画面から入った完了ログも拾う保険。
    history.forEach((h) => {
      const n = ymdToNum(h.date);
      if (n < startNum || n > endNum) return;

      const key = `${h.date}-${h.scheduleId}`;
      if (map.has(key)) return;

      map.set(key, {
        id: key,
        scheduleId: h.scheduleId,
        date: h.date,
        title: h.title,
        emoji: getScheduleEmoji({
          id: h.scheduleId,
          title: h.title,
          startDate: h.date,
          endDate: h.date,
        }),
        must: false,
      });
    });

    return Array.from(map.values()).sort((a, b) => {
      const dateCompare = ymdToNum(b.date) - ymdToNum(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.title.localeCompare(b.title);
    });
  }, [calendarSchedules, history, visibleMonth]);

  const selectedFootprints = useMemo(() => {
    return monthFootprints.filter((item) => item.date === selectedDate);
  }, [monthFootprints, selectedDate]);

  const recentFootprints = useMemo(() => {
    return monthFootprints.slice(0, 18);
  }, [monthFootprints]);

  const topFootprints = useMemo(() => {
    const map = new Map<string, { title: string; emoji: string; count: number }>();

    monthFootprints.forEach((item) => {
      const key = item.title;
      const current = map.get(key);

      if (current) {
        current.count += 1;
      } else {
        map.set(key, {
          title: item.title,
          emoji: item.emoji,
          count: 1,
        });
      }
    });

    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [monthFootprints]);

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

  function openQuickNew(dateStr = selectedDate) {
    setShowAddMenu(false);
    setQuickModal(makeQuickModal(dateStr));
  }

  function openQuickEdit(ev: CalendarScheduleEvent, dateStr: string) {
    const hasWeeklyRepeat = !!ev.weekdays?.some(Boolean) && !ev.oneShot;
    const isDailyRepeat = hasWeeklyRepeat && ev.weekdays?.every(Boolean);

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
      repeatMode: isDailyRepeat ? "daily" : hasWeeklyRepeat ? "weekly" : "none",
      weekdays: ev.weekdays ?? [false, false, false, false, false, false, false],
      endDate: ev.endDate ?? dateStr,
    });
  }

  function openTaskScheduleModal(
    candidate: TaskCandidate,
    baseDate = parseYMD(selectedDate)
  ) {
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
      let next: CalendarScheduleEvent[];

      if (editingId) {
        next = prev.map((x) =>
          x.id === editingId
            ? ({
                ...x,
                ...data,
                id: editingId,
                // 既存値を優先。古い予定で未設定なら、カレンダー編集の予定として表示対象にする。
                must: x.must ?? true,
              } as CalendarScheduleEvent)
            : x
        );
      } else {
        const dataWithRef = data as ScheduleEvent;
        next = [
          ...prev,
          {
            ...data,
            id: uid(),
            // カレンダーから作る通常予定はMust。
            // 目標から選ぶタスクだけは任意扱いにして、完了後だけカレンダーに出す。
            must: dataWithRef.taskRef ? false : true,
          } as CalendarScheduleEvent,
        ];
      }

      saveSchedules(next);
      return next;
    });

    setEditingId(undefined);
    setModalOpen(false);
  }

  function handleSaveQuickSchedule() {
    const title = quickModal.title.trim();
    if (!title) return;

    const fallbackWeekdays = [false, false, false, false, false, false, false];

    const repeatWeekdays =
      quickModal.repeatMode === "daily"
        ? [true, true, true, true, true, true, true]
        : quickModal.repeatMode === "weekly"
        ? quickModal.weekdays.some(Boolean)
          ? quickModal.weekdays
          : (() => {
              const w = [...fallbackWeekdays];
              w[parseYMD(quickModal.date).getDay()] = true;
              return w;
            })()
        : [];

    const isRepeat = quickModal.repeatMode !== "none";

    const ev: CalendarScheduleEvent = {
      id: quickModal.editingId ?? uid(),
      title,
      memo: quickModal.memo.trim(),
      startDate: quickModal.date,
      endDate: isRepeat ? quickModal.endDate || quickModal.date : quickModal.date,
      startTime: quickModal.startTime || undefined,
      endTime: quickModal.endTime || undefined,
      weekdays: repeatWeekdays,
      oneShot: !isRepeat,
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

      saveSchedules(next);
      return next;
    });

    setSelectedDate(quickModal.date);
    setVisibleMonth(startOfMonth(parseYMD(quickModal.date)));
    setQuickModal((prev) => ({ ...prev, open: false }));
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

  function toggleScheduleDone(ev: CalendarScheduleEvent) {
    const done = !(ev.completedDates?.includes(selectedDate) ?? false);
    handleToggleDoneForDate(ev.id, selectedDate, done);
  }

  function selectDate(ymd: string) {
    setSelectedDate(ymd);
    setVisibleMonth(startOfMonth(parseYMD(ymd)));
  }

  function openAddMenu() {
    // 右下の＋から開く追加画面も、カレンダーの日付タップ時と同じUIに統一する。
    // 古いScheduleModalは、既存の繰り返し予定編集など必要な場面だけで使う。
    openQuickNew(selectedDate);
  }

  function openTaskDrawerFromMenu() {
    setShowAddMenu(false);
    setShowTaskDrawer(true);
  }

  function goPrevMonth() {
    const next = addMonths(visibleMonth, -1);
    setVisibleMonth(next);
    setSelectedDate(toYMD(next));
  }

  function goNextMonth() {
    const next = addMonths(visibleMonth, 1);
    setVisibleMonth(next);
    setSelectedDate(toYMD(next));
  }

  return (
    <div style={styles.page}>
      <MoneyRainOverlay seed={rainSeed} />
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>CALENDAR</div>
          <h1 style={styles.title}>Calender</h1>
        </div>
      </header>

      <section style={styles.monthCard}>
        <div style={styles.monthHeader}>
          <button style={styles.monthNavButton} onClick={goPrevMonth}>
            ‹
          </button>
          <button
            style={styles.monthTitleButton}
            onClick={() => {
              setVisibleMonth(startOfMonth(today));
              setSelectedDate(todayYmd);
            }}
          >
            <span style={styles.monthYear}>{visibleMonth.getFullYear()}</span>
            <span style={styles.monthTitle}>{visibleMonth.getMonth() + 1}月</span>
          </button>
          <button style={styles.monthNavButton} onClick={goNextMonth}>
            ›
          </button>
        </div>

        <div style={styles.weekHeaderGrid}>
          {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
            <div
              key={w}
              style={{
                ...styles.weekHeaderCell,
                color:
                  i === 0
                    ? "#ff7d7d"
                    : i === 6
                    ? "#7ab7ff"
                    : "rgba(255,255,255,0.45)",
              }}
            >
              {w}
            </div>
          ))}
        </div>

        <div style={styles.monthGrid}>
          {monthDays.map((d) => {
            const ymd = toYMD(d);
            const selected = ymd === selectedDate;
            const isToday = ymd === todayYmd;
            const isCurrentMonth = sameMonth(d, visibleMonth);
            const dayEvents = calendarSchedules
              .filter((ev) => occursOnDate(ev, ymd))
              .filter((ev) => shouldShowOnCalendar(ev, ymd))
              .sort((a, b) => {
                const ap = getCalendarDisplayPriority(a, ymd);
                const bp = getCalendarDisplayPriority(b, ymd);
                if (ap !== bp) return ap - bp;

                const at = a.startTime ?? "";
                const bt = b.startTime ?? "";
                if (at !== bt) return at.localeCompare(bt);
                return (a.title ?? "").localeCompare(b.title ?? "");
              });

            return (
              <div
                key={ymd}
                role="button"
                tabIndex={0}
                style={{
                  ...styles.monthCell,
                  ...(selected ? styles.monthCellSelected : {}),
                  opacity: isCurrentMonth ? 1 : 0.28,
                }}
                onClick={() => {
                  selectDate(ymd);
                  openQuickNew(ymd);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    selectDate(ymd);
                    openQuickNew(ymd);
                  }
                }}
              >
                <div style={styles.monthCellTop}>
                  <span
                    style={{
                      ...styles.monthDayNum,
                      ...(isToday ? styles.monthDayToday : {}),
                    }}
                  >
                    {d.getDate()}
                  </span>
                  {dayEvents.length > 0 && (
                    <span style={styles.eventCount}>{dayEvents.length}</span>
                  )}
                </div>

                <div style={styles.monthEventList}>
                  {dayEvents.slice(0, 3).map((ev) => (
                    <button
                      key={`${ymd}-${ev.id}`}
                      type="button"
                      style={{
                        ...styles.monthEventChip,
                        ...(isDoneOnDate(ev, ymd)
                          ? styles.monthEventChipDone
                          : {}),
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectDate(ymd);
                        handleEventClick(ev, ymd);
                      }}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <span style={styles.moreText}>+{dayEvents.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={styles.todayScheduleCard}>
        <div style={styles.todayScheduleHeader}>
          <div>
            <div style={styles.todayScheduleEyebrow}>TODAY SCHEDULE</div>
            <h2 style={styles.todayScheduleTitle}>今日の予定</h2>
          </div>

          <button
            type="button"
            style={styles.todayScheduleDateButton}
            onClick={() => {
              setSelectedDate(todayYmd);
              setVisibleMonth(startOfMonth(today));
            }}
          >
            今日へ
          </button>
        </div>

        {todaySchedules.length === 0 ? (
          <button
            type="button"
            style={styles.todayScheduleEmpty}
            onClick={() => openQuickNew(todayYmd)}
          >
            <div style={styles.todayScheduleEmptyIcon}>🌱</div>
            <div style={{ minWidth: 0 }}>
              <div style={styles.todayScheduleEmptyTitle}>今日の予定はまだありません</div>
              <div style={styles.todayScheduleEmptyText}>
                ここから今日の予定を追加できます。
              </div>
            </div>
          </button>
        ) : (
          <div style={styles.todayScheduleSlider}>
            {todaySchedules.map((ev) => {
              const done = isDoneOnDate(ev, todayYmd);

              return (
                <article
                  key={`today-${ev.id}`}
                  style={done ? styles.todayScheduleSlideDone : styles.todayScheduleSlide}
                >
                  <button
                    type="button"
                    style={styles.todayScheduleSlideMain}
                    onClick={() => {
                      setSelectedDate(todayYmd);
                      setVisibleMonth(startOfMonth(today));
                      handleEventClick(ev, todayYmd);
                    }}
                  >
                    <div style={styles.todayScheduleIcon}>{getScheduleEmoji(ev)}</div>

                    <div style={styles.todayScheduleTextBlock}>
                      <div style={styles.todayScheduleTime}>{getTimeLabel(ev)}</div>
                      <div style={styles.todayScheduleItemTitle}>{ev.title}</div>
                      <div style={styles.todayScheduleMeta}>
                        {getReminderLabel(ev.reminderType)}
                        {ev.must ? " ・予定" : " ・前進"}
                      </div>
                      {ev.memo && <div style={styles.todayScheduleMemo}>{ev.memo}</div>}
                    </div>
                  </button>

                  <div style={styles.todayScheduleActions}>
                    <button
                      type="button"
                      style={done ? styles.todayScheduleDoneButton : styles.todayScheduleCompleteButton}
                      onClick={() => handleToggleDoneForDate(ev.id, todayYmd, !done)}
                    >
                      {done ? "完了済み" : "完了"}
                    </button>

                    <button
                      type="button"
                      style={styles.todayScheduleEditButton}
                      onClick={() => {
                        setSelectedDate(todayYmd);
                        setVisibleMonth(startOfMonth(today));
                        handleEventClick(ev, todayYmd);
                      }}
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

      <section style={styles.footprintCard}>
        <div style={styles.footprintHeader}>
          <div>
            <div style={styles.footprintEyebrow}>FOOTPRINTS</div>
            <h2 style={styles.footprintTitle}>今月の足跡</h2>
          </div>
          <div style={styles.footprintCount}>
            {monthFootprints.length}
            <span style={styles.footprintCountUnit}>歩</span>
          </div>
        </div>

        {monthFootprints.length === 0 ? (
          <div style={styles.footprintEmpty}>
            できたことがここに残ります。カレンダーが空でも、行動した日は足跡として積み上がります。
          </div>
        ) : (
          <>
            <div style={styles.footprintTrail}>
              {recentFootprints.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  style={
                    item.date === selectedDate
                      ? styles.footprintBubbleActive
                      : styles.footprintBubble
                  }
                  onClick={() => selectDate(item.date)}
                  aria-label={`${item.title} ${item.date}`}
                >
                  <span style={styles.footprintEmoji}>{item.emoji}</span>
                  <span style={styles.footprintBubbleDate}>
                    {parseYMD(item.date).getDate()}
                  </span>
                </button>
              ))}
            </div>

            {topFootprints.length > 0 && (
              <div style={styles.footprintRanking}>
                {topFootprints.map((item) => (
                  <div key={item.title} style={styles.footprintRankChip}>
                    <span>{item.emoji}</span>
                    <span style={styles.footprintRankTitle}>{item.title}</span>
                    <span style={styles.footprintRankCount}>×{item.count}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={styles.selectedFootprintsBox}>
              <div style={styles.selectedFootprintsLabel}>
                {getDateLabel(selectedDate)} の足跡
              </div>

              {selectedFootprints.length === 0 ? (
                <div style={styles.selectedFootprintsEmpty}>
                  この日はまだ足跡がありません。
                </div>
              ) : (
                <div style={styles.selectedFootprintsList}>
                  {selectedFootprints.slice(0, 5).map((item) => (
                    <div key={item.id} style={styles.selectedFootprintItem}>
                      <span style={styles.selectedFootprintIcon}>{item.emoji}</span>
                      <span style={styles.selectedFootprintTitle}>{item.title}</span>
                      <span style={styles.selectedFootprintBadge}>
                        {item.must ? "予定" : "前進"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>

      <button
        type="button"
        style={styles.fab}
        onClick={openAddMenu}
        aria-label="予定追加"
      >
        ＋
      </button>

      {showAddMenu && (
        <div style={styles.drawerOverlay} onClick={() => setShowAddMenu(false)}>
          <section style={styles.addMenu} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHandle} />

            <div style={styles.drawerHeader}>
              <div>
                <div style={styles.drawerEyebrow}>ADD SCHEDULE</div>
                <h2 style={styles.drawerTitle}>予定を追加</h2>
              </div>
            </div>

            <button style={styles.addMenuCard} onClick={() => openQuickNew(selectedDate)}>
              <div style={styles.addMenuIcon}>📝</div>
              <div style={styles.addMenuText}>
                <div style={styles.addMenuTitle}>1日だけの予定を作る</div>
                <div style={styles.addMenuSub}>
                  日付・通知・メモだけで、さっと登録できます。
                </div>
              </div>
              <div style={styles.taskSelectArrow}>›</div>
            </button>

            <button style={styles.addMenuCard} onClick={openTaskDrawerFromMenu}>
              <div style={styles.addMenuIcon}>✅</div>
              <div style={styles.addMenuText}>
                <div style={styles.addMenuTitle}>既存タスクから選ぶ</div>
                <div style={styles.addMenuSub}>
                  目標に登録済みの小タスクを予定に配置できます。
                </div>
              </div>
              <div style={styles.taskSelectArrow}>›</div>
            </button>

            <button
              style={styles.addMenuGhost}
              onClick={() => {
                setShowAddMenu(false);
                openNewSchedule(parseYMD(selectedDate), undefined, selectedDate);
              }}
            >
              繰り返し予定を作る
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
              <div style={styles.drawerEmpty}>追加できる未完了タスクはありません</div>
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
          <section style={styles.quickModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.drawerHandle} />

            <div style={styles.quickHeader}>
              <button
                style={styles.closeButton}
                onClick={() => setQuickModal((prev) => ({ ...prev, open: false }))}
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

            <div style={styles.sectionLabel}>繰り返し</div>
            <div style={styles.repeatGrid}>
              {[
                { value: "none", label: "なし" },
                { value: "daily", label: "毎日" },
                { value: "weekly", label: "曜日指定" },
              ].map((option) => {
                const active = quickModal.repeatMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    style={active ? styles.repeatButtonActive : styles.repeatButton}
                    onClick={() =>
                      setQuickModal((prev) => {
                        const nextRepeatMode = option.value as QuickModalState["repeatMode"];
                        const nextWeekdays = [...prev.weekdays];

                        if (nextRepeatMode === "weekly" && !nextWeekdays.some(Boolean)) {
                          nextWeekdays[parseYMD(prev.date).getDay()] = true;
                        }

                        return {
                          ...prev,
                          repeatMode: nextRepeatMode,
                          weekdays:
                            nextRepeatMode === "daily"
                              ? [true, true, true, true, true, true, true]
                              : nextRepeatMode === "weekly"
                              ? nextWeekdays
                              : [false, false, false, false, false, false, false],
                          endDate:
                            nextRepeatMode === "none"
                              ? prev.date
                              : prev.endDate && ymdToNum(prev.endDate) >= ymdToNum(prev.date)
                              ? prev.endDate
                              : toYMD(addMonths(parseYMD(prev.date), 1)),
                        };
                      })
                    }
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {quickModal.repeatMode === "weekly" && (
              <div style={styles.weekdayGrid}>
                {["日", "月", "火", "水", "木", "金", "土"].map((label, index) => {
                  const active = quickModal.weekdays[index];

                  return (
                    <button
                      key={label}
                      type="button"
                      style={active ? styles.weekdayButtonActive : styles.weekdayButton}
                      onClick={() =>
                        setQuickModal((prev) => {
                          const next = [...prev.weekdays];
                          next[index] = !next[index];

                          return {
                            ...prev,
                            weekdays: next,
                          };
                        })
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {quickModal.repeatMode !== "none" && (
              <div style={styles.quickRow}>
                <div>
                  <div style={styles.formLabel}>終了日</div>
                  <input
                    style={styles.dateInput}
                    type="date"
                    value={quickModal.endDate}
                    min={quickModal.date}
                    onChange={(e) =>
                      setQuickModal((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}

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
                    style={active ? styles.reminderCardActive : styles.reminderCard}
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
              style={quickModal.must ? styles.mustToggleActive : styles.mustToggle}
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
              <div style={quickModal.must ? styles.mustPillActive : styles.mustPill}>
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
              ※カレンダーから登録した予定は最初からカレンダーに表示されます。任意タスクは完了後だけ二重線で表示されます。
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
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "38px 10px calc(82px + env(safe-area-inset-bottom))",
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
    marginBottom: 4,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 30,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.08em",
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
  todaySummary: {
    position: "relative",
    zIndex: 1,
    borderRadius: 24,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.06)",
    padding: "12px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  summaryLabel: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.16em",
  },
  summaryTitle: {
    marginTop: 4,
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  summaryCount: {
    width: 42,
    height: 42,
    borderRadius: 16,
    background: "rgba(116,224,93,0.16)",
    color: "#8df277",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    fontWeight: 950,
  },
  todayMiniList: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: 6,
    marginBottom: 8,
  },
  todayMiniItem: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.045)",
    color: "#fff",
    borderRadius: 16,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    textAlign: "left",
  },
  todayMiniText: {
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 11,
    fontWeight: 900,
  },
  todayMiniTime: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: 850,
  },
  monthCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 22px 42px rgba(0,0,0,0.20)",
    padding: 10,
    marginBottom: 0,
  },
  monthHeader: {
    display: "grid",
    gridTemplateColumns: "44px 1fr 44px",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  monthNavButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    fontSize: 30,
    fontWeight: 600,
    lineHeight: 1,
  },
  monthTitleButton: {
    border: "none",
    background: "transparent",
    color: "#fff",
    display: "grid",
    justifyItems: "center",
    gap: 1,
  },
  monthYear: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 11,
    fontWeight: 900,
  },
  monthTitle: {
    color: "#fff",
    fontSize: 27,
    fontWeight: 950,
    letterSpacing: "-0.07em",
    lineHeight: 1,
  },
  weekHeaderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 4,
    marginBottom: 4,
  },
  weekHeaderCell: {
    height: 21,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 950,
  },
  monthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
    gap: 5,
    gridTemplateRows: "repeat(6, 84px)",
  },
  monthCell: {
    height: 84,
    minHeight: 84,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.045)",
    background: "rgba(0,0,0,0.12)",
    color: "#fff",
    padding: "6px 4px",
    textAlign: "left",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  monthCellSelected: {
    border: "1px solid rgba(116,224,93,0.65)",
    background: "rgba(116,224,93,0.11)",
    boxShadow: "0 0 0 1px rgba(116,224,93,0.20) inset",
  },
  monthCellTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  monthDayNum: {
    minWidth: 21,
    height: 20,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.84)",
    fontSize: 11,
    fontWeight: 950,
  },
  monthDayToday: {
    background: "#74e05d",
    color: "#061007",
  },
  eventCount: {
    color: "#9df58d",
    fontSize: 10,
    fontWeight: 950,
  },
  monthEventList: {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    alignItems: "flex-start",
    minHeight: 0,
    overflow: "hidden",
  },
  monthEventChip: {
    width: "fit-content",
    maxWidth: "100%",
    height: 16,
    minHeight: 16,
    borderRadius: 5,
    border: "none",
    background: "rgba(116,224,93,0.22)",
    color: "#e9ffe5",
    padding: "0 5px",
    fontSize: 8.5,
    lineHeight: "16px",
    fontWeight: 950,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  monthEventChipDone: {
    // iOS WebView だと textDecorationStyle: "double" が効きにくいので、
    // 背景グラデーションで二重線を疑似的に描画する。
    opacity: 0.86,
    background:
      "linear-gradient(to bottom, transparent 42%, rgba(255,255,255,0.78) 42%, rgba(255,255,255,0.78) 48%, transparent 48%, transparent 56%, rgba(255,255,255,0.78) 56%, rgba(255,255,255,0.78) 62%, transparent 62%), rgba(116,224,93,0.16)",
    color: "rgba(233,255,229,0.82)",
  },
  moreText: {
    height: 15,
    color: "rgba(157,245,141,0.72)",
    fontSize: 8.5,
    fontWeight: 950,
    lineHeight: "15px",
  },
  todayScheduleCard: {
    position: "relative",
    zIndex: 1,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 18px 36px rgba(0,0,0,0.20)",
    padding: "14px 14px 16px",
  },
  todayScheduleHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  todayScheduleEyebrow: {
    color: "#72d85b",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 4,
  },
  todayScheduleTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 21,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  todayScheduleDateButton: {
    minHeight: 38,
    borderRadius: 999,
    border: "1px solid rgba(116,224,93,0.22)",
    background: "rgba(116,224,93,0.12)",
    color: "#9df58d",
    padding: "0 13px",
    fontSize: 12,
    fontWeight: 950,
  },
  todayScheduleSlider: {
    display: "flex",
    gap: 10,
    overflowX: "auto",
    padding: "2px 2px 4px",
    WebkitOverflowScrolling: "touch",
    scrollSnapType: "x mandatory",
  },
  todayScheduleSlide: {
    flex: "0 0 82%",
    maxWidth: 330,
    scrollSnapAlign: "start",
    borderRadius: 24,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.065)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  todayScheduleSlideDone: {
    flex: "0 0 82%",
    maxWidth: 330,
    scrollSnapAlign: "start",
    borderRadius: 24,
    background:
      "linear-gradient(180deg, rgba(116,224,93,0.16), rgba(255,255,255,0.045))",
    border: "1px solid rgba(116,224,93,0.18)",
    boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
    overflow: "hidden",
  },
  todayScheduleSlideMain: {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "14px 14px 10px",
    textAlign: "left",
  },
  todayScheduleIcon: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 16,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  todayScheduleTextBlock: {
    minWidth: 0,
    flex: 1,
  },
  todayScheduleTime: {
    color: "rgba(157,245,141,0.92)",
    fontSize: 11,
    fontWeight: 950,
    lineHeight: 1.25,
  },
  todayScheduleItemTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.3,
    marginTop: 3,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  todayScheduleMeta: {
    marginTop: 4,
    color: "rgba(255,255,255,0.48)",
    fontSize: 10.5,
    fontWeight: 850,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  todayScheduleMemo: {
    marginTop: 4,
    color: "rgba(255,255,255,0.44)",
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.35,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  todayScheduleActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    padding: "0 14px 14px",
  },
  todayScheduleCompleteButton: {
    minHeight: 40,
    border: "none",
    borderRadius: 14,
    background: "#74e05d",
    color: "#07110c",
    fontSize: 13,
    fontWeight: 950,
  },
  todayScheduleDoneButton: {
    minHeight: 40,
    border: "none",
    borderRadius: 14,
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    fontSize: 13,
    fontWeight: 950,
  },
  todayScheduleEditButton: {
    minHeight: 40,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  todayScheduleEmpty: {
    width: "100%",
    border: "1px solid rgba(255,255,255,0.055)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    color: "#fff",
    borderRadius: 22,
    padding: "14px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    textAlign: "left",
  },
  todayScheduleEmptyIcon: {
    width: 44,
    height: 44,
    minWidth: 44,
    borderRadius: 16,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },
  todayScheduleEmptyTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
  },
  todayScheduleEmptyText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  footprintCard: {
    position: "relative",
    zIndex: 1,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 28,
    background:
      "linear-gradient(180deg, rgba(116,224,93,0.10), rgba(255,255,255,0.045))",
    border: "1px solid rgba(116,224,93,0.12)",
    boxShadow: "0 18px 36px rgba(0,0,0,0.20)",
    padding: "14px 14px 16px",
  },
  footprintHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  footprintEyebrow: {
    color: "#72d85b",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 4,
  },
  footprintTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 21,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  footprintCount: {
    minWidth: 58,
    height: 42,
    borderRadius: 16,
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 2,
    padding: "0 10px",
    fontSize: 19,
    fontWeight: 950,
    boxSizing: "border-box",
  },
  footprintCountUnit: {
    color: "rgba(157,245,141,0.72)",
    fontSize: 10,
    fontWeight: 950,
  },
  footprintEmpty: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(0,0,0,0.16)",
    color: "rgba(255,255,255,0.58)",
    fontSize: 12,
    fontWeight: 850,
    lineHeight: 1.55,
  },
  footprintTrail: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    padding: "2px 2px 10px",
    WebkitOverflowScrolling: "touch",
  },
  footprintBubble: {
    width: 46,
    height: 54,
    minWidth: 46,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(0,0,0,0.18)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    gap: 0,
    padding: "6px 0",
    boxSizing: "border-box",
    boxShadow: "0 10px 18px rgba(0,0,0,0.12)",
  },
  footprintBubbleActive: {
    width: 46,
    height: 54,
    minWidth: 46,
    borderRadius: 18,
    border: "1px solid rgba(116,224,93,0.70)",
    background: "rgba(116,224,93,0.18)",
    color: "#fff",
    display: "grid",
    placeItems: "center",
    gap: 0,
    padding: "6px 0",
    boxSizing: "border-box",
    boxShadow: "0 0 0 1px rgba(116,224,93,0.22) inset",
  },
  footprintEmoji: {
    fontSize: 19,
    lineHeight: 1,
  },
  footprintBubbleDate: {
    color: "rgba(255,255,255,0.56)",
    fontSize: 10,
    fontWeight: 950,
    lineHeight: 1,
  },
  footprintRanking: {
    display: "flex",
    gap: 7,
    overflowX: "auto",
    paddingBottom: 10,
  },
  footprintRankChip: {
    flex: "0 0 auto",
    maxWidth: 150,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.07)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    padding: "7px 9px",
    display: "flex",
    alignItems: "center",
    gap: 5,
    fontSize: 11,
    fontWeight: 900,
  },
  footprintRankTitle: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  footprintRankCount: {
    color: "#9df58d",
    fontWeight: 950,
  },
  selectedFootprintsBox: {
    borderRadius: 20,
    background: "rgba(0,0,0,0.15)",
    border: "1px solid rgba(255,255,255,0.055)",
    padding: 12,
  },
  selectedFootprintsLabel: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
    fontWeight: 950,
    marginBottom: 8,
  },
  selectedFootprintsEmpty: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    fontWeight: 850,
  },
  selectedFootprintsList: {
    display: "grid",
    gap: 8,
  },
  selectedFootprintItem: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    minHeight: 38,
    borderRadius: 14,
    background: "rgba(255,255,255,0.055)",
    padding: "8px 10px",
    boxSizing: "border-box",
  },
  selectedFootprintIcon: {
    width: 25,
    height: 25,
    minWidth: 25,
    borderRadius: 10,
    background: "rgba(116,224,93,0.16)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
  },
  selectedFootprintTitle: {
    minWidth: 0,
    flex: 1,
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  selectedFootprintBadge: {
    flex: "0 0 auto",
    borderRadius: 999,
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    padding: "4px 7px",
    fontSize: 10,
    fontWeight: 950,
  },
  selectedPanel: {
    position: "relative",
    zIndex: 1,
    borderRadius: "30px 30px 0 0",
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
  dateTitle: {
    margin: "0 0 6px",
    color: "#fff",
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  subHeader: {
    display: "flex",
    gap: 12,
    color: "rgba(255,255,255,0.52)",
    fontSize: 14,
    fontWeight: 850,
  },
  smallAddButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    border: "none",
    background: "#74e05d",
    color: "#07110c",
    fontSize: 26,
    fontWeight: 900,
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
    fontSize: 11,
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
  reminderText: {
    marginTop: 4,
    color: "rgba(157,245,141,0.88)",
    fontSize: 11,
    fontWeight: 900,
  },
  memoText: {
    color: "rgba(255,255,255,0.48)",
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: 950,
  },
  donePill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(116,224,93,0.20)",
    color: "#9df58d",
    fontSize: 11,
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
    fontSize: 11,
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
  addMenuText: {
    minWidth: 0,
    flex: 1,
  },
  addMenuTitle: {
    color: "#111",
    fontWeight: 950,
    fontSize: 18,
    letterSpacing: "-0.04em",
  },
  addMenuSub: {
    marginTop: 4,
    color: "#777",
    fontSize: 11,
    fontWeight: 850,
    lineHeight: 1.45,
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
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
    fontSize: 11,
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
  quickRow: {
    display: "grid",
    gap: 12,
    marginBottom: 14,
  },
  formLabel: {
    color: "rgba(0,0,0,0.36)",
    fontSize: 11,
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
  timeRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
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
  repeatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  repeatButton: {
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    fontSize: 13,
    fontWeight: 950,
  },
  repeatButtonActive: {
    minHeight: 44,
    borderRadius: 16,
    border: "1px solid rgba(116,224,93,0.80)",
    background: "rgba(116,224,93,0.18)",
    color: "#111",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 0 0 1px rgba(116,224,93,0.30) inset",
  },
  weekdayGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 8,
    marginBottom: 12,
  },
  weekdayButton: {
    minHeight: 42,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontWeight: 950,
  },
  weekdayButtonActive: {
    minHeight: 42,
    borderRadius: 16,
    border: "1px solid rgba(116,224,93,0.80)",
    background: "rgba(116,224,93,0.18)",
    color: "#111",
    fontSize: 14,
    fontWeight: 950,
    boxShadow: "0 0 0 1px rgba(116,224,93,0.30) inset",
  },
  reminderGrid: {
    display: "grid",
    gap: 9,
  },
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
  reminderLabel: {
    color: "#111",
    fontSize: 15,
    fontWeight: 950,
  },
  reminderSub: {
    marginTop: 3,
    color: "#777",
    fontSize: 11,
    fontWeight: 800,
  },
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
  mustTitle: {
    color: "#111",
    fontSize: 15,
    fontWeight: 950,
  },
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
