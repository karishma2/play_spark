import { useEffect, useRef, useState } from "react";
import { getFavourite, setFavourite } from "./api";

export function FavouriteButton({ playPathId }: { playPathId: string }) {
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const current = ++version.current;
    pending.current = true; setReady(false); setBusy(false); setError(undefined); setSaved(false);
    getFavourite(playPathId).then((result) => {
      if (current === version.current) { setSaved(result.saved); setReady(true); }
    }).catch(() => { if (current === version.current) setError("Couldn't check this favourite."); })
      .finally(() => { if (current === version.current) pending.current = false; });
    return () => { version.current++; pending.current = false; };
  }, [playPathId, retry]);
  async function toggle() {
    if (pending.current || !ready) return;
    const current = version.current;
    pending.current = true; setBusy(true); setError(undefined);
    try {
      const result = await setFavourite(playPathId, !saved);
      if (current === version.current) setSaved(result.saved);
    } catch { if (current === version.current) setError("Couldn't update this favourite. Please try again."); }
    finally { if (current === version.current) { pending.current = false; setBusy(false); } }
  }
  return <div className="favourite-action">
    <button className="button button-secondary" aria-pressed={saved} disabled={!ready || busy} onClick={() => void toggle()}>
      {busy ? "Saving…" : !ready ? "Checking favourite…" : saved ? "♥ Saved to favourites" : "♡ Save to favourites"}
    </button>
    {error && <p role="alert">{error} {!ready && <button onClick={() => setRetry((value) => value + 1)}>Try again</button>}</p>}
  </div>;
}
