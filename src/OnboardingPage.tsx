import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  createChildProfile,
  getAuthSession,
  getProfileOptions,
  type AuthSession,
  type ProfileOption,
  type ProfileOptions,
} from "./api";

export const birthMonths = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function ProfileOptionChoices({
  legend,
  hint,
  options,
  selected,
  onToggle,
  error,
}: {
  legend: string;
  hint: string;
  options: ProfileOption[];
  selected: string[];
  onToggle: (key: string) => void;
  error?: string;
}) {
  const errorId = `${legend.toLowerCase().replace(/\s+/gu, "-")}-error`;
  return (
    <fieldset className="onboarding-options" aria-describedby={error ? errorId : undefined}>
      <legend>{legend}</legend>
      <p>{hint}</p>
      <div className="option-grid">
        {options.map((option) => {
          const active = selected.includes(option.key);
          return (
            <button
              key={option.key}
              type="button"
              className={active ? "option-card selected" : "option-card"}
              aria-pressed={active}
              onClick={() => onToggle(option.key)}
            >
              <span aria-hidden="true">{active ? "✓" : "✦"}</span>
              {option.label}
            </button>
          );
        })}
      </div>
      {error && <small id={errorId} className="onboarding-field-error">{error}</small>}
    </fieldset>
  );
}

export function OnboardingPage({
  session,
  onCompleted,
  onSignOut,
  signOutError,
}: {
  session: AuthSession;
  onCompleted: (session: AuthSession) => void;
  onSignOut: () => void;
  signOutError?: string;
}) {
  const [step, setStep] = useState(1);
  const [options, setOptions] = useState<ProfileOptions>();
  const [loadingOptions, setLoadingOptions] = useState(!session.hasChildProfile);
  const [loadError, setLoadError] = useState(false);
  const [nickname, setNickname] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [interestKeys, setInterestKeys] = useState<string[]>([]);
  const [playStyleKeys, setPlayStyleKeys] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const currentYear = new Date().getFullYear();
  const birthYears = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - 2 - index),
    [currentYear],
  );

  useEffect(() => {
    if (session.hasChildProfile) return;
    let current = true;
    setLoadingOptions(true);
    setLoadError(false);
    getProfileOptions()
      .then((value) => { if (current) setOptions(value); })
      .catch(() => { if (current) setLoadError(true); })
      .finally(() => { if (current) setLoadingOptions(false); });
    return () => { current = false; };
  }, [session.hasChildProfile]);

  function toggle(key: string, values: string[], update: (next: string[]) => void) {
    update(values.includes(key) ? values.filter((value) => value !== key) : [...values, key]);
  }

  function nextStep() {
    setMessage(undefined);
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (!birthMonth) errors.birthMonth = "Choose a birth month.";
      if (!birthYear) errors.birthYear = "Choose a birth year.";
    }
    if (step === 2 && interestKeys.length === 0) errors.interestKeys = "Choose at least one interest.";
    if (step === 3 && playStyleKeys.length === 0) errors.playStyleKeys = "Choose at least one play style.";
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) setStep((value) => Math.min(4, value + 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }
    setSubmitting(true);
    setMessage(undefined);
    setFieldErrors({});
    try {
      await createChildProfile({
        ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        birthMonth: Number(birthMonth),
        birthYear: Number(birthYear),
        interestKeys,
        playStyleKeys,
      });
      const refreshed = await getAuthSession();
      onCompleted(refreshed);
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
        if (error.fieldErrors?.birthMonth || error.fieldErrors?.birthYear) setStep(1);
        else if (error.fieldErrors?.interestKeys) setStep(2);
        else if (error.fieldErrors?.playStyleKeys) setStep(3);
      } else {
        setMessage("We couldn't save the child profile. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (session.hasChildProfile) {
    return (
      <main className="onboarding-page onboarding-complete">
        <section className="onboarding-card" aria-labelledby="onboarding-complete-title">
          <span className="onboarding-complete-mark" aria-hidden="true">✓</span>
          <p className="eyebrow">Profile ready</p>
          <h1 id="onboarding-complete-title">You’re ready for more personal play ideas.</h1>
          <p>Your child’s profile is saved securely and will shape recommendations in the next phase.</p>
          <Link className="button button-primary" to="/">Explore activities</Link>
          {signOutError && <div className="auth-error" role="alert">{signOutError}</div>}
          <button className="text-button" onClick={onSignOut}>Sign out</button>
        </section>
      </main>
    );
  }

  if (loadingOptions) {
    return <main className="onboarding-page"><section className="onboarding-card state-card" role="status"><div className="spinner" /><h1>Preparing profile choices…</h1></section></main>;
  }

  if (loadError || !options) {
    return (
      <main className="onboarding-page">
        <section className="onboarding-card state-card" role="alert">
          <span className="state-icon" aria-hidden="true">!</span>
          <h1>Profile setup is taking a pause.</h1>
          <p>Please refresh the page and try again.</p>
        </section>
      </main>
    );
  }

  const interestLabels = options.interests.filter(({ key }) => interestKeys.includes(key)).map(({ label }) => label);
  const playStyleLabels = options.playStyles.filter(({ key }) => playStyleKeys.includes(key)).map(({ label }) => label);

  return (
    <main className="onboarding-page">
      <section className="onboarding-card" aria-labelledby="onboarding-title">
        <Link className="brand onboarding-brand" to="/" aria-label="Play Spark home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Play Spark</strong><small>Mindful Screen-Free Play</small></span>
        </Link>
        <div className="onboarding-progress" aria-label={`Step ${step} of 4`}>
          <span>Child profile</span><strong>Step {step} of 4</strong>
          <div><i style={{ width: `${step * 25}%` }} /></div>
        </div>
        <form onSubmit={submit} noValidate>
          {message && <div className="auth-error" role="alert">{message}</div>}
          {step === 1 && (
            <div className="onboarding-step">
              <p className="eyebrow">A little about your child</p>
              <h1 id="onboarding-title">Help us choose ideas that fit.</h1>
              <p>We only collect what we need. A full birth date is never requested.</p>
              <label>
                <span>Nickname <small>Optional</small></span>
                <input
                  maxLength={40}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.nickname)}
                />
                {fieldErrors.nickname && <small className="onboarding-field-error">{fieldErrors.nickname}</small>}
              </label>
              <div className="birth-fields">
                <label>
                  <span>Birth month</span>
                  <select value={birthMonth} onChange={(event) => setBirthMonth(event.target.value)} aria-invalid={Boolean(fieldErrors.birthMonth)}>
                    <option value="">Choose month</option>
                    {birthMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                  </select>
                  {fieldErrors.birthMonth && <small className="onboarding-field-error">{fieldErrors.birthMonth}</small>}
                </label>
                <label>
                  <span>Birth year</span>
                  <select value={birthYear} onChange={(event) => setBirthYear(event.target.value)} aria-invalid={Boolean(fieldErrors.birthYear)}>
                    <option value="">Choose year</option>
                    {birthYears.map((year) => <option key={year} value={year}>{year}</option>)}
                  </select>
                  {fieldErrors.birthYear && <small className="onboarding-field-error">{fieldErrors.birthYear}</small>}
                </label>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="onboarding-step">
              <p className="eyebrow">Their favourite things</p>
              <h1 id="onboarding-title">What lights them up?</h1>
              <ProfileOptionChoices legend="Interests" hint="Choose one or more. You can change these later." options={options.interests} selected={interestKeys} onToggle={(key) => toggle(key, interestKeys, setInterestKeys)} error={fieldErrors.interestKeys} />
            </div>
          )}
          {step === 3 && (
            <div className="onboarding-step">
              <p className="eyebrow">How they like to play</p>
              <h1 id="onboarding-title">Which kinds of play feel natural?</h1>
              <ProfileOptionChoices legend="Play styles" hint="Choose one or more styles that fit most days." options={options.playStyles} selected={playStyleKeys} onToggle={(key) => toggle(key, playStyleKeys, setPlayStyleKeys)} error={fieldErrors.playStyleKeys} />
            </div>
          )}
          {step === 4 && (
            <div className="onboarding-step">
              <p className="eyebrow">Ready to save</p>
              <h1 id="onboarding-title">Does this look right?</h1>
              <dl className="profile-review">
                <div><dt>Nickname</dt><dd>{nickname.trim() || "Not added"}</dd></div>
                <div><dt>Birth month and year</dt><dd>{birthMonths[Number(birthMonth) - 1]} {birthYear}</dd></div>
                <div><dt>Interests</dt><dd>{interestLabels.join(", ")}</dd></div>
                <div><dt>Play styles</dt><dd>{playStyleLabels.join(", ")}</dd></div>
              </dl>
              <p className="privacy-note">Only your signed-in parent account can access this profile.</p>
            </div>
          )}
          <div className="onboarding-actions">
            {step > 1 && <button type="button" className="button button-soft" onClick={() => setStep((value) => value - 1)} disabled={submitting}>Back</button>}
            <button className="button button-primary" disabled={submitting}>
              {submitting ? "Saving…" : step === 4 ? "Save child profile" : "Continue"}
            </button>
          </div>
        </form>
      </section>
      <aside className="onboarding-aside" aria-label="Privacy information">
        <span aria-hidden="true">✦</span>
        <h2>Small details.<br />Better-fit play.</h2>
        <p>We use these choices to recommend screen-free activities—not to build an advertising profile.</p>
      </aside>
    </main>
  );
}
