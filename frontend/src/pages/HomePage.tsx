// src/pages/HomePage.tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  clearToken,
  listGoals,
  type GoalListItem,
} from "../lib/api";
import {
  createInboxItem,
  deleteInboxItem,
  getInboxItems,
  markInboxProcessed,
  type InboxItem,
} from "../lib/inboxStore";

const DEFAULT_USER_ID = 1;

type ReminderType =
  | "none"
  | "sameDayMorning"
  | "previousDay20"
  | "threeDays20"
  | "oneWeek20"
  | "dailyMorningNight";

type CalendarScheduleEvent = {
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
  reminderType?: ReminderType;
  must?: boolean;
  eventType?: "challenge";
};

type QuickStep = 1 | 2 | 3;

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

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function saveMemoAsSchedule(input: {
  title: string;
  memo?: string;
  targetDate?: string;
  must?: boolean;
}) {
  if (!input.targetDate) return;

  const schedules = loadSchedules();
  const next: CalendarScheduleEvent[] = [
    ...schedules,
    {
      id: uid(),
      title: input.title,
      memo: input.memo || "",
      startDate: input.targetDate,
      endDate: input.targetDate,
      weekdays: [],
      oneShot: true,
      completedDates: [],
      reminderType: input.must ? "previousDay20" : "none",
      must: !!input.must,
    },
  ];

  saveSchedules(next);
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

function occursOnDate(ev: CalendarScheduleEvent, dateStr: string) {
  if (ev.oneShot || !ev.weekdays || ev.weekdays.length === 0) {
    return ev.startDate === dateStr;
  }

  if (ymdToNum(dateStr) < ymdToNum(ev.startDate)) return false;
  if (ymdToNum(dateStr) > ymdToNum(ev.endDate)) return false;

  const d = parseYMD(dateStr);
  return !!ev.weekdays[d.getDay()];
}

function getTodayMessage(params: {
  todayTotal: number;
  todayDone: number;
  inboxCount: number;
  goalsCount: number;
}) {
  const { todayTotal, todayDone, inboxCount, goalsCount } = params;

  if (todayTotal === 0 && inboxCount === 0) {
    return {
      icon: "🌱",
      title: "今日はここから始められます",
      body: "思いついたことを1つ逃がすだけでも、今日の流れは動き始めます。",
    };
  }

  if (inboxCount >= 3) {
    return {
      icon: "📝",
      title: "頭の中を軽くできます",
      body: "未整理メモが少し溜まっています。あとで整えればOK。まずは逃がせているだけで前進です。",
    };
  }

  if (todayTotal > 0 && todayDone === todayTotal) {
    return {
      icon: "✨",
      title: "今日の前進、かなり良い流れです",
      body: "予定していた行動が完了しています。カレンダーに刻まれる記録が増えています。",
    };
  }

  if (todayDone > 0) {
    return {
      icon: "🌿",
      title: "今日も前に進んでいます",
      body: "完璧じゃなくて大丈夫。できたことだけが、あなたのログとして残っていきます。",
    };
  }

  if (goalsCount > 0) {
    return {
      icon: "➡️",
      title: "未来は今日の一歩にできます",
      body: "Progressで今日やることを1つ選ぶだけでも、目標への流れができます。",
    };
  }

  return {
    icon: "💡",
    title: "まずは思いつきを逃がしましょう",
    body: "整理はあとでOK。Homeは頭の中を軽くする入り口です。",
  };
}

function challengeStorageKey(dateStr: string) {
  return `todo-money:challenge:v1:${getCurrentUserKey()}:${dateStr}`;
}

type ChallengeStatus = "none" | "shown" | "accepted" | "dismissed";

function getChallengeStatus(dateStr: string): ChallengeStatus {
  const raw = localStorage.getItem(challengeStorageKey(dateStr));
  if (raw === "shown" || raw === "accepted" || raw === "dismissed") return raw;
  return "none";
}

function setChallengeStatus(dateStr: string, status: ChallengeStatus) {
  localStorage.setItem(challengeStorageKey(dateStr), status);
}

function getChallengeAppearRate() {
  return 0.3;
}

export default function HomePage() {
  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [schedules, setSchedules] = useState<CalendarScheduleEvent[]>(() =>
    loadSchedules()
  );

  const [items, setItems] = useState<InboxItem[]>([]);
  const [title, setTitle] = useState("");
  const [memo, setMemo] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [must, setMust] = useState(true);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickMemoOpen, setQuickMemoOpen] = useState(false);
  const [quickStep, setQuickStep] = useState<QuickStep>(1);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickTargetDate, setQuickTargetDate] = useState("");
  const [quickMust, setQuickMust] = useState(true);
  const [quickMemo, setQuickMemo] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);

  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeError, setChallengeError] = useState<string | null>(null);

  const quickInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null
  );

  const location = useLocation();
  const navigate = useNavigate();

  const isLoggedIn = !!localStorage.getItem("todoMoneyToken");
  const isGuest = localStorage.getItem("todoMoneyUserKey") === "guest";

  function logout() {
    clearToken();
    navigate("/login", { replace: true });
  }

  function goLogin() {
    navigate("/login");
  }

  const userId = useMemo(() => {
    const raw = localStorage.getItem("userId");
    const parsed = raw ? Number(raw) : DEFAULT_USER_ID;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USER_ID;
  }, []);

  const todayYmd = useMemo(() => toYMD(new Date()), []);

  async function loadGoals() {
    const g = await listGoals();
    setGoals(g);
  }

  async function loadInbox() {
    setLoadingInbox(true);
    setError(null);

    try {
      const data = await getInboxItems(userId);
      setItems(data);
    } catch (e: any) {
      setError(e?.message || "受信箱の取得に失敗しました。");
    } finally {
      setLoadingInbox(false);
    }
  }

  function refreshLocal() {
    setSchedules(loadSchedules());
  }

  useEffect(() => {
    void loadGoals();
    void loadInbox();
    refreshLocal();

    const onFocus = () => {
      void loadGoals();
      void loadInbox();
      refreshLocal();
    };

    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onFocus);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    const quickMemoParam =
      params.get("quickMemo") || params.get("quick-memo");

    const shouldOpenQuickMemo =
      quickMemoParam === "1" || quickMemoParam === "true";

    if (shouldOpenQuickMemo) {
      openQuickMemo();
      navigate("/", { replace: true });
    }
  }, [location.search, navigate]);

  useEffect(() => {
    const state = location.state as { quickMemo?: boolean } | null;

    if (state?.quickMemo) {
      openQuickMemo();

      navigate("/", {
        replace: true,
        state: null,
      });
    }
  }, [location.state, navigate]);

  useEffect(() => {
    if (!quickMemoOpen) return;

    setTimeout(() => {
      quickInputRef.current?.focus();
    }, 150);
  }, [quickMemoOpen, quickStep]);

  useEffect(() => {
    if (!isLoggedIn && !isGuest) return;

    const status = getChallengeStatus(todayYmd);
    if (status !== "none") return;

    const timer = window.setTimeout(() => {
      if (Math.random() <= getChallengeAppearRate()) {
        setChallengeStatus(todayYmd, "shown");
        setChallengeOpen(true);
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [isLoggedIn, isGuest, todayYmd]);

  const todaySchedules = useMemo(() => {
    return schedules.filter((ev) => occursOnDate(ev, todayYmd));
  }, [schedules, todayYmd]);

  const todayDone = useMemo(() => {
    return todaySchedules.filter((ev) => ev.completedDates?.includes(todayYmd))
      .length;
  }, [todaySchedules, todayYmd]);

  const todayRate =
    todaySchedules.length === 0
      ? 0
      : Math.round((todayDone / todaySchedules.length) * 100);

  const totalEarned = goals.reduce((s, g: any) => s + (g.earnedAmount ?? 0), 0);
  const goalProgressTotal = goals.reduce((s, g: any) => s + (g.taskCount ?? 0), 0);
  const goalProgressDone = goals.reduce(
    (s, g: any) => s + (g.completedTaskCount ?? 0),
    0
  );

  const message = getTodayMessage({
    todayTotal: todaySchedules.length,
    todayDone,
    inboxCount: items.length,
    goalsCount: goals.length,
  });

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
    setQuickMust(true);
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
    must?: boolean;
  }) {
    await createInboxItem({
      userId,
      title: input.title,
      memo: input.memo || undefined,
      targetDate: input.targetDate || undefined,
    });

    saveMemoAsSchedule({
      title: input.title,
      memo: input.memo,
      targetDate: input.targetDate,
      must: input.must,
    });

    refreshLocal();
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
        must,
      });

      setTitle("");
      setMemo("");
      setTargetDate("");
      setMust(true);
    } catch (e: any) {
      setError(e?.message || "瞬間メモの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptChallenge() {
    const trimmedTitle = challengeTitle.trim();

    if (!trimmedTitle) {
      setChallengeError("今日の挑戦を入力してください。");
      return;
    }

    setSaving(true);
    setChallengeError(null);

    try {
      await createInboxItem({
        userId,
        title: `🚗 挑戦者ミッション：${trimmedTitle}`,
        memo: "挑戦者が現れた。今日はいつもと違う道を走ってみる。",
        targetDate: todayYmd,
      });

      const nextSchedules: CalendarScheduleEvent[] = [
        ...loadSchedules(),
        {
          id: uid(),
          title: trimmedTitle,
          memo: "🚗 挑戦者ミッション。達成できたら、今日の足跡に残ります。",
          startDate: todayYmd,
          endDate: todayYmd,
          weekdays: [],
          oneShot: true,
          completedDates: [],
          reminderType: "none",
          must: false,
          eventType: "challenge",
        },
      ];

      saveSchedules(nextSchedules);
      setSchedules(nextSchedules);
      await loadInbox();

      setChallengeStatus(todayYmd, "accepted");
      setChallengeTitle("");
      setChallengeOpen(false);
      navigate("/calendar");
    } catch (e: any) {
      setChallengeError(e?.message || "挑戦者ミッションの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  function handleDismissChallenge() {
    setChallengeStatus(todayYmd, "dismissed");
    setChallengeTitle("");
    setChallengeError(null);
    setChallengeOpen(false);
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
        must: quickMust,
      });

      closeQuickMemo();
    } catch (e: any) {
      setQuickError(e?.message || "瞬間メモの保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  }

  async function handleProcessed(id: string) {
    setError(null);

    try {
      await markInboxProcessed(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e: any) {
      setError(e?.message || "整理済みにできませんでした。");
    }
  }

  async function handleDelete(id: string) {
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
      <div style={styles.backgroundGlow} />

      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>HOME BASE</div>
          <h1 style={styles.title}>Home</h1>
          <p style={styles.lead}>
            思いつきを逃がして、今日の前進を確認します。
          </p>
        </div>

        <div style={styles.headerActions}>
  {isLoggedIn || isGuest ? (
    <button
      type="button"
      style={styles.headerMiniButton}
      onClick={logout}
    >
      Logout
    </button>
  ) : (
    <button
      type="button"
      style={styles.headerMiniButton}
      onClick={goLogin}
    >
      Login
    </button>
  )}

  <button
    style={styles.quickButton}
    onClick={openQuickMemo}
    aria-label="瞬間メモを追加"
  >
    ＋Memo
  </button>
</div>
      </header>

      <section style={styles.heroCard}>
        <div style={styles.heroIcon}>{message.icon}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.heroTitle}>{message.title}</div>
          <div style={styles.heroText}>{message.body}</div>
        </div>
      </section>

      <section style={styles.challengeTeaser}>
        <div>
          <div style={styles.challengeTeaserKicker}>RANDOM EVENT</div>
          <div style={styles.challengeTeaserTitle}>🚗 挑戦者イベント</div>
          <div style={styles.challengeTeaserText}>
            今日だけの小さな挑戦を作って、達成したら足跡に残せます。
          </div>
        </div>
        <button
          type="button"
          style={styles.challengeTeaserButton}
          onClick={() => {
            setChallengeError(null);
            setChallengeOpen(true);
          }}
        >
          呼ぶ
        </button>
      </section>

      <section style={styles.statusGrid}>
        <button style={styles.statusCard} onClick={() => navigate("/schedule")}>
          <div style={styles.statusLabel}>TODAY</div>
          <div style={styles.statusValue}>{todayRate}%</div>
          <div style={styles.statusSub}>
            {todayDone}/{todaySchedules.length} 完了
          </div>
        </button>

        <button style={styles.statusCard} onClick={() => navigate("/schedule")}>
          <div style={styles.statusLabel}>PROGRESS</div>
          <div style={styles.statusValue}>{goalProgressDone}</div>
          <div style={styles.statusSub}>tasks done</div>
        </button>

        <button style={styles.statusCard} onClick={() => navigate("/")}>
          <div style={styles.statusLabel}>INBOX</div>
          <div style={styles.statusValue}>{items.length}</div>
          <div style={styles.statusSub}>未整理</div>
        </button>

        <button style={styles.statusCard} onClick={() => navigate("/analysis")}>
          <div style={styles.statusLabel}>MONEY</div>
          <div style={styles.statusValueSmall}>¥{Math.round(totalEarned)}</div>
          <div style={styles.statusSub}>積み上げ</div>
        </button>
      </section>

      <section style={styles.card}>
        <div style={styles.cardTitleRow}>
          <div>
            <div style={styles.sectionKicker}>QUICK CAPTURE</div>
            <h2 style={styles.cardTitle}>💡 瞬間メモ</h2>
          </div>
          <button style={styles.miniButton} onClick={openQuickMemo}>
            ポップアップ
          </button>
        </div>

        <label style={styles.label}>
          何を思いつきましたか？
          <input
            style={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例：歯医者予約 / FP3級申し込み / スーパー4280円"
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

        <button
          type="button"
          style={must ? styles.mustToggleActive : styles.mustToggle}
          onClick={() => setMust((prev) => !prev)}
        >
          <div style={styles.mustTextBlock}>
            <div style={styles.mustTitle}>カレンダーに常に表示</div>
            <div style={styles.mustSub}>
              ON：予定として常時表示。OFF：完了後だけ記録。
            </div>
          </div>
          <div style={must ? styles.mustPillActive : styles.mustPill}>
            {must ? "Must" : "任意"}
          </div>
        </button>

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
          {saving
            ? "保存中..."
            : targetDate
              ? must
                ? "保存してカレンダーに反映"
                : "保存してProgressに追加"
              : "受信箱に入れる"}
        </button>
      </section>

      <section style={styles.listSection}>
        <div style={styles.listHeader}>
          <div>
            <div style={styles.sectionKicker}>GTD INBOX</div>
            <h2 style={styles.cardTitle}>未整理</h2>
          </div>
          <button style={styles.reloadButton} onClick={loadInbox}>
            再読み込み
          </button>
        </div>

        {loadingInbox ? (
          <p style={styles.muted}>読み込み中...</p>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>📭</div>
            <p style={styles.emptyTitle}>未整理のメモはありません</p>
            <p style={styles.muted}>思いついたことを気軽に入れていきましょう。</p>
          </div>
        ) : (
          <div style={styles.list}>
            {items.slice(0, 5).map((item) => (
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

            {items.length > 5 && (
              <div style={styles.moreInbox}>ほか {items.length - 5} 件</div>
            )}
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

                <label style={styles.bigQuestion}>何を思いつきましたか？</label>

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

                <label style={styles.bigQuestion}>予定日はありますか？</label>

                <input
                  ref={quickInputRef as React.RefObject<HTMLInputElement>}
                  style={styles.bigInput}
                  type="date"
                  value={quickTargetDate}
                  onChange={(e) => setQuickTargetDate(e.target.value)}
                />

                <button
                  type="button"
                  style={quickMust ? styles.mustToggleActive : styles.mustToggle}
                  onClick={() => setQuickMust((prev) => !prev)}
                >
                  <div style={styles.mustTextBlock}>
                    <div style={styles.mustTitle}>カレンダーに常に表示</div>
                    <div style={styles.mustSub}>
                      ON：予定として常時表示。OFF：完了後だけ記録。
                    </div>
                  </div>
                  <div style={quickMust ? styles.mustPillActive : styles.mustPill}>
                    {quickMust ? "Must" : "任意"}
                  </div>
                </button>
              </>
            )}

            {quickStep === 3 && (
              <>
                <p style={styles.modalText}>
                  補足がなければ空欄のまま保存できます。
                </p>

                <label style={styles.bigQuestion}>補足メモはありますか？</label>

                <textarea
                  ref={quickInputRef as React.RefObject<HTMLTextAreaElement>}
                  style={styles.bigTextarea}
                  value={quickMemo}
                  onChange={(e) => setQuickMemo(e.target.value)}
                  placeholder="例：支払日をあとで確認する"
                />
              </>
            )}

            {quickError && <div style={styles.errorLight}>{quickError}</div>}

            <div style={styles.modalActions}>
              <button
                style={styles.cancelButton}
                onClick={quickStep === 1 ? closeQuickMemo : goPrevStep}
                disabled={saving}
              >
                {quickStep === 1 ? "閉じる" : "戻る"}
              </button>

              {quickStep < 3 ? (
                <button style={styles.primaryButtonLight} onClick={goNextStep} disabled={saving}>
                  次へ
                </button>
              ) : (
                <button
                  style={{
                    ...styles.primaryButtonLight,
                    opacity: saving ? 0.7 : 1,
                  }}
                  onClick={handleQuickCreate}
                  disabled={saving}
                >
                  {saving
                    ? "保存中..."
                    : quickTargetDate
                      ? quickMust
                        ? "保存してカレンダーに反映"
                        : "保存してProgressに追加"
                      : "受信箱に入れる"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {challengeOpen && (
        <div style={styles.challengeBackdrop} onClick={handleDismissChallenge}>
          <section
            style={styles.challengeModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.challengeBadge}>🚗</div>
            <div style={styles.challengeKicker}>MISSION EVENT</div>
            <h2 style={styles.challengeTitle}>挑戦者現る</h2>
            <p style={styles.challengeMessage}>
              「今日はいつもと違う道を走ってみないか？」
            </p>
            <p style={styles.challengeSub}>
              倒す必要はありません。今日の自分に、ひとつだけ小さな挑戦を置いてみましょう。
              達成できたら、足跡として残ります。
            </p>

            <input
              style={styles.challengeInput}
              value={challengeTitle}
              onChange={(e) => setChallengeTitle(e.target.value)}
              placeholder="例：散歩10分 / 本を5ページ / 机を1箇所片付ける"
              autoFocus
            />

            {challengeError && <div style={styles.challengeError}>{challengeError}</div>}

            <div style={styles.challengeActions}>
              <button
                type="button"
                style={styles.challengeCancelButton}
                onClick={handleDismissChallenge}
                disabled={saving}
              >
                また今度
              </button>
              <button
                type="button"
                style={{
                  ...styles.challengeStartButton,
                  opacity: saving ? 0.7 : 1,
                }}
                onClick={handleAcceptChallenge}
                disabled={saving}
              >
                {saving ? "保存中..." : "挑戦を受ける"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: "relative",
    minHeight: "100vh",
    padding: "38px 14px calc(92px + env(safe-area-inset-bottom))",
    background:
      "radial-gradient(circle at 28% -10%, rgba(84, 214, 89, 0.13), transparent 34%), linear-gradient(180deg, #111312 0%, #0d100e 48%, #0a0c0b 100%)",
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 14,
  },
  eyebrow: {
    color: "#72d85b",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "0.08em",
    marginBottom: 6,
  },
  title: {
    margin: 0,
    color: "#fff",
    fontSize: 50,
    lineHeight: 0.94,
    fontWeight: 950,
    letterSpacing: "-0.08em",
  },
  lead: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,0.54)",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.55,
  },
  quickButton: {
    minHeight: 50,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 17px",
    fontSize: 16,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(0,0,0,0.20)",
  },
  heroCard: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: 13,
    borderRadius: 28,
    border: "1px solid rgba(116,224,93,0.14)",
    background:
      "linear-gradient(135deg, rgba(116,224,93,0.13), rgba(255,255,255,0.045))",
    padding: "18px 16px",
    marginBottom: 12,
  },
  heroIcon: {
    width: 54,
    height: 54,
    minWidth: 54,
    borderRadius: 19,
    background: "#141715",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 27,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    marginBottom: 5,
  },
  heroText: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.5,
  },
  statusGrid: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 14,
  },
  statusCard: {
    border: "1px solid rgba(255,255,255,0.07)",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    borderRadius: 24,
    padding: "15px 14px",
    color: "#fff",
    textAlign: "left",
    minHeight: 96,
  },
  statusLabel: {
    color: "rgba(255,255,255,0.42)",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    marginBottom: 8,
  },
  statusValue: {
    color: "#8df277",
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1,
  },
  statusValueSmall: {
    color: "#8df277",
    fontSize: 22,
    fontWeight: 950,
    lineHeight: 1.1,
  },
  statusSub: {
    marginTop: 7,
    color: "rgba(255,255,255,0.50)",
    fontSize: 12,
    fontWeight: 850,
  },
  card: {
    position: "relative",
    zIndex: 1,
    borderRadius: 30,
    background: "rgba(8,10,9,0.78)",
    border: "1px solid rgba(255,255,255,0.07)",
    padding: "18px 16px",
    boxShadow: "0 -14px 34px rgba(0,0,0,0.18)",
    marginBottom: 14,
  },
  cardTitleRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 14,
  },
  sectionKicker: {
    color: "#72d85b",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 6,
  },
  cardTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  miniButton: {
    border: "1px solid rgba(116,224,93,0.28)",
    background: "rgba(116,224,93,0.12)",
    color: "#9df58d",
    borderRadius: 999,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  label: {
    display: "block",
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    fontWeight: 900,
    marginBottom: 12,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 7,
    minHeight: 54,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    padding: "0 14px",
    fontSize: 16,
    fontWeight: 900,
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    marginTop: 7,
    minHeight: 92,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.07)",
    color: "#fff",
    padding: 14,
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.5,
    outline: "none",
    resize: "vertical",
  },
  mustToggle: {
    width: "100%",
    margin: "0 0 12px",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.09)",
    background: "rgba(255,255,255,0.06)",
    padding: "13px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
  },
  mustToggleActive: {
    width: "100%",
    margin: "0 0 12px",
    borderRadius: 18,
    border: "1px solid rgba(116,224,93,0.72)",
    background: "rgba(116,224,93,0.18)",
    padding: "13px 14px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textAlign: "left",
    boxShadow: "0 0 0 1px rgba(116,224,93,0.24) inset",
  },
  mustTextBlock: {
    minWidth: 0,
    flex: 1,
  },
  mustTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: 950,
  },
  mustSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  mustPill: {
    flex: "0 0 auto",
    borderRadius: 999,
    padding: "7px 10px",
    background: "rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.68)",
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
  error: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,80,80,0.13)",
    color: "#ffb5b5",
    fontSize: 13,
    fontWeight: 800,
  },
  primaryButton: {
    width: "100%",
    border: "none",
    borderRadius: 18,
    minHeight: 56,
    padding: "14px 16px",
    fontSize: 16,
    fontWeight: 950,
    color: "#07110c",
    background: "#74e05d",
    boxShadow: "0 12px 24px rgba(116,224,93,0.20)",
  },
  listSection: {
    position: "relative",
    zIndex: 1,
    borderRadius: 30,
    background: "rgba(8,10,9,0.78)",
    border: "1px solid rgba(255,255,255,0.07)",
    padding: "18px 16px",
    marginBottom: 14,
  },
  listHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  reloadButton: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    borderRadius: 999,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
  },
  muted: {
    margin: 0,
    color: "rgba(255,255,255,0.52)",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 800,
  },
  empty: {
    padding: "24px 12px",
    textAlign: "center",
    borderRadius: 22,
    background: "rgba(255,255,255,0.045)",
  },
  emptyIcon: {
    fontSize: 34,
    marginBottom: 8,
  },
  emptyTitle: {
    margin: "0 0 4px",
    fontWeight: 950,
    color: "#fff",
  },
  list: {
    display: "grid",
    gap: 12,
  },
  itemCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.045))",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 12px 24px rgba(0,0,0,0.13)",
  },
  itemMain: {
    minWidth: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: 950,
    color: "#fff",
    wordBreak: "break-word",
  },
  itemDate: {
    marginTop: 6,
    fontSize: 12,
    color: "#9df58d",
    fontWeight: 900,
  },
  itemMemo: {
    marginTop: 6,
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontWeight: 800,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    flexShrink: 0,
  },
  secondaryButton: {
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 950,
    color: "#07210d",
    background: "#bff5b0",
  },
  deleteButton: {
    border: "none",
    borderRadius: 999,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 950,
    color: "#a81919",
    background: "rgba(255,180,180,0.92)",
  },
  moreInbox: {
    borderRadius: 18,
    padding: 12,
    textAlign: "center",
    color: "rgba(255,255,255,0.56)",
    background: "rgba(255,255,255,0.045)",
    fontSize: 13,
    fontWeight: 900,
  },
  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 999,
    background: "rgba(0,0,0,0.62)",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: 16,
    boxSizing: "border-box",
  },
  modalCard: {
    width: "100%",
    maxWidth: 520,
    background: "#f7f8f6",
    borderRadius: 28,
    padding: 18,
    boxShadow: "0 -20px 50px rgba(0,0,0,0.30)",
    border: "1px solid rgba(255,255,255,0.8)",
    boxSizing: "border-box",
  },
  modalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    background: "rgba(0,0,0,0.12)",
    margin: "0 auto 14px",
  },
  stepHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  stepKicker: {
    margin: "0 0 4px",
    fontSize: 11,
    fontWeight: 950,
    color: "#61cf4d",
    letterSpacing: "0.10em",
  },
  stepPills: {
    display: "flex",
    gap: 6,
  },
  stepDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    background: "#d7dbd5",
  },
  stepDotActive: {
    width: 22,
    background: "#74e05d",
  },
  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 950,
    color: "#111827",
  },
  modalText: {
    margin: "0 0 18px",
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 1.6,
    fontWeight: 800,
  },
  bigQuestion: {
    display: "block",
    fontSize: 20,
    fontWeight: 950,
    color: "#111827",
    marginBottom: 14,
    lineHeight: 1.4,
  },
  bigInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "16px 16px",
    borderRadius: 18,
    border: "2px solid #e5e7eb",
    fontSize: 18,
    fontWeight: 850,
    outline: "none",
    background: "#fff",
    color: "#111",
    marginBottom: 18,
  },
  bigTextarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "16px 16px",
    borderRadius: 18,
    border: "2px solid #e5e7eb",
    fontSize: 17,
    fontWeight: 800,
    outline: "none",
    background: "#fff",
    color: "#111",
    minHeight: 130,
    resize: "vertical",
    marginBottom: 18,
  },
  modalActions: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    border: "1px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    borderRadius: 16,
    padding: "14px 12px",
    fontSize: 14,
    fontWeight: 900,
  },
  primaryButtonLight: {
    width: "100%",
    border: "none",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 15,
    fontWeight: 950,
    color: "#07110c",
    background: "#74e05d",
    boxShadow: "0 10px 20px rgba(116,224,93,0.20)",
  },
  errorLight: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 800,
  },
  headerActions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  
  headerMiniButton: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.86)",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 950,
  },
  challengeTeaser: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 24,
    border: "1px solid rgba(116,224,93,0.16)",
    background: "linear-gradient(135deg, rgba(116,224,93,0.12), rgba(255,255,255,0.045))",
    padding: "14px 14px",
    marginBottom: 14,
  },
  challengeTeaserKicker: {
    color: "#72d85b",
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.16em",
    marginBottom: 4,
  },
  challengeTeaserTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  challengeTeaserText: {
    marginTop: 4,
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45,
  },
  challengeTeaserButton: {
    flex: "0 0 auto",
    border: "1px solid rgba(116,224,93,0.32)",
    background: "rgba(116,224,93,0.16)",
    color: "#9df58d",
    borderRadius: 999,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 950,
  },
  challengeBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,0.74)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    boxSizing: "border-box",
  },
  challengeModal: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 32,
    border: "1px solid rgba(116,224,93,0.22)",
    background: "radial-gradient(circle at 50% 0%, rgba(116,224,93,0.22), transparent 38%), linear-gradient(180deg, #18231b, #0d100e)",
    boxShadow: "0 28px 80px rgba(0,0,0,0.48)",
    padding: "26px 20px 20px",
    textAlign: "center",
    boxSizing: "border-box",
  },
  challengeBadge: {
    width: 78,
    height: 78,
    borderRadius: 28,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 38,
    margin: "0 auto 14px",
  },
  challengeKicker: {
    color: "#72d85b",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: "0.18em",
    marginBottom: 8,
  },
  challengeTitle: {
    margin: 0,
    color: "#fff",
    fontSize: 34,
    fontWeight: 950,
    letterSpacing: "-0.07em",
  },
  challengeMessage: {
    margin: "14px 0 0",
    color: "#fff",
    fontSize: 19,
    lineHeight: 1.55,
    fontWeight: 950,
  },
  challengeSub: {
    margin: "12px 0 18px",
    color: "rgba(255,255,255,0.58)",
    fontSize: 13,
    lineHeight: 1.7,
    fontWeight: 800,
  },
  challengeInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 58,
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    padding: "0 15px",
    fontSize: 15,
    fontWeight: 900,
    outline: "none",
    marginBottom: 12,
  },
  challengeError: {
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,80,80,0.13)",
    color: "#ffb5b5",
    fontSize: 13,
    fontWeight: 800,
  },
  challengeActions: {
    display: "grid",
    gridTemplateColumns: "110px 1fr",
    gap: 10,
  },
  challengeCancelButton: {
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.76)",
    borderRadius: 18,
    padding: "14px 12px",
    fontSize: 13,
    fontWeight: 950,
  },
  challengeStartButton: {
    border: "none",
    background: "#74e05d",
    color: "#07110c",
    borderRadius: 18,
    padding: "14px 16px",
    fontSize: 15,
    fontWeight: 950,
    boxShadow: "0 12px 24px rgba(116,224,93,0.20)",
  },

};
