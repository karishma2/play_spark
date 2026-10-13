import { useEffect, useRef, useState } from "react";
import { getPlayFeedback, savePlayFeedback, type FeedbackReason, type PlayFeedback } from "./api";

const reasons: Array<[FeedbackReason, string]> = [
  ["too_easy", "Too easy"], ["too_difficult", "Too difficult"], ["too_messy", "Too messy"],
  ["lost_interest", "Lost interest"], ["not_suitable", "Not suitable for us"],
];
export function PlayFeedbackCard({ sessionId }: { sessionId: string }) {
  const [draft, setDraft] = useState<PlayFeedback>({ overallRating: null, reasonKeys: [] });
  const [saved, setSaved] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const request = ++version.current;
    setLoading(true); setLoadFailed(false); setError(undefined); setSaved(false); setHidden(false); setSaving(false);
    setDraft({ overallRating: null, reasonKeys: [] });
    getPlayFeedback(sessionId).then((feedback) => {
      if (request !== version.current) return;
      if (feedback) { setDraft(feedback); setSaved(true); }
    }).catch(() => {
      if (request === version.current) { setLoadFailed(true); setError("We couldn't load feedback. You can continue playing or try again."); }
    }).finally(() => { if (request === version.current) setLoading(false); });
    return () => { version.current += 1; pending.current = false; };
  }, [sessionId, retry]);

  async function submit() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(undefined);
    const request = ++version.current;
    try {
      await savePlayFeedback(sessionId, draft);
      if (request === version.current) setSaved(true);
    } catch {
      if (request === version.current) setError("We couldn't save your feedback. Your completed Mission Wall is safe. Please try again.");
    } finally {
      if (request === version.current) { pending.current = false; setSaving(false); }
    }
  }
  if (hidden) return <section className="play-feedback"><p>Feedback skipped. You can share it later from Play history.</p><button className="button-link" onClick={() => setHidden(false)}>Share feedback</button></section>;
  return <section className="play-feedback" aria-label="Play Path feedback">
    <h2>How did this Play Path go?</h2><p>Optional parent feedback. A quick choice is enough.</p>
    {loading ? <p role="status">Loading feedback…</p> : saved ? <>
      <p role="status">Thanks — your feedback is saved.</p>
      <p>{draft.overallRating === "loved_it" ? "Loved it" : draft.overallRating === "okay" ? "It was okay" : "Feedback shared"}{draft.reasonKeys.length ? ` · ${reasons.filter(([key]) => draft.reasonKeys.includes(key)).map(([, label]) => label).join(", ")}` : ""}</p>
      <button className="button-link" onClick={() => setSaved(false)}>Change feedback</button>
    </> : <>
      {error && <p role="alert" className="form-error">{error}</p>}
      {error && !saving && <button className="button-link" onClick={() => setRetry((value) => value + 1)}>Reload saved feedback</button>}
      <fieldset disabled={saving || loadFailed}>
        <legend>Your overall experience</legend>
        <div className="feedback-choices">{([ ["loved_it", "Loved it"], ["okay", "It was okay"] ] as const).map(([value, label]) => <label key={value}><input type="radio" name={`rating-${sessionId}`} checked={draft.overallRating === value} onChange={() => setDraft((current) => ({ ...current, overallRating: value }))} />{label}</label>)}</div>
      </fieldset>
      <fieldset disabled={saving || loadFailed}>
        <legend>Anything that didn't work? (optional)</legend>
        <div className="feedback-choices">{reasons.map(([key, label]) => <label key={key}><input type="checkbox" checked={draft.reasonKeys.includes(key)} onChange={(event) => {
          const checked = event.target.checked;
          setDraft((current) => ({ ...current, reasonKeys: checked ? [...current.reasonKeys, key] : current.reasonKeys.filter((item) => item !== key) }));
        }} />{label}</label>)}</div>
      </fieldset>
      <div className="feedback-actions"><button className="button button-primary" disabled={saving || loadFailed || (!draft.overallRating && !draft.reasonKeys.length)} onClick={() => void submit()}>{saving ? "Saving…" : "Save feedback"}</button><button className="button-link" disabled={saving} onClick={() => setHidden(true)}>Skip for now</button></div>
    </>}
  </section>;
}
