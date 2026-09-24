import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuthSession, getGuestSample, getGuestSamples, signOut, type AuthSession } from "./api";
import { AuthPage, OnboardingBoundary } from "./AuthPage";
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

type DurationFilter = "all" | 15 | 20;
type ExploreScreen = "landing" | "guest";
type DetailOrigin = ExploreScreen;

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

function Landing({
  samples,
  progress,
  onSelect,
  onGuest,
}: {
  samples: GuestSampleSummary[];
  progress: GuestProgress;
  onSelect: (sampleId: string) => void;
  onGuest: () => void;
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
            <span className="quiet-copy">No sign-in needed</span>
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
            <h2>Tonight's quick sparks — under 20 minutes</h2>
          </div>
          <div className="filters" aria-label="Filter by duration">
            {(["all", 15, 20] as DurationFilter[]).map((value) => (
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
        <p>Try two ready-made activity plans. Each one helps your child play independently while you stay close by.</p>
        <span className="guest-preview-badge"><span aria-hidden="true">✦</span> {!sessionReady
          ? "Checking your account…"
          : session
          ? `Signed in as ${session.user.email}`
          : "Try both sample paths — no account needed."}</span>
      </header>

      <div className="guest-preview-heading">
        <div>
          <span className="guest-preview-label"><span aria-hidden="true" /> {!sessionReady
            ? "Sample activities · Two ready-to-play paths"
            : session
            ? "Sample activities · Two ready-to-play paths"
            : "Guest preview · Two free samples"}</span>
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
            : "No account or credit card needed to try these two sample paths right now."}</p>
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
}: {
  sample: GuestSample;
  completedMissions: string[];
  highlightedMissionIndex?: number;
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
        ) : (
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
        )}
      </svg>
      <strong>{revealedCount} of {sample.missions.length} scene elements revealed</strong>
      <ol className="mission-wall-key">
        {sceneLabels.map((label, index) => (
          <li className={`${revealed[index] ? "revealed" : ""}${highlightedMissionIndex === index ? " newly-revealed" : ""}`} key={label}>
            <span>{revealed[index] ? "✓" : index + 1}</span>
            <div><b>{label}</b><small>{revealed[index] ? "Revealed" : `Complete mission ${index + 1}`}</small></div>
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
  onStart,
}: {
  sample: GuestSample;
  progress: GuestProgress;
  onBack: () => void;
  backLabel: string;
  onStart: () => void;
}) {
  const completedMissions = progress.completedMissions[sample.id] ?? [];

  return (
    <section className="path-overview-page">
      <div className="path-overview-toolbar">
        <button className="back-button" onClick={onBack}>← Back to {backLabel}</button>
        <span>Guest preview</span>
      </div>

      <div className="path-overview-hero">
        <div>
          <div className="path-overview-tags"><span>Ages 3–5</span><span>♡ Step-by-step play</span></div>
          <p className="eyebrow">Guest Play Path</p>
          <h1>{sample.title}</h1>
          <p className="path-overview-summary">{sample.summary}</p>
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
        <button className="button button-primary" onClick={onStart}>Start Play Path <span aria-hidden="true">→</span></button>
        <p>The next screen gives you one mission at a time, so you can put your phone down and play.</p>
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
}: {
  sample: GuestSample;
  missionIndex: number;
  progress: GuestProgress;
  onProgress: (progress: GuestProgress) => void;
  onAdvance: (progress: GuestProgress) => void;
  onPause: () => void;
}) {
  const [showReveal, setShowReveal] = useState(false);
  const mission = sample.missions[missionIndex];
  const nextMission = sample.missions[missionIndex + 1];
  const completed = progress.completedMissions[sample.id] ?? [];
  const percent = ((missionIndex + 1) / sample.missions.length) * 100;

  function completeMission() {
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
          <p className="active-mission-prompt">{mission.childChallenge}</p>
          <div className="active-guidance">
            <span aria-hidden="true">✦</span>
            <div><strong>Gentle guidance</strong><p>{mission.setupSteps.join(" ")}</p></div>
          </div>
          <div className="active-materials">
            <span aria-hidden="true">▣</span>
            <div><small>Using right now</small><strong>{sample.materials.join(", ")}</strong></div>
            <span>✓ Zero screen required</span>
          </div>
        </article>

        <aside className="phone-down-card">
          <span aria-hidden="true">▱</span>
          <div><h2>Put your phone face-down <small>Sanctuary</small></h2><p>You don’t need this screen while playing. Step back, follow your child’s lead, and come back when this mission feels complete.</p></div>
        </aside>

        <details className="spark-prompts" open>
          <summary><span>“</span><div><strong>If you need a spark</strong><small>Simple words to keep the play moving</small></div></summary>
          <div className="spark-prompt-list"><p>“{mission.sayThis}”</p><p>{mission.tidyUp}</p></div>
        </details>

        <div className="active-session-quiet"><span>● Screen paused · Presence first</span><button onClick={onPause}>Switch mission or pause</button></div>
      </main>
      <div className="active-session-action">
        <button className="button button-primary" onClick={completeMission}>{nextMission ? `Complete Mission ${missionIndex + 1}` : "Complete Play Path"} →</button>
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
  const [sessionReady, setSessionReady] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  const sessionRequestVersion = useRef(0);
  const previousPath = useRef(location.pathname);

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

    let current = true;
    setLoading(true);
    setError(false);
    getGuestSample(selectedId)
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
  }, [selectedId, detailRetry]);

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

  function startSession() {
    if (!selectedSample) return;
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

  function authenticated(nextSession: AuthSession) {
    sessionRequestVersion.current += 1;
    setSignOutError(undefined);
    setSession(nextSession);
    setSessionReady(true);
    navigate(nextSession.hasChildProfile ? "/" : "/onboarding");
  }

  async function endSession() {
    try {
      await signOut();
      sessionRequestVersion.current += 1;
      setSignOutError(undefined);
      setSession(null);
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
  if (location.pathname === "/onboarding") {
    if (!sessionReady) return <LoadingState label="Opening your account…" />;
    if (!session) return <AuthPage mode="sign-in" onAuthenticated={authenticated} />;
    return <OnboardingBoundary session={session} onSignOut={endSession} signOutError={signOutError} />;
  }

  return (
    <>
      {activeSession ? (
        <ActiveSession
          sample={selectedSample}
          missionIndex={activeMissionIndex}
          progress={progress}
          onProgress={setProgress}
          onAdvance={advanceSession}
          onPause={() => setActiveMissionIndex(null)}
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
                progress={progress}
                onBack={detailOrigin === "guest" ? goGuest : goHome}
                backLabel={detailOrigin === "guest" ? "guest preview" : "quick sparks"}
                onStart={startSession}
              />
            ) : screen === "guest" ? (
              <GuestPreview
                samples={samples}
                progress={progress}
                onSelect={(sampleId) => openSample(sampleId, "guest")}
                session={session}
                sessionReady={sessionReady}
                onSignUp={() => navigate("/sign-up")}
                onSignIn={() => navigate("/sign-in")}
              />
            ) : (
              <Landing
                samples={samples}
                progress={progress}
                onSelect={(sampleId) => openSample(sampleId, "landing")}
                onGuest={goGuest}
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
