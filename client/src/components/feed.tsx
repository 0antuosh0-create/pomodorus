import { Link } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy";
import { isLive, useFeed, type FeedEntry } from "@/lib/feed";
import { enDigits, faClock } from "@/lib/format";
import { useTick } from "@/lib/server-clock";

/**
 * Who is working right now — the thing that makes the landing page feel
 * inhabited rather than like a product page.
 *
 * The box never vanishes. An empty feed holds a row's height and says so,
 * because a section that disappears is a page that reflows under whoever is
 * reading it the moment somebody, anywhere, starts a pomodoro.
 */
export function Feed() {
  const { entries } = useFeed();
  // Rows leave at their own bell, and the bell is derived rather than pushed —
  // so this ticks, and the list is filtered on every tick.
  const now = useTick();

  const live = Array.isArray(entries)
    ? entries.filter((entry) => isLive(entry, now))
    : undefined;

  return (
    <section className="w-full rounded-none border border-border bg-card">
      <ul className="divide-y divide-border">
        {live === undefined ? (
          // Still being asked for. A blank row of the right height removed the
          // layout shift but not the confusion — an empty bordered box reads
          // as an answer, so somebody appearing a moment later reads as the
          // page changing its mind. A skeleton says the answer is not in yet,
          // in the same space the answer will occupy.
          <SkeletonRow />
        ) : live.length === 0 ? (
          // Only a server-confirmed empty feed says nobody is here.
          <li className="flex items-center justify-center px-4 py-3 text-sm text-muted-foreground">
            <RowHeight />
            {copy.feed.empty}
          </li>
        ) : (
          live.map((entry) => (
            <Row key={entry.handle} entry={entry} now={now} />
          ))
        )}
      </ul>
    </section>
  );
}

/**
 * Two zero-width spaces, one per face, on a single line.
 *
 * A row's height is not the line-height it is set in. A real row puts the Latin
 * handle and the Persian task on one line, and a line box grows to fit the
 * ascent and descent of *every* font in it — two faces here, so 23.3px where
 * one face gives 21.3. A row with no handle in it is therefore two pixels
 * shorter than a row with one, and the feed resizes the moment somebody starts
 * working.
 *
 * Both spaces have to share one line box, which is why this is a single inline
 * element and not two flex items: a flex item gets a line box of its own, and
 * two of them side by side are each the height of their own font rather than
 * the height of both together.
 */
function RowHeight() {
  return (
    <span aria-hidden>
      <span className="[font-family:ui-sans-serif,system-ui,sans-serif]">
        {"\u200b"}
      </span>
      {"\u200b"}
    </span>
  );
}

/**
 * One row's worth of nothing-yet, laid out exactly as a row is: a name and a
 * task on one side, a countdown on the other. Same padding and same text size,
 * so the box is the height it will be and nothing moves when the answer lands.
 */
function SkeletonRow() {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 items-center">
        <RowHeight />
        <Skeleton className="h-5 w-40 max-w-[60%]" />
      </div>
      <Skeleton className="h-5 w-10 shrink-0" />
    </li>
  );
}

function Row({ entry, now }: { entry: FeedEntry; now: number }) {
  const resting = entry.kind !== "work";

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      {/* dir is stated rather than inherited, and both halves are isolated.
          The row is one line of three parts — a Latin handle, an em dash, and
          a task name in whichever language its owner typed it — and without
          isolation the bidi algorithm resolves that line differently depending
          on the *task*. A Persian task leaves the neutral dash to the
          paragraph direction and the handle lands on the right; an English one
          makes N1 fold the dash into a single left-to-right run and the whole
          group flips to the left. Same markup, same handle, and the name moves
          across the row because somebody named a task "Deep Work".

          <bdi> is exactly the fix: each half is laid out internally by its own
          direction and presents to the line as one neutral unit, so the three
          parts are always ordered by the RTL base — handle first, then the
          dash, then the task. No styling attaches to it, so the design is
          untouched. */}
      <p dir="rtl" className="min-w-0 truncate">
        {/* A handle is Latin by construction, so it is set out of the Persian
            face and pushed through enDigits — a Persian digit reaching one
            would read as a different name, and link to a different profile. */}
        <bdi>
          <Link
            to={`/u/${entry.handle}`}
            className="truncate font-medium hover:underline [font-family:ui-sans-serif,system-ui,sans-serif]"
          >
            {enDigits(entry.handle)}
          </Link>
        </bdi>
        <span className="text-muted-foreground">{" — "}</span>
        <bdi className="text-muted-foreground">{label(entry)}</bdi>
      </p>

      {/* A break shows no countdown: how long somebody's rest has left is not
          what this list is for, and it would read as work. */}
      {resting ? null : (
        <span dir="ltr" className="shrink-0 tabular-nums text-muted-foreground">
          {faClock(entry.endsAt - now)}
        </span>
      )}
    </li>
  );
}

/** What this row says somebody is doing. */
function label(entry: FeedEntry): string {
  if (entry.kind !== "work") return copy.feed.onBreak;
  // A private task's name never left the server, so there is nothing to mask
  // here — the generic label is simply what this client has.
  return entry.task ?? copy.feed.privateTask;
}
