import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  changePassword,
  requestPasswordReset,
  resetPassword,
} from "./api";

function AccountBrand() {
  return (
    <Link className="brand auth-brand" to="/" aria-label="Play Spark home">
      <span className="brand-mark" aria-hidden="true">✦</span>
      <span><strong>Play Spark</strong><small>Mindful Screen-Free Play</small></span>
    </Link>
  );
}

function PasswordReassurance() {
  return (
    <aside className="auth-reassurance" aria-label="Password security">
      <span aria-hidden="true">✓</span>
      <h2>Your parent space,<br />kept private.</h2>
      <ul>
        <li>Reset links expire after 30 minutes</li>
        <li>Every reset link works only once</li>
        <li>Password changes close older sessions</li>
      </ul>
    </aside>
  );
}

function errorState(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    return { message: error.message, fields: error.fieldErrors ?? {} };
  }
  return { message: fallback, fields: {} };
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(undefined);
    setFieldErrors({});
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      const state = errorState(error, "Password reset is temporarily unavailable. Please try again.");
      setMessage(state.message);
      setFieldErrors(state.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="forgot-password-title">
        <AccountBrand />
        <p className="eyebrow">Parent account</p>
        <h1 id="forgot-password-title">Reset your password</h1>
        {sent ? (
          <div className="auth-success" role="status">
            <strong>Check your email</strong>
            <p>If an account matches that address, we sent a link that will work for 30 minutes.</p>
          </div>
        ) : (
          <>
            <p>Enter your account email and we’ll send reset instructions if it matches an account.</p>
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
                  aria-describedby={fieldErrors.email ? "reset-email-error" : undefined}
                />
                {fieldErrors.email && <small id="reset-email-error">{fieldErrors.email}</small>}
              </label>
              <button className="button button-primary" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <p className="auth-switch"><Link to="/sign-in">Back to sign in</Link></p>
      </section>
      <PasswordReassurance />
    </main>
  );
}

export function ResetPasswordPage({ token, onReset }: { token: string; onReset: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setFieldErrors({});
    if (newPassword !== confirmation) {
      setMessage("The passwords do not match.");
      setFieldErrors({ confirmation: "Enter the same password again." });
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      onReset();
      setComplete(true);
    } catch (error) {
      const state = errorState(error, "Password reset is temporarily unavailable. Please try again.");
      setMessage(state.message);
      setFieldErrors(state.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="reset-password-title">
        <AccountBrand />
        <p className="eyebrow">Parent account</p>
        <h1 id="reset-password-title">Choose a new password</h1>
        {complete ? (
          <div className="auth-success" role="status">
            <strong>Password updated</strong>
            <p>Your other sessions have been signed out. You can now sign in with your new password.</p>
          </div>
        ) : token ? (
          <form className="auth-form" onSubmit={submit} noValidate>
            {message && <div className="auth-error" role="alert">{message}</div>}
            <PasswordFields
              password={newPassword}
              confirmation={confirmation}
              onPassword={setNewPassword}
              onConfirmation={setConfirmation}
              fieldErrors={fieldErrors}
            />
            <button className="button button-primary" disabled={submitting}>
              {submitting ? "Updating…" : "Set new password"}
            </button>
          </form>
        ) : (
          <div className="auth-error" role="alert">This password reset link is incomplete.</div>
        )}
        <p className="auth-switch"><Link to="/sign-in">Go to sign in</Link></p>
      </section>
      <PasswordReassurance />
    </main>
  );
}

export function ChangePasswordPage({ onBack }: { onBack: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setFieldErrors({});
    if (newPassword !== confirmation) {
      setMessage("The passwords do not match.");
      setFieldErrors({ confirmation: "Enter the same password again." });
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setComplete(true);
    } catch (error) {
      const state = errorState(error, "Password changes are temporarily unavailable. Please try again.");
      setMessage(state.message);
      setFieldErrors(state.fields);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel" aria-labelledby="change-password-title">
        <AccountBrand />
        <p className="eyebrow">Account security</p>
        <h1 id="change-password-title">Change your password</h1>
        <p>Confirm your current password, then choose a new one. Other signed-in sessions will close.</p>
        {complete && <div className="auth-success" role="status">Your password has been updated.</div>}
        <form className="auth-form" onSubmit={submit} noValidate>
          {message && <div className="auth-error" role="alert">{message}</div>}
          <label>
            <span>Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              minLength={10}
              maxLength={128}
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              aria-describedby={fieldErrors.currentPassword ? "current-password-error" : undefined}
            />
            {fieldErrors.currentPassword && <small id="current-password-error">{fieldErrors.currentPassword}</small>}
          </label>
          <PasswordFields
            password={newPassword}
            confirmation={confirmation}
            onPassword={setNewPassword}
            onConfirmation={setConfirmation}
            fieldErrors={fieldErrors}
          />
          <button className="button button-primary" disabled={submitting}>
            {submitting ? "Updating…" : "Update password"}
          </button>
        </form>
        <button className="text-button auth-back" onClick={onBack}>← Back to Play Spark</button>
      </section>
      <PasswordReassurance />
    </main>
  );
}

function PasswordFields({
  password,
  confirmation,
  onPassword,
  onConfirmation,
  fieldErrors,
}: {
  password: string;
  confirmation: string;
  onPassword: (value: string) => void;
  onConfirmation: (value: string) => void;
  fieldErrors: Record<string, string>;
}) {
  return (
    <>
      <label>
        <span>New password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          value={password}
          onChange={(event) => onPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.newPassword)}
          aria-describedby={fieldErrors.newPassword ? "new-password-error" : "new-password-help"}
        />
        <small id={fieldErrors.newPassword ? "new-password-error" : "new-password-help"}>
          {fieldErrors.newPassword ?? "Use 10 to 128 characters."}
        </small>
      </label>
      <label>
        <span>Confirm new password</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={128}
          value={confirmation}
          onChange={(event) => onConfirmation(event.target.value)}
          aria-invalid={Boolean(fieldErrors.confirmation)}
          aria-describedby={fieldErrors.confirmation ? "confirmation-error" : undefined}
        />
        {fieldErrors.confirmation && <small id="confirmation-error">{fieldErrors.confirmation}</small>}
      </label>
    </>
  );
}
