import { useState, useMemo } from "react";
import { Link } from "react-router";
import { faDigits } from "@/lib/format";
import {
  getJalaliMonthRange,
  getJalaliDate,
  getIsoDate,
  parseIsoDate,
  formatHours,
  formatHoursWithUnit,
  JALALI_WEEKDAY_SHORT,
  type Entry,
} from "@/lib/mtracker";

export function MonthWall({
  entries,
  refDate = new Date(),
  onSelectDate,
}: {
  entries: Entry[];
  refDate?: Date;
  onSelectDate?: (dateIso: string) => void;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const { monthName, days, startWeekdayOffset } = useMemo(
    () => getJalaliMonthRange(refDate),
    [refDate]
  );

  const todayIso = useMemo(() => getIsoDate(), []);

  const dateHoursMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of days) {
      let sum = 0;
      for (const e of entries) {
        if (e.date === d.date) sum += e.hours;
      }
      map[d.date] = sum;
    }
    return map;
  }, [days, entries]);

  const maxHours = useMemo(() => {
    const vals = Object.values(dateHoursMap);
    return Math.max(...vals, 4);
  }, [dateHoursMap]);

  const totalMonthHours = useMemo(() => {
    return Object.values(dateHoursMap).reduce((sum, h) => sum + h, 0);
  }, [dateHoursMap]);

  function getLevel(hours: number): 0 | 1 | 2 | 3 | 4 {
    if (!hours || hours <= 0.001) return 0;
    const ratio = hours / maxHours;
    if (ratio <= 0.25) return 1;
    if (ratio <= 0.5) return 2;
    if (ratio <= 0.75) return 3;
    return 4;
  }

  const levelClasses = {
    0: "bg-secondary/25 text-muted-foreground/30",
    1: "bg-white/8 text-muted-foreground/50",
    2: "bg-white/20 text-foreground/70",
    3: "bg-white/45 text-background font-semibold",
    4: "bg-foreground text-background font-bold",
  };

  const activeInspection = useMemo(() => {
    if (!hoveredDate) {
      return {
        label: `${monthName}`,
        value: `${formatHours(totalMonthHours)} ساعت کارکرد ماه`,
      };
    }
    const h = dateHoursMap[hoveredDate] || 0;
    const j = getJalaliDate(parseIsoDate(hoveredDate));
    return {
      label: `${faDigits(j.jd)} ${monthName}`,
      value: h > 0 ? formatHoursWithUnit(h) : "بدون ثبت کارکرد",
    };
  }, [hoveredDate, totalMonthHours, dateHoursMap, monthName]);

  return (
    <div className="w-full space-y-4">
      {/* Live Inspection Header */}
      <div className="flex items-baseline justify-between border-b border-border/60 pb-2.5 text-xs">
        <span className="font-medium text-foreground">
          دیوار ماه{" "}
          <span className="text-muted-foreground/60 font-normal">({activeInspection.label})</span>
        </span>
        <span className="tabular-nums text-muted-foreground text-[11px]">
          {activeInspection.value}
        </span>
      </div>

      {/* Centered, proportioned heatmap grid */}
      <div className="max-w-sm mx-auto select-none pt-1">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pb-2">
          {JALALI_WEEKDAY_SHORT.map((wd, i) => (
            <div
              key={wd}
              className={`text-center text-[10px] font-medium ${
                i === 6 ? "text-muted-foreground/50" : "text-muted-foreground/40"
              }`}
            >
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {/* Offset blanks */}
          {Array.from({ length: startWeekdayOffset }).map((_, i) => (
            <div key={`blank-start-${i}`} className="aspect-square" />
          ))}

          {/* Day squares */}
          {days.map((d) => {
            const hours = dateHoursMap[d.date] || 0;
            const lvl = getLevel(hours);
            const isToday = d.date === todayIso;
            const isHovered = d.date === hoveredDate;

            const content = (
              <div
                onMouseEnter={() => setHoveredDate(d.date)}
                onMouseLeave={() => setHoveredDate(null)}
                className={`relative flex items-center justify-center aspect-square rounded-md text-[10px] tabular-nums leading-none transition-all duration-150 cursor-pointer ${
                  levelClasses[lvl]
                } ${isToday ? "ring-1 ring-foreground/60 ring-offset-1 ring-offset-background" : ""} ${
                  isHovered ? "brightness-125 scale-[1.08] z-10" : "hover:brightness-110"
                }`}
                title={hours > 0 ? `${formatHours(hours)} ساعت` : undefined}
              >
                {faDigits(d.jd)}
              </div>
            );

            if (onSelectDate) {
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => onSelectDate(d.date)}
                  className="w-full focus:outline-none"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link key={d.date} to={`/daily?date=${d.date}`} className="w-full focus:outline-none">
                {content}
              </Link>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground/40 pt-4">
          <span className="pe-0.5">کم</span>
          <span className="size-2.5 bg-secondary/25" />
          <span className="size-2.5 bg-white/8" />
          <span className="size-2.5 bg-white/20" />
          <span className="size-2.5 bg-white/45" />
          <span className="size-2.5 bg-foreground" />
          <span className="ps-0.5">زیاد</span>
        </div>
      </div>
    </div>
  );
}
