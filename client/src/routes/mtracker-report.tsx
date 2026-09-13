import { useState, useMemo } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { faDigits } from "@/lib/format";
import {
  useMTracker,
  getJalaliMonthRange,
  addDays,
  calculateSDStats,
  formatHours,
} from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { MonthWall } from "@/components/mtracker/month-wall";
import { SDBadge } from "@/components/mtracker/sd-badge";

export function MTrackerReportRoute() {
  const { tasks, entries } = useMTracker();

  const [monthOffset, setMonthOffset] = useState(0);
  const [rangeMode, setRangeMode] = useState<"month" | "30" | "90">("month");

  const refDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + monthOffset * 30);
    return d;
  }, [monthOffset]);

  const { monthName, days: monthDays } = useMemo(
    () => getJalaliMonthRange(refDate),
    [refDate]
  );

  const activeDays = useMemo(() => {
    if (rangeMode === "month") return monthDays;
    const count = Number(rangeMode);
    const list: { date: string }[] = [];
    const today = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      const iso = d.toISOString().split("T")[0];
      list.push({ date: iso });
    }
    return list;
  }, [rangeMode, monthDays]);

  const overallStats = useMemo(() => {
    return calculateSDStats({
      entries,
      days: activeDays,
      targetDailyHours: 6,
      daysPerWeek: 7,
    });
  }, [entries, activeDays]);

  const taskBreakdowns = useMemo(() => {
    const totalHours = overallStats.total || 1;
    return tasks.map((task) => {
      const taskEntries = entries.filter((e) => e.taskId === task.id);
      const stats = calculateSDStats({
        entries: taskEntries,
        days: activeDays,
        targetDailyHours: task.targetDailyHours,
        daysPerWeek: task.daysPerWeek,
      });

      const sharePct = Math.round((stats.total / totalHours) * 100);

      return {
        task,
        stats,
        sharePct,
      };
    });
  }, [tasks, entries, activeDays, overallStats.total]);

  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 w-full max-w-xl mx-auto">
      {/* Month Navigation & Filter Controls */}
      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronRight />
            قبلی
          </Button>
          <span className="px-2 text-sm font-medium text-foreground">
            {monthName}
          </span>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
            disabled={monthOffset >= 0}
          >
            بعدی
            <ChevronLeft />
          </Button>
        </div>

        {/* Range Filter Buttons */}
        <div className="flex items-center gap-1">
          <Button
            size="xs"
            variant={rangeMode === "month" ? "secondary" : "ghost"}
            aria-pressed={rangeMode === "month"}
            onClick={() => setRangeMode("month")}
          >
            ماه شمسی
          </Button>
          <Button
            size="xs"
            variant={rangeMode === "30" ? "secondary" : "ghost"}
            aria-pressed={rangeMode === "30"}
            onClick={() => setRangeMode("30")}
          >
            ۳۰ روز
          </Button>
          <Button
            size="xs"
            variant={rangeMode === "90" ? "secondary" : "ghost"}
            aria-pressed={rangeMode === "90"}
            onClick={() => setRangeMode("90")}
          >
            ۹۰ روز
          </Button>
        </div>
      </section>

      {/* Unified Month Summary Hero Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-8 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">
              مجموع کارکرد در این بازه
            </span>
            <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-foreground leading-none pt-1">
              <bdi dir="ltr">{formatHours(overallStats.total)}</bdi>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums pt-1">
              ساعت کار متمرکز • میانگین: {formatHours(overallStats.mean)} ساعت در روز
            </p>
          </div>

          <SDBadge status={overallStats.status} />
        </div>

        {/* Unified Inset Panel for 4 Metrics */}
        <div className="rounded-none bg-white/[0.04] p-5 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-start">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">میانگین روزانه</span>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {formatHours(overallStats.mean)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">انحراف معیار</span>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {formatHours(overallStats.sd)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">سقف پایداری</span>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {formatHours(overallStats.sdLimit)}
                <span className="text-xs text-muted-foreground font-normal ps-0.5">س</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">روزهای فعال</span>
              <div className="text-xl font-bold tabular-nums text-foreground">
                {faDigits(overallStats.activeDays)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Month Wall Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7">
        <MonthWall entries={entries} refDate={refDate} />
      </section>

      {/* Task Breakdown Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7 space-y-3">
        <div className="border-b border-border/30 pb-2.5">
          <span className="text-xs font-medium text-foreground">
            تفکیک حوزه‌های کاری
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground text-[11px]">
                <th className="text-start py-2.5 font-normal">تسک</th>
                <th className="text-center py-2.5 font-normal">ساعت</th>
                <th className="text-center py-2.5 font-normal">سهم</th>
                <th className="text-center py-2.5 font-normal">میانگین</th>
                <th className="text-center py-2.5 font-normal">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {taskBreakdowns.map(({ task, stats, sharePct }) => (
                <tr key={task.id} className="hover:bg-muted/15 transition-colors">
                  <td className="py-3 font-medium text-foreground">
                    {task.name}
                  </td>
                  <td className="py-3 text-center tabular-nums text-foreground font-medium">
                    {formatHours(stats.total)}
                  </td>
                  <td className="py-3 text-center tabular-nums text-muted-foreground">
                    {faDigits(sharePct)}٪
                  </td>
                  <td className="py-3 text-center tabular-nums text-muted-foreground">
                    {formatHours(stats.mean)}
                  </td>
                  <td className="py-3 text-center">
                    <SDBadge status={stats.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
