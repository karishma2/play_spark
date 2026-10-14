import { useEffect, useId, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

export function ParentNavigation({ eligible, needsVerification, onHome, onFavourites, onHistory, onProfile, onPassword, onDeleteAccount, onSignOut, onVerify, signOutError }: {
  eligible: boolean; needsVerification: boolean;
  onHome: () => void; onFavourites: () => void; onHistory: () => void;
  onProfile: () => void; onPassword: () => void; onSignOut: () => void; onVerify: () => void;
  onDeleteAccount: () => void;
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
    { label: "Explore", icon: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>, active: pathname === "/" || pathname === "/guest-preview", action: onHome },
    { label: "Favourites", icon: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>, active: pathname === "/favourites", action: onFavourites },
    { label: "Play history", icon: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>, active: pathname === "/play-history", action: onHistory },
  ];
  function visit(action: () => void) { setOpen(false); action(); }
  function navigation(className: string, label: string) {
    return <nav className={className} aria-label={label}>{links.map((link) =>
      <button key={link.label} aria-current={link.active ? "page" : undefined} onClick={() => visit(link.action)}>
        <span className="parent-nav-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{link.icon}</svg></span><span>{link.label}</span>
      </button>)}
    </nav>;
  }
  return <>
    {eligible && navigation("parent-desktop-nav", "Main navigation")}
    <div className="parent-account" ref={account} onBlur={(event) => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <button ref={trigger} className="parent-account-trigger" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="parent-account-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.5 18a7 7 0 0 1 13 0"/></svg></span>
        <span>Parent account</span>
        <svg className="parent-account-chevron" aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={open ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"}/></svg>
      </button>
      {open && <div className="parent-account-panel" id={panelId}>
        <div className="parent-account-heading"><strong>Parent account</strong><button ref={closeButton} aria-label="Close account menu" onClick={() => { setOpen(false); trigger.current?.focus(); }}>✕</button></div>
        {needsVerification && <button onClick={() => visit(onVerify)}>Verify email <span aria-hidden="true">→</span></button>}
        {eligible && <button onClick={() => visit(onProfile)}>Child profile <span aria-hidden="true">→</span></button>}
        <button onClick={() => visit(onPassword)}>Change password <span aria-hidden="true">→</span></button>
        <button className="account-delete-link" onClick={() => visit(onDeleteAccount)}>Delete account <span aria-hidden="true">→</span></button>
        <button className="parent-sign-out" onClick={onSignOut}>Sign out <span aria-hidden="true">↪</span></button>
        {signOutError && <p className="account-action-error" role="alert">{signOutError}</p>}
      </div>}
      {!open && signOutError && <p className="account-action-error" role="alert">{signOutError}</p>}
    </div>
    {eligible && navigation("parent-mobile-nav", "Mobile navigation")}
  </>;
}
