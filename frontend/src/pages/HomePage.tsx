// src/pages/HomePage.tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  listGoals,
  createGoal,
  GoalListItem,
} from "../lib/api";

export default function HomePage() {
  const [goals, setGoals] = useState<GoalListItem[]>([]);
  const [annualIncome, setAnnualIncome] = useState("6000000");
  const [title, setTitle] = useState("");

  const loadAll = async () => {
    const g = await listGoals();
    setGoals(g);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    await createGoal(title.trim(), Number(annualIncome));
    setTitle("");
    await loadAll();
  };

  const total = goals.reduce((s, g) => s + (g.earnedAmount ?? 0), 0);

  return (
    <div className="container">
      <div className="stack">
        <div className="card">
          <div className="row">
            <div>
              <div className="muted">総潜在貯金（完了分）</div>
              <div className="big">${total.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>目標を追加</h2>
          <div className="grid2">
            <input
              placeholder="例：セキスペ合格"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              placeholder="想定年収"
              value={annualIncome}
              onChange={(e) => setAnnualIncome(e.target.value)}
            />
          </div>
          <button className="btn primary" onClick={create}>
            Add Goal
          </button>
        </div>

        <div className="card">
          <h2>目標一覧</h2>
          <div className="list">
            {goals.map((g) => (
              <Link key={g.id} to={`/goals/${g.id}`} className="item">
                <div className="itemMain">
                  <div className="itemTitle">
                    {g.title} {g.achieved ? "✅" : ""}
                  </div>
                  <div className="muted">
                    tasks {g.completedTaskCount}/{g.taskCount} ・ perTask $
                    {g.perTaskReward.toFixed(2)} ・ earned $
                    {g.earnedAmount.toFixed(2)}
                  </div>
                </div>
                <div className="pill">${g.annualIncome.toFixed(0)}/y</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}