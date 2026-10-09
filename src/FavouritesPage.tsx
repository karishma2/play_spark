import { useEffect, useRef, useState } from "react";
import { getFavourites, setFavourite, type FavouritePlayPath } from "./api";

export function FavouritesPage({ onHome, onSelect }: { onHome: () => void; onSelect: (id: string) => void }) {
  const [rows, setRows] = useState<FavouritePlayPath[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    const current = ++version.current;
    pending.current = true; setLoading(true); setError(undefined); setRows([]); setCursor(null);
    getFavourites().then((page) => {
      if (current === version.current) { setRows(page.playPaths); setCursor(page.nextCursor); }
    }).catch(() => { if (current === version.current) setError("We couldn't load your favourites. Please try again."); })
      .finally(() => { if (current === version.current) { pending.current = false; setLoading(false); } });
    return () => { version.current++; pending.current = false; };
  }, [retry]);
  async function act(removeId?: string) {
    if (pending.current) return;
    const current = version.current;
    pending.current = true; setLoading(true); setError(undefined);
    try {
      if (removeId) {
        await setFavourite(removeId, false);
        if (current === version.current) setRows((items) => items.filter((row) => row.playPathId !== removeId));
      } else if (cursor) {
        const page = await getFavourites(cursor);
        if (current === version.current) {
          setRows((items) => [...items, ...page.playPaths.filter((row) => !items.some((item) => item.id === row.id))]);
          setCursor(page.nextCursor);
        }
      }
    } catch { if (current === version.current) setError("We couldn't update your favourites. Please try again."); }
    finally { if (current === version.current) { pending.current = false; setLoading(false); } }
  }
  return <main className="app-shell"><section className="favourites-page">
    <div className="favourites-intro"><p className="eyebrow">Saved Play Paths</p><h1>Your favourite Play Paths</h1>
    <p>Screen-free activities you want to return to, anytime.</p></div>
    {error && <div role="alert"><p>{error}</p><button className="button button-secondary" onClick={() => setRetry((value) => value + 1)}>Try again</button></div>}
    {loading && <p role="status">Loading favourites…</p>}
    {!loading && !error && !rows.length && <section className="favourites-empty" aria-labelledby="favourites-empty-title">
      <div className="favourites-empty-illustration" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><path d="M22 16h20v31L32 40 22 47V16Z" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/><path d="m32 24 1.5 3.5L37 29l-3.5 1.5L32 34l-1.5-3.5L27 29l3.5-1.5L32 24Z" fill="currentColor"/><path d="M43 40c-5-5-10 2 0 8 10-6 5-13 0-8Z" fill="var(--canvas)" stroke="var(--secondary)" strokeWidth="1.5"/></svg></div>
      <h2 id="favourites-empty-title">Keep your next play idea here</h2>
      <p>Save a Play Path you’d like to try. Your favourites will be ready whenever you need them.</p>
      <button className="button button-primary" onClick={onHome}>Explore activities <span aria-hidden="true">→</span></button>
      <p className="favourites-hint">Look for “Save to favourites” on an activity.</p>
    </section>}
    <div className="favourites-grid">{rows.map((row) => <article className="favourite-card" key={row.id}>
      {row.activity ? <><div className="favourite-card-image"><img src={row.activity.imageUrl} alt={row.activity.imageAlt} /><span>◷ {row.activity.durationMinutes} min</span></div>
        <div className="favourite-card-body"><h2>{row.activity.title}</h2><p>{row.activity.summary}</p>
        <button className="button button-primary" disabled={loading} onClick={() => onSelect(row.playPathId)}>View Play Path <span aria-hidden="true">→</span></button></div></> : <div className="favourite-card-body"><h2>Play Path unavailable</h2><p>This saved activity is no longer published. You can remove it from your favourites.</p></div>}
      <button className="favourite-remove" disabled={loading} onClick={() => void act(row.playPathId)}>Remove from favourites</button>
    </article>)}</div>
    {cursor && <button className="button button-secondary" disabled={loading} onClick={() => void act()}>Load more favourites</button>}
  </section></main>;
}
