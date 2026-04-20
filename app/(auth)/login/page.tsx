"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { signIn, useSession } from "next-auth/react";

import AppNav from "@/components/layout/AppNav";

const errorMessages: Record<string, string> = {
  AccessDenied: "This sign-in attempt is not allowed right now.",
  OAuthAccountNotLinked:
    "This email is already linked to a different sign-in method.",
  Verification: "The magic link is invalid or has expired.",
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12 10.2v3.96h5.51c-.24 1.27-.96 2.35-2.04 3.08l3.3 2.56c1.92-1.77 3.03-4.37 3.03-7.44 0-.73-.07-1.43-.19-2.12H12Z"
      />
      <path
        fill="#4285F4"
        d="M12 21.75c2.73 0 5.02-.9 6.7-2.44l-3.3-2.56c-.91.61-2.08.98-3.4.98-2.61 0-4.82-1.76-5.61-4.13H2.97v2.65A10.12 10.12 0 0 0 12 21.75Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.6A6.08 6.08 0 0 1 6.07 12c0-.56.1-1.1.32-1.6V7.75H2.97A10.18 10.18 0 0 0 1.88 12c0 1.64.39 3.19 1.09 4.25l3.42-2.65Z"
      />
      <path
        fill="#34A853"
        d="M12 6.27c1.49 0 2.82.51 3.88 1.5l2.91-2.91C17.02 3.23 14.73 2.25 12 2.25a10.12 10.12 0 0 0-9.03 5.5l3.42 2.65c.79-2.37 3-4.13 5.61-4.13Z"
      />
    </svg>
  );
}

function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0A0A0F] text-[#F8F8F2]">
      <AppNav />
      <div className="px-4 pb-16 pt-20">{children}</div>
    </main>
  );
}

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
        setErrorMessage(
          "Magic link could not be sent. Check your email setup."
        );
        return;
      }

      setFeedback("Your sign-in link is on the way. Check your inbox.");
      setEmail("");
    });
  };

  return (
    <LoginShell>
      <div className="mx-auto max-w-[400px]">
        <section className="card-surface amber-glow rounded-xl p-10">
          <div className="mb-8 text-center">
            <span
              aria-hidden="true"
              className="mr-2 inline-block h-2 w-2 bg-[#F59E0B]"
            />
            <span className="font-display text-lg font-bold tracking-[-0.03em] text-[#F8F8F2]">
              VOLTIQ
            </span>
          </div>

          <div className="mb-8">
            <h1 className="text-center font-display text-[22px] font-semibold text-[#F8F8F2]">
              {"Voltiq'e giri\u015F yap"}
            </h1>
            <p className="mt-2 text-center text-sm text-[#9CA3AF]">
              {"Enerji piyasas\u0131 analizine devam et"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGooglePending || isEmailPending}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 font-semibold text-gray-900 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <GoogleIcon />
            <span>
              {isGooglePending
                ? "Google'a y\u00F6nlendiriliyor..."
                : "Google ile devam et"}
            </span>
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1E1E2E]" />
            <span className="text-xs text-[#6B7280]">veya</span>
            <div className="h-px flex-1 bg-[#1E1E2E]" />
          </div>

          <form onSubmit={handleEmailSignIn}>
            <label className="section-label mb-1 block">
              {"E-posta adresi"}
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ornek@sirket.com"
              className="w-full rounded-lg border border-[#1E1E2E] bg-[#111118] px-4 py-3 text-[#F8F8F2] placeholder-[#6B7280] focus:border-[#F59E0B] focus:outline-none"
            />

            <button
              type="submit"
              disabled={isEmailPending || isGooglePending}
              className="mt-3 w-full rounded-lg bg-[#F59E0B] py-3 font-semibold text-black transition hover:bg-[#D97706] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isEmailPending
                ? "Ba\u011Flant\u0131 haz\u0131rlan\u0131yor..."
                : "Sihirli ba\u011Flant\u0131 g\u00F6nder"}
            </button>
          </form>

          {errorMessage ? (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          ) : null}

          {feedback ? (
            <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {feedback}
            </div>
          ) : null}

          <p className="mt-6 text-center text-xs text-[#6B7280]">
            {"Devam ederek "}
            <Link href="/terms" className="text-[#F59E0B] hover:underline">
              {"Kullan\u0131m Ko\u015Fullar\u0131"}
            </Link>{" "}
            ve{" "}
            <Link href="/privacy" className="text-[#F59E0B] hover:underline">
              {"Gizlilik Politikas\u0131"}
            </Link>
            {"'n\u0131 kabul etmi\u015F olursunuz."}
          </p>

          <Link
            href="/tools"
            className="mt-4 block text-center text-sm text-[#9CA3AF] transition hover:text-[#F8F8F2]"
          >
            {"Hesap olmadan devam et \u2192"}
          </Link>
        </section>
      </div>
    </LoginShell>
  );
}

function LoginFallback() {
  return (
    <LoginShell>
      <div className="mx-auto max-w-[400px]">
        <div className="card-surface amber-glow rounded-xl px-6 py-5 text-center text-sm text-[#9CA3AF]">
          {"Giri\u015F ekran\u0131 yukleniyor..."}
        </div>
      </div>
    </LoginShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}
