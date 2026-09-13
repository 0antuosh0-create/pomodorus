import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronRight, ChevronLeft, Calendar as CalendarIcon, RotateCcw } from "lucide-react";
import { faDigits } from "@/lib/format";
import {
  getJalaliDate,
  formatJalaliDate,
  getJalaliMonthRange,
  getJalaliDaysInMonth,
  addDays,
  parseIsoDate,
  getIsoDate,
  JALALI_WEEKDAY_SHORT,
} from "@/lib/mtracker";
import { Button } from "@/components/ui/button";

export function JalaliDatePicker({
  value,
  onChange,
}: {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const [viewDate, setViewDate] = useState<Date>(selectedDate);

  // Sync view date when value changes externally
  useEffect(() => {
    setViewDate(parseIsoDate(value));
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const { monthName, days, startWeekdayOffset, jy, jm } = useMemo(() => {
    return getJalaliMonthRange(viewDate);
  }, [viewDate]);

  const todayIso = useMemo(() => getIsoDate(), []);

  const handlePrevMonth = () => {
    const { jd } = getJalaliDate(viewDate);
    // Landing safely in the previous Jalali month
    setViewDate((d) => addDays(d, -(jd + 5)));
  };

  const handleNextMonth = () => {
    const { jy, jm, jd } = getJalaliDate(viewDate);
    const daysInMonth = getJalaliDaysInMonth(jy, jm);
    // Landing safely in the next Jalali month
    setViewDate((d) => addDays(d, daysInMonth - jd + 5));
  };

  const handleSelectDay = (dayIso: string) => {
    onChange(dayIso);
    setIsOpen(false);
  };

  const handleGoToToday = () => {
    onChange(todayIso);
    setViewDate(new Date());
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full h-10 px-3 rounded-none border border-border bg-background flex items-center justify-between text-sm text-foreground hover:border-foreground/50 transition-colors outline-none focus:border-foreground/40 focus:ring-1 focus:ring-foreground/10"
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate">{formatJalaliDate(selectedDate)}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0 ps-2">
          {value}
        </span>
      </button>

      {/* Dropdown Calendar Popover */}
      {isOpen ? (
        <div className="absolute top-full start-0 z-50 mt-1 w-full max-w-xs rounded-none border border-border bg-popover p-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
          {/* Header Controls */}
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handlePrevMonth}
              title="ماه قبل"
            >
              <ChevronRight />
            </Button>

            <span className="text-xs font-bold text-foreground">
              {monthName}
            </span>

            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={handleNextMonth}
              title="ماه بعد"
            >
              <ChevronLeft />
            </Button>
          </div>

          {/* Weekday Row */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] pb-1">
            {JALALI_WEEKDAY_SHORT.map((wd, i) => (
              <div
                key={wd}
                className={i === 6 ? "text-muted-foreground/60 font-medium" : "text-muted-foreground"}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-1 select-none">
            {Array.from({ length: startWeekdayOffset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square opacity-0 pointer-events-none" />
            ))}

            {days.map((d) => {
              const isSelected = d.date === value;
              const isToday = d.date === todayIso;
              const isFriday = d.weekdayIndex === 6;

              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => handleSelectDay(d.date)}
                  className={`relative flex items-center justify-center aspect-square text-xs transition-colors rounded-none ${
                    isSelected
                      ? "bg-foreground text-background font-bold shadow-xs"
                      : isToday
                      ? "border border-foreground font-medium text-foreground hover:bg-muted"
                      : isFriday
                      ? "text-muted-foreground/60 hover:bg-muted"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="tabular-nums text-[11px] leading-none">
                    {faDigits(d.jd)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer Today Button */}
          <div className="flex items-center justify-between border-t border-border/60 pt-2 mt-2 text-xs">
            <button
              type="button"
              onClick={handleGoToToday}
              className="text-[11px] text-muted-foreground hover:text-foreground underline flex items-center gap-1"
            >
              <RotateCcw className="size-3" />
              انتخاب امروز
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {todayIso}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
