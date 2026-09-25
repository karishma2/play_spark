import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  requestEmailVerification,
  verifyEmail,
  type AuthSession,
} from "./api";

function VerificationShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <Link className="brand auth-brand" to="/" aria-label="Play Spark home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Play Spark</strong><small>Mindful Screen-Free Play</small></span>
        </Link>
        {children}
      </section>
      <aside className="auth-reassurance" aria-label="Email verification">
        <span aria-hidden="true">✉</span>
        <h2>One quick check.<br />Then more play.</h2>
        <ul>
          <li>Verification links expire after 24 hours</li>
          <li>Each link can be used only once</li>
          <li>Guest activities remain available</li>
        </ul>
      </aside>
    </main>
  );
}

export function EmailVerificationPendingPage({
  session,
  onSignOut,
  signOutError,
}: {
  session: AuthSession;
  onSignOut: () => void;
  signOutError?: string;
}) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function resend() {
    setSending(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await requestEmailVerification();
      setMessage("A fresh verification link has been sent. Check your inbox.");
    } catch (caught) {
      setError(caught instanceof ApiError
        ? caught.message
        : "We couldn't send the verification email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <VerificationShell>
      <p className="eyebrow">Verify your email</p>
      <h1>Check your inbox</h1>
      <p>We sent a verification link to <strong>{session.user.email}</strong>. Open it within 24 hours to continue to child-profile setup.</p>
      {message && <div className="auth-success" role="status">{message}</div>}
      {error && <div className="auth-error" role="alert">{error}</div>}
      {signOutError && <div className="auth-error" role="alert">{signOutError}</div>}
      <div className="verification-actions">
        <button className="button button-primary" onClick={resend} disabled={sending}>
          {sending ? "Sending…" : "Resend verification email"}
        </button>
        <Link className="button button-secondary" to="/guest-preview">Browse sample activities</Link>
      </div>
      <button className="text-button auth-back" onClick={onSignOut}>Sign out</button>
    </VerificationShell>
  );
}

export function VerifyEmailPage({
  token,
  signedIn,
  onVerified,
}: {
  token: string;
  signedIn: boolean;
  onVerified: () => Promise<void>;
}) {
  const started = useRef(false);
  const [status, setStatus] = useState<"verifying" | "verified" | "failed">(token ? "verifying" : "failed");
  const [message, setMessage] = useState(token ? "Verifying your email…" : "This verification link is incomplete.");

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(async () => {
        await onVerified();
        setStatus("verified");
        setMessage("Your email is verified. Your parent account is ready.");
      })
      .catch((error) => {
        setStatus("failed");
        setMessage(error instanceof ApiError
          ? error.message
          : "Email verification is temporarily unavailable. Please try again.");
      });
  }, [onVerified, token]);

  return (
    <VerificationShell>
      <p className="eyebrow">Parent account</p>
      <h1>{status === "verified" ? "Email verified" : status === "failed" ? "Link unavailable" : "Just a moment"}</h1>
      <div className={status === "failed" ? "auth-error" : "auth-success"} role={status === "failed" ? "alert" : "status"}>
        {message}
      </div>
      {status === "verified" ? (
        <Link className="button button-primary verification-primary" to={signedIn ? "/onboarding" : "/sign-in"}>
          {signedIn ? "Continue" : "Sign in"}
        </Link>
      ) : status === "failed" ? (
        <p className="auth-switch"><Link to="/sign-in">Sign in to request a fresh link</Link></p>
      ) : null}
    </VerificationShell>
  );
}
