import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  createInboxItem,
  deleteInboxItem,
  getInboxItems,
  markInboxProcessed,
  type InboxItem,
} from "../lib/api";

const DEFAULT_USER_ID = 1;

type QuickStep = 1 | 2 | 3;

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickMemoOpen, setQuickMemoOpen] = useState(true);
  const [quickStep, setQuickStep] = useState<QuickStep>(1);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTargetDate, setQuickTargetDate] = useState("");
  const [quickMemo, setQuickMemo] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);

  const quickInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const userId = useMemo(() => {
    const raw = localStorage.getItem("userId");
    const parsed = raw ? Number(raw) : DEFAULT_USER_ID;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_ID;
  }, []);

  async function loadInbox() {
    setLoading(true);
    setError(null);

    try {
      const data = await getInboxItems(userId);
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "受信箱の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInbox();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenQuickMemo =
      params.get("quickMemo") === "1" || params.get("quickMemo") === "true";

    if (shouldOpenQuickMemo) {
      openQuickMemo();
      navigate("/inbox", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    if (!quickMemoOpen) return;

    setTimeout(() => {
      quickInputRef.current?.focus();
    }, 150);
  }, [quickMemoOpen, quickStep]);

  function openQuickMemo() {
    setQuickMemoOpen(true);
    setQuickStep(1);
    setQuickError(null);
  }

  function closeQuickMemo() {
    if (saving) return;

    setQuickMemoOpen(false);
    setQuickStep(1);
    setQuickTitle("");
    setQuickTargetDate("");
    setQuickMemo("");
    setQuickError(null);
  }

  function goNextStep() {
    setQuickError(null);

    if (quickStep === 1 && !quickTitle.trim()) {
      setQuickError("思いついたことを入力してください。");
      return;
    }

    if (quickStep < 3) {
      setQuickStep((prev) => (prev + 1) as QuickStep);
    }
  }

  function goPrevStep() {
    setQuickError(null);

    if (quickStep > 1) {
      setQuickStep((prev) => (prev - 1) as QuickStep);
    }
  }

  async function saveInboxItem(input: {
    title: string;
    memo?: string;
    targetDate?: string;
  }) {
    await createInboxItem({
      userId,
      title: input.title,
      memo: input.memo || undefined,
      targetDate: input.targetDate || undefined,
    });

    await loadInbox();
  }

  async function handleCreate() {
    const trimmedTitle = title.trim();
    const trimmedMemo = memo.trim();

    if (!trimmedTitle) {
      setError("思いついたことを入力してください。");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await saveInboxItem({
        title: trimmedTitle,
        memo: trimmedMemo,
        targetDate: targetDate || undefined,
      });

      setTitle("");
      setMemo("");
      setTargetDate("");
    } catch (e: any) {
      setError(e?.message || "瞬間メモの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickCreate() {
    const trimmedTitle = quickTitle.trim();
    const trimmedMemo = quickMemo.trim();

    if (!trimmedTitle) {
      setQuickError("思いついたことを入力してください。");
      setQuickStep(1);
      return;
    }

    setSaving(true);
    setQuickError(null);

    try {
      await saveInboxItem({
        title: trimmedTitle,
        memo: trimmedMemo,
        targetDate: quickTargetDate || undefined,
      });

      closeQuickMemo();
    } catch (e: any) {
      setQuickError(e?.message || "瞬間メモの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleProcessed(id: number) {
    setError(null);

    try {
      await markInboxProcessed(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      setError(e?.message || "整理済みにできませんでした。");
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("このメモを削除しますか？");
    if (!ok) return;

    setError(null);

    try {
      await deleteInboxItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      setError(e?.message || "削除に失敗しました。");
    }
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>GTD Inbox</p>
          <h1 style={styles.title}>受信箱</h1>
          <p style={styles.description}>
            思いついたことを、まずここに逃がします。細かい整理はあとでOK。
          </p>
        </div>

        <div style={styles.badge}>未整理 {items.length}件</div>
      </header>

      <section style={styles.card}>
        <div style={styles.cardTitleRow}>
          <h2 style={styles.cardTitle}>💡 瞬間メモ</h2>
          <button style={styles.miniButton} onClick={openQuickMemo}>
            ポップアップで追加
          </button>
        </div>

        <label style={styles.label}>
          何を思いつきましたか？
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：Netflix契約した / FP3級申し込み / スーパー4280円"
          />
        </label>

        <label style={styles.label}>
          予定日があれば
          <input
            style={styles.input}
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </label>

        <label style={styles.label}>
          メモ
          <textarea
            style={styles.textarea}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="補足があれば入力"
          />
        </label>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={{
            ...styles.primaryButton,
            opacity: saving ? 0.7 : 1,
          }}
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? "保存中..." : "受信箱に入れる"}
        </button>
      </section>

      <section style={styles.listSection}>
        <div style={styles.listHeader}>
          <h2 style={styles.cardTitle}>未整理</h2>
          <button style={styles.reloadButton} onClick={loadInbox}>
            再読み込み
          </button>
        </div>

        {loading ? (
          <p style={styles.muted}>読み込み中...</p>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📭</div>
            <p style={styles.emptyTitle}>未整理のメモはありません</p>
            <p style={styles.muted}>思いついたことを気軽に入れていきましょう。</p>
          </div>
        ) : (
          <div style={styles.list}>
            {items.map((item) => (
              <div key={item.id} style={styles.itemCard}>
                <div style={styles.itemMain}>
                  <div style={styles.itemTitle}>{item.title}</div>

                  {item.targetDate && (
                    <div style={styles.itemDate}>予定日：{item.targetDate}</div>
                  )}

                  {item.memo && <div style={styles.itemMemo}>{item.memo}</div>}
                </div>

                <div style={styles.actions}>
                  <button
                    style={styles.secondaryButton}
                    onClick={() => handleProcessed(item.id)}
                  >
                    整理済み
                  </button>

                  <button
                    style={styles.deleteButton}
                    onClick={() => handleDelete(item.id)}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {quickMemoOpen && (
        <div style={styles.modalBackdrop} onClick={closeQuickMemo}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHandle} />

            <div style={styles.stepHeader}>
              <div>
                <p style={styles.stepKicker}>STEP {quickStep} / 3</p>
                <h2 style={styles.modalTitle}>💡 瞬間メモ</h2>
              </div>

              <div style={styles.stepPills}>
                {[1, 2, 3].map((step) => (
                  <span
                    key={step}
                    style={{
                      ...styles.stepDot,
                      ...(quickStep === step ? styles.stepDotActive : {}),
                    }}
                  />
                ))}
              </div>
            </div>

            {quickStep === 1 && (
              <>
                <p style={styles.modalText}>
                  まずは頭の中から出すだけでOKです。
                </p>

                <label style={styles.bigQuestion}>
                  何を思いつきましたか？
                </label>

                <input
                  ref={quickInputRef as React.RefObject<HTMLInputElement>}
                  style={styles.bigInput}
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="例：スーパー4280円"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") goNextStep();
                  }}
                />
              </>
            )}

            {quickStep === 2 && (
              <>
                <p style={styles.modalText}>
                  日付が未定なら、そのまま次へ進んでOKです。
                </p>

                <label style={styles.bigQuestion}>
                  予定日はありますか？
                </label>

                <input
                  ref={quickInputRef as React.RefObject<HTMLInputElement>}
                  style={styles.bigInput}
                  type="date"
                  value={quickTargetDate}
                  onChange={(e) => setQuickTargetDate(e.target.value)}
                />
              </>
            )}

            {quickStep === 3 && (
              <>
                <p style={styles.modalText}>
                  補足がなければ空欄のまま保存できます。
                </p>

                <label style={styles.bigQuestion}>
                  補足メモはありますか？
                </label>

                <textarea
                  ref={quickInputRef as React.RefObject<HTMLTextAreaElement>}
                  style={styles.bigTextarea}
                  value={quickMemo}
                  onChange={(e) => setQuickMemo(e.target.value)}
                  placeholder="例：支払日をあとで確認する"
                />
              </>
            )}

            {quickError && <div style={styles.error}>{quickError}</div>}

            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={quickStep === 1 ? closeQuickMemo : goPrevStep}
                disabled={saving}
              >
                {quickStep === 1 ? "閉じる" : "戻る"}
              </button>

              {quickStep < 3 ? (
                <button
                  style={styles.primaryButton}
                  onClick={goNextStep}
                  disabled={saving}
                >
                  次へ
                </button>
              ) : (
                <button
                  style={{
                    ...styles.primaryButton,
                    opacity: saving ? 0.7 : 1,
                  }}
                  onClick={handleQuickCreate}
                  disabled={saving}
                >
                  {saving ? "保存中..." : "受信箱に入れる"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "24px",
    background:
      "linear-gradient(180deg, rgba(255,248,238,1) 0%, rgba(255,255,255,1) 45%, rgba(244,247,255,1) 100%)",
    color: "#1f2937",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    alignItems: "flex-start",
    marginBottom: "20px",
  },
  kicker: {
    margin: 0,
    fontSize: "12px",
    letterSpacing: "0.08em",
    color: "#f97316",
    fontWeight: 700,
  },
  title: {
    margin: "4px 0 6px",
    fontSize: "28px",
    fontWeight: 800,
  },
  description: {
    margin: 0,
    fontSize: "14px",
    color: "#6b7280",
    lineHeight: 1.6,
  },
  badge: {
    flexShrink: 0,
    padding: "8px 12px",
    borderRadius: "999px",
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: "13px",
    fontWeight: 700,
    border: "1px solid #fed7aa",
  },
  card: {
    background: "rgba(255,255,255,0.92)",
    borderRadius: "20px",
    padding: "18px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.08)",
    border: "1px solid rgba(255,255,255,0.8)",
    marginBottom: "22px",
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "14px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "18px",
    fontWeight: 800,
  },
  miniButton: {
    border: "1px solid #fed7aa",
    background: "#fff7ed",
    color: "#c2410c",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
    marginBottom: "12px",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "6px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    fontSize: "15px",
    outline: "none",
    background: "#fff",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: "6px",
    padding: "12px 14px",
    borderRadius: "14px",
    border: "1px solid #e5e7eb",
    fontSize: "15px",
    outline: "none",
    minHeight: "82px",
    resize: "vertical",
    background: "#fff",
  },
  error: {
    marginBottom: "12px",
    padding: "10px 12px",
    borderRadius: "12px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: "13px",
    fontWeight: 700,
  },
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: "16px",
    padding: "14px 16px",
    fontSize: "15px",
    fontWeight: 800,
    color: "#fff",
    background: "linear-gradient(135deg, #fb923c, #f97316)",
    boxShadow: "0 10px 20px rgba(249,115,22,0.25)",
  },
  listSection: {
    background: "rgba(255,255,255,0.72)",
    borderRadius: "20px",
    padding: "16px",
    border: "1px solid rgba(229,231,235,0.9)",
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },
  reloadButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: "999px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: 700,
    color: "#374151",
  },
  muted: {
    margin: 0,
    color: "#6b7280",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  empty: {
    padding: "28px 12px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "34px",
    marginBottom: "8px",
  },
  emptyTitle: {
    margin: "0 0 4px",
    fontWeight: 800,
    color: "#374151",
  },
  list: {
    display: "grid",
    gap: "12px",
  },
  itemCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 6px 16px rgba(15,23,42,0.05)",
  },
  itemMain: {
    minWidth: 0,
  },
  itemTitle: {
    fontSize: "15px",
    fontWeight: 800,
    color: "#111827",
    wordBreak: "break-word",
  },
  itemDate: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#2563eb",
    fontWeight: 700,
  },
  itemMemo: {
    marginTop: "6px",
    fontSize: "13px",
    color: "#4b5563",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexShrink: 0,
  },
  secondaryButton: {
    border: "none",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#065f46",
    background: "#d1fae5",
  },
  deleteButton: {
    border: "none",
    borderRadius: "999px",
    padding: "8px 10px",
    fontSize: "12px",
    fontWeight: 800,
    color: "#991b1b",
    background: "#fee2e2",
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    background: "rgba(15,23,42,0.35)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "16px",
    boxSizing: "border-box",
  },
  modalCard: {
    width: "100%",
    maxWidth: "520px",
    background: "rgba(255,255,255,0.98)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 20px 50px rgba(15,23,42,0.25)",
    border: "1px solid rgba(255,255,255,0.8)",
    boxSizing: "border-box",
  },
  modalHandle: {
    width: "44px",
    height: "5px",
    borderRadius: "999px",
    background: "#d1d5db",
    margin: "0 auto 14px",
  },
  stepHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: "12px",
    alignItems: "center",
    marginBottom: "8px",
  },
  stepKicker: {
    margin: "0 0 4px",
    fontSize: "11px",
    fontWeight: 900,
    color: "#f97316",
    letterSpacing: "0.08em",
  },
  stepPills: {
    display: "flex",
    gap: "6px",
  },
  stepDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "#e5e7eb",
  },
  stepDotActive: {
    width: "22px",
    background: "#f97316",
  },
  modalTitle: {
    margin: 0,
    fontSize: "22px",
    fontWeight: 900,
    color: "#111827",
  },
  modalText: {
    margin: "0 0 18px",
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: 1.6,
  },
  bigQuestion: {
    display: "block",
    fontSize: "20px",
    fontWeight: 900,
    color: "#111827",
    marginBottom: "14px",
    lineHeight: 1.4,
  },
  bigInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "16px 16px",
    borderRadius: "18px",
    border: "2px solid #e5e7eb",
    fontSize: "18px",
    fontWeight: 700,
    outline: "none",
    background: "#fff",
    marginBottom: "18px",
  },
  bigTextarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "16px 16px",
    borderRadius: "18px",
    border: "2px solid #e5e7eb",
    fontSize: "17px",
    fontWeight: 700,
    outline: "none",
    background: "#fff",
    minHeight: "130px",
    resize: "vertical",
    marginBottom: "18px",
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: "10px",
    marginTop: "4px",
  },
  cancelButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    borderRadius: "16px",
    padding: "14px 12px",
    fontSize: "14px",
    fontWeight: 800,
  },
};