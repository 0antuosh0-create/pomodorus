import { useState, useMemo } from "react";
import { Link } from "react-router";
import { Plus, ArrowLeft, Timer } from "lucide-react";
import { faDigits } from "@/lib/format";
import {
  useMTracker,
  formatJalaliDate,
  getIsoDate,
  getJalaliMonthRange,
  calculateSDStats,
  formatHours,
} from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { MonthWall } from "@/components/mtracker/month-wall";
import { SDBadge } from "@/components/mtracker/sd-badge";
import { RhythmBarChart } from "@/components/mtracker/rhythm-bar-chart";
import { ManualEntryModal } from "@/components/mtracker/manual-entry-modal";

export function MTrackerTodayRoute() {
  const { tasks, entries, addEntry } = useMTracker();
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>();

  const todayIso = useMemo(() => getIsoDate(), []);

  const todayTotalHours = useMemo(() => {
    let sum = 0;
    for (const e of entries) {
      if (e.date === todayIso) sum += e.hours;
    }
    return sum;
  }, [entries, todayIso]);

  const { days: monthDays } = useMemo(() => getJalaliMonthRange(), []);
  const monthStats = useMemo(() => {
    return calculateSDStats({
      entries,
      days: monthDays,
      targetDailyHours: 6,
      daysPerWeek: 7,
    });
  }, [entries, monthDays]);

  const dailyTargetHours = useMemo(() => {
    return tasks.reduce((sum, t) => sum + t.targetDailyHours, 0) || 6;
  }, [tasks]);

  const todayPct = useMemo(() => {
    if (!dailyTargetHours) return 0;
    return Math.round((todayTotalHours / dailyTargetHours) * 100);
  }, [todayTotalHours, dailyTargetHours]);

  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 w-full max-w-xl mx-auto">
      {/* Unified Executive Hero & Metrics Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-8 space-y-6">
        {/* Top Tier: Date, Large Time, and Action */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground block">
              {formatJalaliDate()}
            </span>
            <p className="text-5xl sm:text-6xl font-bold tracking-tight tabular-nums text-foreground leading-none pt-1">
              <bdi dir="ltr">{formatHours(todayTotalHours)}</bdi>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums pt-1">
              ساعت کارکرد متمرکز امروز • هدف: {formatHours(dailyTargetHours)} ساعت
              {todayTotalHours > 0 ? ` (${faDigits(todayPct)}٪)` : ""}
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={() => {
              setSelectedTaskId(undefined);
              setManualModalOpen(true);
            }}
            className="shrink-0"
          >
            <Plus />
            ثبت ساعت
          </Button>
        </div>

        {/* Target Progress Bar */}
        <div className="h-1.5 w-full bg-secondary/50 rounded-none overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-300"
            style={{ width: `${Math.min(100, todayPct)}%` }}
          />
        </div>

        {/* Unified Inset Panel: The 3 Consistency Metrics */}
        <div className="rounded-none bg-white/[0.04] p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">میانگین روزانه</span>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {formatHours(monthStats.mean)}
                <span className="text-xs text-muted-foreground font-normal ps-1">ساعت</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">انحراف معیار</span>
                <SDBadge status={monthStats.status} />
              </div>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {formatHours(monthStats.sd)}
                <span className="text-xs text-muted-foreground font-normal ps-1">ساعت</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground block">زنجیره پیوستگی</span>
              <div className="text-2xl font-bold tabular-nums text-foreground">
                {faDigits(monthStats.streak)}
                <span className="text-xs text-muted-foreground font-normal ps-1">روز</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Month Wall Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7">
        <MonthWall entries={entries} />
      </section>

      {/* 7-Day Rhythm Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7">
        <RhythmBarChart entries={entries} targetDailyHours={dailyTargetHours} />
      </section>

      {/* Tracked Tasks List Card */}
      <section className="rounded-none border border-border bg-card p-6 sm:p-7 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <span className="text-xs font-medium text-foreground">تسک‌های تحت نظر</span>
          <Button asChild size="xs" variant="ghost">
            <Link to="/tasks">
              همه تسک‌ها ({faDigits(tasks.length)})
              <ArrowLeft />
            </Link>
          </Button>
        </div>

        <ul className="divide-y divide-border/50">
          {tasks.map((task) => {
            let taskTodayHours = 0;
            for (const e of entries) {
              if (e.taskId === task.id && e.date === todayIso) {
                taskTodayHours += e.hours;
              }
            }

            return (
              <li
                key={task.id}
                className="py-3.5 px-1 flex items-center justify-between gap-3 group transition-colors hover:bg-muted/15"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">{task.name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                    هدف: {faDigits(task.targetDailyHours)} ساعت در روز
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="tabular-nums text-sm font-medium text-foreground ps-2">
                    {taskTodayHours > 0 ? formatHours(taskTodayHours) + "س" : "۰:۰۰"}
                  </span>
                  <Button
                    asChild
                    size="xs"
                    variant="outline"
                    title="شروع تایمر روی این تسک"
                  >
                    <Link to="/app">
                      <Timer />
                      تایمر
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    title="ثبت دستی ساعت"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setManualModalOpen(true);
                    }}
                  >
                    <Plus />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        tasks={tasks}
        initialTaskId={selectedTaskId}
        initialDate={todayIso}
        onSave={(data) => {
          addEntry(data);
        }}
      />
    </main>
  );
}
