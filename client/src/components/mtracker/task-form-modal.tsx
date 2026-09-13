import { useState, useEffect } from "react";
import { X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task } from "@/lib/mtracker";

const MONOCHROME_PRESETS = [
  "#ffffff", // pure white
  "#e7e5e4", // stone-200
  "#a8a29e", // stone-400
  "#78716c", // stone-500
  "#57534e", // stone-600
  "#292524", // stone-800
];

export function TaskFormModal({
  isOpen,
  onClose,
  task,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  onSave: (data: {
    name: string;
    targetDailyHours: number;
    color: string;
    daysPerWeek: number;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [targetDailyHours, setTargetDailyHours] = useState(2);
  const [daysPerWeek, setDaysPerWeek] = useState(7);
  const [color, setColor] = useState(MONOCHROME_PRESETS[0]);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setTargetDailyHours(task.targetDailyHours);
      setDaysPerWeek(task.daysPerWeek);
      setColor(task.color || MONOCHROME_PRESETS[0]);
    } else {
      setName("");
      setTargetDailyHours(2);
      setDaysPerWeek(7);
      setColor(MONOCHROME_PRESETS[0]);
    }
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      targetDailyHours,
      color,
      daysPerWeek,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-popover shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h3 className="text-sm font-medium text-foreground tracking-wide">
            {task ? "ویرایش تسک" : "ساخت تسک جدید"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-6">
          {/* Task Name */}
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground block">نام تسک</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: برنامه‌نویسی، زبان، طراحی..."
              required
              autoFocus
            />
          </div>

          {/* Target & Schedule in a 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">هدف روزانه (ساعت)</label>
              <Input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                value={targetDailyHours}
                onChange={(e) => setTargetDailyHours(Number(e.target.value))}
                required
              />
              <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                حداقل ساعت پیشنهادی برای پایداری
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground block">برنامه هفتگی</label>
              <div className="relative">
                <select
                  value={daysPerWeek}
                  onChange={(e) => setDaysPerWeek(Number(e.target.value))}
                  className="w-full h-10 ps-9 pe-3 appearance-none rounded-none border border-border bg-background text-sm text-foreground focus:border-foreground/40 outline-none transition-colors"
                >
                  <option value={7}>هر روز (۷ روز)</option>
                  <option value={6}>۶ روز در هفته</option>
                  <option value={5}>۵ روز (روزهای کاری)</option>
                  <option value={4}>۴ روز در هفته</option>
                  <option value={3}>۳ روز در هفته</option>
                  <option value={0}>بدون برنامه پایداری</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3 size-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2.5">
            <label className="text-xs text-muted-foreground block">نشانگر طیف</label>
            <div className="flex items-center gap-3">
              {MONOCHROME_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`size-6 border border-white/10 transition-all ${
                    color === c
                      ? "ring-1 ring-foreground ring-offset-2 ring-offset-background scale-110"
                      : "opacity-50 hover:opacity-90"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/60">
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              انصراف
            </Button>
            <Button type="submit" size="sm" variant="default">
              {task ? "ذخیره تغییرات" : "ایجاد تسک"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
