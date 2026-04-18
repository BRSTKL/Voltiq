"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { ArrowRight, Mail, ShieldCheck } from "lucide-react";
import { signIn, useSession } from "next-auth/react";

const errorMessages: Record<string, string> = {
  AccessDenied: "This sign-in attempt is not allowed right now.",
  OAuthAccountNotLinked: "This email is already linked to a different sign-in method.",
  Verification: "The magic link is invalid or has expired.",
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();

  const callbackUrl = useMemo(() => {
    return searchParams?.get("callbackUrl") || "/dashboard";
  }, [searchParams]);

  const queryError = searchParams?.get("error");

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  useEffect(() => {
    if (!queryError) {
      return;
    }

    setErrorMessage(
      errorMessages[queryError] ?? "An unexpected sign-in error occurred."
    );
  }, [queryError]);

  const handleGoogleSignIn = () => {
    setErrorMessage(null);
    setFeedback(null);

    startGoogleTransition(async () => {
      await signIn("google", { redirectTo: callbackUrl });
    });
  };

  const handleEmailSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    startEmailTransition(async () => {
      const response = await signIn("resend", {
        email,
        redirect: false,
        redirectTo: callbackUrl,
      });

      if (response?.error) {
        setErrorMessage("Magic link could not be sent. Check your email setup.");
        return;
      }

      setFeedback("Your sign-in link is on the way. Check your inbox.");
      setEmail("");
    });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,158,117,0.18),_transparent_36%),linear-gradient(180deg,_#07110e_0%,_#0d1814_100%)] text-[#E5F4EE]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="flex flex-col justify-center gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-[#9fd9c7]">
              <ShieldCheck className="h-4 w-4" />
              Secure access
            </div>
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.24em] text-[#7fb8a7]">Voltiq</p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                One secure sign-in for every Voltiq energy workflow.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[#A8C4BA] sm:text-lg">
                Manage reports, saved calculations, and team access from one Voltiq account.
              </p>
            </div>
            <div className="grid gap-3 text-sm text-[#B6D1C8] sm:grid-cols-2">
              <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
                Database-backed session management
              </div>
              <div className="rounded-[var(--radius-lg)] border border-white/10 bg-white/5 p-4">
                Fast access with Google or magic link
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#0f1b17]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur sm:p-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">Sign in</h2>
              <p className="text-sm text-[#9BB5AC]">Continue with Google or get a one-time sign-in link by email.</p>
            </div>

            <div className="mt-8 space-y-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGooglePending || isEmailPending}
                className="flex w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-[#12211D] transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
                  <path fill="#EA4335" d="M12 10.2v3.96h5.51c-.24 1.27-.96 2.35-2.04 3.08l3.3 2.56c1.92-1.77 3.03-4.37 3.03-7.44 0-.73-.07-1.43-.19-2.12H12Z" />
                  <path fill="#4285F4" d="M12 21.75c2.73 0 5.02-.9 6.7-2.44l-3.3-2.56c-.91.61-2.08.98-3.4.98-2.61 0-4.82-1.76-5.61-4.13H2.97v2.65A10.12 10.12 0 0 0 12 21.75Z" />
                  <path fill="#FBBC05" d="M6.39 13.6A6.08 6.08 0 0 1 6.07 12c0-.56.1-1.1.32-1.6V7.75H2.97A10.18 10.18 0 0 0 1.88 12c0 1.64.39 3.19 1.09 4.25l3.42-2.65Z" />
                  <path fill="#34A853" d="M12 6.27c1.49 0 2.82.51 3.88 1.5l2.91-2.91C17.02 3.23 14.73 2.25 12 2.25a10.12 10.12 0 0 0-9.03 5.5l3.42 2.65c.79-2.37 3-4.13 5.61-4.13Z" />
                </svg>
                {isGooglePending ? "Redirecting to Google..." : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.24em] text-[#6E867E]">
                <span className="h-px flex-1 bg-white/10" />
                or
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-[#C9DDD7]">Email address</span>
                  <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-white/10 bg-white/5 px-4 py-3">
                    <Mail className="h-4 w-4 text-[#8DB4A6]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@company.com"
                      className="w-full border-none bg-transparent text-sm text-white outline-none placeholder:text-[#709386]"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isEmailPending || isGooglePending}
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--color-brand-dark)] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isEmailPending ? "Preparing link..." : "Send sign-in link"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {errorMessage ? (
                <div className="rounded-[var(--radius-md)] border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {errorMessage}
                </div>
              ) : null}

              {feedback ? (
                <div className="rounded-[var(--radius-md)] border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  {feedback}
                </div>
              ) : null}
            </div>

            <p className="mt-8 text-xs text-[#7C958C]">
              By continuing, you agree to the Voltiq{" "}
              <Link href="/terms" className="text-[#CDEBDD] underline underline-offset-4">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-[#CDEBDD] underline underline-offset-4">
                Privacy
              </Link>{" "}
              policies.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function LoginFallback() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(29,158,117,0.18),_transparent_36%),linear-gradient(180deg,_#07110e_0%,_#0d1814_100%)] text-[#E5F4EE]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="rounded-[28px] border border-white/10 bg-[#0f1b17]/90 px-6 py-5 text-sm text-[#9BB5AC] shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur">
          Loading sign-in...
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
