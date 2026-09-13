import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import { ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { faDigits } from "@/lib/format";
import {
  useMTracker,
  formatJalaliDate,
  getIsoDate,
  parseIsoDate,
  addDays,
  formatHours,
  formatHoursWithUnit,
} from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { ManualEntryModal } from "@/components/mtracker/manual-entry-modal";

export function MTrackerDailyRoute() {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = useMemo(() => getIsoDate(), []);

  const selectedDateIso = searchParams.get("date") || todayIso;
  const selectedDate = useMemo(() => parseIsoDate(selectedDateIso), [selectedDateIso]);

  const { tasks, entries, addEntry, deleteEntry } = useMTracker();
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const dayEntries = useMemo(() => {
    return entries.filter((e) => e.date === selectedDateIso);
  }, [entries, selectedDateIso]);

  const dayTotalHours = useMemo(() => {
    return dayEntries.reduce((sum, e) => sum + e.hours, 0);
  }, [dayEntries]);

  const dailyTargetHours = useMemo(() => {
    return tasks.reduce((sum, t) => sum + t.targetDailyHours, 0) || 6;
  }, [tasks]);

  const targetPct = useMemo(() => {
    if (!dailyTargetHours) return 0;
    return Math.round((dayTotalHours / dailyTargetHours) * 100);
  }, [dayTotalHours, dailyTargetHours]);

  const { avg7, avg30, trend14 } = useMemo(() => {
    const trend: { date: string; hours: number }[] = [];
    let sum7 = 0;
    let sum30 = 0;

    for (let i = 0; i < 30; i++) {
      const d = addDays(selectedDate, -i);
      const iso = getIsoDate(d);
      let daySum = 0;
      for (const e of entries) {
        if (e.date === iso) daySum += e.hours;
      }

      if (i < 7) sum7 += daySum;
      sum30 += daySum;

      if (i < 14) {
        trend.unshift({ date: iso, hours: daySum });
      }
    }

    return {
      avg7: +(sum7 / 7).toFixed(2),
      avg30: +(sum30 / 30).toFixed(2),
      trend14: trend,
    };
  }, [entries, selectedDate]);

  const isToday = selectedDateIso === todayIso;

  const maxTrend = useMemo(() => {
    const max = Math.max(...trend14.map((t) => t.hours), 4);
    return max || 1;
  }, [trend14]);

  const trendHoverText = useMemo(() => {
    if (!hoveredDate) return `میانگین: ${formatHours(avg7)}س`;
    const h = trend14.find((t) => t.date === hoveredDate)?.hours ?? 0;
    return `${formatJalaliDate(parseIsoDate(hoveredDate))}: ${h > 0 ? `${formatHours(h)} ساعت` : "بدون ثبت"}`;
  }, [hoveredDate, trend14, avg7]);

  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 w-full max-w-xl mx-auto">
      {/* Date Switcher Bar */}
      <section className="flex items-center justify-between border-b border-border/60 pb-3">
        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => {
            const prev = addDays(selectedDate, -1);
            setSearchParams({ date: getIsoDate(prev) });
          }}
        >
          <ChevronRight />
          روز قبل
        </Button>

        <div className="text-center">
          <span className="text-sm font-medium text-foreground block">
            {formatJalaliDate(selectedDate)}
          </span>
          {!isToday ? (
            <button
              type="button"
              onClick={() => setSearchParams({ date: todayIso })}
              className="text-[11px] text-muted-foreground/80 hover:text-foreground underline mt-0.5"
            >
              رفتن به امروز
            </button>
          ) : null}
        </div>

        <Button
          type="button"
          size="xs"
          variant="outline"
          onClick={() => {
            if (selectedDateIso < todayIso) {
              const next = addDays(selectedDate, 1);
              setSearchParams({ date: getIsoDate(next) });
            }
          }}
          disabled={isToday}
        >
          روز بعد
          <ChevronLeft />
        </Button>
      </section>

      {/* Unified Day Performance Hero Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">
              کارکرد این روز
            </span>
            <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-foreground leading-none pt-1">
              <bdi dir="ltr">{formatHours(dayTotalHours)}</bdi>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums pt-1">
              {dayTotalHours > 0
                ? `${faDigits(targetPct)}٪ از هدف روزانه (${formatHours(dailyTargetHours)}س)`
                : `هدف تعیین‌شده: ${formatHours(dailyTargetHours)} ساعت`}
            </p>
          </div>

          <span className="text-xs tabular-nums text-foreground rounded-none border border-border bg-secondary/40 px-3 py-1">
            {dayTotalHours > 0 ? "ثبت شده" : "بدون کارکرد"}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-secondary/50 rounded-none overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${Math.min(100, targetPct)}%` }}
          />
        </div>

        {/* Unified Inset Panel for 4 Metrics */}
        <div className="rounded-none bg-white/[0.04] p-5 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-start">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground block">هدف روز</span>
              <div className="text-lg font-bold tabular-nums text-foreground">
                {formatHours(dailyTargetHours)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground block">میانگین ۷ روز</span>
              <div className="text-lg font-bold tabular-nums text-foreground">
                {formatHours(avg7)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground block">میانگین ۳۰ روز</span>
              <div className="text-lg font-bold tabular-nums text-foreground">
                {formatHours(avg30)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground block">تعداد ثبت‌ها</span>
              <div className="text-lg font-bold tabular-nums text-foreground">
                {faDigits(dayEntries.length)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 14-day Sparkline Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-2">
          <span className="font-medium text-foreground">روند ۱۴ روز اخیر</span>
          <span className="tabular-nums text-[11px]">{trendHoverText}</span>
        </div>
        <div className="h-16 w-full flex items-end justify-between gap-1.5 pt-1">
          {trend14.map((t, i) => {
            const hPct = t.hours > 0 ? Math.min(100, Math.max(8, (t.hours / maxTrend) * 100)) : 0;
            const isSelected = t.date === selectedDateIso;
            const isHovered = t.date === hoveredDate;
            const isToday = i === trend14.length - 1;
            return (
              <div
                key={t.date}
                onClick={() => setSearchParams({ date: t.date })}
                onMouseEnter={() => setHoveredDate(t.date)}
                onMouseLeave={() => setHoveredDate(null)}
                className="flex-1 h-full flex flex-col justify-end items-center cursor-pointer group"
                title={`${t.date}: ${formatHours(t.hours)} ساعت`}
              >
                <div
                  className={`w-full h-full bg-white/[0.06] rounded-none flex items-end overflow-hidden ${
                    isToday ? "ring-1 ring-foreground/25" : ""
                  }`}
                >
                  <div
                    className={`w-full transition-all ${
                      isSelected
                        ? "bg-foreground"
                        : isHovered
                        ? "bg-white/75"
                        : t.hours > 0
                        ? "bg-white/55 group-hover:bg-white/75"
                        : "bg-muted-foreground/25"
                    }`}
                    style={{ height: t.hours > 0 ? `${hPct}%` : "3px" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Entries for this Day Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7 space-y-4">
        <div className="flex items-center justify-between border-b border-border/30 pb-3">
          <span className="text-xs font-medium text-foreground">
            تسک‌های ثبت‌شده ({faDigits(dayEntries.length)})
          </span>
          <Button
            type="button"
            size="xs"
            variant="default"
            onClick={() => setManualModalOpen(true)}
          >
            <Plus />
            ثبت ساعت
          </Button>
        </div>

        {dayEntries.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            در این تاریخ هیچ ساعتی ثبت نشده است.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {dayEntries.map((e) => {
              const task = tasks.find((t) => t.id === e.taskId);
              return (
                <div
                  key={e.id}
                  className="py-3.5 flex items-center justify-between gap-3 text-xs group"
                >
                  <div>
                    <div className="font-medium text-foreground text-sm">
                      {task ? task.name : "تسک عمومی"}
                    </div>
                    {e.note ? (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{e.note}</div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium text-foreground">
                      {formatHours(e.hours)} ساعت
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteEntry(e.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="حذف"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        tasks={tasks}
        initialDate={selectedDateIso}
        onSave={(data) => {
          addEntry(data);
        }}
      />
    </main>
  );
}
