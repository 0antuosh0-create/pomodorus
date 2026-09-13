import type { SDStatus } from "@/lib/mtracker";

export function SDBadge({ status }: { status: SDStatus }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 bg-foreground/[0.07] px-2.5 py-0.5 text-[10px] font-medium text-foreground/85 whitespace-nowrap">
        <span className="size-1 rounded-full bg-foreground/70" />
        پایدار
      </span>
    );
  }

  if (status === "volatile") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-secondary/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">
        <span className="size-1 rounded-full bg-muted-foreground/60" />
        نوسانی
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-secondary/30 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 whitespace-nowrap">
      <span className="size-1 rounded-full bg-muted-foreground/30" />
      بدون داده
    </span>
  );
}
