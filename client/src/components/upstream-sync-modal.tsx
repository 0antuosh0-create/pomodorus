import { useState, useEffect } from "react";
import {
  Activity,
  ExternalLink,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  User,
} from "lucide-react";
import { faClock } from "@/lib/format";
import { useTick } from "@/lib/server-clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type UpstreamStatus = {
  handle: string;
  upstreamUrl: string;
  hasSessionCookie: boolean;
  authenticated: boolean;
  wsConnected: boolean;
  liveSession: {
    id: string;
    kind: "work" | "shortBreak" | "longBreak";
    categoryName?: string;
    endsAt: number;
    durationMs: number;
  } | null;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function UpstreamSyncModal({ open, onClose }: Props) {
  const [status, setStatus] = useState<UpstreamStatus | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [cookieInput, setCookieInput] = useState("");
  const [adminToken, setAdminToken] = useState(
    () => localStorage.getItem("upstream_admin_token") || ""
  );
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const now = useTick();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/upstream/status");
      if (res.ok) {
        const data: UpstreamStatus = await res.json();
        setStatus(data);
        if (data.handle) {
          setHandleInput(data.handle);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchStatus();
      setMessage(null);
    }
  }, [open]);

  const handleSaveHandle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = handleInput.trim().replace(/^@/, "");
    if (!cleanHandle) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/upstream/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: cleanHandle, adminToken: adminToken || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (adminToken) localStorage.setItem("upstream_admin_token", adminToken);
        setMessage({
          type: "success",
          text: `نام کاربری به @${data.handle} تغییر یافت. بازتاب وضعیت و استمرار فعال است.`,
        });
        await fetchStatus();
      } else if (res.status === 401) {
        setMessage({
          type: "error",
          text: "این تغییر توکن مدیر می‌خواد. توکن رو پایین وارد کن و دوباره بزن.",
        });
      } else {
        setMessage({
          type: "error",
          text: "خطا در تغییر نام کاربری در سرور محلی.",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "خطا در برقراری ارتباط با سرور محلی.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) return;

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/upstream/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionCookie: cookieInput.trim(),
          handle: handleInput.trim() || status?.handle || "anoush",
          adminToken: adminToken || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.verified) {
        if (adminToken) localStorage.setItem("upstream_admin_token", adminToken);
        setMessage({
          type: "success",
          text: `احراز هویت حساب @${data.handle} با موفقیت تأیید شد. کنترل دوطرفه تایمر فعال است.`,
        });
        setCookieInput("");
        await fetchStatus();
      } else if (res.status === 401) {
        setMessage({
          type: "error",
          text: "این تغییر توکن مدیر می‌خواد. توکن رو پایین وارد کن و دوباره بزن.",
        });
      } else {
        setMessage({
          type: "error",
          text: "کوکی نامعتبر یا منقضی شده است. مقدار دقیق pomodorus_session را وارد کنید.",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "خطا در اتصال به سرور محلی.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnectCookie = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/upstream/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearCookie: true,
          handle: status?.handle || "anoush",
          adminToken: adminToken || undefined,
        }),
      });
      await fetchStatus();
      setMessage(
        res.status === 401
          ? {
              type: "error",
              text: "این تغییر توکن مدیر می‌خواد. توکن رو پایین وارد کن و دوباره بزن.",
            }
          : {
              type: "success",
              text: "ارتباط کوکی قطع شد. پخش زنده و رصد عمومی همچنان فعال است.",
            }
      );
    } finally {
      setSubmitting(false);
    }
  };

  const live = status?.liveSession;
  const remainingMs = live ? Math.max(0, live.endsAt - now) : 0;
  const activeHandle = status?.handle || "anoush";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-lg p-6 sm:p-8 rounded-none border border-border bg-popover text-popover-foreground font-vazir max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
        <DialogHeader className="space-y-1.5 text-start">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
            <DialogTitle className="text-base font-semibold tracking-tight">
              همگام‌سازی با @{activeHandle}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            اتصال زنده به سرور اصلی pomodorus.yazdan.me و بازتاب تایمر و استمرار
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Status Metrics Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="border border-border bg-muted/15 p-3 rounded-none flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">وضعیت وب‌سوکت</span>
              <div className="flex items-center gap-2 text-xs font-vazir">
                <span
                  className={`size-1.5 rounded-full ${
                    status?.wsConnected ? "bg-emerald-400" : "bg-muted-foreground"
                  }`}
                />
                <span className="text-foreground">
                  {status?.wsConnected ? "متصل (پخش زنده)" : "در حال اتصال..."}
                </span>
              </div>
            </div>

            <div className="border border-border bg-muted/15 p-3 rounded-none flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground">احراز هویت دوطرفه</span>
              <div className="flex items-center gap-2 text-xs font-vazir">
                <span
                  className={`size-1.5 rounded-full ${
                    status?.hasSessionCookie ? "bg-emerald-400" : "bg-muted-foreground"
                  }`}
                />
                <span className="text-foreground">
                  {status?.hasSessionCookie ? "فعال (ثبت در سرور)" : "آینه‌ای (رصد زنده)"}
                </span>
              </div>
            </div>
          </div>

          {/* Active Timer Stream Container */}
          <div className="border border-border bg-muted/10 p-3.5 rounded-none space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-foreground" />
                تایمر جاری در سرور اصلی (@{activeHandle})
              </span>
              <a
                href={`https://pomodorus.yazdan.me/u/${encodeURIComponent(activeHandle)}`}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-[11px]"
              >
                پروفایل در yazdan.me
                <ExternalLink className="size-3" />
              </a>
            </div>

            {live && remainingMs > 0 ? (
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <div>
                  <p className="text-xs font-medium text-foreground">
                    {live.categoryName || "تسک فعال"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {live.kind === "work" ? "در حال کار" : "استراحت"}
                  </p>
                </div>
                <div dir="ltr" className="text-lg font-vazir tabular-nums text-foreground font-medium">
                  {faClock(remainingMs)}
                </div>
              </div>
            ) : (
              <div className="py-2 text-xs text-muted-foreground text-center">
                تایمری در سرور اصلی فعال نیست (حالت آزاد)
              </div>
            )}
          </div>

          {/* Step 1: Upstream Handle Configuration */}
          <div className="space-y-2 border border-border bg-muted/10 p-3.5 rounded-none">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground font-medium flex items-center gap-1.5">
                <User className="size-3.5 text-muted-foreground" />
                ۱. نام کاربری در سرور اصلی (سریع و بدون نیاز به لاگین)
              </span>
              <span className="text-[11px] text-muted-foreground font-mono" dir="ltr">
                @{activeHandle}
              </span>
            </div>
            <form onSubmit={handleSaveHandle} className="flex gap-2">
              <Input
                type="text"
                placeholder="نام کاربری شما در pomodorus.yazdan.me"
                value={handleInput}
                onChange={(e) => setHandleInput(e.target.value)}
                className="text-xs h-8 rounded-none border-border bg-background font-vazir"
                disabled={submitting}
                dir="ltr"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={submitting || !handleInput.trim() || handleInput.trim().toLowerCase() === status?.handle}
                className="shrink-0 h-8 text-xs rounded-none px-3"
              >
                ذخیره نام کاربری
              </Button>
            </form>
            <Input
              type="password"
              placeholder="توکن مدیر (فقط صاحب سرور — خالی = لوکال)"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              className="text-xs h-8 rounded-none border-border bg-background font-vazir text-right placeholder:text-right"
              disabled={submitting}
              dir="rtl"
            />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              با وارد کردن نام کاربری، وضعیت فوکوس و تایمر شما مستقیماً از سرور اصلی بازتاب داده می‌شود.
            </p>
          </div>

          {/* Step 2: Two-Way Control Form */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-muted-foreground" />
                <span className="text-xs text-foreground font-medium">
                  ۲. اتصال دوطرفه (اختیاری — برای شروع/پایان تایمر از اینجا)
                </span>
              </div>
              {status?.hasSessionCookie ? (
                <button
                  type="button"
                  onClick={handleDisconnectCookie}
                  disabled={submitting}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors select-none outline-none"
                >
                  قطع ارتباط کوکی
                </button>
              ) : null}
            </div>

            {status?.hasSessionCookie ? (
              <div className="border border-border bg-muted/20 p-3 rounded-none text-xs text-muted-foreground flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  احراز هویت دوطرفه فعال است. هر تغییری در تایمر این برنامه (شروع، استراحت یا تایید) مستقیماً روی سرور اصلی اعمال می‌شود.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveCookie} className="space-y-2.5">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  اگر می‌خواهید پومودوروهایی که در این نسخه می‌زنید مستقیماً روی سرور اصلی ثبت شوند، کوکی <code className="text-foreground font-vazir px-1 py-0.5 bg-muted/40 border border-border/50">pomodorus_session</code> را وارد کنید:
                </p>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="کوکی pomodorus_session..."
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    className="text-xs h-8 rounded-none border-border bg-background font-vazir"
                    disabled={submitting}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={submitting || !cookieInput.trim()}
                    className="shrink-0 h-8 text-xs rounded-none px-3"
                  >
                    {submitting ? "بررسی..." : "ثبت و احراز"}
                  </Button>
                </div>

                <div className="border border-border/70 bg-muted/10 p-3 rounded-none text-[11px] text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">ساده‌ترین روش دریافت کوکی:</p>
                  <p>
                    در سایت <a href="https://pomodorus.yazdan.me" target="_blank" rel="noreferrer" className="underline text-foreground">pomodorus.yazdan.me</a> لاگین کنید، کلید <kbd className="border border-border px-1">F12</kbd> را بزنید، به تب <strong>Application &gt; Cookies</strong> بروید و مقدار ستون Value در سطر <strong>pomodorus_session</strong> را کپی و اینجا پیست کنید.
                  </p>
                </div>
              </form>
            )}

            {message ? (
              <div
                className={`p-2.5 border rounded-none text-xs ${
                  message.type === "success"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-destructive/40 bg-destructive/10 text-destructive"
                }`}
              >
                {message.text}
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground h-8 rounded-none gap-1.5 px-2.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            بروزرسانی وضعیت
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 text-xs rounded-none px-5"
          >
            بستن
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
