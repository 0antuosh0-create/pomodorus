import { useState, useMemo } from "react";
import { faDigits } from "@/lib/format";
import {
  addDays,
  getIsoDate,
  parseIsoDate,
  getJalaliDate,
  formatHours,
  formatHoursWithUnit,
  type Entry,
  JALALI_WEEKDAY_SHORT,
} from "@/lib/mtracker";

export function RhythmBarChart({
  entries,
  targetDailyHours = 6,
}: {
  entries: Entry[];
  targetDailyHours?: number;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const last7Days = useMemo(() => {
    const days: {
      date: string;
      label: string;
      jd: number;
      hours: number;
    }[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = addDays(today, -i);
      const iso = getIsoDate(d);
      const weekdayIdx = (d.getDay() - 6 + 7) % 7;
      const label = JALALI_WEEKDAY_SHORT[weekdayIdx];
      const jDate = getJalaliDate(d);

      let sum = 0;
      for (const e of entries) {
        if (e.date === iso) sum += e.hours;
      }

      days.push({ date: iso, label, jd: jDate.jd, hours: sum });
    }
    return days;
  }, [entries]);

  const maxVal = useMemo(() => {
    const max = Math.max(...last7Days.map((d) => d.hours), targetDailyHours, 4);
    return Math.ceil(max);
  }, [last7Days, targetDailyHours]);

  const activeCount = last7Days.filter((d) => d.hours > 0.001).length;
  const coveragePct = Math.round((activeCount / 7) * 100);

  const activeHeader = useMemo(() => {
    if (!hoveredDate) {
      return `هدف روزانه: ${faDigits(targetDailyHours)}:۰۰ ساعت • ${faDigits(coveragePct)}٪ پیوستگی`;
    }
    const day = last7Days.find((d) => d.date === hoveredDate);
    if (!day) return "";
    const pct = targetDailyHours > 0 ? Math.round((day.hours / targetDailyHours) * 100) : 0;
    return `${day.label} (${faDigits(day.jd)}ام): ${day.hours > 0 ? formatHoursWithUnit(day.hours) : "بدون ثبت"} • ${faDigits(pct)}٪ از هدف`;
  }, [hoveredDate, targetDailyHours, coveragePct, last7Days]);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between border-b border-border/60 pb-2.5 text-xs">
        <span className="font-medium text-foreground">ریتم ثبت ۷ روز اخیر</span>
        <span className="tabular-nums text-muted-foreground text-[11px]">
          {activeHeader}
        </span>
      </div>

      {/* Chart Canvas with Day Track Guides */}
      <div className="relative h-32 pt-3 pb-8 flex items-end justify-between gap-2 sm:gap-4 px-2">
        {/* Dashed Target Line */}
        <div
          className="absolute inset-x-0 border-b border-dashed border-border/60 z-10 flex items-center justify-end"
          style={{ bottom: `${(targetDailyHours / maxVal) * 100}%` }}
        >
          <span className="text-[10px] text-muted-foreground bg-card px-1.5 -translate-y-2 tabular-nums">
            خط هدف ({faDigits(targetDailyHours)}س)
          </span>
        </div>

        {/* 7 Day Columns with Background Tracks */}
        {last7Days.map((d) => {
          const heightPct = Math.min(100, Math.max(0, (d.hours / maxVal) * 100));
          const isAboveTarget = d.hours >= targetDailyHours;
          const isHovered = d.date === hoveredDate;

          return (
            <div
              key={d.date}
              onMouseEnter={() => setHoveredDate(d.date)}
              onMouseLeave={() => setHoveredDate(null)}
              className="flex-1 h-full flex flex-col items-center justify-end group cursor-pointer"
            >
              {/* Value floating tag */}
              <div
                className={`text-[10px] tabular-nums transition-opacity mb-1 font-mono ${
                  isHovered ? "opacity-100 text-foreground font-bold" : "opacity-0"
                }`}
              >
                {d.hours > 0 ? formatHours(d.hours) : "۰"}
              </div>

              {/* Background Track Slot */}
              <div className="relative w-full max-w-[34px] h-full bg-white/[0.05] rounded-none flex items-end overflow-hidden">
                {/* Active Bar Fill */}
                <div
                  className={`w-full rounded-none transition-all duration-200 ${
                    isAboveTarget
                      ? "bg-foreground text-background"
                      : d.hours > 0
                      ? "bg-white/45 group-hover:bg-white/60"
                      : "h-0"
                  } ${isHovered ? "ring-1 ring-foreground" : ""}`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>

              {/* 2-tier X-Axis Label */}
              <div className="flex flex-col items-center pt-2 gap-0.5 select-none">
                <span className={`text-[11px] font-medium leading-none ${isHovered ? "text-foreground font-bold" : "text-muted-foreground"}`}>
                  {d.label}
                </span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums leading-none">
                  {faDigits(d.jd)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
        <span>پوشش زمانی هفتگی: <strong className="text-foreground tabular-nums font-normal">{faDigits(coveragePct)}٪</strong></span>
        <span>
          {activeCount === 7 ? "پیوستگی کامل (۷ از ۷)" : `${faDigits(activeCount)} روز با کارکرد ثبت‌شده`}
        </span>
      </div>
    </div>
  );
}
