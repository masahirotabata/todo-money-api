// // src/pages/AnalysisPage.tsx
// import { useEffect, useMemo, useState, type CSSProperties } from "react";
// import MoneyRainOverlay from "../components/MoneyRainOverlay";
// import type { ScheduleEvent } from "./Calender";

// type ScheduleHistoryItem = {
//   id: string;
//   scheduleId: string;
//   date: string;
//   doneAt: string;
//   title: string;
// };

// type ReviewAction = "keep" | "reduce" | "quit" | "later" | "completed";
// type ReviewState = Record<string, ReviewAction | boolean>;

// type LifeTag = {
//   id: string;
//   label: string;
//   statusName: string;
//   emoji: string;
//   custom?: boolean;
// };

// type GoalTagMap = Record<number, string>;

// type HiddenBalanceType =
//   | "skill"
//   | "recovery"
//   | "play"
//   | "connection"
//   | "life";

// type BalanceDiagnostic = {
//   type: HiddenBalanceType;
//   label: string;
//   emoji: string;
//   done: number;
//   scheduled: number;
//   rate: number;
// };

// type ReviewItem = {
//   schedule: ScheduleEvent;
//   lastDoneDate: string | null;
//   scheduledCount: number;
//   doneCount: number;
//   missedCount: number;
//   tag: LifeTag;
//   reason: string;
// };

// type TagDiagnostic = {
//   tag: LifeTag;
//   scheduled: number;
//   done: number;
//   rate: number;
// };

// type ReduceMode =
//   | "week3"
//   | "week1"
//   | "shorter"
//   | "noTime"
//   | "notificationOnly";

// type AnalysisMode = "action" | "investment";

// type InvestmentCategory =
//   | "qualification"
//   | "ai"
//   | "side_business"
//   | "health"
//   | "book"
//   | "family"
//   | "other";

// type InvestmentStatus = "continue" | "review" | "graduated";

// type InvestmentItem = {
//   id: string;
//   title: string;
//   amount: number;
//   category: InvestmentCategory;
//   date: string;
//   memo?: string;
//   result?: string;
//   status: InvestmentStatus;
// };

// type InvestmentFormState = {
//   title: string;
//   amount: string;
//   category: InvestmentCategory;
//   date: string;
//   memo: string;
//   result: string;
//   status: InvestmentStatus;
// };

// const INVESTMENT_CATEGORIES: Record<
//   InvestmentCategory,
//   { label: string; emoji: string; color: string }
// > = {
//   qualification: { label: "資格", emoji: "📚", color: "#9CF27F" },
//   ai: { label: "AI", emoji: "🤖", color: "#78A9FF" },
//   side_business: { label: "副業", emoji: "💰", color: "#F6C15C" },
//   health: { label: "健康", emoji: "💪", color: "#F68A8A" },
//   book: { label: "読書", emoji: "📖", color: "#BCA7FF" },
//   family: { label: "家族", emoji: "🏠", color: "#7FE7D9" },
//   other: { label: "その他", emoji: "🌿", color: "#D7DCE2" },
// };

// const INVESTMENT_STATUS_META: Record<
//   InvestmentStatus,
//   { label: string; emoji: string; color: string }
// > = {
//   continue: { label: "継続", emoji: "🔁", color: "#9CF27F" },
//   review: { label: "見直し", emoji: "🧭", color: "#F6A23C" },
//   graduated: { label: "卒業", emoji: "🎓", color: "#78A9FF" },
// };

// const REVIEW_LOOKBACK_DAYS = 14;
// const STALE_DAYS_THRESHOLD = 7;

// const DEFAULT_LIFE_TAGS: LifeTag[] = [
//   { id: "side_business", label: "副業", statusName: "副業力", emoji: "💰" },
//   { id: "health", label: "健康", statusName: "健康力", emoji: "💪" },
//   { id: "study", label: "学習", statusName: "学習力", emoji: "📚" },
//   { id: "output", label: "発信", statusName: "発信力", emoji: "📣" },
//   { id: "sleep", label: "睡眠", statusName: "睡眠力", emoji: "🌙" },
// ];

// const HIDDEN_TAG_TYPES: Record<string, HiddenBalanceType> = {
//   side_business: "skill",
//   study: "skill",
//   output: "skill",
//   health: "recovery",
//   sleep: "recovery",
// };

// const BALANCE_META: Record<
//   HiddenBalanceType,
//   { label: string; emoji: string }
// > = {
//   skill: { label: "スキル向上", emoji: "🔥" },
//   recovery: { label: "回復", emoji: "🌿" },
//   play: { label: "遊び", emoji: "🎮" },
//   connection: { label: "つながり", emoji: "🤝" },
//   life: { label: "生活", emoji: "🏠" },
// };

// function getCurrentUserKey() {
//   const savedUserKey = localStorage.getItem("todoMoneyUserKey");
//   if (savedUserKey) return savedUserKey;

//   const token = localStorage.getItem("todoMoneyToken");
//   if (!token) return "guest";

//   try {
//     const payload = JSON.parse(atob(token.split(".")[1]));
//     return String(
//       payload.email ?? payload.sub ?? payload.userId ?? payload.id ?? "user"
//     );
//   } catch {
//     return "user";
//   }
// }

// function scheduleKey() {
//   return `todo-money:schedules:v1:${getCurrentUserKey()}`;
// }

// function scheduleHistoryKey() {
//   return `todo-money:scheduleHistory:v1:${getCurrentUserKey()}`;
// }

// function reviewKey() {
//   return `todo-money:scheduleReview:v2:${getCurrentUserKey()}`;
// }

// function goalTagKey() {
//   return `todo-money:goalTags:v1:${getCurrentUserKey()}`;
// }

// function customTagKey() {
//   return `todo-money:customLifeTags:v1:${getCurrentUserKey()}`;
// }

// function investmentKey() {
//   return `todo-money:futureInvestments:v1:${getCurrentUserKey()}`;
// }

// function loadSchedules(): ScheduleEvent[] {
//   try {
//     const raw = localStorage.getItem(scheduleKey());
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// }

// function saveSchedules(list: ScheduleEvent[]) {
//   localStorage.setItem(scheduleKey(), JSON.stringify(list));
// }

// function loadHistory(): ScheduleHistoryItem[] {
//   try {
//     const raw = localStorage.getItem(scheduleHistoryKey());
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// }

// function saveHistory(list: ScheduleHistoryItem[]) {
//   localStorage.setItem(scheduleHistoryKey(), JSON.stringify(list));
// }

// function loadReviewState(): ReviewState {
//   try {
//     const raw = localStorage.getItem(reviewKey());
//     return raw ? JSON.parse(raw) : {};
//   } catch {
//     return {};
//   }
// }

// function saveReviewState(state: ReviewState) {
//   localStorage.setItem(reviewKey(), JSON.stringify(state));
// }

// function loadGoalTags(): GoalTagMap {
//   try {
//     const raw = localStorage.getItem(goalTagKey());
//     return raw ? JSON.parse(raw) : {};
//   } catch {
//     return {};
//   }
// }

// function loadCustomTags(): LifeTag[] {
//   try {
//     const raw = localStorage.getItem(customTagKey());
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// }

// function loadInvestments(): InvestmentItem[] {
//   try {
//     const raw = localStorage.getItem(investmentKey());
//     return raw ? JSON.parse(raw) : [];
//   } catch {
//     return [];
//   }
// }

// function saveInvestments(list: InvestmentItem[]) {
//   localStorage.setItem(investmentKey(), JSON.stringify(list));
// }

// function createEmptyInvestmentForm(date: string): InvestmentFormState {
//   return {
//     title: "",
//     amount: "",
//     category: "qualification",
//     date,
//     memo: "",
//     result: "",
//     status: "continue",
//   };
// }

// function formatYen(amount: number) {
//   return `¥${Math.max(0, Math.round(amount)).toLocaleString("ja-JP")}`;
// }

// function getYearMonth(ymd: string) {
//   return ymd.slice(0, 7);
// }

// function getMonthLabel(ym: string) {
//   const [y, m] = ym.split("-").map(Number);
//   return `${y}年${m}月`;
// }

// function clampPercent(n: number) {
//   return Math.max(0, Math.min(100, n));
// }

// function uid() {
//   return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
// }

// function pad2(n: number) {
//   return String(n).padStart(2, "0");
// }

// function toYMD(d: Date) {
//   return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// }

// function ymdToNum(ymd: string) {
//   const [y, m, d] = ymd.split("-").map(Number);
//   return y * 10000 + m * 100 + d;
// }

// function addDays(d: Date, days: number) {
//   const x = new Date(d);
//   x.setDate(x.getDate() + days);
//   return x;
// }

// function occursOnDate(ev: ScheduleEvent, dateStr: string) {
//   if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
//     return ev.startDate === dateStr;
//   }

//   if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
//   if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

//   const d = new Date(dateStr);
//   return !!ev.weekdays[d.getDay()];
// }

// function makeWeeklyDates() {
//   const today = new Date();
//   return Array.from({ length: 7 }, (_, i) => toYMD(addDays(today, -6 + i)));
// }

// function makeDateRange(days: number) {
//   const today = new Date();
//   return Array.from({ length: days }, (_, i) =>
//     toYMD(addDays(today, -(days - 1) + i))
//   );
// }

// function reviewId(scheduleId: string) {
//   return `${scheduleId}:monthly-review`;
// }

// function isReviewed(value: ReviewState[string]) {
//   return (
//     value === true ||
//     value === "keep" ||
//     value === "reduce" ||
//     value === "quit" ||
//     value === "later" ||
//     value === "completed"
//   );
// }

// function getTagForSchedule(
//   ev: ScheduleEvent,
//   goalTags: GoalTagMap,
//   allTags: LifeTag[]
// ) {
//   const goalId = ev.taskRef?.goalId;
//   const tagId =
//     goalId != null ? goalTags[goalId] : ev.tags?.[0] ?? "side_business";

//   return (
//     allTags.find((t) => t.id === tagId) ?? allTags[0] ?? DEFAULT_LIFE_TAGS[0]
//   );
// }

// function getHiddenType(tag: LifeTag): HiddenBalanceType {
//   if (HIDDEN_TAG_TYPES[tag.id]) return HIDDEN_TAG_TYPES[tag.id];

//   const text = `${tag.label}${tag.statusName}`.toLowerCase();

//   if (
//     text.includes("休") ||
//     text.includes("睡眠") ||
//     text.includes("健康") ||
//     text.includes("回復") ||
//     text.includes("散歩") ||
//     text.includes("筋トレ")
//   ) {
//     return "recovery";
//   }

//   if (
//     text.includes("遊") ||
//     text.includes("エモ") ||
//     text.includes("趣味") ||
//     text.includes("旅行") ||
//     text.includes("ゲーム")
//   ) {
//     return "play";
//   }

//   if (
//     text.includes("家族") ||
//     text.includes("友") ||
//     text.includes("人間") ||
//     text.includes("交流")
//   ) {
//     return "connection";
//   }

//   if (
//     text.includes("勉強") ||
//     text.includes("学習") ||
//     text.includes("副業") ||
//     text.includes("発信") ||
//     text.includes("仕事") ||
//     text.includes("開発")
//   ) {
//     return "skill";
//   }

//   return tag.custom ? "life" : "skill";
// }

// function findLastDoneDate(ev: ScheduleEvent) {
//   const dates = ev.completedDates ?? [];
//   if (dates.length === 0) return null;
//   return dates.slice().sort((a, b) => ymdToNum(b) - ymdToNum(a))[0] ?? null;
// }

// function daysSinceYmd(ymd: string | null) {
//   if (!ymd) return 999;

//   const today = new Date();
//   const [y, m, d] = ymd.split("-").map(Number);
//   const target = new Date(y, m - 1, d);

//   return Math.floor(
//     (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
//   );
// }

// function buildDiagnosisComment(tagStats: TagDiagnostic[]) {
//   if (tagStats.length === 0) {
//     return {
//       title: "まずは行動データを育てましょう",
//       body: "予定を登録して完了すると、タグ別の得意・不足が見えるようになります。",
//       tip: "おすすめ：今日できる5分行動を1つだけ登録してみましょう。",
//     };
//   }

//   const sortedByDone = tagStats.slice().sort((a, b) => b.done - a.done);
//   const best = sortedByDone[0];
//   const weak = tagStats
//     .filter((x) => x.scheduled > 0)
//     .sort((a, b) => a.rate - b.rate)[0];

//   if (
//     best &&
//     best.done > 0 &&
//     weak &&
//     weak.rate < 50 &&
//     weak.tag.id !== best.tag.id
//   ) {
//     return {
//       title: `${best.tag.statusName}がよく伸びています`,
//       body: `${best.tag.emoji}${best.tag.statusName}は今週かなり動けています。一方で、${weak.tag.emoji}${weak.tag.statusName}は少し止まり気味です。`,
//       tip: `${weak.tag.label}系の行動は、いったん小さくして続けやすい形に変えるのがおすすめです。`,
//     };
//   }

//   if (best && best.done > 0) {
//     return {
//       title: `${best.tag.statusName}が良い流れです`,
//       body: `今週は${best.tag.emoji}${best.tag.statusName}の行動が一番多く完了しています。この調子で、来週も同じ方向を少しだけ積むと強いです。`,
//       tip: "おすすめ：続いている行動は削らず、予定の時間帯だけ整えてみましょう。",
//     };
//   }

//   return {
//     title: "行動の整理タイミングです",
//     body: "今週はまだ完了データが少なめです。できなかった行動を責めるより、来週続けやすい形に整えましょう。",
//     tip: "おすすめ：続かない行動は“やめる”より先に“減らす”を試すと、習慣が残りやすいです。",
//   };
// }

// function applyReduceMode(ev: ScheduleEvent, mode: ReduceMode): ScheduleEvent {
//   const next: ScheduleEvent = { ...ev };

//   if (mode === "week3") {
//     next.weekdays = [false, true, false, true, false, true, false];
//     next.oneShot = false;
//     return next;
//   }

//   if (mode === "week1") {
//     next.weekdays = [false, false, false, false, false, false, true];
//     next.oneShot = false;
//     return next;
//   }

//   if (mode === "noTime") {
//     next.startTime = "";
//     next.endTime = "";
//     return next;
//   }

//   if (mode === "notificationOnly") {
//     next.startTime = "";
//     next.endTime = "";
//     next.memo = [next.memo, "棚卸し：通知・メモだけ残す形に軽量化"]
//       .filter(Boolean)
//       .join("\n");
//     return next;
//   }

//   if (mode === "shorter") {
//     const memoLine = "棚卸し：時間を短くして続ける";
//     next.memo = next.memo ? `${next.memo}\n${memoLine}` : memoLine;

//     if (next.startTime && next.endTime) {
//       const [sh, sm] = next.startTime.split(":").map(Number);
//       const start = new Date();
//       start.setHours(sh || 0, sm || 0, 0, 0);
//       const end = new Date(start.getTime() + 10 * 60 * 1000);
//       next.endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
//     }

//     return next;
//   }

//   return next;
// }

// export default function AnalysisPage() {
//   const [schedules, setSchedules] = useState<ScheduleEvent[]>(() =>
//     loadSchedules()
//   );
//   const [history, setHistory] = useState<ScheduleHistoryItem[]>(() =>
//     loadHistory()
//   );
//   const [reviewState, setReviewState] = useState<ReviewState>(() =>
//     loadReviewState()
//   );
//   const [goalTags, setGoalTags] = useState<GoalTagMap>(() => loadGoalTags());
//   const [customTags, setCustomTags] = useState<LifeTag[]>(() =>
//     loadCustomTags()
//   );

//   const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("action");
//   const [investments, setInvestments] = useState<InvestmentItem[]>(() =>
//     loadInvestments()
//   );
//   const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
//   const [editingInvestmentId, setEditingInvestmentId] = useState<string | null>(
//     null
//   );
//   const [investmentForm, setInvestmentForm] = useState<InvestmentFormState>(() =>
//     createEmptyInvestmentForm(toYMD(new Date()))
//   );

//   const [reviewIndex, setReviewIndex] = useState(0);
//   const [showAdMock, setShowAdMock] = useState(false);
//   const [rainSeed, setRainSeed] = useState(0);
//   const [touchX, setTouchX] = useState<number | null>(null);
//   const [reduceTarget, setReduceTarget] = useState<ReviewItem | null>(null);

//   const allTags = useMemo(
//     () => [...DEFAULT_LIFE_TAGS, ...customTags],
//     [customTags]
//   );

//   function refreshFromStorage() {
//     setSchedules(loadSchedules());
//     setHistory(loadHistory());
//     setReviewState(loadReviewState());
//     setGoalTags(loadGoalTags());
//     setCustomTags(loadCustomTags());
//     setInvestments(loadInvestments());
//   }

//   useEffect(() => {
//     refreshFromStorage();

//     const onFocus = () => refreshFromStorage();
//     const onVisible = () => {
//       if (!document.hidden) refreshFromStorage();
//     };

//     window.addEventListener("focus", onFocus);
//     window.addEventListener("pageshow", onFocus);
//     document.addEventListener("visibilitychange", onVisible);

//     return () => {
//       window.removeEventListener("focus", onFocus);
//       window.removeEventListener("pageshow", onFocus);
//       document.removeEventListener("visibilitychange", onVisible);
//     };
//   }, []);

//   useEffect(() => {
//     saveSchedules(schedules);
//   }, [schedules]);

//   useEffect(() => {
//     saveHistory(history);
//   }, [history]);

//   useEffect(() => {
//     saveReviewState(reviewState);
//   }, [reviewState]);

//   useEffect(() => {
//     saveInvestments(investments);
//   }, [investments]);

//   const currentMonth = useMemo(() => toYMD(new Date()).slice(0, 7), []);

//   const monthlyInvestments = useMemo(() => {
//     return investments
//       .filter((item) => getYearMonth(item.date) === currentMonth)
//       .sort((a, b) => ymdToNum(b.date) - ymdToNum(a.date));
//   }, [investments, currentMonth]);

//   const investmentTotal = useMemo(
//     () => monthlyInvestments.reduce((sum, item) => sum + item.amount, 0),
//     [monthlyInvestments]
//   );

//   const investmentCategoryStats = useMemo(() => {
//     const map: Record<
//       InvestmentCategory,
//       { category: InvestmentCategory; amount: number; count: number }
//     > = {
//       qualification: { category: "qualification", amount: 0, count: 0 },
//       ai: { category: "ai", amount: 0, count: 0 },
//       side_business: { category: "side_business", amount: 0, count: 0 },
//       health: { category: "health", amount: 0, count: 0 },
//       book: { category: "book", amount: 0, count: 0 },
//       family: { category: "family", amount: 0, count: 0 },
//       other: { category: "other", amount: 0, count: 0 },
//     };

//     for (const item of monthlyInvestments) {
//       map[item.category].amount += item.amount;
//       map[item.category].count += 1;
//     }

//     return Object.values(map)
//       .filter((item) => item.amount > 0)
//       .sort((a, b) => b.amount - a.amount);
//   }, [monthlyInvestments]);

//   const investmentStatusStats = useMemo(() => {
//     const base: Record<InvestmentStatus, number> = {
//       continue: 0,
//       review: 0,
//       graduated: 0,
//     };

//     for (const item of monthlyInvestments) {
//       base[item.status] += item.amount;
//     }

//     return base;
//   }, [monthlyInvestments]);

//   const investmentDonut = useMemo(() => {
//     if (investmentTotal <= 0 || investmentCategoryStats.length === 0) {
//       return "conic-gradient(rgba(255,255,255,0.12) 0deg 360deg)";
//     }

//     let current = 0;
//     const parts = investmentCategoryStats.map((item) => {
//       const meta = INVESTMENT_CATEGORIES[item.category];
//       const start = current;
//       const deg = (item.amount / investmentTotal) * 360;
//       current += deg;
//       return `${meta.color} ${start}deg ${current}deg`;
//     });

//     return `conic-gradient(${parts.join(", ")})`;
//   }, [investmentCategoryStats, investmentTotal]);

//   const investmentComment = useMemo(() => {
//     if (monthlyInvestments.length === 0) {
//       return {
//         title: "未来投資を記録してみましょう",
//         body: "資格・AI・副業・健康など、未来につながる支出を登録すると、どこに投資しているか見えるようになります。",
//         tip: "おすすめ：ChatGPT、参考書、Udemy、ジム代などから1つ登録してみましょう。",
//       };
//     }

//     const top = investmentCategoryStats[0];
//     const reviewAmount = investmentStatusStats.review;
//     const graduatedAmount = investmentStatusStats.graduated;

//     if (top && graduatedAmount > 0) {
//       const meta = INVESTMENT_CATEGORIES[top.category];
//       return {
//         title: `${meta.label}への投資が中心です`,
//         body: `今月は${meta.emoji}${meta.label}への投資が最も多くなっています。成果が出た投資も記録されているので、支出ではなく回収につながる行動として整理できています。`,
//         tip: "成果が出た投資は「卒業」にして、次に伸ばしたい分野へ少しずつ移すと良さそうです。",
//       };
//     }

//     if (reviewAmount > 0) {
//       return {
//         title: "見直し候補があります",
//         body: `今月は${formatYen(reviewAmount)}分の投資が見直し候補になっています。いきなり削るより、使っていない教材やサービスから整理すると効果が出やすいです。`,
//         tip: "おすすめ：成果メモが空欄の投資を1つだけ見直してみましょう。",
//       };
//     }

//     const topMeta = top ? INVESTMENT_CATEGORIES[top.category] : null;

//     return {
//       title: topMeta
//         ? `${topMeta.label}への未来投資が伸びています`
//         : "未来投資が記録されています",
//       body: topMeta
//         ? `今月は${topMeta.emoji}${topMeta.label}への投資が一番多いです。金額だけでなく、成果メモを残すことで、あとから継続・見直し・卒業を判断しやすくなります。`
//         : "未来につながる支出を記録できています。",
//       tip: "おすすめ：投資した理由と、得られた成果を一言だけ残しておきましょう。",
//     };
//   }, [monthlyInvestments, investmentCategoryStats, investmentStatusStats]);

//   const weeklyDates = useMemo(() => makeWeeklyDates(), []);

//   const weeklyStats = useMemo(() => {
//     const tagMap: Record<
//       string,
//       { tag: LifeTag; scheduled: number; done: number }
//     > = {};

//     let scheduledTotal = 0;
//     let completedTotal = 0;

//     for (const ev of schedules) {
//       const tag = getTagForSchedule(ev, goalTags, allTags);

//       if (!tagMap[tag.id]) {
//         tagMap[tag.id] = { tag, scheduled: 0, done: 0 };
//       }

//       for (const date of weeklyDates) {
//         if (!occursOnDate(ev, date)) continue;

//         scheduledTotal++;
//         tagMap[tag.id].scheduled++;

//         if (ev.completedDates?.includes(date)) {
//           completedTotal++;
//           tagMap[tag.id].done++;
//         }
//       }
//     }

//     const tagStats = Object.values(tagMap).sort((a, b) => b.done - a.done);

//     return {
//       scheduledTotal,
//       completedTotal,
//       completionRate:
//         scheduledTotal === 0
//           ? 0
//           : Math.round((completedTotal / scheduledTotal) * 100),
//       tagStats,
//     };
//   }, [schedules, goalTags, allTags, weeklyDates]);

//   const balanceStats = useMemo<BalanceDiagnostic[]>(() => {
//     const base: Record<HiddenBalanceType, BalanceDiagnostic> = {
//       skill: {
//         type: "skill",
//         label: BALANCE_META.skill.label,
//         emoji: BALANCE_META.skill.emoji,
//         scheduled: 0,
//         done: 0,
//         rate: 0,
//       },
//       recovery: {
//         type: "recovery",
//         label: BALANCE_META.recovery.label,
//         emoji: BALANCE_META.recovery.emoji,
//         scheduled: 0,
//         done: 0,
//         rate: 0,
//       },
//       play: {
//         type: "play",
//         label: BALANCE_META.play.label,
//         emoji: BALANCE_META.play.emoji,
//         scheduled: 0,
//         done: 0,
//         rate: 0,
//       },
//       connection: {
//         type: "connection",
//         label: BALANCE_META.connection.label,
//         emoji: BALANCE_META.connection.emoji,
//         scheduled: 0,
//         done: 0,
//         rate: 0,
//       },
//       life: {
//         type: "life",
//         label: BALANCE_META.life.label,
//         emoji: BALANCE_META.life.emoji,
//         scheduled: 0,
//         done: 0,
//         rate: 0,
//       },
//     };

//     for (const ev of schedules) {
//       const tag = getTagForSchedule(ev, goalTags, allTags);
//       const type = getHiddenType(tag);

//       for (const date of weeklyDates) {
//         if (!occursOnDate(ev, date)) continue;

//         base[type].scheduled++;

//         if (ev.completedDates?.includes(date)) {
//           base[type].done++;
//         }
//       }
//     }

//     const totalDone = Object.values(base).reduce((sum, x) => sum + x.done, 0);

//     return Object.values(base)
//       .map((x) => ({
//         ...x,
//         rate: totalDone === 0 ? 0 : Math.round((x.done / totalDone) * 100),
//       }))
//       .filter((x) => x.scheduled > 0 || x.done > 0)
//       .sort((a, b) => b.done - a.done);
//   }, [schedules, goalTags, allTags, weeklyDates]);

//   const streakDays = useMemo(() => {
//     let streak = 0;
//     const today = new Date();

//     for (let i = 0; i < 365; i++) {
//       const dateStr = toYMD(addDays(today, -i));
//       const daySchedules = schedules.filter((ev) => occursOnDate(ev, dateStr));

//       if (daySchedules.length === 0) continue;

//       const completed = daySchedules.some((ev) =>
//         ev.completedDates?.includes(dateStr)
//       );

//       if (completed) {
//         streak++;
//       } else {
//         break;
//       }
//     }

//     return streak;
//   }, [schedules]);

//   const reviewItems = useMemo<ReviewItem[]>(() => {
//     const dates = makeDateRange(REVIEW_LOOKBACK_DAYS);

//     return schedules
//       .map((ev) => {
//         const scheduledDates = dates.filter((date) => occursOnDate(ev, date));
//         const doneDates = scheduledDates.filter((date) =>
//           ev.completedDates?.includes(date)
//         );
//         const missedCount = scheduledDates.length - doneDates.length;
//         const lastDoneDate = findLastDoneDate(ev);
//         const daysSinceDone = daysSinceYmd(lastDoneDate);
//         const reviewed = isReviewed(reviewState[reviewId(ev.id)]);
//         const tag = getTagForSchedule(ev, goalTags, allTags);

//         if (reviewed) return null;
//         if (scheduledDates.length === 0) return null;

//         const shouldReview =
//           daysSinceDone >= STALE_DAYS_THRESHOLD ||
//           missedCount >= Math.min(STALE_DAYS_THRESHOLD, scheduledDates.length);

//         if (!shouldReview) return null;

//         const reason =
//           lastDoneDate == null
//             ? "まだ完了記録がありません"
//             : `${daysSinceDone}日ほど止まっています`;

//         return {
//           schedule: ev,
//           lastDoneDate,
//           scheduledCount: scheduledDates.length,
//           doneCount: doneDates.length,
//           missedCount,
//           tag,
//           reason,
//         };
//       })
//       .filter(Boolean) as ReviewItem[];
//   }, [schedules, reviewState, goalTags, allTags]);

//   const currentItem = reviewItems[reviewIndex];

//   const tagDiagnostics = useMemo<TagDiagnostic[]>(() => {
//     const dates = makeDateRange(7);
//     const map: Record<string, TagDiagnostic> = {};

//     for (const ev of schedules) {
//       const tag = getTagForSchedule(ev, goalTags, allTags);

//       if (!map[tag.id]) {
//         map[tag.id] = {
//           tag,
//           scheduled: 0,
//           done: 0,
//           rate: 0,
//         };
//       }

//       for (const date of dates) {
//         if (!occursOnDate(ev, date)) continue;

//         map[tag.id].scheduled++;

//         if (ev.completedDates?.includes(date)) {
//           map[tag.id].done++;
//         }
//       }
//     }

//     return Object.values(map)
//       .map((x) => ({
//         ...x,
//         rate:
//           x.scheduled === 0 ? 0 : Math.round((x.done / x.scheduled) * 100),
//       }))
//       .sort((a, b) => b.done - a.done);
//   }, [schedules, goalTags, allTags]);

//   const diagnosis = useMemo(
//     () => buildDiagnosisComment(tagDiagnostics),
//     [tagDiagnostics]
//   );

//   function completeScheduleToday(ev: ScheduleEvent) {
//     const todayYmd = toYMD(new Date());

//     setSchedules((prev) => {
//       const next = prev.map((x) => {
//         if (x.id !== ev.id) return x;

//         const prevDates = x.completedDates ?? [];
//         const nextDates = prevDates.includes(todayYmd)
//           ? prevDates
//           : [...prevDates, todayYmd];

//         return { ...x, completedDates: nextDates };
//       });

//       saveSchedules(next);
//       return next;
//     });

//     setHistory((prev) => {
//       const exists = prev.some(
//         (h) => h.scheduleId === ev.id && h.date === todayYmd
//       );
//       if (exists) return prev;

//       const next = [
//         ...prev,
//         {
//           id: uid(),
//           scheduleId: ev.id,
//           date: todayYmd,
//           doneAt: new Date().toISOString(),
//           title: ev.title,
//         },
//       ];

//       saveHistory(next);
//       return next;
//     });

//     setRainSeed(Date.now());
//   }

//   function moveNext() {
//     const nextIndex = reviewIndex + 1;

//     if (nextIndex >= reviewItems.length) {
//       setReviewIndex(0);
//       setShowAdMock(true);
//     } else {
//       setReviewIndex(nextIndex);
//     }
//   }

//   function saveReviewAction(scheduleId: string, action: ReviewAction) {
//     setReviewState((prev) => {
//       const next = {
//         ...prev,
//         [reviewId(scheduleId)]: action,
//       };
//       saveReviewState(next);
//       return next;
//     });
//   }

//   function markReviewed(item: ReviewItem, action: ReviewAction) {
//     if (action === "completed") {
//       completeScheduleToday(item.schedule);
//     }

//     if (action === "quit") {
//       if (!confirm(`「${item.schedule.title}」を行動から削除しますか？`)) {
//         return;
//       }

//       setSchedules((prev) => {
//         const next = prev.filter((x) => x.id !== item.schedule.id);
//         saveSchedules(next);
//         return next;
//       });
//     }

//     saveReviewAction(item.schedule.id, action);
//     moveNext();
//   }

//   function openReduceSheet(item: ReviewItem) {
//     setReduceTarget(item);
//   }

//   function applyReduce(item: ReviewItem, mode: ReduceMode) {
//     setSchedules((prev) => {
//       const next = prev.map((x) =>
//         x.id === item.schedule.id ? applyReduceMode(x, mode) : x
//       );
//       saveSchedules(next);
//       return next;
//     });

//     saveReviewAction(item.schedule.id, "reduce");
//     setReduceTarget(null);
//     moveNext();
//   }

//   function resetReviews() {
//     if (!confirm("直近の棚卸し履歴をリセットしますか？")) return;
//     setReviewState({});
//     saveReviewState({});
//     setReviewIndex(0);
//   }

//   function openNewInvestmentModal() {
//     setEditingInvestmentId(null);
//     setInvestmentForm(createEmptyInvestmentForm(toYMD(new Date())));
//     setInvestmentModalOpen(true);
//   }

//   function openEditInvestmentModal(item: InvestmentItem) {
//     setEditingInvestmentId(item.id);
//     setInvestmentForm({
//       title: item.title,
//       amount: String(item.amount),
//       category: item.category,
//       date: item.date,
//       memo: item.memo ?? "",
//       result: item.result ?? "",
//       status: item.status,
//     });
//     setInvestmentModalOpen(true);
//   }

//   function closeInvestmentModal() {
//     setInvestmentModalOpen(false);
//     setEditingInvestmentId(null);
//   }

//   function saveInvestment() {
//     const title = investmentForm.title.trim();
//     const amount = Number(investmentForm.amount);

//     if (!title) {
//       alert("投資内容を入力してください");
//       return;
//     }

//     if (!Number.isFinite(amount) || amount <= 0) {
//       alert("金額を入力してください");
//       return;
//     }

//     const item: InvestmentItem = {
//       id: editingInvestmentId ?? uid(),
//       title,
//       amount: Math.round(amount),
//       category: investmentForm.category,
//       date: investmentForm.date || toYMD(new Date()),
//       memo: investmentForm.memo.trim(),
//       result: investmentForm.result.trim(),
//       status: investmentForm.status,
//     };

//     setInvestments((prev) => {
//       const next = editingInvestmentId
//         ? prev.map((x) => (x.id === editingInvestmentId ? item : x))
//         : [item, ...prev];

//       saveInvestments(next);
//       return next;
//     });

//     closeInvestmentModal();
//   }

//   function deleteInvestment(id: string) {
//     if (!confirm("この自己投資の記録を削除しますか？")) return;

//     setInvestments((prev) => {
//       const next = prev.filter((x) => x.id !== id);
//       saveInvestments(next);
//       return next;
//     });

//     closeInvestmentModal();
//   }

//   return (
//     <div style={styles.page}>
//       <MoneyRainOverlay seed={rainSeed} />
//       <div style={styles.backgroundGlow} />

//       <header style={styles.header}>
//         <div>
//           <div style={styles.pageKicker}>TaskMoney</div>
//           <h1 style={styles.pageTitle}>Insights</h1>
//         </div>

//         <button style={styles.backButton} onClick={resetReviews}>
//           ↩
//         </button>
//       </header>

//       <section style={styles.segmentWrap}>
//         <button
//           style={analysisMode === "action" ? styles.segmentActive : styles.segmentButton}
//           onClick={() => setAnalysisMode("action")}
//         >
//           行動分析
//         </button>
//         <button
//           style={analysisMode === "investment" ? styles.segmentActive : styles.segmentButton}
//           onClick={() => setAnalysisMode("investment")}
//         >
//           自己投資
//         </button>
//       </section>

//       {analysisMode === "action" && (
//         <>

//       <section style={styles.balanceCard}>
//         <div style={styles.balanceTop}>
//           <div>
//             <div style={styles.balanceTitle}>今週のバランス</div>
//             <div style={styles.balanceSub}>
//               回復を増やすと、より良いバランスになります。
//             </div>
//           </div>

//           <div style={styles.adjustBadge}>調整中</div>
//         </div>

//         <div style={styles.balanceList}>
//           {balanceStats.length === 0 ? (
//             <div style={styles.emptyText}>
//               カレンダーに行動を登録すると、今週のバランスが表示されます。
//             </div>
//           ) : (
//             balanceStats.slice(0, 3).map((item, index) => {
//               const colors = ["#9CF27F", "#F6A23C", "#78A9FF"];

//               return (
//                 <div key={item.type} style={styles.balanceItem}>
//                   <div style={styles.balanceRow}>
//                     <span style={styles.balanceName}>
//                       {item.emoji} {item.label}
//                     </span>
//                     <span style={styles.balanceRate}>{item.rate}%</span>
//                   </div>

//                   <div style={styles.balanceBar}>
//                     <div
//                       style={{
//                         ...styles.balanceFill,
//                         width: `${item.rate}%`,
//                         background: colors[index] ?? "#9CF27F",
//                       }}
//                     />
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>
//       </section>

//       <section style={styles.summarySection}>
//         <h2 style={styles.sectionTitle}>今週のサマリー</h2>

//         <div style={styles.summaryGrid}>
//           <div style={styles.summaryCard}>
//             <div style={styles.summaryLabel}>完了した行動</div>
//             <div style={styles.summaryValue}>
//               {weeklyStats.completedTotal}件
//             </div>
//           </div>

//           <div style={styles.summaryCard}>
//             <div style={styles.summaryLabel}>達成率</div>
//             <div style={styles.summaryValue}>
//               {weeklyStats.completionRate}%
//             </div>
//           </div>

//           <div style={styles.summaryCard}>
//             <div style={styles.summaryLabel}>連続記録</div>
//             <div style={styles.summaryValue}>{streakDays}日</div>
//           </div>
//         </div>
//       </section>

//       <section style={styles.lifeStatusSection}>
//         <h2 style={styles.sectionTitle}>人生ステータス</h2>

//         {weeklyStats.tagStats.length === 0 ? (
//           <div style={styles.emptyCard}>
//             <div style={styles.emptyIcon}>🌱</div>
//             <h2 style={styles.emptyTitle}>まだステータスはありません</h2>
//             <p style={styles.emptyText}>
//               目標にタグを付けて、カレンダーの予定を完了するとステータスが育ちます。
//             </p>
//           </div>
//         ) : (
//           <div style={styles.lifeStatusList}>
//             {weeklyStats.tagStats.map((item) => {
//               const rate =
//                 item.scheduled === 0
//                   ? 0
//                   : Math.round((item.done / item.scheduled) * 100);

//               return (
//                 <div key={item.tag.id} style={styles.lifeStatusRow}>
//                   <div style={styles.lifeStatusLeft}>
//                     <span style={styles.lifeStatusEmoji}>{item.tag.emoji}</span>

//                     <div>
//                       <div style={styles.lifeStatusName}>
//                         {item.tag.statusName} Lv2
//                       </div>

//                       <div style={styles.lifeStatusSub}>
//                         {item.done}/{item.scheduled}日 • {rate}%
//                       </div>
//                     </div>
//                   </div>

//                   <div style={styles.lifeStatusRight}>{rate}%</div>
//                 </div>
//               );
//             })}
//           </div>
//         )}
//       </section>

//       <section style={styles.aiCard}>
//         <div style={styles.aiLabel}>🌿 AI REVIEW</div>
//         <h2 style={styles.aiTitle}>{diagnosis.title}</h2>
//         <p style={styles.aiBody}>{diagnosis.body}</p>
//         <div style={styles.aiTip}>{diagnosis.tip}</div>
//       </section>

//       {reviewItems.length === 0 || !currentItem ? (
//         <section style={styles.emptyCard}>
//           <div style={styles.emptyIcon}>✨</div>
//           <h2 style={styles.emptyTitle}>棚卸し対象はありません</h2>
//           <p style={styles.emptyText}>
//             7日以上止まっている行動が出たら、ここで続ける・減らす・やめるを整理できます。
//           </p>

//           <button style={styles.subButton} onClick={resetReviews}>
//             棚卸し履歴をリセット
//           </button>
//         </section>
//       ) : (
//         <section
//           style={styles.reviewCard}
//           onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
//           onTouchEnd={(e) => {
//             if (touchX == null) return;
//             const diff = e.changedTouches[0].clientX - touchX;
//             setTouchX(null);

//             if (diff > 60) {
//               markReviewed(currentItem, "keep");
//             } else if (diff < -60) {
//               markReviewed(currentItem, "quit");
//             }
//           }}
//         >
//           <div style={styles.counter}>
//             {reviewIndex + 1}/{reviewItems.length}
//           </div>

//           <h2 style={styles.reviewTitle}>この行動、来週どうする？</h2>
//           <p style={styles.reviewSub}>
//             右スワイプで続ける / 左スワイプでやめる
//           </p>

//           <div style={styles.taskCard}>
//             <div style={styles.tagPill}>
//               {currentItem.tag.emoji} {currentItem.tag.statusName}
//             </div>

//             <div style={styles.taskTitle}>{currentItem.schedule.title}</div>

//             <div style={styles.reasonText}>{currentItem.reason}</div>

//             <div style={styles.taskMemo}>
//               直近{REVIEW_LOOKBACK_DAYS}日：{currentItem.doneCount}/
//               {currentItem.scheduledCount}回 完了
//             </div>

//             {currentItem.schedule.memo && (
//               <div style={styles.memoText}>{currentItem.schedule.memo}</div>
//             )}
//           </div>

//           <div style={styles.actionGrid}>
//             <button
//               onClick={() => markReviewed(currentItem, "quit")}
//               style={styles.dangerButton}
//             >
//               やめる
//             </button>

//             <button
//               onClick={() => openReduceSheet(currentItem)}
//               style={styles.lightButton}
//             >
//               減らす
//             </button>

//             <button
//               onClick={() => markReviewed(currentItem, "later")}
//               style={styles.lightButton}
//             >
//               あとで
//             </button>

//             <button
//               onClick={() => markReviewed(currentItem, "keep")}
//               style={styles.keepButton}
//             >
//               続ける
//             </button>
//           </div>
//         </section>
//       )}

//       <section style={styles.statusCard}>
//         <div style={styles.sectionHead}>
//           <h2 style={styles.sectionTitle}>タグ別の完了率</h2>
//           <div style={styles.sectionCount}>{tagDiagnostics.length}件</div>
//         </div>

//         {tagDiagnostics.length === 0 ? (
//           <div style={styles.emptyText}>
//             カレンダーに行動を登録すると、タグごとの完了率が表示されます。
//           </div>
//         ) : (
//           <div style={styles.statusList}>
//             {tagDiagnostics.map((item) => (
//               <div key={item.tag.id} style={styles.statusRow}>
//                 <div style={styles.statusTop}>
//                   <div style={styles.statusName}>
//                     {item.tag.emoji} {item.tag.statusName}
//                   </div>
//                   <div style={styles.statusCount}>
//                     {item.done}/{item.scheduled}回・{item.rate}%
//                   </div>
//                 </div>

//                 <div style={styles.statusBar}>
//                   <div
//                     style={{ ...styles.statusFill, width: `${item.rate}%` }}
//                   />
//                 </div>
//               </div>
//             ))}
//           </div>
//         )}
//       </section>

//         </>
//       )}

//       {analysisMode === "investment" && (
//         <>
//           <section style={styles.investmentHeroCard}>
//             <div style={styles.investmentHeroTop}>
//               <div>
//                 <div style={styles.investmentKicker}>FUTURE INVESTMENT</div>
//                 <h2 style={styles.investmentHeroTitle}>
//                   {getMonthLabel(currentMonth)}の未来投資
//                 </h2>
//               </div>
//               <button style={styles.investmentAddButton} onClick={openNewInvestmentModal}>
//                 ＋ 追加
//               </button>
//             </div>

//             <div style={styles.investmentTotal}>{formatYen(investmentTotal)}</div>
//             <div style={styles.investmentHeroSub}>
//               資格・AI・副業・健康など、未来につながる支出を整理します。
//             </div>
//           </section>

//           <section style={styles.investmentChartCard}>
//             <div style={styles.sectionHead}>
//               <h2 style={styles.sectionTitle}>投資カテゴリ</h2>
//               <div style={styles.sectionCount}>{monthlyInvestments.length}件</div>
//             </div>

//             {investmentCategoryStats.length === 0 ? (
//               <div style={styles.emptyText}>
//                 まだ自己投資の記録がありません。右上の＋から登録できます。
//               </div>
//             ) : (
//               <div style={styles.investmentChartLayout}>
//                 <div style={{ ...styles.donutChart, background: investmentDonut }}>
//                   <div style={styles.donutCenter}>
//                     <div style={styles.donutCenterLabel}>合計</div>
//                     <div style={styles.donutCenterValue}>
//                       {formatYen(investmentTotal)}
//                     </div>
//                   </div>
//                 </div>

//                 <div style={styles.investmentLegendList}>
//                   {investmentCategoryStats.map((item) => {
//                     const meta = INVESTMENT_CATEGORIES[item.category];
//                     const percent =
//                       investmentTotal === 0
//                         ? 0
//                         : Math.round((item.amount / investmentTotal) * 100);

//                     return (
//                       <div key={item.category} style={styles.investmentLegendRow}>
//                         <div style={styles.investmentLegendLeft}>
//                           <span
//                             style={{
//                               ...styles.legendDot,
//                               background: meta.color,
//                             }}
//                           />
//                           <span style={styles.investmentLegendName}>
//                             {meta.emoji} {meta.label}
//                           </span>
//                         </div>
//                         <div style={styles.investmentLegendRight}>
//                           <span>{formatYen(item.amount)}</span>
//                           <span style={styles.investmentPercent}>{percent}%</span>
//                         </div>
//                       </div>
//                     );
//                   })}
//                 </div>
//               </div>
//             )}
//           </section>

//           <section style={styles.aiCard}>
//             <div style={styles.aiLabel}>💡 INVESTMENT REVIEW</div>
//             <h2 style={styles.aiTitle}>{investmentComment.title}</h2>
//             <p style={styles.aiBody}>{investmentComment.body}</p>
//             <div style={styles.aiTip}>{investmentComment.tip}</div>
//           </section>

//           <section style={styles.statusCard}>
//             <div style={styles.sectionHead}>
//               <h2 style={styles.sectionTitle}>投資の状態</h2>
//               <div style={styles.sectionCount}>継続 / 見直し / 卒業</div>
//             </div>

//             <div style={styles.investmentStatusGrid}>
//               {(["continue", "review", "graduated"] as InvestmentStatus[]).map(
//                 (status) => {
//                   const meta = INVESTMENT_STATUS_META[status];
//                   const amount = investmentStatusStats[status];
//                   const percent =
//                     investmentTotal === 0
//                       ? 0
//                       : clampPercent(Math.round((amount / investmentTotal) * 100));

//                   return (
//                     <div key={status} style={styles.investmentStatusCard}>
//                       <div style={styles.investmentStatusLabel}>
//                         {meta.emoji} {meta.label}
//                       </div>
//                       <div style={styles.investmentStatusAmount}>
//                         {formatYen(amount)}
//                       </div>
//                       <div style={styles.statusBar}>
//                         <div
//                           style={{
//                             ...styles.statusFill,
//                             width: `${percent}%`,
//                             background: meta.color,
//                           }}
//                         />
//                       </div>
//                     </div>
//                   );
//                 }
//               )}
//             </div>
//           </section>

//           <section style={styles.statusCard}>
//             <div style={styles.sectionHead}>
//               <h2 style={styles.sectionTitle}>直近の投資</h2>
//               <button style={styles.smallAddButton} onClick={openNewInvestmentModal}>
//                 ＋ 追加
//               </button>
//             </div>

//             {monthlyInvestments.length === 0 ? (
//               <div style={styles.emptyCard}>
//                 <div style={styles.emptyIcon}>💸</div>
//                 <h2 style={styles.emptyTitle}>未来投資を登録しましょう</h2>
//                 <p style={styles.emptyText}>
//                   参考書、AI課金、Udemy、ジム代などを登録すると、カテゴリ別に見える化できます。
//                 </p>
//                 <button style={styles.keepButtonWide} onClick={openNewInvestmentModal}>
//                   自己投資を追加
//                 </button>
//               </div>
//             ) : (
//               <div style={styles.investmentList}>
//                 {monthlyInvestments.map((item) => {
//                   const category = INVESTMENT_CATEGORIES[item.category];
//                   const status = INVESTMENT_STATUS_META[item.status];

//                   return (
//                     <button
//                       key={item.id}
//                       style={styles.investmentRow}
//                       onClick={() => openEditInvestmentModal(item)}
//                     >
//                       <div style={styles.investmentRowIcon}>
//                         {category.emoji}
//                       </div>
//                       <div style={styles.investmentRowMain}>
//                         <div style={styles.investmentRowTitle}>{item.title}</div>
//                         <div style={styles.investmentRowSub}>
//                           {item.date}・{category.label}・{status.emoji}
//                           {status.label}
//                         </div>
//                         {item.result && (
//                           <div style={styles.investmentResult}>
//                             成果：{item.result}
//                           </div>
//                         )}
//                       </div>
//                       <div style={styles.investmentRowAmount}>
//                         {formatYen(item.amount)}
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>
//             )}
//           </section>
//         </>
//       )}

//       {investmentModalOpen && (
//         <div style={styles.sheetBackdrop} onClick={closeInvestmentModal}>
//           <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
//             <div style={styles.sheetHandle} />
//             <div style={styles.sheetLabel}>FUTURE INVESTMENT</div>
//             <h2 style={styles.sheetTitle}>
//               {editingInvestmentId ? "自己投資を編集" : "自己投資を追加"}
//             </h2>

//             <div style={styles.formGrid}>
//               <label style={styles.formLabel}>
//                 内容
//                 <input
//                   style={styles.formInput}
//                   value={investmentForm.title}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       title: e.target.value,
//                     }))
//                   }
//                   placeholder="例：ChatGPT Plus / セキスペ参考書"
//                 />
//               </label>

//               <label style={styles.formLabel}>
//                 金額
//                 <input
//                   style={styles.formInput}
//                   value={investmentForm.amount}
//                   inputMode="numeric"
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       amount: e.target.value.replace(/[^\d]/g, ""),
//                     }))
//                   }
//                   placeholder="3000"
//                 />
//               </label>

//               <label style={styles.formLabel}>
//                 日付
//                 <input
//                   style={styles.formInput}
//                   type="date"
//                   value={investmentForm.date}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       date: e.target.value,
//                     }))
//                   }
//                 />
//               </label>

//               <label style={styles.formLabel}>
//                 カテゴリ
//                 <select
//                   style={styles.formInput}
//                   value={investmentForm.category}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       category: e.target.value as InvestmentCategory,
//                     }))
//                   }
//                 >
//                   {(Object.keys(INVESTMENT_CATEGORIES) as InvestmentCategory[]).map(
//                     (key) => (
//                       <option key={key} value={key}>
//                         {INVESTMENT_CATEGORIES[key].emoji}{" "}
//                         {INVESTMENT_CATEGORIES[key].label}
//                       </option>
//                     )
//                   )}
//                 </select>
//               </label>

//               <label style={styles.formLabel}>
//                 状態
//                 <select
//                   style={styles.formInput}
//                   value={investmentForm.status}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       status: e.target.value as InvestmentStatus,
//                     }))
//                   }
//                 >
//                   {(Object.keys(INVESTMENT_STATUS_META) as InvestmentStatus[]).map(
//                     (key) => (
//                       <option key={key} value={key}>
//                         {INVESTMENT_STATUS_META[key].emoji}{" "}
//                         {INVESTMENT_STATUS_META[key].label}
//                       </option>
//                     )
//                   )}
//                 </select>
//               </label>

//               <label style={styles.formLabel}>
//                 成果メモ
//                 <textarea
//                   style={styles.formTextarea}
//                   value={investmentForm.result}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       result: e.target.value,
//                     }))
//                   }
//                   placeholder="例：AI機能を実装できた / 模試の点数が上がった"
//                 />
//               </label>

//               <label style={styles.formLabel}>
//                 メモ
//                 <textarea
//                   style={styles.formTextarea}
//                   value={investmentForm.memo}
//                   onChange={(e) =>
//                     setInvestmentForm((prev) => ({
//                       ...prev,
//                       memo: e.target.value,
//                     }))
//                   }
//                   placeholder="例：来月も継続予定"
//                 />
//               </label>
//             </div>

//             <div style={styles.sheetActionRow}>
//               {editingInvestmentId && (
//                 <button
//                   style={styles.sheetDeleteButton}
//                   onClick={() => deleteInvestment(editingInvestmentId)}
//                 >
//                   削除
//                 </button>
//               )}
//               <button style={styles.sheetCancelButton2} onClick={closeInvestmentModal}>
//                 キャンセル
//               </button>
//               <button style={styles.sheetSaveButton} onClick={saveInvestment}>
//                 保存
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {reduceTarget && (
//         <div style={styles.sheetBackdrop} onClick={() => setReduceTarget(null)}>
//           <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
//             <div style={styles.sheetHandle} />
//             <div style={styles.sheetLabel}>REDUCE ACTION</div>
//             <h2 style={styles.sheetTitle}>行動を軽くしますか？</h2>
//             <p style={styles.sheetText}>
//               「{reduceTarget.schedule.title}」をやめずに、続けやすい形へ調整できます。
//             </p>

//             <div style={styles.reduceList}>
//               {[
//                 {
//                   mode: "week3" as ReduceMode,
//                   title: "週3にする",
//                   desc: "毎日が重い行動を、月・水・金だけにします。",
//                 },
//                 {
//                   mode: "week1" as ReduceMode,
//                   title: "週1にする",
//                   desc: "まずは週1だけ残して、習慣の火を消さない形にします。",
//                 },
//                 {
//                   mode: "shorter" as ReduceMode,
//                   title: "時間を短くする",
//                   desc: "10分だけやる前提にして、心理的な重さを減らします。",
//                 },
//                 {
//                   mode: "noTime" as ReduceMode,
//                   title: "時間未設定にする",
//                   desc: "時間のプレッシャーを外して、できる時にやる形にします。",
//                 },
//                 {
//                   mode: "notificationOnly" as ReduceMode,
//                   title: "通知・メモだけ残す",
//                   desc: "予定として縛らず、意識だけ残す軽い形にします。",
//                 },
//               ].map((item) => (
//                 <button
//                   key={item.mode}
//                   style={styles.reduceButton}
//                   onClick={() => applyReduce(reduceTarget, item.mode)}
//                 >
//                   <div style={styles.reduceTitle}>{item.title}</div>
//                   <div style={styles.reduceDesc}>{item.desc}</div>
//                 </button>
//               ))}
//             </div>

//             <button
//               style={styles.sheetCancelButton}
//               onClick={() => setReduceTarget(null)}
//             >
//               キャンセル
//             </button>
//           </div>
//         </div>
//       )}

//       {showAdMock && (
//         <div style={styles.overlay}>
//           <div style={styles.adCard}>
//             <h2 style={{ marginTop: 0 }}>棚卸しが完了しました</h2>
//             <div style={styles.adText}>来週の行動が少し整いました。</div>

//             <div style={styles.adBox}>AD</div>

//             <button style={styles.adButton} onClick={() => setShowAdMock(false)}>
//               閉じる
//             </button>
//           </div>
//         </div>
//       )}
//           {/* Founder Badge */}
//       <div style={{
//         marginTop: 24,
//         padding: 20,
//         borderRadius: 20,
//         background: "linear-gradient(135deg,#2d2d2d,#1a1a1a)",
//         border: "1px solid rgba(255,255,255,.12)"
//       }}>
//         <div style={{
//           fontSize: 12,
//           color: "#9cff87",
//           fontWeight: 700
//         }}>
//           LIMITED BADGE
//         </div>

//         <h3 style={{
//           color: "#fff",
//           marginTop: 8
//         }}>
//           🏅 Founder
//         </h3>

//         <p style={{
//           color: "rgba(255,255,255,.75)"
//         }}>
//           TaskMoney初期ユーザー限定バッジ
//         </p>
//       </div>
//     </div>
//   );
// }


// const styles: Record<string, CSSProperties> = {
//   page: {
//     position: "relative",
//     minHeight: "100vh",
//     padding: "48px 20px calc(112px + env(safe-area-inset-bottom))",
//     background:
//       "radial-gradient(circle at 30% -10%, rgba(84,214,89,0.10), transparent 34%), linear-gradient(180deg, #0f1110 0%, #0a0c0b 100%)",
//     color: "#fff",
//     overflowX: "hidden",
//   },

//   backgroundGlow: {
//     position: "fixed",
//     inset: 0,
//     pointerEvents: "none",
//     background:
//       "radial-gradient(circle at 72% 18%, rgba(97,220,82,0.08), transparent 26%)",
//   },

//   header: {
//     position: "relative",
//     zIndex: 1,
//     display: "flex",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//     gap: 16,
//     marginBottom: 20,
//   },

//   pageKicker: {
//     color: "rgba(142,230,111,0.78)",
//     fontSize: 12,
//     fontWeight: 900,
//     letterSpacing: "0.14em",
//   },

//   pageTitle: {
//     margin: 0,
//     color: "#fff",
//     fontSize: 34,
//     fontWeight: 950,
//     letterSpacing: "-0.06em",
//   },

//   backButton: {
//     width: 44,
//     height: 44,
//     borderRadius: 999,
//     border: "1px solid rgba(255,255,255,0.10)",
//     background: "rgba(255,255,255,0.07)",
//     color: "#fff",
//     fontSize: 22,
//     fontWeight: 900,
//   },

//   segmentWrap: {
//     position: "relative",
//     zIndex: 1,
//     display: "flex",
//     alignItems: "center",
//     gap: 8,
//     marginBottom: 22,
//   },

//   segmentActive: {
//     border: "none",
//     minWidth: 150,
//     minHeight: 44,
//     borderRadius: 999,
//     background:
//       "linear-gradient(90deg, rgba(91,201,75,0.12), rgba(116,224,93,0.40))",
//     color: "#9CF27F",
//     fontWeight: 900,
//     fontSize: 15,
//     boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
//   },

//   segmentButton: {
//     border: "none",
//     background: "transparent",
//     color: "rgba(255,255,255,0.7)",
//     fontWeight: 800,
//     fontSize: 15,
//     padding: "0 10px",
//   },

//   balanceCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 28,
//     padding: 22,
//     marginBottom: 22,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 20px 48px rgba(0,0,0,0.22)",
//     backdropFilter: "blur(18px)",
//   },

//   balanceTop: {
//     display: "flex",
//     justifyContent: "space-between",
//     gap: 14,
//     alignItems: "flex-start",
//     marginBottom: 18,
//   },

//   balanceTitle: {
//     color: "#fff",
//     fontSize: 22,
//     fontWeight: 950,
//     marginBottom: 6,
//   },

//   balanceSub: {
//     color: "rgba(255,255,255,0.48)",
//     fontSize: 13,
//     lineHeight: 1.5,
//     fontWeight: 700,
//   },

//   adjustBadge: {
//     flex: "0 0 auto",
//     borderRadius: 999,
//     padding: "6px 10px",
//     background: "rgba(246,162,60,0.18)",
//     color: "#F6A23C",
//     fontSize: 12,
//     fontWeight: 900,
//   },

//   balanceList: {
//     display: "grid",
//     gap: 16,
//   },

//   balanceItem: {
//     display: "grid",
//     gap: 8,
//   },

//   balanceRow: {
//     display: "flex",
//     justifyContent: "space-between",
//     alignItems: "center",
//     gap: 12,
//   },

//   balanceName: {
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: 900,
//   },

//   balanceRate: {
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: 900,
//   },

//   balanceBar: {
//     height: 10,
//     borderRadius: 999,
//     background: "rgba(255,255,255,0.12)",
//     overflow: "hidden",
//   },

//   balanceFill: {
//     height: "100%",
//     borderRadius: 999,
//   },

//   summarySection: {
//     position: "relative",
//     zIndex: 1,
//     marginBottom: 22,
//   },

//   sectionTitle: {
//     margin: "0 0 16px",
//     color: "#fff",
//     fontSize: 24,
//     fontWeight: 950,
//     letterSpacing: "-0.04em",
//   },

//   summaryGrid: {
//     display: "grid",
//     gridTemplateColumns: "repeat(3, 1fr)",
//     gap: 10,
//   },

//   summaryCard: {
//     borderRadius: 20,
//     padding: "18px 14px",
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.035))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 16px 32px rgba(0,0,0,0.18)",
//   },

//   summaryLabel: {
//     color: "rgba(255,255,255,0.48)",
//     fontSize: 12,
//     fontWeight: 800,
//     marginBottom: 8,
//   },

//   summaryValue: {
//     color: "#fff",
//     fontSize: 32,
//     fontWeight: 950,
//     letterSpacing: "-0.05em",
//   },

//   lifeStatusSection: {
//     position: "relative",
//     zIndex: 1,
//     marginBottom: 22,
//   },

//   lifeStatusList: {
//     display: "grid",
//     gap: 12,
//   },

//   lifeStatusRow: {
//     borderRadius: 22,
//     padding: "16px 18px",
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.03))",
//     border: "1px solid rgba(255,255,255,0.05)",
//     boxShadow: "0 16px 36px rgba(0,0,0,0.16)",
//     display: "flex",
//     justifyContent: "space-between",
//     alignItems: "center",
//     gap: 14,
//   },

//   lifeStatusLeft: {
//     display: "flex",
//     alignItems: "center",
//     gap: 12,
//     minWidth: 0,
//   },

//   lifeStatusEmoji: {
//     fontSize: 24,
//   },

//   lifeStatusName: {
//     color: "#fff",
//     fontSize: 17,
//     fontWeight: 900,
//   },

//   lifeStatusSub: {
//     marginTop: 3,
//     color: "rgba(255,255,255,0.5)",
//     fontSize: 13,
//     fontWeight: 700,
//   },

//   lifeStatusRight: {
//     color: "#9CF27F",
//     fontSize: 16,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//   },

//   aiCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 24,
//     padding: 18,
//     marginBottom: 16,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
//   },

//   aiLabel: {
//     color: "#9CF27F",
//     fontSize: 13,
//     fontWeight: 900,
//     letterSpacing: "0.12em",
//     marginBottom: 10,
//   },

//   aiTitle: {
//     margin: "0 0 10px",
//     color: "#fff",
//     fontSize: 26,
//     lineHeight: 1.25,
//     fontWeight: 950,
//     letterSpacing: "-0.05em",
//   },

//   aiBody: {
//     margin: 0,
//     color: "rgba(255,255,255,0.74)",
//     fontSize: 14,
//     lineHeight: 1.7,
//     fontWeight: 750,
//   },

//   aiTip: {
//     marginTop: 14,
//     padding: "14px 14px",
//     borderRadius: 16,
//     background: "rgba(0,0,0,0.34)",
//     border: "1px solid rgba(255,255,255,0.06)",
//     color: "#fff",
//     fontSize: 14,
//     fontWeight: 900,
//     lineHeight: 1.6,
//   },

//   emptyCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 24,
//     padding: 22,
//     textAlign: "center",
//     marginBottom: 16,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
//     border: "1px solid rgba(255,255,255,0.06)",
//   },

//   emptyIcon: {
//     fontSize: 44,
//     marginBottom: 14,
//   },

//   emptyTitle: {
//     color: "#fff",
//     fontSize: 22,
//     fontWeight: 950,
//     margin: "0 0 10px",
//   },

//   emptyText: {
//     color: "rgba(255,255,255,0.55)",
//     fontWeight: 750,
//     lineHeight: 1.7,
//     fontSize: 14,
//   },

//   reviewCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 24,
//     padding: 20,
//     marginBottom: 16,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
//   },

//   counter: {
//     color: "rgba(255,255,255,0.55)",
//     fontWeight: 900,
//     marginBottom: 8,
//   },

//   reviewTitle: {
//     margin: 0,
//     color: "#fff",
//     fontSize: 27,
//     fontWeight: 950,
//     letterSpacing: "-0.05em",
//   },

//   reviewSub: {
//     color: "rgba(255,255,255,0.52)",
//     fontWeight: 800,
//     marginTop: 7,
//     fontSize: 13,
//   },

//   taskCard: {
//     marginTop: 16,
//     padding: 18,
//     borderRadius: 22,
//     border: "1px solid rgba(255,255,255,0.08)",
//     background:
//       "linear-gradient(135deg, rgba(255,255,255,0.90), rgba(255,255,255,0.64))",
//     color: "#111",
//     boxShadow: "0 16px 34px rgba(0,0,0,0.14)",
//   },

//   tagPill: {
//     width: "fit-content",
//     padding: "7px 12px",
//     borderRadius: 999,
//     background: "#111",
//     color: "#fff",
//     fontSize: 13,
//     fontWeight: 900,
//     marginBottom: 12,
//   },

//   taskTitle: {
//     marginTop: 8,
//     fontSize: 26,
//     fontWeight: 950,
//     letterSpacing: "-0.05em",
//     wordBreak: "break-word",
//   },

//   reasonText: {
//     marginTop: 10,
//     color: "#111",
//     fontWeight: 900,
//   },

//   taskMemo: {
//     marginTop: 8,
//     color: "#777",
//     fontWeight: 750,
//   },

//   memoText: {
//     marginTop: 8,
//     color: "#888",
//     fontWeight: 700,
//     lineHeight: 1.6,
//   },

//   actionGrid: {
//     display: "grid",
//     gridTemplateColumns: "repeat(4, 1fr)",
//     gap: 8,
//     marginTop: 16,
//   },

//   lightButton: {
//     minHeight: 44,
//     borderRadius: 14,
//     background: "rgba(255,255,255,0.92)",
//     color: "#111",
//     border: "none",
//     fontWeight: 950,
//     fontSize: 13,
//   },

//   keepButton: {
//     minHeight: 44,
//     borderRadius: 14,
//     border: "none",
//     background: "#74e05d",
//     color: "#07110c",
//     fontWeight: 950,
//     fontSize: 13,
//     boxShadow: "0 12px 26px rgba(116,224,93,0.24)",
//   },

//   dangerButton: {
//     minHeight: 44,
//     borderRadius: 14,
//     border: "none",
//     background: "rgba(255,255,255,0.92)",
//     color: "#b91c1c",
//     fontWeight: 950,
//     fontSize: 13,
//   },

//   subButton: {
//     marginTop: 16,
//     border: "none",
//     background: "transparent",
//     color: "#9CF27F",
//     fontWeight: 900,
//   },

//   statusCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 24,
//     padding: 20,
//     marginBottom: 16,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
//   },

//   sectionHead: {
//     display: "flex",
//     justifyContent: "space-between",
//     gap: 12,
//     alignItems: "center",
//     marginBottom: 14,
//   },

//   sectionCount: {
//     color: "rgba(255,255,255,0.55)",
//     fontWeight: 900,
//     fontSize: 14,
//   },

//   statusList: {
//     display: "grid",
//     gap: 14,
//   },

//   statusRow: {
//     display: "grid",
//     gap: 8,
//   },

//   statusTop: {
//     display: "flex",
//     justifyContent: "space-between",
//     gap: 12,
//     alignItems: "center",
//   },

//   statusName: {
//     fontWeight: 900,
//     fontSize: 16,
//     color: "#fff",
//   },

//   statusCount: {
//     color: "rgba(255,255,255,0.52)",
//     fontWeight: 800,
//     fontSize: 13,
//   },

//   statusBar: {
//     height: 8,
//     borderRadius: 999,
//     background: "rgba(255,255,255,0.10)",
//     overflow: "hidden",
//   },

//   statusFill: {
//     height: "100%",
//     borderRadius: 999,
//     background: "#74e05d",
//     transition: "0.3s ease",
//   },

//   sheetBackdrop: {
//     position: "fixed",
//     inset: 0,
//     zIndex: 9999,
//     background: "rgba(0,0,0,0.52)",
//     display: "flex",
//     alignItems: "flex-end",
//     justifyContent: "center",
//   },

//   sheet: {
//     width: "100%",
//     maxWidth: 560,
//     maxHeight: "82dvh",
//     overflowY: "auto",
//     background: "#f7f8f6",
//     color: "#111",
//     borderRadius: "30px 30px 0 0",
//     padding: "12px 22px calc(24px + env(safe-area-inset-bottom))",
//     boxShadow: "0 -18px 50px rgba(0,0,0,0.28)",
//   },

//   sheetHandle: {
//     width: 46,
//     height: 5,
//     borderRadius: 999,
//     background: "rgba(0,0,0,0.14)",
//     margin: "0 auto 18px",
//   },

//   sheetLabel: {
//     color: "#999",
//     letterSpacing: "0.16em",
//     fontSize: 12,
//     fontWeight: 900,
//     marginBottom: 8,
//   },

//   sheetTitle: {
//     margin: "0 0 10px",
//     fontSize: 27,
//     fontWeight: 950,
//     letterSpacing: "-0.04em",
//     color: "#111",
//   },

//   sheetText: {
//     color: "#666",
//     fontSize: 15,
//     fontWeight: 750,
//     lineHeight: 1.7,
//     margin: "0 0 16px",
//   },

//   reduceList: {
//     display: "grid",
//     gap: 10,
//   },

//   reduceButton: {
//     width: "100%",
//     textAlign: "left",
//     border: "1px solid #e3e6ef",
//     background: "#fff",
//     borderRadius: 18,
//     padding: "14px 16px",
//   },

//   reduceTitle: {
//     color: "#111",
//     fontSize: 17,
//     fontWeight: 950,
//     marginBottom: 4,
//   },

//   reduceDesc: {
//     color: "#777",
//     fontSize: 13,
//     fontWeight: 750,
//     lineHeight: 1.6,
//   },

//   sheetCancelButton: {
//     width: "100%",
//     minHeight: 54,
//     marginTop: 14,
//     borderRadius: 18,
//     border: "none",
//     background: "#111",
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: 950,
//   },

//   overlay: {
//     position: "fixed",
//     inset: 0,
//     zIndex: 9999,
//     background: "rgba(0,0,0,0.52)",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     padding: 24,
//   },

//   adCard: {
//     width: "100%",
//     maxWidth: 420,
//     borderRadius: 24,
//     background: "#f7f8f6",
//     color: "#111",
//     padding: 22,
//     textAlign: "center",
//   },

//   adText: {
//     color: "#777",
//     marginBottom: 14,
//     fontWeight: 800,
//   },

//   adBox: {
//     borderRadius: 18,
//     background: "rgba(0,0,0,0.04)",
//     padding: 18,
//     marginBottom: 16,
//     color: "#777",
//     fontWeight: 950,
//   },

//   adButton: {
//     width: "100%",
//     minHeight: 52,
//     border: "none",
//     borderRadius: 18,
//     background: "#111",
//     color: "#fff",
//     fontWeight: 950,
//   },

//   investmentHeroCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 28,
//     padding: 22,
//     marginBottom: 18,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,248,246,0.90))",
//     color: "#111",
//     border: "1px solid rgba(255,255,255,0.20)",
//     boxShadow: "0 20px 48px rgba(0,0,0,0.22)",
//   },

//   investmentHeroTop: {
//     display: "flex",
//     justifyContent: "space-between",
//     gap: 14,
//     alignItems: "flex-start",
//     marginBottom: 18,
//   },

//   investmentKicker: {
//     color: "rgba(0,0,0,0.28)",
//     fontSize: 12,
//     fontWeight: 950,
//     letterSpacing: "0.16em",
//     marginBottom: 8,
//   },

//   investmentHeroTitle: {
//     margin: 0,
//     color: "#111",
//     fontSize: 24,
//     lineHeight: 1.18,
//     fontWeight: 950,
//     letterSpacing: "-0.05em",
//   },

//   investmentAddButton: {
//     minHeight: 44,
//     borderRadius: 999,
//     border: "1px solid rgba(255,255,255,0.10)",
//     background: "rgba(255,255,255,0.07)",
//     color: "#fff",
//     padding: "0 16px",
//     fontSize: 14,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//     boxShadow: "0 14px 26px rgba(0,0,0,0.18)",
//     backdropFilter: "blur(16px)",
//   },

//   investmentTotal: {
//     color: "#50B878",
//     fontSize: 42,
//     fontWeight: 950,
//     letterSpacing: "-0.06em",
//     marginBottom: 8,
//   },

//   investmentHeroSub: {
//     color: "#777",
//     fontSize: 14,
//     fontWeight: 800,
//     lineHeight: 1.6,
//   },

//   investmentChartCard: {
//     position: "relative",
//     zIndex: 1,
//     borderRadius: 24,
//     padding: 20,
//     marginBottom: 16,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
//     border: "1px solid rgba(255,255,255,0.06)",
//     boxShadow: "0 18px 42px rgba(0,0,0,0.18)",
//   },

//   investmentChartLayout: {
//     display: "grid",
//     gridTemplateColumns: "140px 1fr",
//     gap: 18,
//     alignItems: "center",
//   },

//   donutChart: {
//     width: 136,
//     height: 136,
//     borderRadius: 999,
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     boxShadow: "0 14px 34px rgba(0,0,0,0.20)",
//   },

//   donutCenter: {
//     width: 82,
//     height: 82,
//     borderRadius: 999,
//     background: "#111",
//     display: "flex",
//     flexDirection: "column",
//     alignItems: "center",
//     justifyContent: "center",
//     textAlign: "center",
//     padding: 8,
//   },

//   donutCenterLabel: {
//     color: "rgba(255,255,255,0.52)",
//     fontSize: 11,
//     fontWeight: 900,
//     marginBottom: 4,
//   },

//   donutCenterValue: {
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: 950,
//     lineHeight: 1.1,
//   },

//   investmentLegendList: {
//     display: "grid",
//     gap: 10,
//   },

//   investmentLegendRow: {
//     display: "flex",
//     justifyContent: "space-between",
//     gap: 10,
//     alignItems: "center",
//   },

//   investmentLegendLeft: {
//     display: "flex",
//     alignItems: "center",
//     gap: 8,
//     minWidth: 0,
//   },

//   legendDot: {
//     width: 10,
//     height: 10,
//     borderRadius: 999,
//     flex: "0 0 auto",
//   },

//   investmentLegendName: {
//     color: "#fff",
//     fontSize: 14,
//     fontWeight: 900,
//     whiteSpace: "nowrap",
//     overflow: "hidden",
//     textOverflow: "ellipsis",
//   },

//   investmentLegendRight: {
//     display: "flex",
//     alignItems: "baseline",
//     gap: 8,
//     color: "#fff",
//     fontSize: 14,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//   },

//   investmentPercent: {
//     color: "rgba(255,255,255,0.45)",
//     fontSize: 12,
//     fontWeight: 900,
//   },

//   investmentStatusGrid: {
//     display: "grid",
//     gridTemplateColumns: "1fr",
//     gap: 12,
//   },

//   investmentStatusCard: {
//     borderRadius: 18,
//     padding: 16,
//     background: "rgba(255,255,255,0.06)",
//     border: "1px solid rgba(255,255,255,0.06)",
//     display: "grid",
//     gap: 8,
//   },

//   investmentStatusLabel: {
//     color: "rgba(255,255,255,0.72)",
//     fontSize: 13,
//     fontWeight: 900,
//   },

//   investmentStatusAmount: {
//     color: "#fff",
//     fontSize: 24,
//     fontWeight: 950,
//     letterSpacing: "-0.04em",
//   },

//   smallAddButton: {
//     minHeight: 40,
//     borderRadius: 999,
//     border: "1px solid rgba(255,255,255,0.10)",
//     background: "rgba(255,255,255,0.07)",
//     color: "#fff",
//     padding: "0 16px",
//     fontSize: 14,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//     boxShadow: "0 10px 22px rgba(0,0,0,0.16)",
//     backdropFilter: "blur(16px)",
//   },

//   investmentList: {
//     display: "grid",
//     gap: 10,
//   },

//   investmentRow: {
//     width: "100%",
//     border: "1px solid rgba(255,255,255,0.06)",
//     borderRadius: 20,
//     background:
//       "linear-gradient(180deg, rgba(255,255,255,0.065), rgba(255,255,255,0.035))",
//     color: "#fff",
//     padding: 14,
//     display: "flex",
//     alignItems: "center",
//     gap: 12,
//     textAlign: "left",
//   },

//   investmentRowIcon: {
//     width: 46,
//     height: 46,
//     minWidth: 46,
//     borderRadius: 16,
//     background: "#111",
//     display: "flex",
//     alignItems: "center",
//     justifyContent: "center",
//     fontSize: 24,
//   },

//   investmentRowMain: {
//     minWidth: 0,
//     flex: 1,
//   },

//   investmentRowTitle: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//     overflow: "hidden",
//     textOverflow: "ellipsis",
//   },

//   investmentRowSub: {
//     marginTop: 4,
//     color: "rgba(255,255,255,0.50)",
//     fontSize: 12,
//     fontWeight: 800,
//   },

//   investmentResult: {
//     marginTop: 6,
//     color: "#9CF27F",
//     fontSize: 12,
//     fontWeight: 850,
//     lineHeight: 1.4,
//   },

//   investmentRowAmount: {
//     color: "#fff",
//     fontSize: 16,
//     fontWeight: 950,
//     whiteSpace: "nowrap",
//   },

//   keepButtonWide: {
//     width: "100%",
//     minHeight: 52,
//     marginTop: 16,
//     borderRadius: 18,
//     border: "none",
//     background: "#74e05d",
//     color: "#07110c",
//     fontSize: 16,
//     fontWeight: 950,
//   },

//   formGrid: {
//     display: "grid",
//     gap: 12,
//   },

//   formLabel: {
//     display: "grid",
//     gap: 7,
//     color: "#555",
//     fontSize: 13,
//     fontWeight: 900,
//   },

//   formInput: {
//     width: "100%",
//     minHeight: 50,
//     borderRadius: 16,
//     border: "1px solid #e3e6ef",
//     background: "#fff",
//     color: "#111",
//     padding: "0 14px",
//     fontSize: 16,
//     fontWeight: 850,
//     boxSizing: "border-box",
//   },

//   formTextarea: {
//     width: "100%",
//     minHeight: 86,
//     borderRadius: 16,
//     border: "1px solid #e3e6ef",
//     background: "#fff",
//     color: "#111",
//     padding: "13px 14px",
//     fontSize: 15,
//     fontWeight: 800,
//     lineHeight: 1.5,
//     boxSizing: "border-box",
//     resize: "vertical",
//   },

//   sheetActionRow: {
//     display: "grid",
//     gridTemplateColumns: "1fr 1fr",
//     gap: 10,
//     marginTop: 16,
//   },

//   sheetDeleteButton: {
//     minHeight: 52,
//     borderRadius: 18,
//     border: "none",
//     background: "rgba(185,28,28,0.10)",
//     color: "#b91c1c",
//     fontSize: 15,
//     fontWeight: 950,
//   },

//   sheetCancelButton2: {
//     minHeight: 52,
//     borderRadius: 18,
//     border: "1px solid #e3e6ef",
//     background: "#fff",
//     color: "#111",
//     fontSize: 15,
//     fontWeight: 950,
//   },

//   sheetSaveButton: {
//     minHeight: 52,
//     borderRadius: 18,
//     border: "none",
//     background: "#111",
//     color: "#fff",
//     fontSize: 15,
//     fontWeight: 950,
//   },

// };
