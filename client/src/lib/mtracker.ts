/**
 * Core habit tracking, statistical rhythm metrics, and Jalali calendar engine.
 * Synthesized from mTracker (https://github.com/moein8668-git/mTracker) by Moein (@moein8668-git).
 */
import { useEffect, useState, useCallback } from "react";
import { faDigits } from "@/lib/format";

export type Task = {
  id: string;
  name: string;
  targetDailyHours: number;
  color: string;
  daysPerWeek: number; // 7 = every day, 5 = 5 days/week, 0 = no schedule
  createdAt: string;
  archivedAt: string | null;
};

export type Entry = {
  id: string;
  taskId: string;
  date: string; // YYYY-MM-DD
  hours: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type MTrackerDB = {
  schemaVersion: number;
  tasks: Task[];
  entries: Entry[];
};

export type SDStatus = "ok" | "volatile" | "nodata";

export type SDStats = {
  status: SDStatus;
  days: { date: string; hours: number }[];
  n: number;
  total: number;
  mean: number;
  sd: number;
  cv: number;
  sdLimit: number;
  activeDays: number;
  targetPct: number | null;
  streak: number;
  peakDay: { jd: number; hours: number } | null;
};

// --- Persian / Jalali Calendar Helpers ---

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const JALALI_WEEKDAY_NAMES = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

export const JALALI_WEEKDAY_SHORT = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

const persianDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

export function getJalaliDate(date: Date | string = new Date()): { jy: number; jm: number; jd: number } {
  const d = typeof date === "string" ? parseIsoDate(date) : date;
  const parts = persianDateFormatter.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    jy: Number(map.year),
    jm: Number(map.month),
    jd: Number(map.day),
  };
}

export function formatJalaliDate(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? parseIsoDate(date) : date;
  const { jy, jm, jd } = getJalaliDate(d);
  const weekday = JALALI_WEEKDAY_NAMES[d.getDay()];
  return `${faDigits(jy)} ${JALALI_MONTH_NAMES[jm - 1]} ${faDigits(jd)}، ${weekday}`;
}

export function formatJalaliMonthName(jy: number, jm: number): string {
  return `${JALALI_MONTH_NAMES[jm - 1]} ${faDigits(jy)}`;
}

export function getIsoDate(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // "YYYY-MM-DD"
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  // Construct noon in UTC to stay unambiguously on the right day in Tehran (+3:30)
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function addDays(date: Date, n: number): Date {
  const res = new Date(date.getTime());
  res.setDate(res.getDate() + n);
  return res;
}

export function getJalaliDaysInMonth(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Leap year check for Persian calendar (approximate 33-year cycle)
  const isLeap = (((((jy - 474) % 2820) + 474) + 38) * 682) % 2816 < 682;
  return isLeap ? 30 : 29;
}

/**
 * Returns all dates for a given Jalali month (or current month)
 */
export function getJalaliMonthRange(refDate: Date = new Date()): {
  jy: number;
  jm: number;
  monthName: string;
  days: { date: string; jd: number; weekdayIndex: number }[];
  startWeekdayOffset: number; // 0 for Saturday ('ش')
} {
  const { jy, jm, jd } = getJalaliDate(refDate);
  const daysInMonth = getJalaliDaysInMonth(jy, jm);

  // Find the first day of this Jalali month
  const firstDay = addDays(refDate, -(jd - 1));
  const days: { date: string; jd: number; weekdayIndex: number }[] = [];

  for (let i = 0; i < daysInMonth; i++) {
    const current = addDays(firstDay, i);
    // Saturday is index 0 in Persian week (Sunday is 0 in JS Date)
    const weekdayIndex = (current.getDay() - 6 + 7) % 7;
    days.push({
      date: getIsoDate(current),
      jd: i + 1,
      weekdayIndex,
    });
  }

  const startWeekdayOffset = days[0]?.weekdayIndex || 0;

  return {
    jy,
    jm,
    monthName: formatJalaliMonthName(jy, jm),
    days,
    startWeekdayOffset,
  };
}

// --- SD Method Core Calculations ---

export function calculateSDStats({
  entries,
  days,
  targetDailyHours = 0,
  daysPerWeek = 7,
}: {
  entries: Entry[];
  days: { date: string }[];
  targetDailyHours?: number;
  daysPerWeek?: number;
}): SDStats {
  const dayMap = new Map<string, number>();
  for (const d of days) dayMap.set(d.date, 0);

  for (const entry of entries) {
    if (dayMap.has(entry.date)) {
      dayMap.set(entry.date, (dayMap.get(entry.date) || 0) + entry.hours);
    }
  }

  const dayList = days.map((d) => ({
    date: d.date,
    hours: dayMap.get(d.date) || 0,
  }));

  const n = dayList.length;
  if (!n) {
    return {
      status: "nodata",
      days: [],
      n: 0,
      total: 0,
      mean: 0,
      sd: 0,
      cv: 0,
      sdLimit: 0,
      activeDays: 0,
      targetPct: null,
      streak: 0,
      peakDay: null,
    };
  }

  const total = dayList.reduce((sum, d) => sum + d.hours, 0);
  const activeDays = dayList.filter((d) => d.hours > 0.001).length;

  let values: number[] = [];
  const scheduleDays = daysPerWeek === 0 ? 7 : daysPerWeek;

  if (scheduleDays === 7 || scheduleDays === 0 || n <= 7) {
    values = dayList.map((d) => d.hours);
  } else {
    // Group into weeks and pick the top N days per week
    for (let i = 0; i < dayList.length; i += 7) {
      const week = dayList.slice(i, i + 7);
      const sorted = week.map((d) => d.hours).sort((a, b) => b - a);
      values.push(...sorted.slice(0, Math.min(week.length, scheduleDays)));
    }
  }

  const count = values.length || 1;
  const mean = values.reduce((s, v) => s + v, 0) / count;
  const variance = values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / count;
  const sd = Math.sqrt(variance);

  let status: SDStatus = "nodata";
  if (total > 0.001) {
    status = sd < mean / 2 ? "ok" : "volatile";
  }

  // Calculate Streak
  let streak = 0;
  const todayIso = getIsoDate();
  const sortedDesc = [...dayList].reverse();
  for (const d of sortedDesc) {
    if (d.date > todayIso) continue;
    if (d.hours > 0.001) {
      streak++;
    } else if (d.date < todayIso) {
      break;
    }
  }

  // Find Peak Day
  let peakDay: { jd: number; hours: number } | null = null;
  let maxH = 0;
  for (const d of dayList) {
    if (d.hours > maxH) {
      maxH = d.hours;
      const j = getJalaliDate(parseIsoDate(d.date));
      peakDay = { jd: j.jd, hours: d.hours };
    }
  }

  return {
    status,
    days: dayList,
    n,
    total,
    mean,
    sd,
    cv: mean > 0 ? sd / mean : 0,
    sdLimit: mean / 2,
    activeDays,
    targetPct: targetDailyHours > 0 ? (mean / targetDailyHours) * 100 : null,
    streak,
    peakDay,
  };
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${faDigits(h)}:${faDigits(String(m).padStart(2, "0"))}`;
}

export function formatHoursWithUnit(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${faDigits(m)} دقیقه`;
  if (m === 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(h)}:${faDigits(String(m).padStart(2, "0"))} ساعت`;
}

// --- Sample Initial Dataset ---

export function generateSampleMTrackerDB(): MTrackerDB {
  const taskEnglish: Task = {
    id: "task-eng",
    name: "زبان انگلیسی",
    targetDailyHours: 2,
    color: "#ffffff",
    daysPerWeek: 7,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    archivedAt: null,
  };

  const taskCoding: Task = {
    id: "task-code",
    name: "برنامه‌نویسی",
    targetDailyHours: 3,
    color: "#a8a29e",
    daysPerWeek: 5,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    archivedAt: null,
  };

  const taskExercise: Task = {
    id: "task-fit",
    name: "ورزش",
    targetDailyHours: 1,
    color: "#57534e",
    daysPerWeek: 7,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
    archivedAt: null,
  };

  const tasks = [taskEnglish, taskCoding, taskExercise];
  const entries: Entry[] = [];

  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const d = addDays(now, -i);
    const dateStr = getIsoDate(d);

    // English: almost every day 1.8 - 2.4h
    if (Math.random() > 0.1) {
      entries.push({
        id: `entry-eng-${i}`,
        taskId: taskEnglish.id,
        date: dateStr,
        hours: +(1.8 + Math.random() * 0.6).toFixed(2),
        note: "تمرین واژگان و اسپیکینگ",
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      });
    }

    // Coding: 5 days a week 2.5 - 4.5h
    if (d.getDay() !== 4 && d.getDay() !== 5) {
      entries.push({
        id: `entry-code-${i}`,
        taskId: taskCoding.id,
        date: dateStr,
        hours: +(2.5 + Math.random() * 2.0).toFixed(2),
        note: "توسعه کامپوننت‌ها و تسک‌های پروژه",
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      });
    }

    // Exercise: 0.8 - 1.2h
    if (i % 2 === 0) {
      entries.push({
        id: `entry-fit-${i}`,
        taskId: taskExercise.id,
        date: dateStr,
        hours: +(0.8 + Math.random() * 0.4).toFixed(2),
        note: "تمرین هوازی و بدنسازی",
        createdAt: d.toISOString(),
        updatedAt: d.toISOString(),
      });
    }
  }

  return {
    schemaVersion: 3,
    tasks,
    entries,
  };
}

/** Task colors may only come from the monochrome ramp. Anything else — older
    seeded data, hand-edited JSON — falls back to white rather than letting a
    stray hue onto the dots. */
const MONOCHROME_TASK_COLORS: Record<string, true> = {
  "#ffffff": true,
  "#e7e5e4": true,
  "#a8a29e": true,
  "#78716c": true,
  "#57534e": true,
  "#292524": true,
};

export function safeTaskColor(color: string | null | undefined): string {
  const c = color?.toLowerCase();
  return c && MONOCHROME_TASK_COLORS[c] ? c : "#ffffff";
}
// --- Storage Key ---
const STORAGE_KEY = "mtracker.db.v1";
const SYNC_HANDLE_KEY = "mtracker.sync_handle";

export function getAutoSyncHandle(): string {
  if (typeof window === "undefined") return "anoush";
  return localStorage.getItem(SYNC_HANDLE_KEY) || "anoush";
}

export function setAutoSyncHandle(handle: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SYNC_HANDLE_KEY, handle.trim().toLowerCase());
  window.dispatchEvent(new Event("mtracker-sync-handle-change"));
}

export function loadMTrackerDB(): MTrackerDB {
  if (typeof window === "undefined") return generateSampleMTrackerDB();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.tasks && parsed.entries) return parsed;
    }
  } catch (err) {
    console.error("Failed to load mTracker DB:", err);
  }
  const initial = generateSampleMTrackerDB();
  saveMTrackerDB(initial);
  return initial;
}

export function saveMTrackerDB(db: MTrackerDB) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    window.dispatchEvent(new Event("mtracker-db-change"));
  } catch (err) {
    console.error("Failed to save mTracker DB:", err);
  }
}

// --- React Hook ---

export function useMTracker() {
  const [db, setDb] = useState<MTrackerDB>(loadMTrackerDB);

  useEffect(() => {
    const handler = () => {
      setDb(loadMTrackerDB());
    };
    window.addEventListener("mtracker-db-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("mtracker-db-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addTask = useCallback((task: Omit<Task, "id" | "createdAt" | "archivedAt">) => {
    setDb((prev) => {
      const newTask: Task = {
        ...task,
        id: "task-" + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        archivedAt: null,
      };
      const next = { ...prev, tasks: [...prev.tasks, newTask] };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setDb((prev) => {
      const next = {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setDb((prev) => {
      const next = {
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== id),
        entries: prev.entries.filter((e) => e.taskId !== id),
      };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const addEntry = useCallback((entry: Omit<Entry, "id" | "createdAt" | "updatedAt">) => {
    setDb((prev) => {
      const newEntry: Entry = {
        ...entry,
        id: "entry-" + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const next = { ...prev, entries: [...prev.entries, newEntry] };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<Entry>) => {
    setDb((prev) => {
      const next = {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
        ),
      };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setDb((prev) => {
      const next = {
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  /**
   * Automatically synced whenever a Pomodorus timer finishes!
   */
  const syncFromPomodorus = useCallback((categoryName: string, durationMs: number) => {
    setDb((prev) => {
      const hours = +(durationMs / (60 * 60 * 1000)).toFixed(2);
      if (hours <= 0) return prev;

      const dateStr = getIsoDate();
      let targetTask = prev.tasks.find(
        (t) => t.name.trim().toLowerCase() === categoryName.trim().toLowerCase()
      );

      let tasks = prev.tasks;
      if (!targetTask) {
        targetTask = {
          id: "task-" + crypto.randomUUID(),
          name: categoryName,
          targetDailyHours: 2,
          color: "#ffffff",
          daysPerWeek: 7,
          createdAt: new Date().toISOString(),
          archivedAt: null,
        };
        tasks = [...tasks, targetTask];
      }

      const newEntry: Entry = {
        id: "entry-" + crypto.randomUUID(),
        taskId: targetTask.id,
        date: dateStr,
        hours,
        note: "ثبت خودکار از تایمر پومودوروس",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const next = { ...prev, tasks, entries: [...prev.entries, newEntry] };
      saveMTrackerDB(next);
      return next;
    });
  }, []);

  const loadSample = useCallback(() => {
    const sample = generateSampleMTrackerDB();
    saveMTrackerDB(sample);
    setDb(sample);
  }, []);

  const clearAll = useCallback(() => {
    const empty: MTrackerDB = { schemaVersion: 3, tasks: [], entries: [] };
    saveMTrackerDB(empty);
    setDb(empty);
  }, []);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mtracker-backup-${getIsoDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [db]);

  const exportCsv = useCallback(() => {
    let csv = "ID,Task,Date,Hours,Note\n";
    for (const e of db.entries) {
      const task = db.tasks.find((t) => t.id === e.taskId);
      csv += `"${e.id}","${task ? task.name : ""}","${e.date}",${e.hours},"${e.note || ""}"\n`;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mtracker-export-${getIsoDate()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [db]);

  const importData = useCallback((imported: MTrackerDB) => {
    if (Array.isArray(imported.tasks) && Array.isArray(imported.entries)) {
      saveMTrackerDB(imported);
      setDb(imported);
      return true;
    }
    return false;
  }, []);

  // Auto-sync with live server on every startup & periodically
  useEffect(() => {
    let active = true;
    const runSync = async () => {
      const handle = getAutoSyncHandle();
      if (!handle) return;
      try {
        const res = await fetch(`/api/sync/mtracker-remote?handle=${encodeURIComponent(handle)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.success && data.db) {
          importData(data.db);
        }
      } catch {}
    };

    void runSync();

    const interval = setInterval(runSync, 5 * 60 * 1000);
    window.addEventListener("mtracker-sync-handle-change", runSync);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("mtracker-sync-handle-change", runSync);
    };
  }, [importData]);

  return {
    db,
    tasks: db.tasks,
    entries: db.entries,
    addTask,
    updateTask,
    deleteTask,
    addEntry,
    updateEntry,
    deleteEntry,
    syncFromPomodorus,
    loadSample,
    clearAll,
    exportJson,
    exportCsv,
    importData,
  };
}
