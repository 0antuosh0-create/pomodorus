import { useState, useRef } from "react";
import { Download, Upload, RefreshCw, Trash2, ShieldCheck, CloudDownload, Check, AlertCircle } from "lucide-react";
import { faDigits } from "@/lib/format";
import { useMTracker, getAutoSyncHandle, setAutoSyncHandle } from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MTrackerDataRoute() {
  const {
    entries,
    exportJson,
    exportCsv,
    importData,
    loadSample,
    clearAll,
  } = useMTracker();
  const [remoteHandle, setRemoteHandle] = useState<string>(getAutoSyncHandle() ?? "");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoteSync = async () => {
    if (!remoteHandle.trim()) return;
    setSyncLoading(true);
    setSyncMessage(null);
    try {
      const res = await fetch(`/api/sync/mtracker-remote?handle=${encodeURIComponent(remoteHandle.trim())}`);
      const data = await res.json();
      if (res.ok && data.success && data.db) {
        setAutoSyncHandle(remoteHandle.trim());
        if (importData(data.db)) {
          setSyncMessage({
            type: "success",
            text: `همگام‌سازی موفق: ${faDigits(data.stats.tasksCount)} حوزه کاری و ${faDigits(data.stats.totalHours)} ساعت کارکرد از @${data.handle} دریافت شد.`,
          });
        } else {
          setSyncMessage({ type: "error", text: "خطا در اعمال ساختار داده‌ها." });
        }
      } else {
        setSyncMessage({
          type: "error",
          text: data.error === "remote_profile_not_found"
            ? `پروفایل «${remoteHandle}» در سرور pomodorus.yazdan.me یافت نشد.`
            : "خطا در برقراری ارتباط با سرور زنده pomodorus.yazdan.me",
        });
      }
    } catch {
      setSyncMessage({ type: "error", text: "خطای شبکه در اتصال به سرور زنده." });
    } finally {
      setSyncLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (importData(parsed)) {
          alert("داده‌ها با موفقیت وارد شدند.");
        } else {
          alert("فایل وارد شده نامعتبر است.");
        }
      } catch {
        alert("خطا در خواندن فایل JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 w-full max-w-xl mx-auto">
      {/* Top Header Card */}
      <section className="rounded-none border border-border/40 bg-card p-5 sm:p-6">
        <h2 className="text-base font-medium text-foreground">
          مدیریت داده‌ها و همگام‌سازی
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          <strong className="text-foreground">{faDigits(entries.length)}</strong> ثبت انجام‌شده در حافظه محلی
        </p>
      </section>

      {/* 3 Operations Cards */}
      <div className="space-y-4">
        {/* Card 1: Backup */}
        <div className="rounded-none border border-border/40 bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-base font-medium text-foreground">پشتیبان‌گیری</h3>
            <span className="text-xs border border-border bg-secondary text-foreground px-2 py-0.5">
              آماده استخراج
            </span>
          </div>

          <div className="space-y-2 text-xs border-b border-border/50 pb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">محل ذخیره‌سازی:</span>
              <span className="text-foreground">حافظه محلی و دیتابیس</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">تعداد رکوردها:</span>
              <span className="tabular-nums text-foreground">{faDigits(entries.length)} ثبت</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">فرمت‌های قابل دریافت:</span>
              <span className="text-foreground">JSON / CSV</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={exportJson}
              className="flex-1"
            >
              <Download />
              بکاپ JSON
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={exportCsv}
              className="flex-1"
            >
              <Download />
              خروجی CSV
            </Button>
          </div>
        </div>

        {/* Card 2: Sync with Pomodorus */}
        <div className="rounded-none border border-border/40 bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-base font-medium text-foreground">همگام‌سازی با سرور زنده</h3>
            <span className="text-xs border border-border bg-secondary text-foreground px-2 py-0.5">
              pomodorus.yazdan.me
            </span>
          </div>

          <div className="space-y-2 text-xs border-b border-border/50 pb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">سرور مقصد:</span>
              <span className="text-foreground font-medium font-mono text-[11px]" dir="ltr">https://pomodorus.yazdan.me</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">وضعیت اتصال:</span>
              <span className="text-foreground">پروکسی زنده فید و سوابق</span>
            </div>
          </div>

          {/* Remote Profile Sync Input & Action */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground block">
                نام کاربری جهت استخراج سوابق زنده:
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={remoteHandle}
                  onChange={(e) => setRemoteHandle(e.target.value)}
                  placeholder="مثلاً: yazdanctx"
                  className="text-xs font-mono text-start"
                  dir="ltr"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  onClick={handleRemoteSync}
                  disabled={syncLoading || !remoteHandle.trim()}
                  className="shrink-0"
                >
                  <CloudDownload className="size-4" />
                  {syncLoading ? "در حال دریافت..." : "همگام‌سازی زنده"}
                </Button>
              </div>
            </div>

            {syncMessage && (
              <div
                className={`p-3 text-xs flex items-start gap-2 border ${
                  syncMessage.type === "success"
                    ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                }`}
              >
                {syncMessage.type === "success" ? (
                  <Check className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                ) : (
                  <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                )}
                <span>{syncMessage.text}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={loadSample}
              className="flex-1"
            >
              <RefreshCw />
              داده نمونه
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1"
            >
              <Upload />
              ورود فایل JSON
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Card 3: Delete / Reset */}
        <div className="rounded-none border border-border/40 bg-card p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h3 className="text-base font-medium text-foreground">حذف داده‌ها</h3>
            <span className="text-xs border border-destructive/30 text-destructive px-2 py-0.5">
              حساس
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            این عملیات تمام تسک‌ها و رکوردهای ثبت‌شده محلی را حذف می‌کند و قابل بازگشت نیست.
          </p>

          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={() => {
              if (confirm("آیا کاملاً مطمئنید که می‌خواهید همه داده‌ها را پاک کنید؟")) {
                clearAll();
              }
            }}
            className="w-full"
          >
            <Trash2 />
            حذف همه داده‌ها
          </Button>
        </div>
      </div>

      {/* SD Methodology Card */}
      <div className="rounded-none border border-border/40 bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-3">
          <h3 className="text-base font-medium text-foreground flex items-center gap-2">
            <ShieldCheck className="size-4" />
            روش SD و اصول پیوستگی کارکرد
          </h3>
          <span className="text-xs tabular-nums text-foreground border border-border bg-secondary px-2.5 py-1">
            انحراف معیار &lt; میانگین ÷ ۲
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="border border-border/40 bg-secondary p-3.5 space-y-1">
            <div className="text-xs font-medium text-foreground">۱. ارزش پیوستگی</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              ۷ ساعت در ۷ روز، از ۷ ساعت در ۱ روز بسیار ارزشمندتر و پایدارتر است. استمرار مانع فرسودگی می‌شود.
            </p>
          </div>

          <div className="border border-border/40 bg-secondary p-3.5 space-y-1">
            <div className="text-xs font-medium text-foreground">۲. ثبت دقیق</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              روزهای بدون کار صفر حساب می‌شوند؛ هیچ روزی را خالی نگذارید و روزهای سبک را هم با نیم ساعت حفظ کنید.
            </p>
          </div>

          <div className="border border-border/40 bg-secondary p-3.5 space-y-1">
            <div className="text-xs font-medium text-foreground">۳. کف عملکرد</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              حداقل ۳ ساعت تمرکز روزانه برای پیشبرد کارهای تخصصی پیشنهاد می‌شود.
            </p>
          </div>

          <div className="border border-border/40 bg-secondary p-3.5 space-y-1">
            <div className="text-xs font-medium text-foreground">۴. دید ماهانه</div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              به‌جای قضاوت یک روز منفرد، معدل و پایداری ماه را بسنجید تا نوسان‌ها جبران شوند.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
