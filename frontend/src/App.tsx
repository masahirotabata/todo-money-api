// src/App.tsx
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
  useLocation,
} from "react-router-dom";

import React, { useEffect, useRef } from "react";
import { useSwipeable } from "react-swipeable";
import { App as CapacitorApp } from "@capacitor/app";

import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import SchedulePage from "./pages/SchedulePage";
import GoalsPage from "./pages/GoalsPage";
import CalendarPage from "./pages/CalendarPage";
import DayTasksPage from "./pages/DayTasksPage";
import AnalysisPage from "./pages/FootprintsPage";

import RequireAuth from "./components/RequireAuth";

function DeepLinkHandler() {
  const navigate = useNavigate();
  const handledRef = useRef(false);
  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const isQuickMemoUrl = (url?: string | null) => {
      if (!url) return false;

      return (
        url.includes("quickMemo=1") ||
        url.includes("quickMemo=true") ||
        url.includes("quick-memo=1") ||
        url.includes("quick-memo=true")
      );
    };

    const openQuickMemo = (url: string) => {
      if (handledRef.current) return;
      if (lastHandledUrlRef.current === url) return;

      handledRef.current = true;
      lastHandledUrlRef.current = url;

      navigate("/home", {
        replace: true,
        state: { quickMemo: true },
      });

      setTimeout(() => {
        handledRef.current = false;
      }, 2000);
    };

    CapacitorApp.getLaunchUrl().then((result) => {
      const url = result?.url ?? "";
      if (isQuickMemoUrl(url)) openQuickMemo(url);
    });

    const listener = CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      console.log("DeepLink:", url);
      if (isQuickMemoUrl(url)) openQuickMemo(url);
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, [navigate]);

  return null;
}

const TABS = [
  {
    to: "/home",
    label: "Home",
    icon: "🏠",
    match: ["/home", "/drive", "/inbox", "/goals", "/future"],
  },
  {
    to: "/progress",
    label: "Today",
    icon: "➡️",
    match: ["/progress", "/schedule"],
  },
  {
    to: "/calendar",
    label: "Calendar",
    icon: "📅",
    match: ["/calendar"],
  },
  {
    to: "/footprints",
    label: "Footprints",
    icon: "🗺️",
    match: ["/footprints", "/insights", "/analysis"],
  },
] as const;

function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = TABS.map((t) => t.to);

  const currentIndex = Math.max(
    0,
    TABS.findIndex((t) => t.match.some((m) => location.pathname.startsWith(m)))
  );

  const swipeDisabled =
    location.pathname.startsWith("/calendar") ||
    location.pathname.startsWith("/home") ||
    location.pathname.startsWith("/progress") ||
    location.pathname.startsWith("/footprints");

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
          paddingBottom: 78,
          touchAction: "pan-y",
          minHeight: "100vh",
          background: "#0a0c0b",
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
          height: "calc(70px + env(safe-area-inset-bottom))",
          padding: "7px 10px calc(7px + env(safe-area-inset-bottom))",
          boxSizing: "border-box",
          background: "rgba(255,255,255,0.96)",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          boxShadow: "0 -12px 28px rgba(0,0,0,0.14)",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 4,
          zIndex: 100,
          WebkitBackdropFilter: "blur(18px)",
          backdropFilter: "blur(18px)",
        }}
      >
        {TABS.map((tab) => (
          <NavItem
            key={tab.to}
            to={tab.to}
            label={tab.label}
            icon={tab.icon}
            match={tab.match}
          />
        ))}
      </nav>
    </>
  );
}

function NavItem({
  to,
  label,
  icon,
  match,
}: {
  to: string;
  label: string;
  icon: string;
  match: readonly string[];
}) {
  const location = useLocation();
  const active = match.some((m) => location.pathname.startsWith(m));

  return (
    <NavLink to={to} style={{ textDecoration: "none", minWidth: 0 }}>
      <div
        style={{
          height: 54,
          borderRadius: 18,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 2,
          fontWeight: active ? 950 : 900,
          color: active ? "#07110c" : "rgba(0,0,0,0.46)",
          background: active ? "rgba(116,224,93,0.14)" : "transparent",
          boxShadow: active
            ? "0 0 0 1px rgba(116,224,93,0.18) inset"
            : "none",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
        <span
          style={{
            fontSize: 10.5,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
          }}
        >
          {label}
        </span>
      </div>
    </NavLink>
  );
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <>
      <DeepLinkHandler />

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route path="/home" element={<ProtectedPage><HomePage /></ProtectedPage>} />
        <Route path="/drive" element={<Navigate to="/home" replace />} />
        <Route path="/inbox" element={<Navigate to="/home" replace />} />

        <Route path="/progress" element={<ProtectedPage><SchedulePage /></ProtectedPage>} />
        <Route path="/schedule" element={<Navigate to="/progress" replace />} />

        <Route path="/goals" element={<ProtectedPage><GoalsPage /></ProtectedPage>} />
        <Route path="/future" element={<Navigate to="/home" replace />} />

        <Route path="/calendar" element={<ProtectedPage><CalendarPage /></ProtectedPage>} />
        <Route path="/calendar/:date" element={<ProtectedPage><DayTasksPage /></ProtectedPage>} />

        {/* まずは既存のAnalysisPageをFootprintsタブとして使う */}
        <Route path="/footprints" element={<ProtectedPage><AnalysisPage /></ProtectedPage>} />
        <Route path="/insights" element={<Navigate to="/footprints" replace />} />
        <Route path="/analysis" element={<Navigate to="/footprints" replace />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </>
  );
}