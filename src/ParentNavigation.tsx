import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function ParentNavigation({ eligible, needsVerification, onHome, onFavourites, onHistory, onProfile, onPassword, onSignOut, onVerify, signOutError }: {
  eligible: boolean; needsVerification: boolean;
  onHome: () => void; onFavourites: () => void; onHistory: () => void;
  onProfile: () => void; onPassword: () => void; onSignOut: () => void; onVerify: () => void;
  signOutError?: string;
}) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const account = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !account.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", escape);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", escape); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  const links = [
    { label: "Explore", icon: "✧", active: pathname === "/" || pathname === "/guest-preview", action: onHome },
    { label: "Favourites", icon: "♡", active: pathname === "/favourites", action: onFavourites },
    { label: "Play history", icon: "◷", active: pathname === "/play-history", action: onHistory },
  ];
  function visit(action: () => void) { setOpen(false); action(); }
  function navigation(className: string, label: string) {
    return <nav className={className} aria-label={label}>{links.map((link) =>
      <button key={link.label} aria-current={link.active ? "page" : undefined} onClick={() => visit(link.action)}>
        <span aria-hidden="true">{link.icon}</span><span>{link.label}</span>
      </button>)}
    </nav>;
  }
  return <>
    {eligible && navigation("parent-desktop-nav", "Main navigation")}
    <div className="parent-account" ref={account} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} className="parent-account-trigger" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="parent-account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2"/></svg></span>Parent account <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      {open && <div className="parent-account-panel" id={panelId}>
        <div className="parent-account-heading"><strong>Parent account</strong><button ref={closeButton} aria-label="Close account menu" onClick={() => { setOpen(false); trigger.current?.focus(); }}>✕</button></div>
        {needsVerification && <button onClick={() => visit(onVerify)}>Verify email <span aria-hidden="true">→</span></button>}
        {eligible && <button onClick={() => visit(onProfile)}>Child profile <span aria-hidden="true">→</span></button>}
        <button onClick={() => visit(onPassword)}>Change password <span aria-hidden="true">→</span></button>
        <button className="parent-sign-out" onClick={onSignOut}>Sign out <span aria-hidden="true">↪</span></button>
        {signOutError && <p className="account-action-error" role="alert">{signOutError}</p>}
      </div>}
      {!open && signOutError && <p className="account-action-error" role="alert">{signOutError}</p>}
    </div>
    {eligible && navigation("parent-mobile-nav", "Mobile navigation")}
  </>;
}
