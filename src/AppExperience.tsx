import { Component, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

function focusContent() {
  const target = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("main, [role='main']");
  if (!target) return;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

export function AppExperience({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [reconnected, setReconnected] = useState(false);
  useEffect(() => {
    function offline() { setOnline(false); setReconnected(false); }
    function connected() { setOnline(true); setReconnected(true); }
    window.addEventListener("offline", offline);
    window.addEventListener("online", connected);
    return () => { window.removeEventListener("offline", offline); window.removeEventListener("online", connected); };
  }, []);
  useEffect(() => {
    const previousFocus = document.activeElement;
    function focusReadyContent() {
      if (!document.querySelector("main h1")) return false;
      if (document.activeElement === previousFocus || document.activeElement === document.body) focusContent();
      return true;
    }
    if (focusReadyContent()) return;
    const observer = new MutationObserver(() => { if (focusReadyContent()) observer.disconnect(); });
    observer.observe(document.getElementById("root") ?? document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);
  return <>
    <button className="skip-content" onClick={focusContent}>Skip to main content</button>
    <div className="connection-announcement" role="status" aria-live="polite">
      {!online ? <div className="connection-notice"><strong>You’re offline.</strong><span>Keep playing away from the screen. Reconnect before saving progress or making account changes.</span></div>
        : reconnected ? <div className="connection-notice"><span>You’re back online. Retry any action that did not save.</span><button onClick={() => setReconnected(false)} aria-label="Dismiss connection notice">Dismiss</button></div> : null}
    </div>
    {children}
  </>;
}

export class AppRecoveryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="app-shell"><section className="state-card" role="alert">
      <h1>Let’s get you back to play</h1>
      <p>This screen couldn’t open. Reload Play Spark to try again. Any play progress already saved to your account stays saved.</p>
      <button className="button button-primary" onClick={() => window.location.reload()}>Reload Play Spark</button>
    </section></main>;
  }
}
