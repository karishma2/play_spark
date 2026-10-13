import { useEffect, useRef, useState, type FormEvent } from "react";
import { deleteAccount } from "./api";

export function DeleteAccountPage({ email, onDeleted, onCancel }: { email: string; onDeleted: () => void; onCancel: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy.current || confirmation !== email) return;
    busy.current = true; setPending(true); setError(undefined);
    try {
      await deleteAccount(confirmation);
      onDeleted();
    } catch {
      if (mounted.current) setError("We couldn't delete your account. Please try again. If your session has expired, sign in again first.");
    } finally {
      if (mounted.current) { busy.current = false; setPending(false); }
    }
  }
  return <main className="auth-page delete-account-page">
    <section className="auth-panel" aria-labelledby="delete-account-title">
      <p className="eyebrow">Parent account</p>
      <h1 id="delete-account-title">Delete your account</h1>
      <p>This permanently deletes your account, child profiles, play progress, history, favourites and feedback. You will be signed out on all devices.</p>
      <p id="deletion-warning"><strong>This cannot be undone.</strong> Curated Play Spark activities remain available to other families.</p>
      <form className="auth-form" onSubmit={submit}>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <label htmlFor="confirmation-email">Type your account email exactly: <strong>{email}</strong></label>
        <input id="confirmation-email" type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={254} required value={confirmation} disabled={pending} aria-describedby="deletion-warning" onChange={(event) => setConfirmation(event.target.value)} />
        <button className="button button-danger" disabled={pending || confirmation !== email}>{pending ? "Deleting account…" : "Permanently delete my account"}</button>
        <button className="button-link" type="button" disabled={pending} onClick={onCancel}>Cancel — keep my account</button>
        {pending && <p role="status">Please wait while your account is deleted.</p>}
      </form>
    </section>
  </main>;
}
