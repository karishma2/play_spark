import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, getPlayHistory, getSavedPlaySession, startPlaySession, type HistoryCursor, type PlaySession } from "./api";
import type { GuestSample } from "./guestTypes";
import { PlayFeedbackCard } from "./PlayFeedbackCard";

function savedDate(session: PlaySession) {
  return new Date(session.completedAt ?? session.abandonedAt ?? session.updatedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function PlayHistoryPage({ onHome, onReplay, renderWall }: {
  onHome: () => void;
  onReplay: () => void;
  renderWall: (sample: GuestSample, completed: string[]) => ReactNode;
}) {
  const [sessions, setSessions] = useState<PlaySession[]>([]);
  const [cursor, setCursor] = useState<HistoryCursor | null>(null);
  const [selected, setSelected] = useState<PlaySession>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const pending = useRef(false);
  const failedAction = useRef<() => Promise<void>>();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef<string>();
  useEffect(() => {
    if (previousSelection.current !== selected?.id) heading.current?.focus();
    previousSelection.current = selected?.id;
  }, [selected?.id]);

  useEffect(() => {
    const request = ++version.current;
    pending.current = true;
    failedAction.current = undefined;
    setLoading(true); setError(undefined); setSessions([]); setSelected(undefined); setCursor(null);
    getPlayHistory().then((page) => {
      if (request !== version.current) return;
      setSessions(page.sessions); setCursor(page.nextCursor);
    }).catch(() => {
      if (request === version.current) setError("We couldn't load your play history. Please try again.");
    }).finally(() => {
      if (request === version.current) { pending.current = false; setLoading(false); }
    });
    return () => { version.current += 1; pending.current = false; };
  }, [retry]);

  async function act(action: (request: number) => Promise<void>) {
    if (pending.current) return;
    const request = ++version.current;
    pending.current = true; setLoading(true); setError(undefined);
    try { await action(request); if (request === version.current) failedAction.current = undefined; }
    catch (failure) {
      if (request === version.current) { failedAction.current = () => act(action); setError(failure instanceof ApiError ? failure.message : "We couldn't open this activity. Please try again."); }
    } finally {
      if (request === version.current) { pending.current = false; setLoading(false); }
    }
  }

  function loadMore() {
    if (!cursor) return;
    void act(async (request) => {
      const page = await getPlayHistory(cursor);
      if (version.current !== request) return;
      setSessions((current) => [...current, ...page.sessions.filter((item) => !current.some(({ id }) => id === item.id))]);
      setCursor(page.nextCursor);
    });
  }

  function openSaved(id: string) {
    void act(async (request) => {
      const saved = await getSavedPlaySession(id);
      if (version.current === request) { setSelected(saved); window.scrollTo({ top: 0 }); }
    });
  }

  function replay() {
    if (!selected) return;
    void act(async (request) => {
      await startPlaySession(selected.playPath.id);
      if (version.current === request) onReplay();
    });
  }

  return <>
    <main className="app-shell play-history">
      <p className="eyebrow">Your child’s play</p>
      <h1 ref={heading} tabIndex={-1}>{selected ? selected.playPath.title : "Play history"}</h1>
      {error && <div className="state-card" role="alert"><p>{error}</p><button className="button button-primary" disabled={loading} onClick={() => failedAction.current ? void failedAction.current() : setRetry((value) => value + 1)}>Try again</button></div>}
      {loading && <p role="status">Opening your saved play…</p>}
      {selected ? <>
        <p>{selected.status === "completed" ? "Completed" : "Ended unfinished"} · {savedDate(selected)} · {selected.completedMissionIds.length} of {selected.playPath.missions.length} missions completed</p>
        <section aria-label="Saved Mission Wall"><h2>{selected.status === "completed" ? "Your completed Mission Wall" : "Your Mission Wall so far"}</h2>{renderWall(selected.playPath, selected.completedMissionIds)}</section>
        {selected.status === "completed" && <PlayFeedbackCard key={selected.id} sessionId={selected.id} />}
        <section className="history-missions" aria-label="Saved missions">
          {selected.playPath.missions.map((mission) => {
            const replacement = selected.missionReplacements.find(({ originalMissionId }) => originalMissionId === mission.id);
            const shown = replacement?.replacementMission ?? mission;
            return <article key={mission.id}><h2>{shown.title}</h2><p>{selected.completedMissionIds.includes(mission.id) ? "Completed" : "Not completed"}{replacement ? " · Curated replacement" : ""}</p><p>{shown.childChallenge}</p>{replacement && <p>Originally: {mission.title}</p>}</article>;
          })}
        </section>
        <div className="history-actions"><button className="button button-primary" disabled={loading} onClick={replay}>Play again</button><button className="button button-soft" disabled={loading} onClick={() => { setSelected(undefined); setError(undefined); }}>Back to history</button></div>
        <p>Play again starts a fresh activity. Your saved Mission Wall stays here. Finish or end any current activity before starting a different one.</p>
      </> : <>
        <p>Revisit completed Mission Walls and activities you ended along the way.</p>
        {!loading && !error && !sessions.length && <div className="state-card"><h2>Your first Mission Wall is waiting</h2><p>Complete a Play Path to see it here.</p><button className="button button-primary" onClick={onHome}>Explore activities</button></div>}
        <div className="history-grid">{sessions.map((saved) => <article className="recommendation-card history-card" key={saved.id}>
          <h2>{saved.playPath.title}</h2><p>{saved.status === "completed" ? "Completed" : "Ended unfinished"} · {savedDate(saved)}</p><p>{saved.completedMissionIds.length} of {saved.playPath.missions.length} missions completed</p>
          <button className="button button-primary" aria-label={`View saved Mission Wall for ${saved.playPath.title}`} disabled={loading} onClick={() => openSaved(saved.id)}>View saved Mission Wall</button>
        </article>)}</div>
        {cursor && <button className="button button-soft" disabled={loading} onClick={loadMore}>Load more activities</button>}
      </>}
    </main>
  </>;
}
