import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  abandonPlaySession,
  completePlaySessionMission,
  getActivePlaySession,
  getAuthSession,
  getGuestSample,
  getGuestSamples,
  getPlayPath,
  skipPlaySessionMission,
  signOut,
  startPlaySession,
  type AuthSession,
  type MissionSkipReason,
  type PlaySession,
} from "./api";
import { AuthPage } from "./AuthPage";
import { ChangePasswordPage, ForgotPasswordPage, ResetPasswordPage } from "./PasswordPage";
import { EmailVerificationPendingPage, VerifyEmailPage } from "./EmailVerificationPage";
import { OnboardingPage } from "./OnboardingPage";
import { ChildProfilePage } from "./ChildProfilePage";
import { DiscoveryDashboard } from "./DiscoveryDashboard";
import { PlayHistoryPage } from "./PlayHistoryPage";
import {
  completeSample,
  readGuestProgress,
  restartSample,
  saveGuestProgress,
  toggleMission,
  type GuestProgress,
} from "./guestProgress";
import type { GuestSample, GuestSampleSummary } from "./guestTypes";

const heroImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAtjRgej7iCWGfqmoHsWwfo6nRSZeuWby6e4xgpEDnJTsXCEM9EgL3l6yqyB6P-aHu6mJpHbAZlQEsBAjZypunyB7Lx6tKyrXQKhth60JnVP4S5YZJ8aiNIpfpMR3pXRPxRJkoIQXIGQP-Zn2rEL-x0o4c9hfFLe27khlofMSwcI9RyYDgo18BAGdYY9kvsy4UtgwcoSe8zzJtXmW-MytqejDRyPG3Q5AH8g8Vo5Pxl6lDDnt1qcHKJqQ";

type DurationFilter = "all" | 10 | 15 | 20;

const skipReasonOptions: Array<{ value: MissionSkipReason; label: string }> = [
  { value: "missing_materials", label: "We don’t have the materials" },
  { value: "too_messy_or_noisy", label: "Too messy or noisy right now" },
  { value: "too_much_parent_help", label: "Needs too much parent help" },
  { value: "child_not_interested", label: "My child isn’t interested" },
  { value: "something_else", label: "Something else" },
];
type ExploreScreen = "landing" | "guest";
type DetailOrigin = ExploreScreen;
const guestSampleLimit = 2;

function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <a className="brand" href="#top" aria-label="Play Spark home" onClick={onNavigate}>
      <span className="brand-mark" aria-hidden="true">✦</span>
      <span>
        <strong>Play Spark</strong>
        <small>Mindful Screen-Free Play</small>
      </span>
    </a>
  );
}

function Header({
  screen,
  onHome,
  onGuest,
  session,
  sessionReady,
  onSignIn,
  onSignUp,
  onSignOut,
  onManageAccount,
  onManageProfile,
  onHistory,
  onVerifyEmail,
  signOutError,
}: {
  screen: ExploreScreen;
  onHome: () => void;
  onGuest: () => void;
  session: AuthSession | null;
  sessionReady: boolean;
  onSignIn: () => void;
  onSignUp: () => void;
  onSignOut: () => void;
  onManageAccount: () => void;
  onManageProfile: () => void;
  onHistory: () => void;
  onVerifyEmail: () => void;
  signOutError?: string;
}) {
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand onNavigate={onHome} />
        {!sessionReady ? (
          <div className="guest-auth-actions" aria-label="Checking parent account" role="status">
            <span className="account-email">Checking account…</span>
          </div>
        ) : session ? (
          <div className="guest-auth-actions" aria-label="Parent account">
            <span className="account-email">{session.user.email}</span>
            {!session.emailVerified && <button onClick={onVerifyEmail}>Verify email</button>}
            {session.emailVerified && session.hasChildProfile && <button onClick={onManageProfile}>Child profile</button>}
            {session.emailVerified && session.hasChildProfile && <button onClick={onHistory}>Play history</button>}
            <button onClick={onManageAccount}>Password</button>
            <button onClick={onSignOut}>Sign out</button>
            <span className="guest-avatar" aria-hidden="true">●</span>
            {signOutError && <span className="account-action-error" role="alert">{signOutError}</span>}
          </div>
        ) : screen === "guest" ? (
          <div className="guest-auth-actions" aria-label="Parent account options">
            <button onClick={onSignIn}>Sign in</button>
            <button className="guest-account-button" onClick={onSignUp}>Create account</button>
            <span className="guest-avatar" aria-hidden="true">●</span>
          </div>
        ) : (
          <>
            <nav aria-label="Primary navigation">
              <button className="nav-active" onClick={onHome}>Explore</button>
              <a href="#how-it-works">How it works</a>
            </nav>
            <div className="header-account-actions">
              <button className="guest-pill" onClick={onGuest}>Guest preview</button>
              <button className="header-sign-in" onClick={onSignIn}>Sign in</button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="state-card" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="state-card state-error" role="alert">
      <span className="state-icon" aria-hidden="true">↻</span>
      <h2>That spark did not load</h2>
      <p>Please check your connection and try again.</p>
      <button className="button button-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}

function SampleCard({
  sample,
  completed,
  onSelect,
}: {
  sample: GuestSampleSummary;
  completed: boolean;
  onSelect: () => void;
}) {
  return (
    <article className="sample-card">
      <div className="sample-image-wrap">
        <img src={sample.imageUrl} alt={sample.imageAlt} />
        <span className="category-chip category-primary">{sample.category}</span>
        <span className="category-chip category-secondary">{sample.secondaryCategory}</span>
      </div>
      <div className="sample-card-body">
        <div className="metadata-row">
          <span>◷ {sample.durationMinutes} min</span>
          <span>Prep {sample.setupMinutes} min</span>
          <span>{sample.parentEffort} effort</span>
        </div>
        <div>
          <div className="card-title-row">
            <h3>{sample.title}</h3>
            {completed && <span className="completed-badge">Completed</span>}
          </div>
          <p>{sample.summary}</p>
          <p className="sample-purpose"><strong>Purpose:</strong> {sample.goal}</p>
        </div>
        <div className="materials-line">
          <span aria-hidden="true">⌂</span>
          <span>{sample.materials.join(" · ")}</span>
        </div>
        <button className="button button-spark" onClick={onSelect}>
          <span aria-hidden="true">▶</span>
          {completed ? "Play again" : `Start ${sample.durationMinutes}-min Play Path`}
        </button>
      </div>
    </article>
  );
}

function AccountInvitation({ onClose, onCreate, onSignIn }: { onClose: () => void; onCreate: () => void; onSignIn: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-title">
        <button className="icon-button modal-close" onClick={onClose} aria-label="Close invitation">×</button>
        <span className="invite-spark" aria-hidden="true">✦</span>
        <p className="eyebrow">Two sparks completed</p>
        <h2 id="invite-title">Keep the playful momentum going</h2>
        <p>Create a parent account to get ideas matched to your child's interests, save favourites, and build a living Mission Wall.</p>
        <button className="button button-primary" onClick={onCreate}>Create parent account</button>
        <button className="text-button" onClick={onSignIn}>I already have an account</button>
        <button className="text-button" onClick={onClose}>Keep exploring samples</button>
      </section>
    </div>
  );
}

function AdditionalMissionWallScene({
  sceneKey,
  revealed,
  highlightedMissionIndex,
}: {
  sceneKey: string;
  revealed: boolean[];
  highlightedMissionIndex?: number;
}) {
  const piece = (index: number) => `mission-wall-piece${revealed[index] ? " revealed" : ""}${highlightedMissionIndex === index ? " newly-revealed" : ""}`;

  if (sceneKey === "secret-code-path") return <>
    <g className={piece(0)} fill="none" stroke="#d96b43" strokeWidth="8"><circle cx="75" cy="108" r="25" /><circle cx="145" cy="83" r="23" /><circle cx="215" cy="108" r="25" /><path d="M55 108h40M145 60v46M197 90l36 36" /></g>
    <g className={piece(1)} fill="#dda74a"><ellipse cx="270" cy="101" rx="13" ry="24" transform="rotate(-25 270 101)" /><ellipse cx="301" cy="78" rx="13" ry="24" transform="rotate(-25 301 78)" /></g>
    <g className={piece(2)}><path d="M326 126V38" stroke="#214e34" strokeWidth="7" /><path d="M330 42h27l-9 13 9 13h-27z" fill="#7f63b5" /></g>
  </>;
  if (sceneKey === "paper-worm-garden") return <>
    <g className={piece(0)} strokeWidth="9" strokeLinecap="round"><path d="M35 109h74" stroke="#d96b43" /><path d="M35 88h74" stroke="#79a583" /><path d="M35 67h74" stroke="#7f63b5" /></g>
    <g className={piece(1)} fill="none" stroke="#dda74a" strokeWidth="18" strokeLinecap="round"><path d="M134 108q28-54 55 0t55 0" /></g>
    <g className={piece(2)}><path d="M252 130q34-76 67 0" fill="none" stroke="#79a583" strokeWidth="18" strokeLinecap="round" /><circle cx="286" cy="58" r="25" fill="#d96b43" /><circle cx="286" cy="58" r="10" fill="#dda74a" /></g>
  </>;
  if (sceneKey === "parcel-town") return <>
    <g className={piece(0)} fill="#dda74a" stroke="#9d6a15" strokeWidth="4"><rect x="38" y="83" width="38" height="35" rx="4" /><rect x="76" y="65" width="42" height="53" rx="4" /></g>
    <g className={piece(1)}><path d="M150 69h75l-10 58h-55z" fill="#79a583" stroke="#214e34" strokeWidth="6" /><path d="M158 88h60M155 105h65" stroke="#fff" strokeWidth="4" /></g>
    <g className={piece(2)}><path d="M238 115q42-78 103-45" fill="none" stroke="#d96b43" strokeWidth="13" strokeLinecap="round" strokeDasharray="13 11" /><path d="m330 55 19 13-21 9" fill="#d96b43" /></g>
  </>;
  if (sceneKey === "colour-creature-cafe") return <>
    <g className={piece(0)} stroke="#214e34" strokeWidth="5">
      <path d="M30 65q0-24 24-24h57q24 0 24 24v64H30z" fill="#d96b43" /><circle cx="61" cy="70" r="6" fill="#fff" /><circle cx="103" cy="70" r="6" fill="#fff" /><rect x="55" y="91" width="55" height="24" rx="11" fill="#fff" />
      <path d="M145 65q0-24 24-24h57q24 0 24 24v64H145z" fill="#dda74a" /><circle cx="176" cy="70" r="6" fill="#fff" /><circle cx="218" cy="70" r="6" fill="#fff" /><rect x="170" y="91" width="55" height="24" rx="11" fill="#fff" />
    </g>
    <g className={piece(1)} stroke="#214e34" strokeWidth="4"><circle cx="282" cy="104" r="20" fill="#d96b43" /><rect x="314" y="84" width="40" height="40" rx="7" fill="#dda74a" /><path d="m275 104 8 8 14-18M324 104l8 8 14-18" fill="none" /></g>
    <g className={piece(2)}><path d="M275 35h70v37h-70z" fill="#79a583" stroke="#214e34" strokeWidth="5" /><path d="M289 54h43" stroke="#fff" strokeWidth="5" strokeDasharray="7 5" /><path d="m330 29 8 10 13-3-2 13 10 8-12 6-1 14-11-8-12 7 1-14-11-7 11-7z" fill="#7f63b5" /></g>
  </>;
  if (sceneKey === "detective-table") return <>
    <g className={piece(0)}><path d="M33 53q51-26 102 0l-13 77H47z" fill="#7f63b5" stroke="#214e34" strokeWidth="6" /><path d="M48 55q36 16 73 0" fill="none" stroke="#dda74a" strokeWidth="9" strokeLinecap="round" /><text x="73" y="105" fill="#fff" fontSize="45" fontWeight="800">?</text></g>
    <g className={piece(1)} stroke="#214e34" strokeWidth="4"><rect x="151" y="48" width="56" height="72" rx="7" fill="#fff" /><path d="M165 70h28M165 83h22M165 96h31" /><rect x="218" y="48" width="56" height="72" rx="7" fill="#fff" /><circle cx="246" cy="82" r="15" fill="#dda74a" /></g>
    <g className={piece(2)}><path d="m319 42 11 19 22 5-15 17 2 22-20-9-20 9 2-22-15-17 22-5z" fill="#d96b43" stroke="#214e34" strokeWidth="5" /><circle cx="319" cy="73" r="9" fill="#fff" /><path d="M302 107l-8 28 25-12 25 12-8-28" fill="#79a583" stroke="#214e34" strokeWidth="5" /></g>
  </>;
  if (sceneKey === "treasure-route") return <>
    <g className={piece(0)} stroke="#214e34" strokeWidth="5"><path d="M23 92l32-29 32 29v36H23z" fill="#d96b43" /><rect x="104" y="70" width="65" height="55" rx="7" fill="#7ba5b6" /><path d="M190 126V74h70v52" fill="#dda74a" /></g>
    <g className={piece(1)}><path d="M58 112c46-77 75 26 116-26 31-39 57 30 98-18" fill="none" stroke="#79a583" strokeWidth="9" strokeLinecap="round" strokeDasharray="2 16" /><g fill="#dda74a" stroke="#214e34" strokeWidth="3"><circle cx="58" cy="112" r="10" /><circle cx="174" cy="86" r="10" /><circle cx="272" cy="68" r="10" /></g></g>
    <g className={piece(2)}><rect x="286" y="85" width="55" height="42" rx="6" fill="#d96b43" stroke="#214e34" strokeWidth="5" /><path d="M314 85v42M286 101h55" stroke="#f4d17c" strokeWidth="5" /><path d="m315 35 8 16 18 2-13 12 4 18-17-9-16 9 3-18-13-12 18-2z" fill="#7f63b5" /></g>
  </>;
  return null;
}

function Landing({
  samples,
  progress,
  onSelect,
  onGuest,
  showNoSignInNeeded,
}: {
  samples: GuestSampleSummary[];
  progress: GuestProgress;
  onSelect: (sampleId: string) => void;
  onGuest: () => void;
  showNoSignInNeeded: boolean;
}) {
  const [filter, setFilter] = useState<DurationFilter>("all");
  const visibleSamples = useMemo(
    () => samples.filter((sample) => filter === "all" || sample.durationMinutes === filter),
    [filter, samples],
  );

  return (
    <>
      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow-pill"><span aria-hidden="true">✦</span> Screen-free play for preschoolers (ages 3–5)</span>
          <h1>Screen-free play,<br />made simple.</h1>
          <p className="hero-summary">60-second setup. Zero screens. Simple everyday play for 3–5 year olds.</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={onGuest}>Explore activities <span aria-hidden="true">→</span></button>
            {showNoSignInNeeded && <span className="quiet-copy">No sign-in needed</span>}
          </div>
          <div className="reassurance-row" aria-label="Play Spark benefits">
            <span>♧ Household materials</span>
            <span>▱ Zero child screen-time</span>
            <span>✓ Clear parent guidance</span>
          </div>
        </div>
        <div className="hero-visual" aria-label="A calm family play moment">
          <div className="soft-orb soft-orb-green" />
          <div className="soft-orb soft-orb-peach" />
          <div className="hero-card">
            <div className="hero-image-wrap">
              <img src={heroImage} alt="A parent and preschool child building together on a living-room rug." />
              <span className="floating-time">◷ 12 min calm session</span>
            </div>
            <div className="quick-suggestion">
              <span className="suggestion-icon" aria-hidden="true">✦</span>
              <span><strong>Tonight's quick suggestion</strong><small>Uses simple things already at home</small></span>
              <span aria-hidden="true">→</span>
            </div>
          </div>
        </div>
      </section>

      <section className="quick-sparks" id="quick-sparks">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">Screen-free micro-rituals</p>
            <h2>Tonight's quick sparks — 20 minutes or less</h2>
          </div>
          <div className="filters" aria-label="Filter by duration">
            {(["all", 10, 15, 20] as DurationFilter[]).map((value) => (
              <button
                className={filter === value ? "active" : ""}
                key={value}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {value === "all" ? "All" : `${value} mins`}
              </button>
            ))}
          </div>
        </div>
        {visibleSamples.length > 0 ? (
          <div className="sample-grid">
            {visibleSamples.map((sample) => (
              <SampleCard
                key={sample.id}
                sample={sample}
                completed={progress.completedSampleIds.includes(sample.id)}
                onSelect={() => onSelect(sample.id)}
              />
            ))}
          </div>
        ) : (
          <div className="state-card"><p>No sample matches this duration yet.</p></div>
        )}
      </section>

      <section className="how-it-works" id="how-it-works">
        <div className="center-heading">
          <p className="eyebrow">Paced for real life</p>
          <h2>How Play Spark works</h2>
          <p>No preparation marathon. No supplies to buy. Ready in seconds.</p>
        </div>
        <ol className="steps-grid">
          {[
            ["Choose a spark", "Pick the time and energy that fit right now."],
            ["Grab a few items", "Use familiar things already around your home."],
            ["Play screen-free", "Follow three calm, parent-friendly missions."],
            ["Keep the memory", "Finish together and come back for another spark."],
          ].map(([title, copy], index) => (
            <li key={title}><span>{index + 1}</span><h3>{title}</h3><p>{copy}</p></li>
          ))}
        </ol>
      </section>

      <section className="closing-panel">
        <div>
          <p className="eyebrow">A calmer transition starts small</p>
          <h2>One playful idea. A few things from home. Time together that feels easy.</h2>
        </div>
        <button className="button button-primary" onClick={onGuest}>Choose your first spark</button>
      </section>
    </>
  );
}

function GuestPreview({
  samples,
  progress,
  onSelect,
  session,
  sessionReady,
  onSignUp,
  onSignIn,
}: {
  samples: GuestSampleSummary[];
  progress: GuestProgress;
  onSelect: (sampleId: string) => void;
  session: AuthSession | null;
  sessionReady: boolean;
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  return (
    <section className="guest-preview-page" id="top">
      <header className="guest-preview-hero">
        <p className="eyebrow">Screen-free play, made simple</p>
        <h1>A small spark for their<br />next free moment.</h1>
        <p>Try ready-made activity plans that help your child play independently while you stay close by.</p>
        <span className="guest-preview-badge"><span aria-hidden="true">✦</span> {!sessionReady
          ? "Checking your account…"
          : session
          ? `Signed in as ${session.user.email}`
          : "Explore sample paths — no account needed."}</span>
      </header>

      <div className="guest-preview-heading">
        <div>
          <span className="guest-preview-label"><span aria-hidden="true" /> {!sessionReady
            ? "Sample activities · Ready-to-play paths"
            : session
            ? "Sample activities · Ready-to-play paths"
            : "Guest preview · Free sample activities"}</span>
          <h2>Choose a play path</h2>
        </div>
        <p>Everything you need is on one calm, parent-friendly plan.</p>
      </div>

      <div className="guest-path-grid">
        {samples.map((sample) => {
          const completed = progress.completedSampleIds.includes(sample.id);
          return (
            <article className="guest-path-card" key={sample.id}>
              <div>
                <div className="guest-path-image">
                  <img src={sample.imageUrl} alt={sample.imageAlt} />
                  <span>{sample.category}</span>
                </div>
                <div className="guest-path-title-row">
                  <h3>{sample.title}</h3>
                  {completed && <span className="completed-badge">Completed</span>}
                </div>
                <p className="guest-path-summary">{sample.summary}</p>
                <div className="guest-path-purpose">
                  <strong>What your child practises</strong>
                  <p>{sample.goal}</p>
                  <ul>{sample.supports.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
                </div>
                <div className="guest-path-metadata" aria-label={`${sample.title} details`}>
                  <span>◷ {sample.durationMinutes} min</span>
                  <span>☷ {sample.missionCount} missions</span>
                  <span>✓ {sample.setupMinutes === 0 ? "No prep" : `${sample.setupMinutes} min prep`}</span>
                </div>
                <div className="guest-path-materials">
                  <span aria-hidden="true">▣</span>
                  <p><strong>Needs:</strong> {sample.materials.join(", ")}</p>
                </div>
              </div>
              <button className="button button-primary" onClick={() => onSelect(sample.id)}>
                {completed ? "Play this path again" : "Start this play path"} <span aria-hidden="true">→</span>
              </button>
            </article>
          );
        })}
      </div>

      <aside className="guest-reassurance">
        <span className="guest-reassurance-icon" aria-hidden="true">✓</span>
        <div>
          <h3>Designed for parent-guided, screen-free moments.</h3>
          <p>{!sessionReady
            ? "Your sample activities are ready while we check your account."
            : session
            ? "Your parent account stays signed in while you explore and play these samples."
            : "No account or credit card needed to try these sample paths right now."}</p>
        </div>
      </aside>

      {sessionReady && !session && (
        <section className="guest-signup-panel" aria-labelledby="guest-signup-title">
          <div>
            <p className="eyebrow">✦ Tailored experiences</p>
            <h2 id="guest-signup-title">Want ideas tailored to your child?</h2>
            <p>Create a free account to add interests, save favourites, and easily keep track of completed play as they grow.</p>
          </div>
          <div className="guest-signup-actions">
            <button className="button button-soft" onClick={onSignUp}>Create a free account →</button>
            <button className="text-button" onClick={onSignIn}>Already have an account? Sign in ↗</button>
          </div>
        </section>
      )}
    </section>
  );
}

function MissionWallPreview({
  sample,
  completedMissions,
  highlightedMissionIndex,
  readOnly = false,
}: {
  sample: GuestSample;
  completedMissions: string[];
  highlightedMissionIndex?: number;
  readOnly?: boolean;
}) {
  const revealed = sample.missions.map((mission) => completedMissions.includes(mission.id));
  const revealedCount = revealed.filter(Boolean).length;
  const sceneLabels = sample.missions.map((mission) => mission.wallElement.label);

  return (
    <div className="mission-wall-scene" aria-live="polite">
      <svg
        viewBox="0 0 360 150"
        role="img"
        aria-label={`${revealedCount} of ${sample.missions.length} Mission Wall elements revealed`}
      >
        <rect className="mission-wall-sky" width="360" height="150" rx="18" />
        {sample.wallSceneKey === "delivery-route" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <path className="mission-wall-road" d="M-20 130 C70 118 78 74 162 86 S260 142 382 104" />
              <path className="mission-wall-road-line" d="M-20 130 C70 118 78 74 162 86 S260 142 382 104" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <path className="mission-wall-bridge" d="M126 91 V56 Q180 18 234 56 V103 H216 V67 Q180 41 144 67 V94 Z" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <rect className="mission-wall-parcel" x="274" y="65" width="32" height="28" rx="4" />
              <path className="mission-wall-parcel-line" d="M290 65 V93 M274 77 H306" />
              <path className="mission-wall-car" d="M55 92 H98 Q105 92 109 100 L114 113 H48 L51 101 Q53 92 55 92 Z" />
              <circle className="mission-wall-wheel" cx="63" cy="114" r="7" />
              <circle className="mission-wall-wheel" cx="101" cy="114" r="7" />
            </g>
          </>
        ) : sample.wallSceneKey === "shadow-safari" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <circle className="mission-wall-moon" cx="68" cy="48" r="24" />
              <path className="mission-wall-beam" d="M89 60 L270 128 L142 128 Z" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <path className="mission-wall-animal" d="M178 102 Q160 78 176 61 L166 42 L187 54 Q202 50 214 61 L234 46 L226 72 Q236 92 218 106 Q198 119 178 102 Z" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <path className="mission-wall-tree" d="M286 126 V66 M286 78 Q260 68 260 48 M286 91 Q312 80 316 58" />
              <circle className="mission-wall-leaves" cx="257" cy="43" r="18" />
              <circle className="mission-wall-leaves" cx="319" cy="53" r="20" />
              <circle className="mission-wall-leaves" cx="288" cy="64" r="21" />
            </g>
          </>
        ) : sample.wallSceneKey === "rainbow-trail" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <ellipse cx="75" cy="112" rx="34" ry="14" fill="#d96b43" /><ellipse cx="145" cy="92" rx="34" ry="14" fill="#dda74a" /><ellipse cx="218" cy="112" rx="34" ry="14" fill="#79a583" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <path d="M116 78a66 66 0 0 1 132 0" fill="none" stroke="#d96b43" strokeWidth="13" /><path d="M130 78a52 52 0 0 1 104 0" fill="none" stroke="#dda74a" strokeWidth="13" /><path d="M144 78a38 38 0 0 1 76 0" fill="none" stroke="#79a583" strokeWidth="13" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <path d="M292 118V38" stroke="#214e34" strokeWidth="7" strokeLinecap="round" /><path d="M296 42h45l-15 18 15 18h-45z" fill="#d96b43" /><circle cx="292" cy="122" r="10" fill="#214e34" />
            </g>
          </>
        ) : sample.wallSceneKey === "animal-rescue" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <path d="M26 125C94 74 136 132 202 88" fill="none" stroke="#dda74a" strokeWidth="18" strokeLinecap="round" strokeDasharray="18 12" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <ellipse cx="220" cy="91" rx="42" ry="34" fill="#c58a55" /><path d="M186 66l8-25 19 23M231 62l20-22 6 31" fill="#c58a55" /><circle cx="207" cy="86" r="4" fill="#263b2d" /><circle cx="231" cy="86" r="4" fill="#263b2d" /><path d="M212 101q9 7 18 0" fill="none" stroke="#263b2d" strokeWidth="4" strokeLinecap="round" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <path d="M274 74l39-32 39 32v52h-78z" fill="#7ba5b6" /><path d="M263 78l50-42 50 42" fill="none" stroke="#214e34" strokeWidth="8" strokeLinejoin="round" /><path d="M300 126V92h26v34" fill="#f7f2e9" />
            </g>
          </>
        ) : sample.wallSceneKey === "rhythm-parade" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <ellipse cx="94" cy="78" rx="48" ry="17" fill="#7ba5b6" /><path d="M46 78l9 51h78l9-51" fill="#93bcc8" /><path d="M60 87l-18-45M126 87l25-42" stroke="#a97144" strokeWidth="7" strokeLinecap="round" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <path d="M186 42v58q-19-7-28 8-8 14 9 20 28 8 32-24V63l40-11v42q-18-8-28 7-9 14 9 21 28 8 33-24V28z" fill="#214e34" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <path d="M292 128V34" stroke="#214e34" strokeWidth="7" strokeLinecap="round" /><path d="M296 38q28-22 56 0v35q-28-22-56 0z" fill="#d96b43" /><circle cx="292" cy="130" r="10" fill="#dda74a" />
            </g>
          </>
        ) : sample.wallSceneKey === "nature-lab" ? (
          <>
            <g className={`mission-wall-piece${revealed[0] ? " revealed" : ""}${highlightedMissionIndex === 0 ? " newly-revealed" : ""}`}>
              <rect x="28" y="65" width="150" height="67" rx="13" fill="#d6ad78" /><path d="M78 67v63M128 67v63" stroke="#f4dfbd" strokeWidth="7" />
            </g>
            <g className={`mission-wall-piece${revealed[1] ? " revealed" : ""}${highlightedMissionIndex === 1 ? " newly-revealed" : ""}`}>
              <path d="M210 106q36-72 70 0-29 35-70 0z" fill="#79a583" /><path d="M245 78v53" stroke="#365f41" strokeWidth="5" /><ellipse cx="205" cy="126" rx="22" ry="13" fill="#8b8174" />
            </g>
            <g className={`mission-wall-piece${revealed[2] ? " revealed" : ""}${highlightedMissionIndex === 2 ? " newly-revealed" : ""}`}>
              <circle cx="300" cy="65" r="31" fill="none" stroke="#214e34" strokeWidth="9" /><path d="M322 87l35 35" stroke="#214e34" strokeWidth="11" strokeLinecap="round" /><circle cx="290" cy="55" r="6" fill="#fff" opacity=".8" />
            </g>
          </>
        ) : (
          <AdditionalMissionWallScene
            sceneKey={sample.wallSceneKey}
            revealed={revealed}
            highlightedMissionIndex={highlightedMissionIndex}
          />
        )}
      </svg>
      <strong>{revealedCount} of {sample.missions.length} scene elements revealed</strong>
      <ol className="mission-wall-key">
        {sceneLabels.map((label, index) => (
          <li className={`${revealed[index] ? "revealed" : ""}${highlightedMissionIndex === index ? " newly-revealed" : ""}`} key={label}>
            <span>{revealed[index] ? "✓" : index + 1}</span>
            <div><b>{label}</b><small>{revealed[index] ? "Revealed" : readOnly ? "Not revealed" : `Complete mission ${index + 1}`}</small></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function MissionReveal({
  sample,
  missionIndex,
  completedMissions,
  onContinue,
}: {
  sample: GuestSample;
  missionIndex: number;
  completedMissions: string[];
  onContinue: () => void;
}) {
  const revealNames = sample.missions.map((mission) => mission.wallElement.revealMessage);
  const isFinalMission = missionIndex === sample.missions.length - 1;

  return (
    <div className="mission-reveal-page" role="status" aria-live="polite">
      <header className="active-session-header"><Brand /></header>
      <main className="mission-reveal-shell">
        <p className="eyebrow">Mission {missionIndex + 1} complete</p>
        <h1>{revealNames[missionIndex]}</h1>
        <p>One new piece has joined your Mission Wall.</p>
        <div className="mission-reveal-art">
          <span className="mission-reveal-spark spark-one" aria-hidden="true">✦</span>
          <MissionWallPreview
            sample={sample}
            completedMissions={completedMissions}
            highlightedMissionIndex={missionIndex}
          />
        </div>
        <button className="button button-primary" onClick={onContinue}>
          {isFinalMission ? "See your completed Mission Wall" : `Continue to Mission ${missionIndex + 2}`} <span aria-hidden="true">→</span>
        </button>
        <small>{isFinalMission ? "Your scene is complete." : "Continue whenever you are ready."}</small>
      </main>
    </div>
  );
}

function SampleDetail({
  sample,
  progress,
  onBack,
  backLabel,
  authenticated,
  onStart,
  activeSession,
  onEndSession,
}: {
  sample: GuestSample;
  progress: GuestProgress;
  onBack: () => void;
  backLabel: string;
  authenticated: boolean;
  onStart: () => void | Promise<void>;
  activeSession?: boolean;
  onEndSession?: () => Promise<void>;
}) {
  const completedMissions = progress.completedMissions[sample.id] ?? [];
  const [endingSession, setEndingSession] = useState(false);
  const [endError, setEndError] = useState<string>();
  const [startingSession, setStartingSession] = useState(false);
  const [startError, setStartError] = useState<string>();

  async function beginSession() {
    if (startingSession) return;
    setStartingSession(true);
    setStartError(undefined);
    try {
      await onStart();
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "We couldn't start this Play Path. Please try again.");
    } finally {
      setStartingSession(false);
    }
  }

  async function endCurrentSession() {
    if (!onEndSession || endingSession) return;
    setEndingSession(true);
    setEndError(undefined);
    try {
      await onEndSession();
    } catch (error) {
      setEndError(error instanceof Error ? error.message : "We couldn't end this Play Path. Please try again.");
    } finally {
      setEndingSession(false);
    }
  }

  return (
    <section className="path-overview-page">
      <div className="path-overview-toolbar">
        <button className="back-button" onClick={onBack}>← Back to {backLabel}</button>
        <span>{authenticated ? "Personalized recommendation" : "Guest preview"}</span>
      </div>

      <div className="path-overview-hero">
        <div>
          <div className="path-overview-tags"><span>Ages 3–5</span><span>♡ Step-by-step play</span></div>
          <p className="eyebrow">{authenticated ? "Your Play Path" : "Guest Play Path"}</p>
          <h1>{sample.title}</h1>
          <p className="path-overview-summary">{sample.summary}</p>
          <div className="path-purpose">
            <p className="path-purpose-label">What this Play Path helps build</p>
            <p>{sample.goal}</p>
            <ul>{sample.supports.map((benefit) => <li key={benefit}>{benefit}</li>)}</ul>
          </div>
          <p className="safety-note"><strong>Stay safe:</strong> {sample.safetyNote}</p>
        </div>
        <img src={sample.imageUrl} alt={sample.imageAlt} />
      </div>

      <section className="path-preparation" aria-labelledby="before-you-begin">
        <h2 id="before-you-begin">Before you begin</h2>
        <div className="path-facts">
          <div><span>◷</span><small>Duration</small><strong>{sample.durationMinutes} min</strong></div>
          <div><span>♧</span><small>Parent effort</small><strong>{sample.parentEffort} effort</strong></div>
          <div><span>◴</span><small>Setup</small><strong>{sample.setupMinutes <= 1 ? "Almost none" : "Little prep"}</strong></div>
          <div><span>⌂</span><small>Setting</small><strong>Indoors</strong></div>
        </div>
        <div className="path-material-checklist">
          <div><strong>▣ You’ll need</strong><span>{sample.materials.length} simple items</span></div>
          <ul>{sample.materials.map((material) => <li key={material}>✓ {material}</li>)}</ul>
        </div>
      </section>

      <section className="path-journey" aria-labelledby="play-journey">
        <div className="path-section-heading">
          <div><h2 id="play-journey">Your play journey</h2><p>Three small missions, one calm activity.</p></div>
          <span>{completedMissions.length} of {sample.missions.length} complete</span>
        </div>
        <ol>
          {sample.missions.map((mission, index) => {
            const completed = completedMissions.includes(mission.id);
            return (
              <li className={completed ? "path-journey-complete" : ""} key={mission.id}>
                <span>{completed ? "✓" : index + 1}</span>
                <div><h3>{mission.title}</h3><p>{mission.childChallenge}</p></div>
                <small>{mission.durationMinutes} min</small>
              </li>
            );
          })}
        </ol>
      </section>

      <aside className="path-reward-preview">
        <div><p className="eyebrow">Mission Wall preview</p><h3>Complete the missions to finish this spark together.</h3></div>
        <MissionWallPreview sample={sample} completedMissions={completedMissions} />
      </aside>

      <div className="path-start-panel">
        <button className="button button-primary" onClick={beginSession} disabled={startingSession}>{startingSession ? "Opening…" : activeSession ? "Resume Play Path" : completedMissions.length === sample.missions.length ? "Play again" : "Start Play Path"} <span aria-hidden="true">→</span></button>
        <p>The next screen gives you one mission at a time, so you can put your phone down and play.</p>
        {startError ? <p className="form-error" role="alert">{startError}</p> : null}
        {activeSession && onEndSession ? <button className="button-link" onClick={endCurrentSession} disabled={endingSession}>{endingSession ? "Ending…" : "End this Play Path and choose another"}</button> : null}
        {endError ? <p className="form-error" role="alert">{endError}</p> : null}
      </div>
    </section>
  );
}

function ActiveSession({
  sample,
  missionIndex,
  progress,
  onProgress,
  onAdvance,
  onPause,
  onComplete,
  onSkip,
  missionWasReplaced = false,
}: {
  sample: GuestSample;
  missionIndex: number;
  progress: GuestProgress;
  onProgress: (progress: GuestProgress) => void;
  onAdvance: (progress: GuestProgress) => void;
  onPause: () => void;
  onComplete?: (missionId: string) => Promise<GuestProgress>;
  onSkip?: (reason: MissionSkipReason) => Promise<void>;
  missionWasReplaced?: boolean;
}) {
  const [showReveal, setShowReveal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [showSkipReasons, setShowSkipReasons] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [swapNotice, setSwapNotice] = useState(missionWasReplaced ? "This mission was swapped to better fit today." : undefined);
  const mission = sample.missions[missionIndex];
  const nextMission = sample.missions[missionIndex + 1];
  const completed = progress.completedMissions[sample.id] ?? [];
  const percent = ((missionIndex + 1) / sample.missions.length) * 100;

  useEffect(() => {
    setShowSkipReasons(false);
    setSaveError(undefined);
    setSwapNotice(missionWasReplaced ? "This mission was swapped to better fit today." : undefined);
  }, [mission.id, missionWasReplaced]);

  async function skipMission(reason: MissionSkipReason) {
    if (!onSkip || swapping) return;
    setSwapping(true);
    setSaveError(undefined);
    try {
      await onSkip(reason);
      setShowSkipReasons(false);
      setSwapNotice("Mission swapped. Here is a calmer option for the same step.");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We couldn’t change this mission. Please try again.");
    } finally {
      setSwapping(false);
    }
  }

  async function completeMission() {
    if (saving) return;
    setSaving(true);
    setSaveError(undefined);
    if (onComplete) {
      try {
        const nextProgress = await onComplete(mission.id);
        onProgress(nextProgress);
        setShowReveal(true);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "We couldn't save this mission. Please try again.");
      } finally {
        setSaving(false);
      }
      return;
    }
    let nextProgress = progress;
    if (!completed.includes(mission.id)) {
      nextProgress = toggleMission(nextProgress, sample.id, mission.id);
    }
    if (!nextMission) {
      nextProgress = completeSample(nextProgress, sample.id);
    }
    saveGuestProgress(nextProgress);
    onProgress(nextProgress);
    setShowReveal(true);
    setSaving(false);
  }

  function continueAfterReveal() {
    setShowReveal(false);
    onAdvance(progress);
  }

  if (showReveal) {
    return (
      <MissionReveal
        sample={sample}
        missionIndex={missionIndex}
        completedMissions={progress.completedMissions[sample.id] ?? []}
        onContinue={continueAfterReveal}
      />
    );
  }

  return (
    <div className="active-session-page">
      <header className="active-session-header">
        <Brand />
        <button onClick={onPause}>Pause for later</button>
      </header>
      <main className="active-session-shell">
        <div className="active-session-context">
          <span>▧ {sample.title}</span>
          <span>◷ ~{mission.durationMinutes} min · Unhurried</span>
        </div>
        <div className="active-session-progress">
          <div><strong>Current mission: {missionIndex + 1} of {sample.missions.length}</strong><span>Playing together</span></div>
          <div
            role="progressbar"
            aria-label="Current mission position"
            aria-valuemin={1}
            aria-valuemax={sample.missions.length}
            aria-valuenow={missionIndex + 1}
            aria-valuetext={`Currently on mission ${missionIndex + 1} of ${sample.missions.length}`}
          ><span style={{ width: `${percent}%` }} /></div>
        </div>

        <article className="active-mission-card">
          <div className="active-mission-eyebrow"><span>Mission {missionIndex + 1}</span><small>Step {missionIndex + 1} of {sample.title}</small></div>
          <h1>{mission.title}</h1>
          {swapNotice ? <p className="mission-swap-notice" role="status">✓ {swapNotice}</p> : null}
          <p className="active-mission-prompt">{mission.childChallenge}</p>
          <div className="active-guidance">
            <span aria-hidden="true">✦</span>
            <div><strong>Gentle guidance</strong><p>{mission.setupSteps.join(" ")}</p></div>
          </div>
          <div className="active-materials">
            <span aria-hidden="true">▣</span>
            <div><small>Using right now</small><strong>{(mission.materials ?? sample.materials).join(", ")}</strong></div>
            <span>✓ Zero screen required</span>
          </div>
        </article>

        {onSkip && !missionWasReplaced ? (
          <section className="mission-skip-panel" aria-labelledby="mission-skip-title">
            {!showSkipReasons ? (
              <button className="button-link" onClick={() => setShowSkipReasons(true)}>Skip this mission</button>
            ) : (
              <>
                <div><h2 id="mission-skip-title">What isn’t working today?</h2><p>Choose one reason and we’ll offer a reviewed alternative.</p></div>
                <div className="mission-skip-reasons">
                  {skipReasonOptions.map((option) => (
                    <button key={option.value} onClick={() => skipMission(option.value)} disabled={swapping}>{option.label}</button>
                  ))}
                </div>
                <button className="button-link" onClick={() => setShowSkipReasons(false)} disabled={swapping}>Keep this mission</button>
              </>
            )}
          </section>
        ) : null}

        <aside className="phone-down-card">
          <span aria-hidden="true">▱</span>
          <div><h2>Put your phone face-down <small>Sanctuary</small></h2><p>You don’t need this screen while playing. Step back, follow your child’s lead, and come back when this mission feels complete.</p></div>
        </aside>

        <details className="spark-prompts" open>
          <summary><span>“</span><div><strong>If you need a spark</strong><small>Simple words to keep the play moving</small></div></summary>
          <div className="spark-prompt-list"><p>“{mission.sayThis}”</p><p>{mission.tidyUp}</p></div>
        </details>

        <div className="active-session-quiet"><span>● Screen paused · Presence first</span><button onClick={onPause}>Pause this Play Path</button></div>
      </main>
      <div className="active-session-action">
        {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
        <button className="button button-primary" onClick={completeMission} disabled={saving}>{saving ? "Saving…" : nextMission ? `Complete Mission ${missionIndex + 1}` : "Complete Play Path"} →</button>
        <small>{nextMission ? <>Up next: <strong>{nextMission.title} (Mission {missionIndex + 2})</strong></> : "This is the final mission."}</small>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [samples, setSamples] = useState<GuestSampleSummary[]>([]);
  const [screen, setScreen] = useState<ExploreScreen>(location.pathname === "/guest-preview" ? "guest" : "landing");
  const [detailOrigin, setDetailOrigin] = useState<DetailOrigin>("landing");
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedSample, setSelectedSample] = useState<GuestSample>();
  const [activeMissionIndex, setActiveMissionIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detailRetry, setDetailRetry] = useState(0);
  const [progress, setProgress] = useState<GuestProgress>(() => readGuestProgress());
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [playSession, setPlaySession] = useState<PlaySession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const sessionRequestVersion = useRef(0);
  const playActionRequestVersion = useRef(0);
  const authenticatedUserRef = useRef<string>();
  const playSessionRef = useRef<PlaySession | null>(null);
  const previousPath = useRef(location.pathname);
  const guestSamples = samples.slice(0, guestSampleLimit);
  const canBrowseFullCatalogue = Boolean(session?.emailVerified && session.hasChildProfile);
  const authenticatedUserId = session?.user.id;
  const landingSamples = canBrowseFullCatalogue ? samples : guestSamples;
  const signedProgress: GuestProgress = playSession ? {
    completedMissions: { [playSession.playPath.id]: playSession.completedMissionIds },
    completedSampleIds: playSession.status === "completed" ? [playSession.playPath.id] : [],
  } : { completedMissions: {}, completedSampleIds: [] };
  const visibleProgress = playSession && selectedSample?.id === playSession.playPath.id ? signedProgress : progress;
  const activeSample = useMemo(() => {
    if (!selectedSample || !playSession || selectedSample.id !== playSession.playPath.id) return selectedSample;
    const replacements = new Map(playSession.missionReplacements.map((replacement) => [replacement.originalMissionId, replacement.replacementMission]));
    return {
      ...playSession.playPath,
      missions: playSession.playPath.missions.map((mission) => {
        const replacement = replacements.get(mission.id);
        return replacement ? { ...replacement, id: mission.id, wallElement: mission.wallElement } : mission;
      }),
    };
  }, [playSession, selectedSample]);

  function loadSamples() {
    setLoading(true);
    setError(false);
    getGuestSamples()
      .then(setSamples)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }

  useEffect(loadSamples, []);

  useEffect(() => {
    authenticatedUserRef.current = authenticatedUserId;
  }, [authenticatedUserId]);

  useEffect(() => {
    playSessionRef.current = playSession;
  }, [playSession]);

  useEffect(() => {
    const requestVersion = sessionRequestVersion.current;
    getAuthSession()
      .then((restoredSession) => {
        if (sessionRequestVersion.current === requestVersion) setSession(restoredSession);
      })
      .catch(() => {
        if (sessionRequestVersion.current === requestVersion) setSession(null);
      })
      .finally(() => {
        if (sessionRequestVersion.current === requestVersion) setSessionReady(true);
      });
  }, []);

  useEffect(() => {
    if (!sessionReady || !canBrowseFullCatalogue || location.pathname !== "/") return;
    let current = true;
    getActivePlaySession()
      .then((active) => {
        if (!current) return;
        if (!active) {
          setPlaySession(null);
          return;
        }
        setPlaySession(active);
        setDetailOrigin("landing");
        setSelectedId(active.playPath.id);
        setSelectedSample(active.playPath);
        setActiveMissionIndex(active.completedMissionIds.length);
        setLoading(false);
      })
      .catch(() => undefined);
    return () => { current = false; };
  }, [sessionReady, canBrowseFullCatalogue, authenticatedUserId, location.pathname]);

  useEffect(() => {
    const pathChanged = previousPath.current !== location.pathname;
    previousPath.current = location.pathname;
    if (!pathChanged) return;

    if (location.pathname === "/guest-preview" || location.pathname === "/") {
      setScreen(location.pathname === "/guest-preview" ? "guest" : "landing");
      setActiveMissionIndex(null);
      setSelectedId(undefined);
      setSelectedSample(undefined);
      setError(false);
      setLoading(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedSample(undefined);
      return;
    }
    if (playSession?.playPath.id === selectedId) {
      setSelectedSample(playSession.playPath);
      setLoading(false);
      return;
    }

    let current = true;
    setLoading(true);
    setError(false);
    const loadDetail = detailOrigin === "landing" && canBrowseFullCatalogue ? getPlayPath : getGuestSample;
    loadDetail(selectedId)
      .then((sample) => {
        if (current) setSelectedSample(sample);
      })
      .catch(() => {
        if (current) setError(true);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [selectedId, detailRetry, detailOrigin, canBrowseFullCatalogue, playSession]);

  function goHome() {
    navigate("/");
    setScreen("landing");
    setActiveMissionIndex(null);
    setSelectedId(undefined);
    setSelectedSample(undefined);
    setError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goGuest() {
    navigate("/guest-preview");
    setScreen("guest");
    setActiveMissionIndex(null);
    setSelectedId(undefined);
    setSelectedSample(undefined);
    setError(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openSample(sampleId: string, origin: DetailOrigin) {
    setDetailOrigin(origin);
    setActiveMissionIndex(null);
    setSelectedId(sampleId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function startSession() {
    if (!selectedSample) return;
    if (detailOrigin === "landing" && canBrowseFullCatalogue) {
      if (playSession?.status === "active" && playSession.playPath.id !== selectedSample.id) {
        setSelectedId(playSession.playPath.id);
        setSelectedSample(playSession.playPath);
        setActiveMissionIndex(playSession.completedMissionIds.length);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      try {
        playActionRequestVersion.current += 1;
        const active = await startPlaySession(selectedSample.id);
        setPlaySession(active);
        setActiveMissionIndex(active.completedMissionIds.length);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (error) {
        throw error;
      }
      return;
    }
    const completed = progress.completedMissions[selectedSample.id] ?? [];
    if (completed.length === selectedSample.missions.length) {
      const restartedProgress = restartSample(progress, selectedSample.id);
      saveGuestProgress(restartedProgress);
      setProgress(restartedProgress);
      setActiveMissionIndex(0);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const firstIncomplete = selectedSample.missions.findIndex((mission) => !completed.includes(mission.id));
    setActiveMissionIndex(firstIncomplete >= 0 ? firstIncomplete : 0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function advanceSession() {
    if (!selectedSample || activeMissionIndex === null) return;
    if (activeMissionIndex < selectedSample.missions.length - 1) {
      setActiveMissionIndex(activeMissionIndex + 1);
    } else {
      setActiveMissionIndex(null);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const activeSession = selectedSample && activeMissionIndex !== null;

  async function completeSignedMission(missionId: string) {
    if (!playSession) throw new Error("This play session is unavailable. Please try again.");
    playActionRequestVersion.current += 1;
    const updated = await completePlaySessionMission(playSession.id, missionId);
    playSessionRef.current = updated;
    setPlaySession(updated);
    return {
      completedMissions: { [updated.playPath.id]: updated.completedMissionIds },
      completedSampleIds: updated.status === "completed" ? [updated.playPath.id] : [],
    };
  }

  async function skipSignedMission(reason: MissionSkipReason) {
    if (!playSession) throw new Error("This play session is unavailable. Please try again.");
    const originalMission = playSession.playPath.missions[playSession.completedMissionIds.length];
    if (!originalMission) throw new Error("This mission is unavailable. Please refresh and try again.");
    const requestUserId = authenticatedUserId;
    const requestVersion = sessionRequestVersion.current;
    const requestActionVersion = playActionRequestVersion.current;
    const requestSessionId = playSession.id;
    const requestMissionId = originalMission.id;
    const updated = await skipPlaySessionMission(requestSessionId, requestMissionId, reason);
    const currentSession = playSessionRef.current;
    const currentMission = currentSession?.playPath.missions[currentSession.completedMissionIds.length];
    if (
      !requestUserId
      || sessionRequestVersion.current !== requestVersion
      || playActionRequestVersion.current !== requestActionVersion
      || authenticatedUserRef.current !== requestUserId
      || currentSession?.id !== requestSessionId
      || currentMission?.id !== requestMissionId
    ) return;
    playSessionRef.current = updated;
    setPlaySession(updated);
  }

  async function endCurrentPlaySession() {
    if (!playSession || playSession.status !== "active") return;
    playActionRequestVersion.current += 1;
    const ended = await abandonPlaySession(playSession.id);
    playSessionRef.current = ended;
    setPlaySession(ended);
    setActiveMissionIndex(null);
    setSelectedId(undefined);
    setSelectedSample(undefined);
    setScreen("landing");
  }

  function authenticated(nextSession: AuthSession) {
    sessionRequestVersion.current += 1;
    playActionRequestVersion.current += 1;
    authenticatedUserRef.current = nextSession.user.id;
    playSessionRef.current = null;
    setSignOutError(undefined);
    setPlaySession(null);
    setActiveMissionIndex(null);
    setSelectedId(undefined);
    setSelectedSample(undefined);
    setSession(nextSession);
    setSessionReady(true);
    navigate(!nextSession.emailVerified ? "/verify-email-pending" : nextSession.hasChildProfile ? "/" : "/onboarding");
  }

  async function refreshSessionAfterVerification() {
    sessionRequestVersion.current += 1;
    try {
      setSession(await getAuthSession());
    } catch {
      setSession(null);
    } finally {
      setSessionReady(true);
    }
  }

  async function endSession() {
    try {
      await signOut();
      sessionRequestVersion.current += 1;
      playActionRequestVersion.current += 1;
      authenticatedUserRef.current = undefined;
      playSessionRef.current = null;
      setSignOutError(undefined);
      setSession(null);
      setPlaySession(null);
      setSessionReady(true);
      navigate("/");
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
    }
  }

  if (location.pathname === "/sign-in") {
    return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
  }
  if (location.pathname === "/sign-up") {
    return <AuthPage mode="sign-up" onAuthenticated={authenticated} />;
  }
  if (location.pathname === "/forgot-password") {
    return <ForgotPasswordPage />;
  }
  if (location.pathname === "/reset-password") {
    return (
      <ResetPasswordPage
        token={new URLSearchParams(location.search).get("token") ?? ""}
        onReset={() => {
          sessionRequestVersion.current += 1;
          setSession(null);
          setSessionReady(true);
        }}
      />
    );
  }
  if (location.pathname === "/change-password") {
    if (!sessionReady) return <LoadingState label="Opening account security…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    return <ChangePasswordPage onBack={() => navigate("/")} />;
  }
  if (location.pathname === "/verify-email") {
    return (
      <VerifyEmailPage
        token={new URLSearchParams(location.search).get("token") ?? ""}
        signedIn={Boolean(session)}
        onVerified={refreshSessionAfterVerification}
      />
    );
  }
  if (location.pathname === "/verify-email-pending") {
    if (!sessionReady) return <LoadingState label="Opening your account…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    if (session.emailVerified) {
      return <OnboardingPage session={session} onCompleted={setSession} onSignOut={endSession} signOutError={signOutError} />;
    }
    return <EmailVerificationPendingPage session={session} onSignOut={endSession} signOutError={signOutError} />;
  }
  if (location.pathname === "/onboarding") {
    if (!sessionReady) return <LoadingState label="Opening your account…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    if (!session.emailVerified) {
      return <EmailVerificationPendingPage session={session} onSignOut={endSession} signOutError={signOutError} />;
    }
    return <OnboardingPage session={session} onCompleted={setSession} onSignOut={endSession} signOutError={signOutError} />;
  }
  if (location.pathname === "/play-history") {
    if (!sessionReady) return <LoadingState label="Opening play history…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    if (!session.emailVerified) return <EmailVerificationPendingPage session={session} onSignOut={endSession} signOutError={signOutError} />;
    if (!session.hasChildProfile) return <OnboardingPage session={session} onCompleted={setSession} onSignOut={endSession} signOutError={signOutError} />;
    return <PlayHistoryPage key={session.user.id} onHome={goHome} onReplay={() => navigate("/")} renderWall={(sample, completed) => <MissionWallPreview sample={sample} completedMissions={completed} readOnly />} />;
  }
  if (location.pathname === "/child-profile") {
    if (!sessionReady) return <LoadingState label="Opening the child profile…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    if (!session.emailVerified) {
      return <EmailVerificationPendingPage session={session} onSignOut={endSession} signOutError={signOutError} />;
    }
    if (!session.hasChildProfile) {
      return <OnboardingPage session={session} onCompleted={setSession} onSignOut={endSession} signOutError={signOutError} />;
    }
    return <ChildProfilePage />;
  }

  return (
    <>
      {activeSession ? (
        <ActiveSession
          sample={activeSample ?? selectedSample}
          missionIndex={activeMissionIndex}
          progress={visibleProgress}
          onProgress={detailOrigin === "landing" && canBrowseFullCatalogue ? () => undefined : setProgress}
          onAdvance={advanceSession}
          onPause={() => {
            playActionRequestVersion.current += 1;
            setActiveMissionIndex(null);
          }}
          onComplete={detailOrigin === "landing" && canBrowseFullCatalogue ? completeSignedMission : undefined}
          onSkip={detailOrigin === "landing" && canBrowseFullCatalogue ? skipSignedMission : undefined}
          missionWasReplaced={Boolean(playSession?.missionReplacements.some(({ originalMissionId }) => originalMissionId === playSession.playPath.missions[activeMissionIndex]?.id))}
        />
      ) : (
        <>
          <Header
            screen={selectedSample ? detailOrigin : screen}
            onHome={goHome}
            onGuest={goGuest}
            session={session}
            sessionReady={sessionReady}
            onSignIn={() => navigate("/sign-in")}
            onSignUp={() => navigate("/sign-up")}
            onSignOut={endSession}
            onManageAccount={() => navigate("/change-password")}
            onManageProfile={() => navigate("/child-profile")}
            onHistory={() => navigate("/play-history")}
            onVerifyEmail={() => navigate("/verify-email-pending")}
            signOutError={signOutError}
          />
          <main className="app-shell">
            {loading ? (
              <LoadingState label={selectedId ? "Opening this Play Path…" : "Gathering tonight's sparks…"} />
            ) : error ? (
              <ErrorState onRetry={selectedId ? () => setDetailRetry((value) => value + 1) : loadSamples} />
            ) : selectedSample ? (
              <SampleDetail
                sample={selectedSample}
                progress={visibleProgress}
                onBack={detailOrigin === "guest" ? goGuest : goHome}
                backLabel={detailOrigin === "guest" ? "guest preview" : canBrowseFullCatalogue ? "recommendations" : "quick sparks"}
                authenticated={detailOrigin === "landing" && canBrowseFullCatalogue}
                onStart={startSession}
                activeSession={playSession?.status === "active" && playSession.playPath.id === selectedSample.id}
                onEndSession={playSession?.status === "active" && playSession.playPath.id === selectedSample.id ? endCurrentPlaySession : undefined}
              />
            ) : screen === "guest" ? (
              <GuestPreview
                samples={guestSamples}
                progress={progress}
                onSelect={(sampleId) => openSample(sampleId, "guest")}
                session={session}
                sessionReady={sessionReady}
                onSignUp={() => navigate("/sign-up")}
                onSignIn={() => navigate("/sign-in")}
              />
            ) : canBrowseFullCatalogue ? (
              <DiscoveryDashboard onSelect={(sampleId) => openSample(sampleId, "landing")} />
            ) : (
              <Landing
                samples={landingSamples}
                progress={progress}
                onSelect={(sampleId) => openSample(sampleId, "landing")}
                onGuest={goGuest}
                showNoSignInNeeded={sessionReady && !session}
              />
            )}
          </main>
          <footer><Brand /><p>Screen-free moments designed for real homes · Built for preschool minds ages 3–5.</p></footer>
        </>
      )}
      {!activeSession && sessionReady && !session && progress.completedSampleIds.length >= 2 && !inviteDismissed && (
        <AccountInvitation
          onClose={() => setInviteDismissed(true)}
          onCreate={() => navigate("/sign-up")}
          onSignIn={() => navigate("/sign-in")}
        />
      )}
    </>
  );
}

export default App;
