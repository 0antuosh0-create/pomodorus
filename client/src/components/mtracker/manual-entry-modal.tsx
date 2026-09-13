import { useState, useEffect } from "react";
import { X, Check, ChevronsUpDown, Minus, Plus } from "lucide-react";
import { faDigits } from "@/lib/format";
import { getIsoDate, formatHours, safeTaskColor, type Task } from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JalaliDatePicker } from "@/components/ui/jalali-date-picker";

export function ManualEntryModal({
  isOpen,
  onClose,
  tasks,
  onSave,
  initialDate,
  initialTaskId,
}: {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSave: (data: { taskId: string; date: string; hours: number; note: string }) => void;
  initialDate?: string;
  initialTaskId?: string;
}) {
  const [taskId, setTaskId] = useState(initialTaskId || tasks[0]?.id || "");
  const [date, setDate] = useState(initialDate || getIsoDate());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [note, setNote] = useState("");
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialTaskId) setTaskId(initialTaskId);
      else if (!taskId && tasks[0]) setTaskId(tasks[0].id);
      if (initialDate) setDate(initialDate);
    }
  }, [isOpen, initialTaskId, initialDate, tasks]);

  if (!isOpen) return null;

  const currentTask = tasks.find((t) => t.id === taskId) || tasks[0];

  const h = Math.floor(durationMinutes / 60);
  const m = durationMinutes % 60;
  const formattedDuration =
    h === 0
      ? `${faDigits(m)} دقیقه`
      : m === 0
      ? `${faDigits(h)} ساعت`
      : `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const totalHours = +(durationMinutes / 60).toFixed(2);
    if (!taskId || totalHours <= 0) return;

    onSave({
      taskId,
      date,
      hours: totalHours,
      note: note.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-popover p-6 sm:p-8 space-y-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h3 className="text-base font-medium text-foreground">
            ثبت دستی ساعت
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Task Selector */}
          <div className="space-y-2 relative">
            <label className="text-xs text-muted-foreground block">انتخاب تسک</label>
            <button
              type="button"
              onClick={() => setTaskPickerOpen((prev) => !prev)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background flex items-center justify-between text-sm text-foreground hover:border-foreground/50 transition-colors"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: safeTaskColor(currentTask?.color) }}
                />
                <span className="font-medium truncate">{currentTask?.name || "انتخاب تسک"}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  (هدف: {faDigits(currentTask?.targetDailyHours || 0)}س)
                </span>
              </div>
              <ChevronsUpDown className="size-4 text-muted-foreground shrink-0" />
            </button>

            {/* Custom Task Dropdown */}
            {taskPickerOpen ? (
              <div className="absolute top-full start-0 z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-2xl py-1 divide-y divide-border/50 max-h-48 overflow-y-auto">
                {tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTaskId(t.id);
                      setTaskPickerOpen(false);
                    }}
                    className="w-full px-3 py-2.5 text-start text-xs flex items-center justify-between hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: safeTaskColor(t.color) }}
                      />
                      <span className="text-foreground font-medium">{t.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        (هدف: {faDigits(t.targetDailyHours)}س)
                      </span>
                    </div>
                    {t.id === taskId ? <Check className="size-3.5 text-foreground" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Genuine Jalali Date Picker */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">تاریخ (تقویم جلالی)</label>
            <JalaliDatePicker value={date} onChange={setDate} />
          </div>

          {/* Calm & Clean Duration Stepper */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">مدت زمان</label>
              <span className="text-xs tabular-nums text-foreground font-medium">
                {formattedDuration}
              </span>
            </div>

            {/* Single Elegant Stepper */}
            <div className="rounded-lg border border-border bg-background p-2 flex items-center justify-between">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDurationMinutes((mins) => Math.max(15, mins - 15))}
                disabled={durationMinutes <= 15}
              >
                <Minus className="size-4" />
              </Button>

              <div className="text-center">
                <span className="text-xl font-bold tabular-nums text-foreground">
                  {formatHours(durationMinutes / 60)}
                </span>
                <span className="text-xs text-muted-foreground ps-1.5">ساعت</span>
              </div>

              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDurationMinutes((mins) => Math.min(720, mins + 15))}
                disabled={durationMinutes >= 720}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {/* 4 Quiet Preset Chips */}
            <div className="flex items-center justify-between gap-1.5 pt-1">
              {[25, 50, 60, 120].map((mins) => {
                const isSelected = durationMinutes === mins;
                const label =
                  mins === 25 ? "۲۵ دقیقه" : mins === 50 ? "۵۰ دقیقه" : mins === 60 ? "۱ ساعت" : "۲ ساعت";
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationMinutes(mins)}
                    className={`flex-1 py-1 text-xs tabular-nums transition-colors rounded-none ${
                      isSelected
                        ? "border border-foreground bg-secondary text-foreground font-medium"
                        : "border border-border/50 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Note Field */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">یادداشت (اختیاری)</label>
            <Input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="روی چه مبحثی کار کردی؟"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" variant="default" size="sm">
              ثبت ساعت
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
