import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { calendar, completeOccurrence } from "../lib/api";

type DayTaskItem = {
  taskId: number | string;
  date: string;
  title: string;
  memo?: string;
  completed?: boolean;
  startTime?: string;
  endTime?: string;
  time?: string;
  tags?: Array<{
    id?: string | number;
    name?: string;
    label?: string;
    color?: string;
  }>;
};

function formatDateLabel(date?: string) {
  if (!date) return "今日";
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;

  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${weekdays[d.getDay()]})`;
}

function getTaskTimeLabel(item: DayTaskItem) {
  if (item.startTime && item.endTime) return `${item.startTime} - ${item.endTime}`;
  if (item.startTime) return `${item.startTime}〜`;
  if (item.time) return item.time;
  return "時間指定なし";
}

function getCompletionMessage(total: number, done: number) {
  if (total === 0) {
    return {
      eyebrow: "EMPTY DAY",
      title: "今日は余白があります",
      body: "予定がない日も大事です。回復・散歩・読書など、軽い行動を1つ置くのも良さそうです。",
      tip: "何もしない時間も、整える時間です 🌱",
    };
  }

  if (done === 0) {
    return {
      eyebrow: "TODAY FLOW",
      title: "まず1つだけでOK",
      body: "まだ完了はありません。重いタスクからではなく、5分で終わる行動から始めると流れが作りやすいです。",
      tip: "寝ながら読書5分、メモ1行でも前進です 🌿",
    };
  }

  if (done >= total) {
    return {
      eyebrow: "COMPLETE",
      title: "今日の流れ、整いました",
      body: "予定していた行動を完了できています。今日はここまででも十分。余力があれば回復を入れるとさらに良いです。",
      tip: "よく走り切りました。明日はまた小さく始めればOK ✨",
    };
  }

  return {
    eyebrow: "IN PROGRESS",
    title: "いい流れができています",
    body: "すでに行動が積み上がっています。残りは全部やろうとせず、次の1つだけ見れば大丈夫です。",
    tip: "完璧より、流れを切らないことが大事です ☕️",
  };
}

function getProgressColor(percent: number) {
  if (percent >= 100) return "#74e05d";
  if (percent >= 50) return "#67d957";
  if (percent > 0) return "#5dca4f";
  return "rgba(255,255,255,0.18)";
}

export default function DayTasksPage() {
  const navigate = useNavigate();
  const { date } = useParams();

  const [items, setItems] = useState<DayTaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingKey, setCompletingKey] = useState<string | null>(null);

  async function refresh() {
    if (!date) return;

    try {
      setError(null);
      setLoading(true);
      const data = await calendar(date, date);
      setItems((data ?? []).filter((it: DayTaskItem) => it.date === date));
    } catch (e: any) {
      setError(e?.message ?? "タスクの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const completedCount = useMemo(
    () => items.filter((item) => item.completed).length,
    [items]
  );

  const totalCount = items.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const message = getCompletionMessage(totalCount, completedCount);
  const remainingCount = Math.max(totalCount - completedCount, 0);

  async function handleComplete(item: DayTaskItem) {
    const key = `${item.taskId}@${item.date}`;
    setCompletingKey(key);
  
    try {
      await completeOccurrence(Number(item.taskId), item.date);
  
      navigator.vibrate?.(80);
  
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? "完了処理に失敗しました");
    } finally {
      setCompletingKey(null);
    }
  }

  return (
    <div style={ui.page}>
      <style>{`
        @keyframes softPulse {
          0% { transform: scale(1); opacity: .92; }
          50% { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); opacity: .92; }
        }
        @keyframes riseIn {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={ui.backgroundGlow} />

      <header style={ui.header}>
        <div>
          <div style={ui.brand}>TaskMoney</div>
          <h1 style={ui.title}>今日の予定</h1>
        </div>

        <div style={ui.headerActions}>
          <button style={ui.iconButton} onClick={() => navigate("/goals")} aria-label="目標へ戻る">
            🌿
          </button>
          <button style={ui.iconButton} onClick={() => navigate("/calendar")} aria-label="カレンダーへ戻る">
            📅
          </button>
        </div>
      </header>

      <section style={ui.heroCard}>
        <div style={ui.heroTop}>
          <div>
            <div style={ui.eyebrow}>{message.eyebrow}</div>
            <h2 style={ui.heroTitle}>{message.title}</h2>
          </div>
          <div style={ui.percentBadge}>
            <span style={ui.percentNumber}>{progressPercent}</span>
            <span style={ui.percentMark}>%</span>
          </div>
        </div>

        <p style={ui.heroBody}>{message.body}</p>

        <div style={ui.progressTrack}>
          <div
            style={{
              ...ui.progressFill,
              width: `${progressPercent}%`,
              background: getProgressColor(progressPercent),
            }}
          />
        </div>

        <div style={ui.heroMetaRow}>
          <div>
            <div style={ui.metaLabel}>DATE</div>
            <div style={ui.metaValue}>{formatDateLabel(date)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={ui.metaLabel}>TASKS</div>
            <div style={ui.metaValue}>{completedCount}/{totalCount}</div>
          </div>
        </div>

        <div style={ui.tipBox}>{message.tip}</div>
      </section>

      {error && <div style={ui.errorBox}>{error}</div>}

      <section style={ui.conditionCard}>
        <div style={ui.sectionHeader}>
          <div>
            <div style={ui.darkEyebrow}>TODAY CONDITION</div>
            <h2 style={ui.sectionTitle}>今日のタスク</h2>
          </div>
          <div style={ui.bigCount}>{completedCount}/{totalCount}</div>
        </div>

        <MeterRow icon="🚗" label="今日の走行" value={progressPercent} detail={`${completedCount}/${totalCount} 完了`} />
        <MeterRow icon="🌿" label="残りの行動" value={totalCount === 0 ? 0 : Math.round((remainingCount / totalCount) * 100)} detail={`${remainingCount}件`} muted />
      </section>

      <section style={ui.listCard}>
        <div style={ui.sectionHeaderLight}>
          <div>
            <div style={ui.lightEyebrow}>ACTION LIST</div>
            <h2 style={ui.listTitle}>次にやること</h2>
          </div>
          <button style={ui.smallButton} onClick={() => navigate("/calendar")}>戻る</button>
        </div>

        {loading ? (
          <div style={ui.emptyBox}>読み込み中です 🌿</div>
        ) : items.length === 0 ? (
          <div style={ui.emptyBox}>
            <div style={ui.emptyIcon}>☕️</div>
            <div style={ui.emptyTitle}>この日のタスクはありません</div>
            <div style={ui.emptyText}>予定を入れない日も、ちゃんと大事な日です。</div>
          </div>
        ) : (
          <div style={ui.taskList}>
            {items.map((it) => {
              const key = `${it.taskId}@${it.date}`;
              const isCompleting = completingKey === key;

              return (
                <article key={key} style={it.completed ? ui.taskCardDone : ui.taskCard}>
                  <div style={ui.taskCardTop}>
                    <div style={ui.taskIcon}>{it.completed ? "✓" : "🌿"}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={ui.taskTitle}>{it.title}</div>
                      <div style={ui.taskTime}>{getTaskTimeLabel(it)}</div>
                    </div>
                    <div style={it.completed ? ui.donePill : ui.todoPill}>
                      {it.completed ? "完了" : "未完了"}
                    </div>
                  </div>

                  {it.memo && <p style={ui.memo}>{it.memo}</p>}

                  {!!it.tags?.length && (
                    <div style={ui.tags}>
                      {it.tags.map((tag, idx) => (
                        <span key={`${tag.id ?? tag.name ?? idx}`} style={ui.tagBadge}>
                          <span
                            style={{
                              ...ui.tagDot,
                              background: tag.color || "#74e05d",
                            }}
                          />
                          {tag.name ?? tag.label ?? "タグ"}
                        </span>
                      ))}
                    </div>
                  )}

                  <div style={ui.taskActions}>
                    {!it.completed ? (
                      <button
                        style={ui.completeButton}
                        disabled={isCompleting}
                        onClick={() => handleComplete(it)}
                      >
                        {isCompleting ? "完了中..." : "完了"}
                      </button>
                    ) : (
                      <button style={ui.completedButton} disabled>
                        完了済み
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function MeterRow({
  icon,
  label,
  value,
  detail,
  muted = false,
}: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  muted?: boolean;
}) {
  return (
    <div style={ui.meterRow}>
      <div style={ui.meterTop}>
        <div style={ui.meterLabel}>
          <span style={ui.meterIcon}>{icon}</span>
          {label}
        </div>
        <div style={ui.meterDetail}>{detail} ・ {value}%</div>
      </div>
      <div style={ui.meterTrack}>
        <div
          style={{
            ...ui.meterFill,
            width: `${Math.max(0, Math.min(100, value))}%`,
            opacity: muted ? 0.78 : 1,
          }}
        />
      </div>
    </div>
  );
}

const ui: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "48px 20px calc(112px + env(safe-area-inset-bottom))",
    background: "radial-gradient(circle at 28% -10%, rgba(84, 214, 89, 0.28), transparent 34%), linear-gradient(180deg, #092514 0%, #07110c 46%, #050806 100%)",
    color: "#fff",
    overflowX: "hidden",
  },
  backgroundGlow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: "radial-gradient(circle at 72% 18%, rgba(97, 220, 82, 0.16), transparent 26%)",
    zIndex: 0,
  },
  header: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
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
  headerActions: {
    display: "flex",
    gap: 10,
    paddingTop: 10,
  },
  iconButton: {
    width: 58,
    height: 58,
    minWidth: 58,
    borderRadius: 22,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.10)",
    color: "#fff",
    fontSize: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 14px 26px rgba(0,0,0,0.18)",
    backdropFilter: "blur(18px)",
  },
  heroCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: 36,
    padding: "26px 24px",
    marginBottom: 18,
    background: "linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.055))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08)",
    backdropFilter: "blur(22px)",
    animation: "riseIn .35s ease both",
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
    background: "linear-gradient(145deg, rgba(103, 217, 87, 0.34), rgba(255,255,255,0.10))",
    border: "1px solid rgba(255,255,255,0.16)",
    boxShadow: "0 18px 34px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
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
    transition: "width .35s ease",
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
  errorBox: {
    position: "relative",
    zIndex: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 18,
    background: "rgba(254, 202, 202, 0.14)",
    border: "1px solid rgba(254, 202, 202, 0.25)",
    color: "#fecaca",
    fontWeight: 900,
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
    transition: "width .35s ease",
  },
  listCard: {
    position: "relative",
    zIndex: 1,
    borderRadius: "36px 36px 0 0",
    padding: "28px 24px 36px",
    margin: "0 -20px",
    background: "#f7f8f6",
    color: "#0d0f0d",
    boxShadow: "0 -18px 50px rgba(0,0,0,0.18)",
  },
  sectionHeaderLight: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 20,
  },
  lightEyebrow: {
    color: "rgba(0,0,0,0.18)",
    fontSize: 14,
    fontWeight: 950,
    letterSpacing: "0.22em",
    marginBottom: 8,
  },
  listTitle: {
    margin: 0,
    fontSize: 40,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.07em",
  },
  smallButton: {
    border: "1px solid #dfe3dc",
    background: "#fff",
    color: "#111",
    borderRadius: 18,
    padding: "12px 16px",
    fontWeight: 950,
    fontSize: 14,
    whiteSpace: "nowrap",
  },
  emptyBox: {
    borderRadius: 28,
    padding: "36px 22px",
    background: "rgba(0,0,0,0.035)",
    border: "1px solid rgba(0,0,0,0.06)",
    color: "#555",
    fontWeight: 900,
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#111",
    fontSize: 24,
    fontWeight: 950,
    marginBottom: 8,
  },
  emptyText: {
    color: "#777",
    fontSize: 15,
    lineHeight: 1.7,
  },
  taskList: {
    display: "grid",
    gap: 14,
  },
  taskCard: {
    borderRadius: 28,
    padding: "18px 18px",
    background: "linear-gradient(180deg, #ffffff, #eef1ed)",
    border: "1px solid rgba(0,0,0,0.08)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.055)",
    animation: "riseIn .32s ease both",
  },
  taskCardDone: {
    borderRadius: 28,
    padding: "18px 18px",
    background: "linear-gradient(180deg, rgba(116,224,93,0.18), #f5f7f4)",
    border: "1px solid rgba(92, 202, 78, 0.22)",
    boxShadow: "0 12px 26px rgba(0,0,0,0.045)",
    opacity: 0.92,
    animation: "riseIn .32s ease both",
  },
  taskCardTop: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  taskIcon: {
    width: 54,
    height: 54,
    minWidth: 54,
    borderRadius: 18,
    background: "#0f1110",
    color: "#74e05d",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    fontWeight: 950,
  },
  taskTitle: {
    color: "#101210",
    fontSize: 22,
    lineHeight: 1.22,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    wordBreak: "break-word",
  },
  taskTime: {
    marginTop: 6,
    color: "#777",
    fontSize: 14,
    fontWeight: 850,
  },
  todoPill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#111",
    color: "#fff",
    fontSize: 13,
    fontWeight: 950,
  },
  donePill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "8px 12px",
    background: "#dff8dc",
    color: "#247821",
    fontSize: 13,
    fontWeight: 950,
  },
  memo: {
    margin: "14px 0 0",
    color: "#666",
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.7,
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  tagBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 10px",
    background: "rgba(0,0,0,0.045)",
    color: "#333",
    fontSize: 13,
    fontWeight: 900,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 7,
  },
  taskActions: {
    marginTop: 16,
    display: "flex",
    justifyContent: "flex-end",
  },
  completeButton: {
    width: "100%",
    minHeight: 58,
    border: "none",
    borderRadius: 20,
    background: "#111",
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(0,0,0,0.14)",
  },
  completedButton: {
    width: "100%",
    minHeight: 58,
    border: "none",
    borderRadius: 20,
    background: "#dff8dc",
    color: "#247821",
    fontSize: 18,
    fontWeight: 950,
  },
};
