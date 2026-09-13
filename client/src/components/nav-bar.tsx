import { useState, useEffect, useCallback } from "react";
import { BellRing, Timer } from "lucide-react";
import { Link, useLocation } from "react-router";
import { UpstreamSyncModal } from "@/components/upstream-sync-modal";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth, type Auth, type AuthValue } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { faClock, faElapsed } from "@/lib/format";
import { useTick } from "@/lib/server-clock";
import { isRinging, useSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const HIDE_ON = ["/login", "/offline"];
const HIDE_SUB_ON = ["/", "/login", "/offline"];
const CTA_BOX = "h-8 min-w-24";

const NAV_TABS = [
  { to: "/app", label: "تایمر" },
  { to: "/today", label: "استمرار" },
  { to: "/daily", label: "روزانه" },
  { to: "/report", label: "گزارش" },
  { to: "/tasks", label: "تسک‌ها" },
  { to: "/data", label: "داده‌ها" },
] as const;

export function NavBar() {
  const { pathname } = useLocation();
  const auth = useAuth();
  const { session } = useSession();
  const now = useTick();
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [upstreamInfo, setUpstreamInfo] = useState<{
    handle: string;
    wsConnected: boolean;
    authenticated: boolean;
  } | null>(null);

  const refreshUpstream = useCallback(async () => {
    try {
      const res = await fetch("/api/upstream/status");
      if (res.ok) {
        const data = await res.json();
        setUpstreamInfo(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void refreshUpstream();
  }, [refreshUpstream]);

  if (HIDE_ON.includes(pathname)) return null;

  const showSubNav = !HIDE_SUB_ON.includes(pathname);
  const displayHandle = upstreamInfo?.handle || "anoush";
  const isConnected = upstreamInfo?.wsConnected ?? true;
  const isAuthenticated = upstreamInfo?.authenticated ?? false;

  return (
    <>
      <header className="flex h-14 w-full shrink-0 items-center justify-between px-6 border-b border-border/60">
        <Link to="/" aria-label={copy.app.name}>
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 text-sm font-vazir">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSyncModalOpen(true)}
            className="h-8 px-3 rounded-none border-border bg-background hover:bg-muted/40 text-xs font-vazir gap-2 select-none"
            title={`همگام‌سازی زنده با حساب @${displayHandle} در pomodorus.yazdan.me`}
          >
            <span
              className={`size-2 rounded-full ${
                isConnected
                  ? isAuthenticated
                    ? "bg-emerald-400 ring-2 ring-emerald-400/30"
                    : "bg-emerald-400 ring-2 ring-emerald-400/10"
                  : "bg-amber-400 ring-2 ring-amber-400/20"
              }`}
            />
            <span className="font-vazir text-xs text-foreground tracking-normal font-normal">
              {displayHandle}
            </span>
          </Button>
          <TimerCta />
          <AuthCta auth={auth} />
        </nav>
      </header>

      {showSubNav ? (
        <nav
          aria-label="بخش‌های برنامه"
          className="w-full border-b border-border/60 px-6 py-2.5 flex items-center justify-center overflow-x-auto scrollbar-none"
        >
          <div className="flex items-center gap-6 sm:gap-8 text-xs min-w-max">
            {NAV_TABS.map((tab) => {
              const isActive =
                tab.to === "/app"
                  ? pathname === "/app"
                  : pathname.startsWith(tab.to);

              return (
                <Link
                  key={tab.to}
                  to={tab.to}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative py-1 transition-colors select-none outline-none text-xs",
                    isActive
                      ? "text-foreground font-medium underline underline-offset-8 decoration-1 decoration-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {/* Ambient Live Timer Banner when away from /app */}
      {showSubNav && pathname !== "/app" && session ? (
        <div className="w-full border-b border-border/60 bg-card px-6 py-2.5 flex items-center justify-between gap-4 text-xs animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="size-1.5 rounded-full bg-rose-400/90 animate-pulse shrink-0" />
            <span className="text-muted-foreground shrink-0">
              {session.kind === "work" ? "در حال تمرکز:" : "استراحت:"}
            </span>
            <span className="font-medium text-foreground truncate">
              {session.categoryName || (session.kind === "work" ? "تسک عمومی" : "چیل")}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="tabular-nums font-semibold text-foreground text-sm" dir="ltr">
              {isRinging(session, now)
                ? faElapsed(now - session.endsAt)
                : faClock(session.endsAt - now)}
            </span>
            <Link
              to="/app"
              className="text-muted-foreground hover:text-foreground border border-border px-2.5 py-1 transition-colors"
            >
              رفتن به تایمر
            </Link>
          </div>
        </div>
      ) : null}
      <UpstreamSyncModal
        open={syncModalOpen}
        onClose={() => {
          setSyncModalOpen(false);
          void refreshUpstream();
        }}
      />
    </>
  );
}

function TimerCta() {
  const { session } = useSession();
  const now = useTick();
  const clock = "flex min-w-10 justify-start tabular-nums font-vazir text-xs";

  if (session === undefined) {
    return <Skeleton className={CTA_BOX} data-testid="nav-timer-placeholder" />;
  }

  if (session === null) {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 px-3 rounded-none border-border bg-background hover:bg-muted/40 font-vazir">
        <Link to="/app" className="flex items-center gap-1.5 hover:text-foreground text-xs font-vazir">
          <Timer size={14} />
          <span className="hidden sm:inline font-vazir">{copy.header.timer}</span>
        </Link>
      </Button>
    );
  }

  if (isRinging(session, now)) {
    return (
      <Button asChild size="sm" variant="outline" className="h-8 px-3 rounded-none border-border bg-background hover:bg-muted/40 font-vazir">
        <Link to="/app" className="flex items-center gap-1.5 animate-pulse text-rose-500 text-xs font-vazir">
          <span className={clock} dir="ltr">
            {faElapsed(now - session.endsAt)}
          </span>
          <BellRing size={14} />
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild size="sm" variant="outline" className="h-8 px-3 rounded-none border-border bg-background hover:bg-muted/40 font-vazir">
      <Link to="/app" className="flex items-center gap-1.5 text-foreground hover:text-foreground text-xs font-vazir">
        <span className={clock} dir="ltr">
          {faClock(session.endsAt - now)}
        </span>
        <Timer size={14} className="animate-pulse text-rose-500" />
      </Link>
    </Button>
  );
}

function AuthCta({ auth }: { auth: AuthValue }) {
  if (auth.status === "loading") {
    return <Skeleton className={CTA_BOX} data-testid="nav-cta-placeholder" />;
  }

  const { to, label } = destination(auth);
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className={cn(CTA_BOX, "h-8 px-3 rounded-none border-border bg-background hover:bg-muted/40 text-xs font-vazir")}
    >
      <Link to={to} className="font-vazir text-xs text-foreground hover:text-foreground">{label}</Link>
    </Button>
  );
}

function destination(auth: Auth): { to: string; label: string } {
  if (auth.status !== "authenticated") {
    return { to: "/login", label: copy.landing.enter };
  }
  if (auth.handle === null) {
    return { to: "/app", label: copy.header.timer };
  }
  return { to: `/u/${auth.handle}`, label: copy.header.myProfile };
}
