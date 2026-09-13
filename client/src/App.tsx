import { Route, Routes } from "react-router";

import { Alarm } from "@/components/alarm";
import { AmbientBackdrop } from "@/components/ambient-backdrop";
import { NavBar } from "@/components/nav-bar";
import { RequireHandle } from "@/components/require-handle";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, type AuthValue } from "@/lib/auth";
import { SessionProvider, type SessionValue } from "@/lib/session";
import { LandingRoute } from "@/routes/landing";
import { LoginRoute } from "@/routes/login";
import { OfflineRoute } from "@/routes/offline";
import { ProfileRoute } from "@/routes/profile";
import { TimerRoute } from "@/routes/timer";
import { MTrackerTodayRoute } from "@/routes/mtracker-today";
import { MTrackerDailyRoute } from "@/routes/mtracker-daily";
import { MTrackerReportRoute } from "@/routes/mtracker-report";
import { MTrackerTasksRoute } from "@/routes/mtracker-tasks";
import { MTrackerDataRoute } from "@/routes/mtracker-data";

/**
 * The frame every screen sits inside: a centred column, thin side borders on
 * large screens only, a dark stone surround on desktop and flush black on a
 * phone. It is `min-h-screen` and a flex column so a route can claim the
 * remaining height with `flex-1` without measuring anything.
 * Exactly max-w-xl matching Pomodorus design tokens.
 */
const FRAME =
  "mx-auto overflow-x-hidden flex min-h-screen w-full max-w-xl flex-col border-x-0 bg-background lg:border-x lg:border-border/50";

export function App({
  auth,
  session,
}: {
  auth?: AuthValue;
  session?: SessionValue;
}) {
  return (
    <AuthProvider value={auth}>
      <SessionProvider value={session}>
        <TooltipProvider>
          <AmbientBackdrop />
          {/* Outside the frame on purpose: the toaster portals to the body */}
          <div className={FRAME}>
            {/* Above the router, because the bell reaches any route */}
            <Alarm />
            <NavBar />
            <Routes>
              <Route path="/" element={<LandingRoute />} />
              <Route path="/login" element={<LoginRoute />} />
              <Route
                path="/app"
                element={
                  <RequireHandle>
                    <TimerRoute />
                  </RequireHandle>
                }
              />
              <Route path="/today" element={<MTrackerTodayRoute />} />
              <Route path="/daily" element={<MTrackerDailyRoute />} />
              <Route path="/report" element={<MTrackerReportRoute />} />
              <Route path="/tasks" element={<MTrackerTasksRoute />} />
              <Route path="/data" element={<MTrackerDataRoute />} />
              <Route path="/u/:handle" element={<ProfileRoute />} />
              <Route path="/offline" element={<OfflineRoute />} />
              <Route path="*" element={<LandingRoute />} />
            </Routes>
          </div>
        </TooltipProvider>
      </SessionProvider>
    </AuthProvider>
  );
}
