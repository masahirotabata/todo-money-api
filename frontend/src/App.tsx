import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";

import SchedulePage from "./pages/SchedulePage";
import LoginPage from "./pages/LoginPage";
import GoalsPage from "./pages/GoalsPage";
import CalendarPage from "./pages/CalendarPage";
import DayTasksPage from "./pages/DayTasksPage";
import DiagnosePage from "./pages/DiagnosePage";
import AnalysisPage from "./pages/AnalysisPage";
import InboxPage from "./pages/InboxPage";
import { useSwipeable } from "react-swipeable";
import DrivePage from "./pages/DrivePage";

import RequireAuth from "./components/RequireAuth";

function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    "/drive",
    "/inbox",
    "/goals",
    "/schedule",
    "/calendar",
    "/analysis",
    "/diagnose",
  ];

  const currentIndex = Math.max(
    0,
    tabs.findIndex((t) => location.pathname.startsWith(t))
  );

  const swipeDisabled =
    location.pathname.startsWith("/schedule") ||
    location.pathname.startsWith("/calendar") ||
    location.pathname.startsWith("/diagnose") ||
    location.pathname.startsWith("/inbox");

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (swipeDisabled) return;

      const nextIndex = (currentIndex + 1) % tabs.length;
      navigate(tabs[nextIndex]);
    },

    onSwipedRight: () => {
      if (swipeDisabled) return;

      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      navigate(tabs[prevIndex]);
    },

    trackMouse: true,
  });

  return (
    <>
      <main
        {...handlers}
        style={{
          paddingBottom: 72,
          touchAction: "pan-y",
        }}
      >
        {children}
      </main>

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
          overflowX: "auto",
        }}
      >
        <NavItem to="/drive" label="ホーム" />
        <NavItem to="/inbox" label="受信箱" />
        <NavItem to="/goals" label="目標" />
        <NavItem to="/schedule" label="継続" />
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
        fontSize: 11,
        fontWeight: isActive ? 800 : 600,
        color: isActive ? "#111" : "#777",
        whiteSpace: "nowrap",
        padding: "8px 6px",
        flexShrink: 0,
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
        path="/drive"
        element={
          <RequireAuth>
            <AppLayout>
              <DrivePage />
            </AppLayout>
          </RequireAuth>
        }
      />

      <Route
        path="/inbox"
        element={
          <RequireAuth>
            <AppLayout>
              <InboxPage />
            </AppLayout>
          </RequireAuth>
        }
      />

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

      <Route
        path="/quick-memo"
        element={
          <RequireAuth>
           <Route path="*" element={<Navigate to="/quick-memo" replace />} />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/drive" replace />} />
    </Routes>
  );
}