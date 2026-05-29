// src/pages/LoginPage.tsx
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { guestLogin, login, register, setToken } from "../lib/api";

type Slide = {
  id: number;
  headline: string;
  sub: string;
  bg: string;
  accent: string;
  scene: "light" | "footprints" | "sunrise" | "road";
  symbol: string;
};

const SLIDES: Slide[] = [
  {
    id: 0,
    symbol: "•",
    headline: "どこから始めてもいい",
    sub: "暗い道にも、小さな光がある",
    bg: "radial-gradient(circle at 50% 88%, rgba(86,220,80,0.22), transparent 34%), linear-gradient(180deg, #092514 0%, #06100b 55%, #020504 100%)",
    accent: "#76dd64",
    scene: "light",
  },
  {
    id: 1,
    symbol: "・・",
    headline: "小さな行動も、ちゃんと残る",
    sub: "足跡は少しずつ、でも確かに伸びていく",
    bg: "radial-gradient(circle at 42% 68%, rgba(86,220,80,0.24), transparent 36%), linear-gradient(180deg, #092514 0%, #06100b 58%, #020504 100%)",
    accent: "#76dd64",
    scene: "footprints",
  },
  {
    id: 2,
    symbol: "☀",
    headline: "続けた分だけ、未来が変わる",
    sub: "景色に朝焼けが差し込むように",
    bg: "radial-gradient(circle at 68% 24%, rgba(255,202,86,0.28), transparent 34%), radial-gradient(circle at 48% 78%, rgba(86,220,80,0.17), transparent 38%), linear-gradient(180deg, #10220f 0%, #07100b 56%, #020504 100%)",
    accent: "#ffd166",
    scene: "sunrise",
  },
  {
    id: 3,
    symbol: "→",
    headline: "人生を少しずつ前に進めよう",
    sub: "車が走り出すように、今日から始まる",
    bg: "radial-gradient(circle at 50% 44%, rgba(86,220,80,0.27), transparent 37%), linear-gradient(180deg, #0b2815 0%, #06100b 58%, #020504 100%)",
    accent: "#76dd64",
    scene: "road",
  },
];

const STAR_POINTS = [
  [38, 26],
  [72, 18],
  [112, 38],
  [172, 24],
  [218, 36],
  [260, 22],
  [292, 52],
  [46, 72],
  [100, 64],
  [154, 76],
  [236, 78],
];

function SlideScene({
  scene,
  accent,
}: {
  scene: Slide["scene"];
  accent: string;
}) {
  return (
    <svg viewBox="0 0 320 190" style={sceneStyles.svg}>
      <defs>
        <radialGradient id={`sceneGlow-${scene}`} cx="50%" cy="70%" r="60%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.42" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="320" height="190" fill="transparent" />

      {STAR_POINTS.map(([x, y], i) => (
        <circle
          key={`${x}-${y}`}
          cx={x}
          cy={y}
          r={i % 3 === 0 ? 1.25 : 0.8}
          fill="rgba(255,255,255,0.52)"
          style={{
            animation: `tmTwinkle ${1.8 + i * 0.18}s ease-in-out infinite alternate`,
          }}
        />
      ))}

      {scene === "light" && (
        <>
          <path
            d="M0 166 Q160 144 320 166 L320 190 L0 190 Z"
            fill="rgba(18,36,22,0.72)"
          />
          <ellipse cx="160" cy="136" rx="32" ry="13" fill={accent} opacity="0.22" />
          <ellipse cx="160" cy="136" rx="15" ry="7" fill={accent} opacity="0.5" />
          <circle cx="160" cy="134" r="3.6" fill="rgba(230,255,220,0.94)" />
          <path
            d="M160 136 L118 190 M160 136 L202 190"
            stroke="rgba(118,221,100,0.12)"
            strokeWidth="1"
          />
        </>
      )}

      {scene === "footprints" && (
        <>
          <path
            d="M0 160 Q160 148 320 160 L320 190 L0 190 Z"
            fill="rgba(18,36,22,0.64)"
          />
          <ellipse cx="160" cy="112" rx="98" ry="20" fill={accent} opacity="0.08" />
          <path
            d="M38 153 C96 138 176 142 256 152"
            stroke={accent}
            strokeWidth="1"
            strokeDasharray="5 7"
            opacity="0.26"
            fill="none"
          />
          {[44, 74, 108, 140, 174, 206, 238].map((x, i) => (
            <ellipse
              key={x}
              cx={x}
              cy={150 + (i % 2 === 0 ? -3 : 4)}
              rx="6"
              ry="10"
              fill={accent}
              opacity={0.18 + i * 0.1}
              transform={`rotate(${i % 2 === 0 ? -18 : 18} ${x} ${
                150 + (i % 2 === 0 ? -3 : 4)
              })`}
            />
          ))}
        </>
      )}

      {scene === "sunrise" && (
        <>
          <ellipse cx="160" cy="148" rx="170" ry="72" fill={`url(#sceneGlow-${scene})`} />
          <ellipse cx="160" cy="150" rx="25" ry="13" fill={accent} opacity="0.32" />
          <ellipse cx="160" cy="153" rx="15" ry="8" fill={accent} opacity="0.7" />
          <path
            d="M0 155 L48 124 L88 140 L130 102 L170 134 L210 108 L252 137 L292 116 L320 138 L320 190 L0 190 Z"
            fill="rgba(5,18,9,0.88)"
          />
          {[0, 30, 60, 90, 120, 150, 180].map((angle) => {
            const rad = ((angle - 90) * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1="160"
                y1="154"
                x2={160 + Math.cos(rad) * 118}
                y2={154 + Math.sin(rad) * 78}
                stroke="rgba(255,210,100,0.09)"
                strokeWidth="1"
              />
            );
          })}
        </>
      )}

      {scene === "road" && (
        <>
          <ellipse cx="160" cy="105" rx="78" ry="18" fill={accent} opacity="0.1" />
          <path d="M96 190 L143 108 L177 108 L224 190 Z" fill="rgba(16,34,20,0.74)" />
          <path
            d="M80 190 L140 106 L180 106 L240 190"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="1"
            fill="none"
          />
          {[126, 142, 158].map((y) => (
            <rect key={y} x="157" y={y} width="6" height="9" rx="2" fill="rgba(255,255,255,0.18)" />
          ))}
          <g transform="translate(139 142)">
            <rect x="0" y="9" width="42" height="17" rx="5" fill="rgba(15,34,20,0.94)" stroke={accent} />
            <rect x="8" y="2" width="26" height="13" rx="5" fill="rgba(15,34,20,0.85)" stroke={accent} opacity="0.82" />
            <circle cx="10" cy="26" r="4" fill="#07100b" stroke={accent} />
            <circle cx="32" cy="26" r="4" fill="#07100b" stroke={accent} />
            <ellipse cx="44" cy="15" rx="12" ry="5" fill={accent} opacity="0.34" />
          </g>
        </>
      )}
    </svg>
  );
}

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from ?? "/goals";

  const [phase, setPhase] = useState<"onboarding" | "login">("onboarding");
  const [slideIndex, setSlideIndex] = useState(0);
  const [isChanging, setIsChanging] = useState(false);

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const autoTimer = useRef<ReturnType<typeof window.setTimeout> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("todoMoneyToken");
    if (token) nav("/goals", { replace: true });
  }, [nav]);

  useEffect(() => {
    if (phase !== "onboarding") return;

    autoTimer.current = window.setTimeout(() => {
      if (slideIndex < SLIDES.length - 1) {
        goToSlide(slideIndex + 1);
      }
    }, 3600);

    return () => {
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, phase]);

  function clearAutoTimer() {
    if (autoTimer.current) window.clearTimeout(autoTimer.current);
  }

  function goToSlide(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= SLIDES.length) return;
    if (nextIndex === slideIndex) return;

    setIsChanging(true);

    window.setTimeout(() => {
      setSlideIndex(nextIndex);
      window.setTimeout(() => setIsChanging(false), 40);
    }, 220);
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;

    const delta = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;

    if (Math.abs(delta) < 42) return;

    clearAutoTimer();

    if (delta > 0) goToSlide(Math.min(slideIndex + 1, SLIDES.length - 1));
    if (delta < 0) goToSlide(Math.max(slideIndex - 1, 0));
  }

  function handleSkip() {
    clearAutoTimer();
    setPhase("login");
  }

  function handleNext() {
    clearAutoTimer();

    if (slideIndex < SLIDES.length - 1) {
      goToSlide(slideIndex + 1);
      return;
    }

    setPhase("login");
  }

  function getOrCreateGuestDeviceId() {
    const key = "todoMoneyGuestDeviceId";
    const existing = localStorage.getItem(key);
    if (existing) return existing;

    const id =
      crypto.randomUUID?.() ??
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    localStorage.setItem(key, id);
    return id;
  }

  async function handleGuestLogin() {
    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const deviceId = getOrCreateGuestDeviceId();
      const data = await guestLogin(deviceId);

      setToken(data.token);
      localStorage.setItem("todoMoneyUserKey", `guest:${deviceId}`);
      nav("/goals", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "ゲスト開始に失敗しました。");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit() {
    if (busy) return;

    setError(null);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("EmailとPasswordを入力してください。");
      return;
    }

    setBusy(true);

    try {
      const data =
        mode === "register"
          ? await register(trimmedEmail, trimmedPassword)
          : await login(trimmedEmail, trimmedPassword);

      setToken(data.token);
      localStorage.setItem("todoMoneyUserKey", trimmedEmail.toLowerCase());
      nav(from, { replace: true });
    } catch (e: any) {
      if (mode === "register" && e?.status === 409) {
        setError("このEmailは既に登録済みです。ログインしてください。");
        setMode("login");
      } else if (e?.status === 401) {
        setError("EmailまたはPasswordが違います。");
      } else {
        setError(e?.message ?? "処理に失敗しました。");
      }
    } finally {
      setBusy(false);
    }
  }

  const slide = SLIDES[slideIndex];

  if (phase === "onboarding") {
    return (
      <>
        <GlobalAnimationStyle />

        <main
          style={{
            ...onboardingStyles.page,
            background: slide.bg,
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            style={{
              ...onboardingStyles.ambientA,
              background: `radial-gradient(circle, ${slide.accent}, transparent 72%)`,
            }}
          />
          <div style={onboardingStyles.ambientB} />

          <header style={onboardingStyles.topBar}>
            <div style={onboardingStyles.brand}>
              <span style={onboardingStyles.rabbit}>🐰</span>
              <span>TaskMoney</span>
            </div>

            <button type="button" onClick={handleSkip} style={onboardingStyles.skipButton}>
              スキップ
            </button>
          </header>

          <section
            style={{
              ...onboardingStyles.sceneCard,
              opacity: isChanging ? 0 : 1,
              transform: isChanging ? "translateY(10px) scale(0.985)" : "translateY(0) scale(1)",
            }}
          >
            <SlideScene scene={slide.scene} accent={slide.accent} />
          </section>

          <section
            style={{
              ...onboardingStyles.copyArea,
              opacity: isChanging ? 0 : 1,
              transform: isChanging ? "translateY(16px)" : "translateY(0)",
            }}
          >
            <div
              style={{
                ...onboardingStyles.symbol,
                color: slide.accent,
                textShadow: `0 0 28px ${slide.accent}`,
              }}
            >
              {slide.symbol}
            </div>

            <h1 style={onboardingStyles.headline}>{slide.headline}</h1>
            <p style={onboardingStyles.sub}>{slide.sub}</p>
          </section>

          <div style={onboardingStyles.dots}>
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  clearAutoTimer();
                  goToSlide(i);
                }}
                aria-label={`スライド${i + 1}`}
                style={{
                  ...onboardingStyles.dot,
                  width: i === slideIndex ? 24 : 8,
                  background: i === slideIndex ? "#76dd64" : "rgba(255,255,255,0.22)",
                }}
              />
            ))}
          </div>

          <footer style={onboardingStyles.footer}>
            <button type="button" onClick={handleNext} style={onboardingStyles.nextButton}>
              {slideIndex < SLIDES.length - 1 ? "次へ" : "始める →"}
            </button>
          </footer>
        </main>
      </>
    );
  }

  return (
    <>
      <GlobalAnimationStyle />

      <main style={styles.page}>
        <div style={styles.bgGlowA} />
        <div style={styles.bgGlowB} />

        <div style={styles.shell}>
          <section style={styles.heroCard}>
            <div style={styles.logoCircle}>🐰</div>

            <div style={styles.kicker}>TaskMoney</div>

            <h1 style={styles.title}>
              今日の行動を、
              <br />
              人生の前進に。
            </h1>

            <p style={styles.lead}>
              タスクをただ管理するだけじゃなく、毎日の小さな行動を
              “積み上げ”として見える化します。
            </p>

            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={busy}
              style={{
                ...styles.mainButton,
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? "開始中..." : "今すぐ始める"}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowAccountForm((v) => !v);
                setError(null);
              }}
              disabled={busy}
              style={styles.accountLink}
            >
              メールアドレスでログイン・同期する
            </button>

            <p style={styles.note}>
              まずは登録なしで使えます。データ同期・端末変更時の引き継ぎには
              メールアドレス登録が必要です。
            </p>
          </section>

          {showAccountForm && (
            <section style={styles.accountCard}>
              <div style={styles.formHeader}>
                <div>
                  <div style={styles.formKicker}>ACCOUNT</div>
                  <h2 style={styles.formTitle}>
                    {mode === "login" ? "ログイン" : "アカウント作成"}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode(mode === "login" ? "register" : "login");
                  }}
                  disabled={busy}
                  style={styles.switchButton}
                >
                  {mode === "login" ? "新規作成" : "ログインへ"}
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit();
                }}
                style={styles.form}
              >
                <div>
                  <label style={styles.label}>Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    inputMode="email"
                    placeholder="email@example.com"
                    style={styles.input}
                  />
                </div>

                <div>
                  <label style={styles.label}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password"
                    style={styles.input}
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  style={{
                    ...styles.submitButton,
                    opacity: busy ? 0.7 : 1,
                  }}
                >
                  {busy
                    ? "処理中..."
                    : mode === "login"
                      ? "ログインする"
                      : "作成して始める"}
                </button>

                {error && <div style={styles.error}>{error}</div>}
              </form>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function GlobalAnimationStyle() {
  return (
    <style>{`
      @keyframes tmTwinkle {
        from { opacity: 0.22; transform: scale(0.9); }
        to { opacity: 0.88; transform: scale(1.18); }
      }

      @keyframes tmFadeInUp {
        from { opacity: 0; transform: translateY(24px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes tmPulseGlow {
        0%, 100% { box-shadow: 0 18px 42px rgba(80,220,84,0.22); }
        50% { box-shadow: 0 20px 56px rgba(80,220,84,0.38); }
      }
    `}</style>
  );
}

const sceneStyles: Record<string, CSSProperties> = {
  svg: {
    width: "100%",
    height: 160,
    display: "block",
  },
};

const onboardingStyles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: "52px 24px 38px",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    transition: "background 720ms ease",
  },
  ambientA: {
    position: "fixed",
    width: 280,
    height: 280,
    borderRadius: 999,
    top: -110,
    right: -90,
    filter: "blur(62px)",
    opacity: 0.42,
    pointerEvents: "none",
    transition: "background 720ms ease",
  },
  ambientB: {
    position: "fixed",
    width: 260,
    height: 260,
    borderRadius: 999,
    bottom: 80,
    left: -100,
    background: "rgba(74,222,128,0.12)",
    filter: "blur(72px)",
    pointerEvents: "none",
  },
  topBar: {
    position: "relative",
    zIndex: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    color: "#76dd64",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "0.08em",
  },
  rabbit: {
    fontSize: 26,
    letterSpacing: 0,
  },
  skipButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.58)",
    borderRadius: 22,
    padding: "10px 18px",
    fontSize: 15,
    fontWeight: 900,
    cursor: "pointer",
    backdropFilter: "blur(18px)",
  },
  sceneCard: {
    position: "relative",
    zIndex: 2,
    borderRadius: 28,
    overflow: "hidden",
    background: "rgba(255,255,255,0.035)",
    border: "1px solid rgba(255,255,255,0.09)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
    transition: "opacity 240ms ease, transform 240ms ease",
  },
  copyArea: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    padding: "28px 0 18px",
    transition: "opacity 280ms ease, transform 280ms ease",
  },
  symbol: {
    fontSize: 54,
    lineHeight: 1,
    fontWeight: 950,
    marginBottom: 24,
  },
  headline: {
    margin: 0,
    fontSize: 39,
    lineHeight: 1.2,
    fontWeight: 950,
    letterSpacing: "-0.07em",
    color: "#fff",
  },
  sub: {
    margin: "22px 0 0",
    color: "rgba(255,255,255,0.55)",
    fontSize: 16,
    lineHeight: 1.8,
    fontWeight: 850,
  },
  dots: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    justifyContent: "center",
    gap: 9,
    marginBottom: 28,
  },
  dot: {
    height: 34,
    borderRadius: 999,
    border: "none",
    padding: 0,
    cursor: "pointer",
    transition: "all 320ms ease",
  },
  footer: {
    position: "relative",
    zIndex: 2,
  },
  nextButton: {
    width: "100%",
    border: "none",
    borderRadius: 24,
    padding: "18px",
    background: "linear-gradient(135deg, #73e15b, #31c954)",
    color: "#071009",
    fontSize: 20,
    fontWeight: 950,
    cursor: "pointer",
    animation: "tmPulseGlow 2600ms ease-in-out infinite",
  },
};

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "44px 22px 32px",
    boxSizing: "border-box",
    background:
      "radial-gradient(circle at 50% 0%, rgba(44,132,60,0.5), transparent 36%), linear-gradient(180deg, #0b1f12 0%, #06100b 55%, #020504 100%)",
    color: "#fff",
    position: "relative",
    overflow: "hidden",
  },
  bgGlowA: {
    position: "fixed",
    width: 260,
    height: 260,
    borderRadius: 999,
    background: "rgba(86,220,80,0.18)",
    filter: "blur(60px)",
    top: -80,
    right: -70,
    pointerEvents: "none",
  },
  bgGlowB: {
    position: "fixed",
    width: 260,
    height: 260,
    borderRadius: 999,
    background: "rgba(74,222,128,0.12)",
    filter: "blur(70px)",
    bottom: 40,
    left: -90,
    pointerEvents: "none",
  },
  shell: {
    width: "100%",
    maxWidth: 520,
    margin: "0 auto",
    position: "relative",
    zIndex: 1,
    animation: "tmFadeInUp 520ms ease both",
  },
  heroCard: {
    borderRadius: 36,
    padding: "34px 28px 26px",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.035))",
    border: "1px solid rgba(255,255,255,0.14)",
    boxShadow: "0 24px 80px rgba(0,0,0,0.42)",
    textAlign: "center",
    backdropFilter: "blur(18px)",
  },
  logoCircle: {
    width: 74,
    height: 74,
    borderRadius: 24,
    margin: "0 auto 18px",
    display: "grid",
    placeItems: "center",
    fontSize: 42,
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))",
    border: "1px solid rgba(255,255,255,0.16)",
  },
  kicker: {
    color: "#76dd64",
    fontSize: 26,
    fontWeight: 950,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  title: {
    margin: 0,
    fontSize: 42,
    lineHeight: 1.12,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },
  lead: {
    margin: "20px auto 28px",
    color: "rgba(255,255,255,0.72)",
    fontSize: 16,
    lineHeight: 1.9,
    fontWeight: 750,
  },
  mainButton: {
    width: "100%",
    border: "none",
    borderRadius: 24,
    padding: "18px 18px",
    background: "linear-gradient(135deg, #73e15b, #31c954)",
    color: "#071009",
    fontSize: 20,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 18px 42px rgba(80,220,84,0.28)",
  },
  accountLink: {
    marginTop: 18,
    border: "none",
    background: "transparent",
    color: "#9af58b",
    fontSize: 14,
    fontWeight: 900,
    cursor: "pointer",
    textDecoration: "underline",
    textUnderlineOffset: 4,
  },
  note: {
    margin: "14px 0 0",
    color: "rgba(255,255,255,0.42)",
    fontSize: 12,
    lineHeight: 1.7,
    fontWeight: 700,
  },
  accountCard: {
    marginTop: 18,
    borderRadius: 30,
    padding: 22,
    background:
      "linear-gradient(145deg, rgba(18,24,20,0.96), rgba(13,18,15,0.92))",
    border: "1px solid rgba(255,255,255,0.12)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.36)",
    animation: "tmFadeInUp 360ms ease both",
  },
  formHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  formKicker: {
    color: "#87ee7a",
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: 3,
  },
  formTitle: {
    margin: "4px 0 0",
    fontSize: 28,
    fontWeight: 950,
  },
  switchButton: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 18,
    padding: "11px 14px",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  label: {
    display: "block",
    marginBottom: 7,
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(0,0,0,0.28)",
    color: "#fff",
    padding: "14px 15px",
    fontSize: 16,
    outline: "none",
  },
  submitButton: {
    marginTop: 4,
    width: "100%",
    border: "none",
    borderRadius: 20,
    padding: "15px 16px",
    background: "#f7f7f7",
    color: "#101010",
    fontSize: 16,
    fontWeight: 950,
    cursor: "pointer",
  },
  error: {
    marginTop: 4,
    borderRadius: 16,
    padding: "12px 14px",
    background: "rgba(239,68,68,0.14)",
    border: "1px solid rgba(239,68,68,0.25)",
    color: "#ffb4b4",
    fontSize: 13,
    fontWeight: 800,
  },
};