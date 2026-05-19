import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { calendar, completeOccurrence } from "../lib/api";

export default function DayTasksPage() {
  const navigate = useNavigate();
  const { date } = useParams();

  const [items, setItems] = useState<any[]>([]);

  async function refresh() {
    if (!date) return;
    const data = await calendar(date, date);
    setItems(data.filter((it: any) => it.date === date));
  }

  useEffect(() => {
    refresh();
  }, [date]);

  return (
    <div className="container">
      <div className="row-between">
        <h1>ToDo（{date}）</h1>
        <button onClick={() => navigate("/calendar")}>戻る</button>
      </div>

      <div className="card" style={{ marginTop: 10 }}>
        {items.length === 0 ? (
          <div className="small">この日のタスクはありません</div>
        ) : (
          items.map((it: any) => (
            <div key={`${it.taskId}@${it.date}`} className="task">
              <div>
                <div style={{ fontWeight: 700 }}>{it.title}</div>

                {it.memo && <div className="small">{it.memo}</div>}

                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {(it.tags ?? []).map((t: any) => (
                    <span
                      key={t.id}
                      className="badge"
                      style={{ borderColor: t.color || "#e5e7eb" }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: t.color || "#999",
                          display: "inline-block",
                          marginRight: 6,
                        }}
                      />
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="row" style={{ gap: 8 }}>
                {!it.completed ? (
                  <button
                    className="primary"
                    onClick={async () => {
                      await completeOccurrence(it.taskId, it.date);
                      await refresh();
                    }}
                  >
                    Complete
                  </button>
                ) : (
                  <span className="badge">completed</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}