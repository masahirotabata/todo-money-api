export default function AnalysisPage() {
    function onUpgrade() {
      alert("Pro機能は現在準備中です");
    }
  
    return (
      <div className="container">
        <div style={styles.heroCard}>
          <div>
            <div style={styles.heroLabel}>行動分析</div>
            <h1 style={styles.heroTitle}>分析</h1>
            <p style={styles.heroText}>
              行動量やカテゴリ別内訳をグラフで可視化できます。
            </p>
          </div>
        </div>
  
        <div style={styles.previewCard}>
          <div style={styles.fadeChart}>
            <div style={styles.barArea}>
              <div style={{ ...styles.bar, height: 54 }} />
              <div style={{ ...styles.bar, height: 86 }} />
              <div style={{ ...styles.bar, height: 128 }} />
              <div style={{ ...styles.barMuted, height: 196 }} />
            </div>
  
            <div style={styles.centerIcon}>📊</div>
  
            <h2 style={styles.previewTitle}>グラフで詳しく分析</h2>
            <p style={styles.previewText}>
              行動量やカテゴリ別内訳を
              <br />
              グラフで可視化
            </p>
          </div>
  
          <button style={styles.upgradeButton} onClick={onUpgrade}>
            Proにアップグレード
          </button>
        </div>
  
        <div style={styles.proCard}>
          <div style={styles.proLabel}>PRO</div>
          <h2 style={styles.proTitle}>行動をもっと深く分析</h2>
  
          <div style={styles.proList}>
            <div style={styles.proItem}>
              <span style={styles.check}>✓</span>
              <span>月別の行動量をグラフ化</span>
            </div>
            <div style={styles.proItem}>
              <span style={styles.check}>✓</span>
              <span>カテゴリ別の達成率を表示</span>
            </div>
            <div style={styles.proItem}>
              <span style={styles.check}>✓</span>
              <span>行動価値の推移を可視化</span>
            </div>
            <div style={styles.proItem}>
              <span style={styles.check}>✓</span>
              <span>目標別の振り返りレポート</span>
            </div>
          </div>
  
          <button style={styles.proButton} onClick={onUpgrade}>
            Proにアップグレード →
          </button>
        </div>
      </div>
    );
  }
  
  const styles: Record<string, React.CSSProperties> = {
    heroCard: {
      background: "#111",
      color: "#fff",
      borderRadius: 28,
      padding: 24,
      marginBottom: 18,
      boxShadow: "0 20px 44px rgba(0,0,0,0.18)",
    },
    heroLabel: {
      color: "rgba(255,255,255,0.55)",
      fontWeight: 800,
      fontSize: 14,
      marginBottom: 6,
    },
    heroTitle: {
      margin: 0,
      fontSize: 44,
      fontWeight: 900,
      letterSpacing: "-0.05em",
    },
    heroText: {
      color: "rgba(255,255,255,0.72)",
      fontWeight: 700,
      lineHeight: 1.7,
      margin: "12px 0 0",
    },
    previewCard: {
      position: "relative",
      background: "#fff",
      borderRadius: 28,
      border: "1px solid #e7e9f2",
      padding: 24,
      marginBottom: 18,
      minHeight: 360,
      overflow: "hidden",
    },
    fadeChart: {
      position: "relative",
      height: 300,
      borderRadius: 24,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78))",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    },
    barArea: {
      position: "absolute",
      inset: "36px 28px 28px",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 12,
      opacity: 0.22,
    },
    bar: {
      width: 28,
      borderRadius: 8,
      background: "#111",
    },
    barMuted: {
      width: 48,
      borderRadius: 8,
      background: "#cfcfcf",
    },
    centerIcon: {
      fontSize: 36,
      marginBottom: 14,
    },
    previewTitle: {
      margin: 0,
      fontSize: 24,
      fontWeight: 900,
      color: "#111",
    },
    previewText: {
      margin: "10px 0 0",
      color: "#777",
      fontSize: 16,
      fontWeight: 700,
      lineHeight: 1.6,
    },
    upgradeButton: {
      position: "absolute",
      left: "50%",
      bottom: 28,
      transform: "translateX(-50%)",
      minWidth: 240,
      minHeight: 56,
      borderRadius: 20,
      border: "none",
      background: "#2f2e2b",
      color: "#fff",
      fontSize: 17,
      fontWeight: 900,
      boxShadow: "0 12px 30px rgba(0,0,0,0.16)",
    },
    proCard: {
      background: "#1b1b1b",
      color: "#fff",
      borderRadius: 28,
      padding: 28,
      marginBottom: 24,
      boxShadow: "0 20px 48px rgba(0,0,0,0.16)",
    },
    proLabel: {
      color: "rgba(255,255,255,0.5)",
      letterSpacing: "0.22em",
      fontSize: 13,
      fontWeight: 900,
      marginBottom: 10,
    },
    proTitle: {
      margin: "0 0 20px",
      fontSize: 28,
      fontWeight: 900,
      letterSpacing: "-0.03em",
    },
    proList: {
      display: "grid",
      gap: 13,
      marginBottom: 24,
    },
    proItem: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      color: "rgba(255,255,255,0.82)",
      fontSize: 16,
      fontWeight: 700,
    },
    check: {
      color: "#27c7bd",
      fontSize: 22,
      lineHeight: 1,
    },
    proButton: {
      width: "100%",
      minHeight: 58,
      borderRadius: 999,
      border: "none",
      background: "#fff",
      color: "#111",
      fontSize: 17,
      fontWeight: 900,
    },
  };