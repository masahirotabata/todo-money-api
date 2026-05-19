import { Routes, Route, Navigate, NavLink } from "react-router-dom";

import SchedulePage from "./pages/SchedulePage";
import LoginPage from "./pages/LoginPage";
import GoalsPage from "./pages/GoalsPage";
import CalendarPage from "./pages/CalendarPage";
import DayTasksPage from "./pages/DayTasksPage";
import DiagnosePage from "./pages/DiagnosePage";
import AnalysisPage from "./pages/AnalysisPage";

import RequireAuth from "./components/RequireAuth";

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main style={{ paddingBottom: 72 }}>{children}</main>

      <nav
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: 64,
          background: "#fff",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 100,
        }}
      >
        <NavItem to="/goals" label="目標" />
        <NavItem to="/schedule" label="予定" />
        <NavItem to="/calendar" label="カレンダー" />
        <NavItem to="/analysis" label="分析" />
        <NavItem to="/diagnose" label="診断" />
      </nav>
    </>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        textDecoration: "none",
        fontSize: 12,
        fontWeight: isActive ? 800 : 600,
        color: isActive ? "#111" : "#777",
        whiteSpace: "nowrap",
      })}
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/goals"
        element={
          <RequireAuth>
            <AppLayout>
              <GoalsPage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/schedule"
        element={
          <RequireAuth>
            <AppLayout>
              <SchedulePage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/calendar"
        element={
          <RequireAuth>
            <AppLayout>
              <CalendarPage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/calendar/:date"
        element={
          <RequireAuth>
            <AppLayout>
              <DayTasksPage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/analysis"
        element={
          <RequireAuth>
            <AppLayout>
              <AnalysisPage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/diagnose"
        element={
          <RequireAuth>
            <AppLayout>
              <DiagnosePage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/goals" replace />} />
    </Routes>
  );
}