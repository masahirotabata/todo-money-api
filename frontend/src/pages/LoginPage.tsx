import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  login,
  register,
  guestLogin,
  setToken,
} from "../lib/api";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from ?? "/goals";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("todoMoneyToken");
    if (token) {
      nav("/goals", { replace: true });
    }
  }, [nav]);

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
      if (mode === "register") {
        const data = await register(trimmedEmail, trimmedPassword);
      
        setToken(data.token);
        console.log("new guest token", data.token);
        console.log("saved token", localStorage.getItem("todoMoneyToken"));
        console.log("saved userKey", localStorage.getItem("todoMoneyUserKey"));
        localStorage.setItem("todoMoneyUserKey", trimmedEmail.toLowerCase());
      
        nav(from, { replace: true });
        return;
      }

      const data = await login(trimmedEmail, trimmedPassword);

      setToken(data.token);
      console.log("new guest token", data.token);
      console.log("saved token", localStorage.getItem("todoMoneyToken"));
      console.log("saved userKey", localStorage.getItem("todoMoneyUserKey"));
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
    const deviceId = getOrCreateGuestDeviceId();

    const data = await guestLogin(deviceId);
    
    setToken(data.token);
    localStorage.setItem("todoMoneyUserKey", `guest:${deviceId}`);
    
    nav("/goals", { replace: true });
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>

        {/* タイトル */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              fontSize: 42,
              marginBottom: 8,
            }}
          >
            🐰
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            TaskMoney 
            Goal & Habit
          </h1>

          <div
            style={{
              marginTop: 8,
              color: "#666",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            毎日の行動を、
            <br />
            “人生の成長”として見える化。
          </div>
        </div>

        {/* ゲストログイン */}
        <button
          type="button"
          onClick={handleGuestLogin}
          disabled={busy}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 16,
            border: "none",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white",
            fontWeight: 800,
            fontSize: 16,
            cursor: "pointer",
            marginBottom: 18,
            boxShadow: "0 10px 30px rgba(34,197,94,.25)",
          }}
        >
          {busy ? "..." : "すぐ始める"}
        </button>

        {/* 区切り */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
            color: "#888",
            fontSize: 12,
          }}
        >
          <div style={{ flex: 1, height: 1, background: "#ddd" }} />
          ※アカウント連携する場合はメールアドレス登録が必要です
          <div style={{ flex: 1, height: 1, background: "#ddd" }} />
        </div>

        {/* Login/Register切替 */}
        <div className="row-between" style={{ marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>
            {mode === "login" ? "Login" : "Create Account"}
          </h2>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode(mode === "login" ? "register" : "login");
            }}
            disabled={busy}
          >
            {mode === "login"
              ? "Create account"
              : "Back to login"}
          </button>
        </div>

        {/* フォーム */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              Email
            </label>

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ddd",
              }}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <button
              type="submit"
              className="primary"
              disabled={busy}
              style={{
                width: "100%",
              }}
            >
              {busy
                ? "..."
                : mode === "login"
                ? "Login"
                : "Register"}
            </button>
          </div>

          {error && (
            <div
              className="error"
              style={{
                marginTop: 10,
              }}
            >
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}