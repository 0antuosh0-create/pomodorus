import { useState, useMemo } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { faDigits } from "@/lib/format";
import {
  useMTracker,
  getIsoDate,
  parseIsoDate,
  getJalaliDate,
  addDays,
  formatHours,
  formatHoursWithUnit,
  calculateSDStats,
  type Task,
} from "@/lib/mtracker";
import { Button } from "@/components/ui/button";
import { SDBadge } from "@/components/mtracker/sd-badge";
import { TaskFormModal } from "@/components/mtracker/task-form-modal";
import { ManualEntryModal } from "@/components/mtracker/manual-entry-modal";

const JALALI_MONTH_NAMES = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
];

function TaskSparkline({
  days,
  maxVal,
}: {
  days: { date: string; hours: number }[];
  maxVal: number;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const activeText = useMemo(() => {
    if (!hoveredDate) return "روند فعالیت در دو هفته اخیر:";
    const item = days.find((d) => d.date === hoveredDate);
    if (!item) return "";
    const j = getJalaliDate(parseIsoDate(item.date));
    return `${faDigits(j.jd)} ${JALALI_MONTH_NAMES[j.jm - 1]}: ${item.hours > 0 ? formatHoursWithUnit(item.hours) : "بدون ثبت"}`;
  }, [hoveredDate, days]);

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-normal">{activeText}</span>
        <span className="text-[11px] text-muted-foreground/80 tabular-nums">۱۴ روز گذشته</span>
      </div>

      <div className="h-16 w-full flex items-end justify-between gap-1.5 p-2.5 bg-white/[0.04] rounded-none">
        {days.map((d, i) => {
          const heightPct = d.hours > 0 ? Math.min(100, Math.max(8, (d.hours / maxVal) * 100)) : 0;
          const isHovered = d.date === hoveredDate;
          const isToday = i === days.length - 1;

          return (
            <div
              key={d.date}
              onMouseEnter={() => setHoveredDate(d.date)}
              onMouseLeave={() => setHoveredDate(null)}
              className="flex-1 h-full flex flex-col justify-end items-center cursor-pointer group"
            >
              {/* Track channel: quiet full-height rail; today carries a faint ring */}
              <div
                className={`w-full max-w-[16px] h-full bg-white/[0.06] rounded-none flex items-end overflow-hidden ${
                  isToday ? "ring-1 ring-foreground/25" : ""
                }`}
              >
                <div
                  className={`w-full transition-all duration-150 ${
                    isHovered
                      ? "bg-foreground"
                      : d.hours > 0
                      ? "bg-white/55 group-hover:bg-white/75"
                      : "bg-muted-foreground/25"
                  }`}
                  style={{ height: d.hours > 0 ? `${heightPct}%` : "3px" }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MTrackerTasksRoute() {
  const { tasks, entries, addTask, updateTask, deleteTask, addEntry } = useMTracker();

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [activeTaskForEntry, setActiveTaskForEntry] = useState<string | undefined>();

  const todayIso = useMemo(() => getIsoDate(), []);

  const totalAllHours = useMemo(() => {
    return entries.reduce((s, e) => s + e.hours, 0);
  }, [entries]);

  const last14Days = useMemo(() => {
    const list: { date: string }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      list.push({ date: getIsoDate(addDays(today, -i)) });
    }
    return list;
  }, []);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const handleOpenEntry = (taskId: string) => {
    setActiveTaskForEntry(taskId);
    setEntryModalOpen(true);
  };

  return (
    <main className="flex flex-1 flex-col gap-7 p-4 sm:p-6 w-full max-w-xl mx-auto">
      {/* Top Header */}
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">
            تسک‌ها و حوزه‌های کاری
          </h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {faDigits(tasks.length)} حوزه فعال • {formatHours(totalAllHours)} ساعت کل کارکرد ثبت‌شده
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleCreate}
        >
          <Plus />
          تسک جدید
        </Button>
      </section>

      {/* Task Cards List */}
      {tasks.length === 0 ? (
        <div className="text-center py-16 rounded-none border border-border bg-card p-8 text-muted-foreground text-xs space-y-3">
          <p>هنوز تسکی تعریف نشده است.</p>
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={handleCreate}
          >
            <Plus />
            ساخت اولین تسک
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const taskEntries = entries.filter((e) => e.taskId === task.id);
            const stats = calculateSDStats({
              entries: taskEntries,
              days: last14Days,
              targetDailyHours: task.targetDailyHours,
              daysPerWeek: task.daysPerWeek,
            });

            let todayHours = 0;
            for (const e of taskEntries) {
              if (e.date === todayIso) todayHours += e.hours;
            }

            const maxVal = Math.max(...stats.days.map((d) => d.hours), 4);

            return (
              <div
                key={task.id}
                className="rounded-none border border-border bg-card p-6 sm:p-8 space-y-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h3 className="text-base font-medium text-foreground">{task.name}</h3>
                    <span className="text-xs text-muted-foreground block">
                      {task.daysPerWeek === 7
                        ? "هر روز (۷ روز در هفته)"
                        : task.daysPerWeek === 0
                        ? "صرفاً ثبت رکورد"
                        : `${faDigits(task.daysPerWeek)} روز در هفته`}
                    </span>
                  </div>
                  <SDBadge status={stats.status} />
                </div>

                <div className="text-xs text-muted-foreground tabular-nums">
                  هدف روزانه: <strong className="text-foreground">{faDigits(task.targetDailyHours)} ساعت</strong>
                </div>

                {/* 3 Metric Columns in subtle inset container */}
                <div className="grid grid-cols-3 gap-3 text-center py-4 bg-white/[0.04] rounded-none">
                  <div>
                    <div className="text-[11px] text-muted-foreground">ثبت امروز</div>
                    <div className="text-sm tabular-nums font-bold text-foreground mt-0.5">
                      {todayHours > 0 ? formatHours(todayHours) : "۰:۰۰"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">۱۴ روز اخیر</div>
                    <div className="text-sm tabular-nums font-bold text-foreground mt-0.5">
                      {formatHours(stats.total)}س
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted-foreground">زنجیره پیوستگی</div>
                    <div className="text-sm tabular-nums font-bold text-foreground mt-0.5">
                      {faDigits(stats.streak)} روز
                    </div>
                  </div>
                </div>

                {/* Enhanced 14-day Sparkline with hover inspection */}
                <TaskSparkline days={stats.days} maxVal={maxVal} />

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEntry(task.id)}
                    className="flex-1"
                  >
                    <Plus />
                    ثبت ساعت
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(task)}
                    title="ویرایش"
                  >
                    <Edit2 />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`آیا از حذف تسک «${task.name}» مطمئنید؟`)) {
                        deleteTask(task.id);
                      }
                    }}
                    title="حذف"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Form Modal */}
      <TaskFormModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        task={editingTask}
        onSave={(data) => {
          if (editingTask) {
            updateTask(editingTask.id, data);
          } else {
            addTask(data);
          }
        }}
      />

      {/* Manual Entry Modal */}
      <ManualEntryModal
        isOpen={entryModalOpen}
        onClose={() => setEntryModalOpen(false)}
        tasks={tasks}
        initialTaskId={activeTaskForEntry}
        onSave={(data) => {
          addEntry(data);
        }}
      />
    </main>
  );
}
