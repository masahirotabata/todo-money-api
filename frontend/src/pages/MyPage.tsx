import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApi } from "../api";

type Summary = {
  potentialTotal: number;
  achievedTotal: number;
  currencyCount: number;
};

export default function MyPage() {
  const api = useApi();
  const nav = useNavigate();
  const [s, setS] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/api/me/summary").then((res: any) => setS(res.data));
  }, []);

  async function deleteAccount() {
    if (!confirm("アカウントを削除します。この操作は取り消せません。よろしいですか？")) return;

    setBusy(true);
    try {
      await api.delete("/api/me");
      localStorage.removeItem("todoMoneyToken");
      alert("アカウントを削除しました。");
      nav("/login", { replace: true });
    } catch (e: any) {
      alert(e?.response?.data?.message ?? e?.message ?? "アカウント削除に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>My Page</h2>
        {s ? (
          <>
            <div className="muted">潜在貯金（未達成）</div>
            <div className="big">${s.potentialTotal.toFixed(2)}</div>

            <div className="muted" style={{ marginTop: 12 }}>実現済み貯金（達成）</div>
            <div className="big">${s.achievedTotal.toFixed(2)}</div>

            <div className="muted" style={{ marginTop: 12 }}>通貨獲得回数</div>
            <div className="big">{s.currencyCount}</div>
          </>
        ) : (
          <p className="muted">Loading...</p>
        )}

        <hr style={{ margin: "24px 0" }} />

        <button
          onClick={deleteAccount}
          disabled={busy}
          style={{
            background: "#b91c1c",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 14px",
            fontWeight: 700,
          }}
        >
          {busy ? "Deleting..." : "Delete Account"}
        </button>
      </div>
    </div>
  );
}