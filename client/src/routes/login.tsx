import { useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Failure } from "@/components/failure";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messageFor, post, type ServerTimed } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { copy } from "@/lib/copy";
import { enDigits } from "@/lib/format";

/**
 * One flow, two steps: type an address, read the code, you are in.
 *
 * There is no sign-in/sign-up choice to make, because there is nothing to
 * choose between — an unknown address creates the account and a known one
 * signs in, and the screen never learns which happened. It also never learns
 * whether the address was known, because the server's answer is identical
 * either way.
 *
 * v1's login was a username and a password and has no reference screenshot;
 * this is built from the design tokens and v1's own furniture — the field
 * hint, the spinner-and-waiting-label submit, and the link back to the
 * landing.
 */
export function LoginRoute() {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-xs space-y-8">
          {/* Set like the hero's title — same treatment, its own size. */}
          <h1 className="text-center text-2xl font-light tracking-widest uppercase text-yellow-600">
            {copy.app.name}
          </h1>

          {/* The step and the way out are one group, so the gap between the
              submit and the link below it is the form's own rhythm rather than
              the wider gap that separates the wordmark from everything. */}
          <div className="space-y-4">
            {sentTo === null ? (
              <EmailStep email={email} onEmail={setEmail} onSent={setSentTo} />
            ) : (
              <CodeStep email={sentTo} />
            )}

            {/* One button, two jobs, because at each step there is exactly one
                place worth going back to. On the address step that is the
                landing, which a signed-out visitor otherwise reaches only by
                the browser's own back. On the code step it is the address
                itself — the toast naming it has gone by then, and this is the
                only way to fix a typo without reloading.

                Same size and width as the submit above it either way: they are
                a pair, and a smaller one reads as a footnote. */}
            {sentTo === null ? (
              <Button asChild variant="ghost" className="w-full">
                <Link to="/">
                  <ArrowRight className="size-4" />
                  {copy.login.backHome}
                </Link>
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="w-full"
                // Unmounting CodeStep is what clears the half-typed code: it
                // belongs to a code that is about to be superseded anyway.
                onClick={() => setSentTo(null)}
              >
                <ArrowRight className="size-4" />
                {copy.login.backToEmail}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function EmailStep({
  email,
  onEmail,
  onSent,
}: {
  email: string;
  onEmail: (email: string) => void;
  onSent: (email: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await post<ServerTimed & { sent: boolean }>("/api/auth/request-code", {
        email,
      });
      announceSent(email);
      onSent(email);
    } catch (failure) {
      setError(messageFor(failure));
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{copy.login.email}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(event) => onEmail(event.target.value)}
          autoFocus
          required
          autoComplete="email"
          dir="ltr"
          // What is typed here is Latin all the way through, digits included.
          className="font-latin"
        />
        <p className="text-xs text-muted-foreground">{copy.login.emailHint}</p>
      </div>

      <Failure message={error} />

      <SubmitButton
        pending={pending}
        label={copy.login.sendCode}
        pendingLabel={copy.login.sending}
      />
    </form>
  );
}

/**
 * «کد رفت …» as a toast, with the address set apart from the sentence.
 *
 * It cannot go through `t`, which returns a string: the address is Latin and
 * needs its own font and direction, and the UI font would otherwise draw the
 * digits in it as Persian numerals — `yazdan2000@…` reading `yazdan۲۰۰۰@…`.
 * Sonner takes a node here, so the span survives.
 */
function announceSent(email: string) {
  const [before = "", after = ""] = copy.login.sentBody.split("{email}");
  toast(copy.login.sentTitle, {
    // Longer than Sonner's four seconds, because this is the only place the
    // address appears — there is no banner behind it and no way back to the
    // address field. Six is a read, not a record: long enough to catch a
    // mistyped address, short enough not to sit over the form.
    duration: 6_000,
    description: (
      <>
        {before}
        <span dir="ltr" className="font-latin">
          {email}
        </span>
        {after}
      </>
    ),
  });
}

function CodeStep({ email }: { email: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await post<ServerTimed & { handle: string | null }>("/api/auth/verify", {
        email,
        code,
      });
      // The server is the authority on who you are now, so ask it rather than
      // believing the response — the next screen depends on the handle.
      await auth.refresh();
      void navigate("/app", { replace: true });
    } catch (failure) {
      setError(messageFor(failure));
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="code">{copy.login.code}</Label>
          {/* The wrapper carries dir, not the field. A code is read off a
              screen left to right and typed the same way, so box one has to be
              the leftmost — and `dir` passed to InputOTP lands on its hidden
              input, never on the row of boxes, which then inherits the page's
              rtl and fills backwards: type 123456, read 654321.

              enDigits on the way in because a code stays in ASCII digits,
              unlike every other number in the app — a phone with a Persian
              keypad would otherwise send «۱۲۳۴۵۶», which is not the code the
              server hashed. */}
          <div dir="ltr">
            <InputOTP
              id="code"
              name="code"
              maxLength={6}
              autoComplete="one-time-code"
              value={code}
              onChange={(next) => setCode(enDigits(next))}
              autoFocus
              containerClassName="w-full"
            >
              {/* The row fills the column and the boxes divide it, rather than
                  six fixed squares floating in the middle of it: at this width
                  a centred `w-10` cluster reads as unfinished. */}
              <InputOTPGroup className="w-full">
                {[0, 1, 2, 3, 4, 5].map((slot) => (
                  // font-mono, which design-tokens.md allows here and nowhere
                  // else: Peyda is a FaNum face and draws ASCII digits as
                  // Persian numerals, so the mail would say 123456 and these
                  // boxes would answer ۱۲۳۴۵۶. The code is retyped, not read,
                  // and it has to look like the thing being retyped.
                  <InputOTPSlot
                    key={slot}
                    index={slot}
                    className="h-12 w-auto flex-1 font-mono text-lg"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <p className="text-xs text-muted-foreground">{copy.login.codeHint}</p>
        </div>

        <Failure message={error} />

        <SubmitButton
          pending={pending}
          label={copy.login.go}
          pendingLabel={copy.login.signingIn}
        />
      </form>
    </div>
  );
}
