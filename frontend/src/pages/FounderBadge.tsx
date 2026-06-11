// src/components/FounderBadge.tsx
export default function FounderBadge() {
    return (
      <div style={{
        marginTop: 16,
        padding: "16px 18px",
        borderRadius: 24,
        background: "linear-gradient(135deg, rgba(255,215,0,.18), rgba(90,255,90,.10))",
        border: "1px solid rgba(255,255,255,.16)",
        color: "#fff",
        boxShadow: "0 12px 30px rgba(0,0,0,.25)"
      }}>
        <div style={{ fontSize: 13, letterSpacing: ".18em", color: "#9cff87", fontWeight: 900 }}>
          LIMITED BADGE
        </div>
        <div style={{ fontSize: 28, fontWeight: 1000, marginTop: 8 }}>
          🏅 Founder
        </div>
        <div style={{ marginTop: 8, color: "rgba(255,255,255,.72)", fontWeight: 700, lineHeight: 1.6 }}>
          TaskMoney初期から使ってくれている開拓者の証です。
        </div>
      </div>
    );
  }