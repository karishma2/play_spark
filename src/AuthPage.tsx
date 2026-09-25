import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, signIn, signUp, type AuthSession } from "./api";

export function AuthPage({
  mode,
  onAuthenticated,
}: {
  mode: "sign-in" | "sign-up";
  onAuthenticated: (session: AuthSession) => void;
}) {
  const creating = mode === "sign-up";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setPassword("");
    setSubmitting(false);
    setMessage(undefined);
    setFieldErrors({});
  }, [mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(undefined);
    setFieldErrors({});
    try {
      const session = await (creating ? signUp(email, password) : signIn(email, password));
      onAuthenticated(session);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setMessage("Account access is temporarily unavailable. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="auth-title">
        <Link className="brand auth-brand" to="/" aria-label="Play Spark home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Play Spark</strong><small>Mindful Screen-Free Play</small></span>
        </Link>
        <p className="eyebrow">Parent account</p>
        <h1 id="auth-title">{creating ? "Create your calm play space" : "Welcome back"}</h1>
        <p>{creating
          ? "Save favourites and prepare for activities matched to your child."
          : "Sign in to continue building screen-free moments together."}</p>

        <form className="auth-form" onSubmit={submit} noValidate>
          {message && <div className="auth-error" role="alert">{message}</div>}
          <label>
            <span>Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? "email-error" : undefined}
            />
            {fieldErrors.email && <small id="email-error">{fieldErrors.email}</small>}
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              autoComplete={creating ? "new-password" : "current-password"}
              minLength={10}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? "password-error" : "password-help"}
            />
            <small id={fieldErrors.password ? "password-error" : "password-help"}>
              {fieldErrors.password ?? (creating ? "Use at least 10 characters." : "Enter your account password.")}
            </small>
          </label>
          {!creating && <Link className="auth-forgot-link" to="/forgot-password">Forgot your password?</Link>}
          <button className="button button-primary" disabled={submitting}>
            {submitting ? "Please wait…" : creating ? "Create parent account" : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {creating ? "Already have an account?" : "New to Play Spark?"}{" "}
          <Link to={creating ? "/sign-in" : "/sign-up"}>{creating ? "Sign in" : "Create an account"}</Link>
        </p>
        <Link className="text-button auth-back" to="/guest-preview">← Continue as a guest</Link>
      </section>
      <aside className="auth-reassurance" aria-label="Account benefits">
        <span aria-hidden="true">✦</span>
        <h2>A little less planning.<br />A lot more play.</h2>
        <ul>
          <li>Activities shaped around your child</li>
          <li>Secure parent-only access</li>
          <li>One calm mission at a time</li>
        </ul>
      </aside>
    </main>
  );
}

export function OnboardingBoundary({
  session,
  onSignOut,
  signOutError,
}: {
  session: AuthSession;
  onSignOut: () => void;
  signOutError?: string;
}) {
  return (
    <main className="auth-page onboarding-boundary">
      <section className="auth-panel">
        <span className="invite-spark" aria-hidden="true">✓</span>
        <p className="eyebrow">Account ready</p>
        <h1>Welcome to Play Spark</h1>
        <p>Your secure parent account is active as <strong>{session.user.email}</strong>.</p>
        <div className="boundary-note">
          <strong>Next: tell us a little about your child</strong>
          <p>Child profile setup is the next development phase. You can browse the sample activities now and your parent account will remain signed in.</p>
        </div>
        <Link className="button button-primary" to="/guest-preview">Browse sample activities</Link>
        {signOutError && <div className="auth-error" role="alert">{signOutError}</div>}
        <button className="text-button" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}
