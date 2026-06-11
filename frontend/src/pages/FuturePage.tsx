// src/pages/FuturePage.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { createFuturePlan } from "../api";
import {
  getProStatus,
  purchasePro,
  restorePurchases,
} from "../lib/iap";

type PlanType = "side_business" | "study" | "health" | "output";

type FuturePlanItem = {
  title: string;
  weekday: number;
  startTime: string;
  endTime: string;
  memo: string;
};

type ScheduleEvent = {
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
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const PLAN_TYPES = [
  { id: "side_business", label: "副業", emoji: "💰" },
  { id: "study", label: "資格・学習", emoji: "📚" },
  { id: "health", label: "健康・筋トレ", emoji: "💪" },
  { id: "output", label: "発信", emoji: "📣" },
] as const;

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

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
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

function createEmptyPlanItem(minutes: number): FuturePlanItem {
  return {
    title: "新しい行動",
    weekday: 1,
    startTime: "21:00",
    endTime: minutes <= 30 ? "21:30" : "22:00",
    memo: "必要に応じて内容を編集してください",
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

export default function FuturePage() {
  const nav = useNavigate();

  const [goal, setGoal] = useState("資格試験に合格する");
  const [deadline, setDeadline] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [type, setType] = useState<PlanType>("side_business");
  const [created, setCreated] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [detailInput, setDetailInput] = useState("");

  const AI_LOADING_MESSAGES = [
    "未来を分析しています...",
    "現実的なプランを作成しています...",
    "今日できる行動に分解しています...",
    "カレンダーへ登録できる形に変換しています...",
  ];

  const [aiLoadingStep, setAiLoadingStep] = useState(0);

  const [isPro, setIsPro] = useState(false);
  const [proChecking, setProChecking] = useState(true);
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<FuturePlanItem | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkPro() {
      try {
        const status = await getProStatus();
        if (mounted) setIsPro(status);
      } catch (e) {
        console.error("Pro status check failed", e);
      } finally {
        if (mounted) setProChecking(false);
      }
    }

    checkPro();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!aiLoading) {
      setAiLoadingStep(0);
      return;
    }

    const timer = window.setInterval(() => {
      setAiLoadingStep((prev) => (prev + 1) % AI_LOADING_MESSAGES.length);
    }, 1200);

    return () => window.clearInterval(timer);
  }, [aiLoading]);

  async function handlePurchasePro() {
    setPurchaseLoading(true);

    try {
      const result = await purchasePro();

      if (result.cancelled) return;

      if (result.pending) {
        alert("購入が保留中です。承認後にProが有効になります。");
        return;
      }

      if (result.isPro) {
        setIsPro(true);
        alert("TaskMoney Proが有効になりました。");
      }
    } catch (e) {
      console.error("Purchase failed", e);
      alert("購入に失敗しました。時間をおいて再度お試しください。");
    } finally {
      setPurchaseLoading(false);
    }
  }

  async function handleRestorePurchases() {
    setPurchaseLoading(true);

    try {
      const result = await restorePurchases();

      if (result.isPro) {
        setIsPro(true);
        alert("購入を復元しました。");
      } else {
        alert("復元できる購入が見つかりませんでした。");
      }
    } catch (e) {
      console.error("Restore failed", e);
      alert("購入の復元に失敗しました。");
    } finally {
      setPurchaseLoading(false);
    }
  }

  const plan = useMemo(() => generatePlan(type, minutes), [type, minutes]);
  const [editablePlan, setEditablePlan] = useState<FuturePlanItem[]>(plan);
  const [aiSummary, setAiSummary] = useState("");

  useEffect(() => {
    setEditablePlan(plan);
    setCreated(false);
    setAiSummary("");
  }, [plan]);

  function openEditPlan(index: number) {
    setEditingIndex(index);
    setEditingItem({ ...editablePlan[index] });
  }

  function openAddPlan() {
    setEditingIndex(null);
    setEditingItem(createEmptyPlanItem(minutes));
  }

  function closeEditor() {
    setEditingIndex(null);
    setEditingItem(null);
  }

  function updateEditingItem(
    field: keyof FuturePlanItem,
    value: string | number
  ) {
    setEditingItem((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: value };
    });
  }

  function saveEditingItem() {
    if (!editingItem) return;

    const fixedItem: FuturePlanItem = {
      ...editingItem,
      title: editingItem.title.trim() || "新しい行動",
      memo: editingItem.memo.trim(),
    };

    setEditablePlan((prev) => {
      if (editingIndex == null) {
        return [...prev, fixedItem];
      }

      return prev.map((item, i) => (i === editingIndex ? fixedItem : item));
    });

    closeEditor();
  }

  function removePlanItem(index: number) {
    setEditablePlan((prev) => prev.filter((_, i) => i !== index));
  }

  async function createAiPlan() {
    console.log("Future AI: button clicked", {
      goal,
      deadline,
      minutes,
      type,
      isPro,
    });

    setAiLoading(true);

    try {
      console.log("Future AI: request start");

      const data = await createFuturePlan({
        goal: `
        目標:
        ${goal}
        
        興味:
        ${detailInput}
        
        条件:
        ・初心者でも継続できる
        ・最初の一歩を小さくする
        ・週3回以内
        ・挫折しにくい計画
        `,
        deadline,
        minutes,
        type,
      });

      console.log("Future AI: response success", data);

      if (data.items?.length) {
        setEditablePlan(data.items);
        setAiSummary(data.summary ?? "");
        setCreated(false);
      } else {
        console.warn("Future AI: empty items", data);
        alert("AIプランが空でした。テンプレプランを使ってください。");
      }
    } catch (e) {
      console.error("Future AI: failed", e);
      alert("AIプラン作成に失敗しました。テンプレプランを使ってください。");
    } finally {
      console.log("Future AI: request finished");
      setAiLoading(false);
    }
  }

  async function replanAiPlan() {
    setAiLoading(true);

    try {
      const data = await createFuturePlan({
        goal: `
  ${goal}
  
  現在の予定:
  ${editablePlan.map((p) => p.title).join("\n")}
  
  予定通りできなかったため、
  より無理なく継続できる形へ再計画してください。
  `,
        deadline,
        minutes,
        type,
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

  function registerPlan() {
    const today = new Date();
    const startDate = toYMD(today);
    const endDate = deadline || toYMD(addMonths(today, 3));

    const validItems = editablePlan.filter((item) => item.title.trim());

    const newSchedules: ScheduleEvent[] = validItems.map((item) => {
      const weekdays = [false, false, false, false, false, false, false];
      weekdays[item.weekday] = true;

      return {
        id: uid(),
        title: item.title.trim(),
        memo: `Future目標：${goal}\n${item.memo}`,
        startDate,
        endDate,
        startTime: item.startTime,
        endTime: item.endTime,
        weekdays,
        oneShot: false,
        completedDates: [],
        tags: [type],
      };
    });

    const current = loadSchedules();
    saveSchedules([...current, ...newSchedules]);
    setCreated(true);

    setTimeout(() => {
      nav("/calendar");
    }, 700);
  }

  const selectedType = PLAN_TYPES.find((x) => x.id === type);

  return (
    <div style={styles.page}>
      <div style={styles.glow} />

      <header style={styles.header}>
        <div>
          <div style={styles.kicker}>FUTURE PLAN</div>
          <h1 style={styles.title}>未来を予定に変える</h1>
          <p style={styles.lead}>
            将来こうなりたい、を行動プランに落とし込みます。
          </p>
        </div>
      </header>

      <section style={styles.card}>
        <label style={styles.label}>達成したいこと</label>

        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="例：資格試験に合格する / 5kg痩せる / 朝活を習慣化する"
          style={styles.input}
        />

        <label style={styles.label}>興味のあること・補足</label>

        <textarea
          value={detailInput}
          onChange={(e) => setDetailInput(e.target.value)}
          placeholder="例：情報処理安全確保支援士、午後問題、散歩中心、夜の間食を減らしたい"
          style={styles.memoInput}
        />

        <label style={styles.label}>いつまで？</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={styles.input}
        />

        <label style={styles.label}>1回あたりどれくらいできそう？</label>
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          style={styles.input}
        >
          <option value={15}>15分</option>
          <option value={30}>30分</option>
          <option value={60}>60分</option>
        </select>

        <label style={styles.label}>方向性</label>
        <div style={styles.typeGrid}>
          {PLAN_TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id)}
              style={{
                ...styles.typeButton,
                ...(type === item.id ? styles.typeButtonActive : {}),
              }}
            >
              {item.emoji} {item.label}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.planCard}>
        <div style={styles.planHead}>
          <div>
            <div style={styles.planKicker}>
              {aiSummary ? "AI PLAN" : "TEMPLATE PLAN"}
            </div>
            <h2 style={styles.planTitle}>
              {selectedType?.emoji} {goal || "未来の目標"}
            </h2>
          </div>
        </div>

        <p style={styles.planIntro}>
          生成されたプランは自由に編集できます。内容を整えてから一括でカレンダーに登録できます。
        </p>

        {aiSummary && <div style={styles.aiSummary}>{aiSummary}</div>}

        <div style={styles.proBox}>
          <div style={styles.proBadge}>BETA</div>
          <div style={styles.proTitle}>AI機能をお試し開放中</div>
          <div style={styles.proText}>
            現在はAIプラン生成・AI再計画を無料で利用できます。
            今後、Pro機能として提供予定です。
          </div>
        </div>

        {aiLoading && (
          <div style={styles.aiSummary}>
            🤖 {AI_LOADING_MESSAGES[aiLoadingStep]}
          </div>
        )}

        <button
          type="button"
          style={{
            ...styles.aiButton,
            opacity: aiLoading ? 0.55 : 1,
          }}
          onClick={createAiPlan}
          disabled={aiLoading}
        >
          {aiLoading ? "AIが作成中..." : "AIプラン作成"}
        </button>

        <button
          type="button"
          style={{
            ...styles.addButton,
            marginTop: 0,
            marginBottom: 14,
          }}
          onClick={replanAiPlan}
          disabled={aiLoading}
        >
          今日はできなかった → AI再計画
        </button>

        <div style={styles.planList}>
          {editablePlan.map((item, index) => (
            <div key={`${index}-${item.title}`} style={styles.planItem}>
              <div style={styles.planItemHead}>
                <div style={styles.planItemBadge}>STEP {index + 1}</div>

                <button
                  type="button"
                  style={styles.deleteButton}
                  onClick={() => removePlanItem(index)}
                >
                  削除
                </button>
              </div>

              <div style={styles.previewTitle}>{item.title}</div>
              <div style={styles.previewMeta}>
                {WEEKDAY_LABELS[item.weekday]}曜 / {item.startTime} -{" "}
                {item.endTime}
              </div>
              <div style={styles.previewMemo}>{item.memo}</div>

              <button
                type="button"
                style={styles.editButton}
                onClick={() => openEditPlan(index)}
              >
                編集
              </button>
            </div>
          ))}
        </div>

        <button type="button" style={styles.plusButton} onClick={openAddPlan}>
          +
        </button>

        <button style={styles.primaryButton} onClick={registerPlan}>
          このプランを一括登録 →
        </button>

        {created && <div style={styles.doneText}>カレンダーに登録しました</div>}
      </section>

      {editingItem && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalSheet}>
            <div style={styles.modalHeader}>
              <button type="button" style={styles.modalClose} onClick={closeEditor}>
                ×
              </button>

              <div style={styles.modalTitle}>
                {editingIndex === null ? "行動を追加" : "行動を編集"}
              </div>

              <button type="button" style={styles.modalSave} onClick={saveEditingItem}>
                保存
              </button>
            </div>

            <label style={styles.modalLabel}>行動名</label>
            <input
              value={editingItem.title}
              onChange={(e) => updateEditingItem("title", e.target.value)}
              style={styles.modalInput}
            />

            <label style={styles.modalLabel}>曜日</label>
            <select
              value={editingItem.weekday}
              onChange={(e) => updateEditingItem("weekday", Number(e.target.value))}
              style={styles.modalInput}
            >
              {WEEKDAY_LABELS.map((label, weekday) => (
                <option key={weekday} value={weekday}>
                  {label}曜
                </option>
              ))}
            </select>

            <div style={styles.modalTimeGrid}>
              <div>
                <label style={styles.modalLabel}>開始</label>
                <input
                  type="time"
                  value={editingItem.startTime}
                  onChange={(e) => updateEditingItem("startTime", e.target.value)}
                  style={styles.modalInput}
                />
              </div>

              <div>
                <label style={styles.modalLabel}>終了</label>
                <input
                  type="time"
                  value={editingItem.endTime}
                  onChange={(e) => updateEditingItem("endTime", e.target.value)}
                  style={styles.modalInput}
                />
              </div>
            </div>

            <label style={styles.modalLabel}>メモ</label>
            <textarea
              value={editingItem.memo}
              onChange={(e) => updateEditingItem("memo", e.target.value)}
              style={styles.modalMemoInput}
            />
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
      "radial-gradient(circle at 30% -10%, rgba(84,214,89,0.12), transparent 34%), linear-gradient(180deg, #0f1110 0%, #0a0c0b 100%)",
    color: "#fff",
    overflowX: "hidden",
  },
  glow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 72% 18%, rgba(97,220,82,0.10), transparent 26%)",
  },
  header: {
    position: "relative",
    zIndex: 1,
    marginBottom: 22,
  },
  kicker: {
    color: "#9CF27F",
    fontSize: 13,
    fontWeight: 950,
    letterSpacing: "0.16em",
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 36,
    fontWeight: 950,
    letterSpacing: "-0.07em",
    lineHeight: 1.1,
  },
  lead: {
    marginTop: 12,
    color: "rgba(255,255,255,0.58)",
    fontWeight: 800,
    lineHeight: 1.7,
  },
  card: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.07)",
    boxShadow: "0 20px 48px rgba(0,0,0,0.22)",
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.72)",
    fontWeight: 900,
    margin: "16px 0 8px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 54,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.92)",
    color: "#111",
    padding: "0 16px",
    fontSize: 16,
    fontWeight: 800,
  },
  typeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: 10,
  },
  typeButton: {
    minHeight: 48,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 900,
  },
  typeButtonActive: {
    background: "#74e05d",
    color: "#07110c",
    border: "none",
  },
  planCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 28,
    padding: 22,
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,255,255,0.78))",
    color: "#111",
    boxShadow: "0 22px 50px rgba(0,0,0,0.25)",
  },
  planHead: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 10,
  },
  planKicker: {
    color: "#ff8a1c",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.16em",
    marginBottom: 6,
  },
  planTitle: {
    margin: 0,
    fontSize: 27,
    fontWeight: 950,
    letterSpacing: "-0.05em",
  },
  planIntro: {
    margin: "0 0 16px",
    color: "#666",
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.7,
  },
  aiButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 18,
    border: "1px solid rgba(255,138,28,0.35)",
    background: "linear-gradient(135deg, #111, #2a1b09)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
    marginBottom: 14,
  },
  aiSummary: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,138,28,0.10)",
    border: "1px solid rgba(255,138,28,0.18)",
    color: "#7c3f00",
    fontSize: 14,
    fontWeight: 850,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  planList: {
    display: "grid",
    gap: 12,
  },
  planItem: {
    borderRadius: 20,
    padding: 16,
    background: "rgba(0,0,0,0.045)",
    border: "1px solid rgba(0,0,0,0.06)",
  },
  planItemHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 12,
  },
  planItemBadge: {
    width: "fit-content",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#111",
    color: "#fff",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },
  deleteButton: {
    border: "none",
    background: "rgba(185,28,28,0.08)",
    color: "#b91c1c",
    borderRadius: 999,
    padding: "7px 11px",
    fontSize: 12,
    fontWeight: 950,
  },
  previewTitle: {
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    marginBottom: 6,
  },
  previewMeta: {
    color: "#555",
    fontSize: 13,
    fontWeight: 850,
    marginBottom: 4,
  },
  previewMemo: {
    color: "#666",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.5,
    marginTop: 8,
    marginBottom: 12,
  },
  editButton: {
    width: "100%",
    minHeight: 42,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    fontSize: 14,
    fontWeight: 950,
  },
  memoInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 72,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111",
    padding: 12,
    fontSize: 14,
    fontWeight: 750,
    lineHeight: 1.5,
    resize: "vertical",
  },
  addButton: {
    width: "100%",
    minHeight: 48,
    borderRadius: 18,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "rgba(0,0,0,0.05)",
    color: "#111",
    fontSize: 15,
    fontWeight: 950,
    marginTop: 14,
  },
  plusButton: {
    width: 64,
    height: 64,
    borderRadius: 999,
    border: "none",
    background: "#74e05d",
    color: "#07110c",
    fontSize: 34,
    fontWeight: 950,
    display: "block",
    margin: "18px auto 6px",
    boxShadow: "0 16px 30px rgba(116,224,93,0.28)",
  },
  primaryButton: {
    width: "100%",
    minHeight: 58,
    borderRadius: 20,
    border: "none",
    background: "#74e05d",
    color: "#07110c",
    fontSize: 17,
    fontWeight: 950,
    marginTop: 12,
    boxShadow: "0 16px 30px rgba(116,224,93,0.28)",
  },
  doneText: {
    textAlign: "center",
    marginTop: 12,
    color: "#15803d",
    fontWeight: 950,
  },
  proBox: {
    borderRadius: 20,
    padding: 16,
    background:
      "linear-gradient(135deg, rgba(17,17,17,0.95), rgba(42,27,9,0.95))",
    color: "#fff",
    marginBottom: 14,
    border: "1px solid rgba(255,138,28,0.28)",
  },
  proBadge: {
    display: "inline-block",
    padding: "5px 10px",
    borderRadius: 999,
    background: "#ff8a1c",
    color: "#111",
    fontSize: 12,
    fontWeight: 950,
    marginBottom: 8,
  },
  proTitle: {
    fontSize: 18,
    fontWeight: 950,
    marginBottom: 6,
  },
  proText: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.56)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "20px 14px calc(20px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },
  modalSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "86vh",
    overflowY: "auto",
    borderRadius: 28,
    background: "#fff",
    color: "#111",
    padding: 20,
    boxSizing: "border-box",
    boxShadow: "0 -18px 50px rgba(0,0,0,0.35)",
  },
  modalHeader: {
    display: "grid",
    gridTemplateColumns: "52px 1fr 72px",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  modalClose: {
    width: 48,
    height: 48,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    color: "#111",
    fontSize: 24,
    fontWeight: 950,
  },
  modalTitle: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: 950,
  },
  modalSave: {
    minHeight: 48,
    borderRadius: 16,
    border: "none",
    background: "#111",
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
  },
  modalLabel: {
    display: "block",
    color: "#666",
    fontSize: 13,
    fontWeight: 900,
    margin: "14px 0 7px",
  },
  modalInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    color: "#111",
    padding: "0 14px",
    fontSize: 16,
    fontWeight: 850,
  },
  modalTimeGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  modalMemoInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 92,
    borderRadius: 16,
    border: "1px solid rgba(0,0,0,0.10)",
    background: "#fff",
    color: "#111",
    padding: 14,
    fontSize: 15,
    fontWeight: 750,
    lineHeight: 1.5,
    resize: "vertical",
  },
};