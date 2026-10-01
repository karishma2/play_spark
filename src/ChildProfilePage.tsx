import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  ApiError,
  getChildProfile,
  getProfileOptions,
  updateChildProfile,
  type ChildProfile,
  type ProfileOptions,
} from "./api";
import { birthMonths, ProfileOptionChoices } from "./OnboardingPage";

type ProfileForm = {
  nickname: string;
  birthMonth: string;
  birthYear: string;
  interestKeys: string[];
  playStyleKeys: string[];
};

function formFromProfile(profile: ChildProfile): ProfileForm {
  return {
    nickname: profile.nickname ?? "",
    birthMonth: String(profile.birthMonth),
    birthYear: String(profile.birthYear),
    interestKeys: [...profile.interestKeys],
    playStyleKeys: [...profile.playStyleKeys],
  };
}

export function ChildProfilePage() {
  const [profile, setProfile] = useState<ChildProfile>();
  const [options, setOptions] = useState<ProfileOptions>();
  const [form, setForm] = useState<ProfileForm>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [reloadVersion, setReloadVersion] = useState(0);
  const currentYear = new Date().getFullYear();
  const birthYears = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - 2 - index),
    [currentYear],
  );

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([getChildProfile(), getProfileOptions()])
      .then(([nextProfile, nextOptions]) => {
        if (!current) return;
        setProfile(nextProfile);
        setOptions(nextOptions);
        setForm(formFromProfile(nextProfile));
      })
      .catch(() => { if (current) setLoadError(true); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [reloadVersion]);

  function updateForm<Key extends keyof ProfileForm>(key: Key, value: ProfileForm[Key]) {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggle(key: string, field: "interestKeys" | "playStyleKeys") {
    if (!form) return;
    const values = form[field];
    updateForm(field, values.includes(key) ? values.filter((value) => value !== key) : [...values, key]);
  }

  function beginEditing() {
    if (!profile) return;
    setForm(formFromProfile(profile));
    setMessage(undefined);
    setSuccessMessage(undefined);
    setFieldErrors({});
    setEditing(true);
  }

  function cancelEditing() {
    if (profile) setForm(formFromProfile(profile));
    setMessage(undefined);
    setFieldErrors({});
    setEditing(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    const errors: Record<string, string> = {};
    if (!form.birthMonth) errors.birthMonth = "Choose a birth month.";
    if (!form.birthYear) errors.birthYear = "Choose a birth year.";
    if (form.interestKeys.length === 0) errors.interestKeys = "Choose at least one interest.";
    if (form.playStyleKeys.length === 0) errors.playStyleKeys = "Choose at least one play style.";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setMessage(undefined);
    setSuccessMessage(undefined);
    try {
      const updated = await updateChildProfile({
        nickname: form.nickname.trim(),
        birthMonth: Number(form.birthMonth),
        birthYear: Number(form.birthYear),
        interestKeys: form.interestKeys,
        playStyleKeys: form.playStyleKeys,
      });
      setProfile(updated);
      setForm(formFromProfile(updated));
      setEditing(false);
      setSuccessMessage("Child profile updated. Future activity suggestions will use these choices.");
    } catch (error) {
      if (error instanceof ApiError) {
        setMessage(error.message);
        setFieldErrors(error.fieldErrors ?? {});
      } else {
        setMessage("We couldn't update the child profile. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="onboarding-page"><section className="onboarding-card state-card" role="status"><div className="spinner" /><h1>Opening the child profile…</h1></section></main>;
  }

  if (loadError || !profile || !options || !form) {
    return (
      <main className="onboarding-page onboarding-complete">
        <section className="onboarding-card state-card" role="alert">
          <span className="state-icon" aria-hidden="true">!</span>
          <h1>The child profile did not load.</h1>
          <p>Please try again. Your saved profile has not been changed.</p>
          <button className="button button-primary" onClick={() => setReloadVersion((value) => value + 1)}>Try again</button>
          <Link className="text-button" to="/">Back to activities</Link>
        </section>
      </main>
    );
  }

  const interestLabels = options.interests.filter(({ key }) => profile.interestKeys.includes(key)).map(({ label }) => label);
  const playStyleLabels = options.playStyles.filter(({ key }) => profile.playStyleKeys.includes(key)).map(({ label }) => label);

  return (
    <main className="onboarding-page profile-page">
      <section className="onboarding-card" aria-labelledby="child-profile-title">
        <Link className="brand onboarding-brand" to="/" aria-label="Play Spark home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <span><strong>Play Spark</strong><small>Mindful Screen-Free Play</small></span>
        </Link>
        {successMessage && <div className="profile-success" role="status">{successMessage}</div>}
        {editing ? (
          <form className="onboarding-step" onSubmit={submit} noValidate>
            <p className="eyebrow">Edit child profile</p>
            <h1 id="child-profile-title">Keep their play ideas a good fit.</h1>
            <p>Update the details that shape future recommendations.</p>
            {message && <div className="auth-error" role="alert">{message}</div>}
            <label>
              <span>Nickname <small>Optional</small></span>
              <input maxLength={40} value={form.nickname} onChange={(event) => updateForm("nickname", event.target.value)} autoComplete="off" aria-invalid={Boolean(fieldErrors.nickname)} />
              {fieldErrors.nickname && <small className="onboarding-field-error">{fieldErrors.nickname}</small>}
            </label>
            <div className="birth-fields">
              <label>
                <span>Birth month</span>
                <select value={form.birthMonth} onChange={(event) => updateForm("birthMonth", event.target.value)} aria-invalid={Boolean(fieldErrors.birthMonth)}>
                  <option value="">Choose month</option>
                  {birthMonths.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
                </select>
                {fieldErrors.birthMonth && <small className="onboarding-field-error">{fieldErrors.birthMonth}</small>}
              </label>
              <label>
                <span>Birth year</span>
                <select value={form.birthYear} onChange={(event) => updateForm("birthYear", event.target.value)} aria-invalid={Boolean(fieldErrors.birthYear)}>
                  <option value="">Choose year</option>
                  {birthYears.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
                {fieldErrors.birthYear && <small className="onboarding-field-error">{fieldErrors.birthYear}</small>}
              </label>
            </div>
            <ProfileOptionChoices legend="Interests" hint="Choose one or more current interests." options={options.interests} selected={form.interestKeys} onToggle={(key) => toggle(key, "interestKeys")} error={fieldErrors.interestKeys} />
            <ProfileOptionChoices legend="Play styles" hint="Choose one or more styles that fit most days." options={options.playStyles} selected={form.playStyleKeys} onToggle={(key) => toggle(key, "playStyleKeys")} error={fieldErrors.playStyleKeys} />
            <p className="privacy-note">These changes affect future recommendations. Completed activities and past play remain unchanged.</p>
            <div className="onboarding-actions">
              <button type="button" className="button button-soft" onClick={cancelEditing} disabled={submitting}>Cancel</button>
              <button className="button button-primary" disabled={submitting}>{submitting ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        ) : (
          <div className="onboarding-step">
            <p className="eyebrow">Child profile</p>
            <h1 id="child-profile-title">The details behind better-fit play.</h1>
            <p>Review what Play Spark uses to choose future activity suggestions.</p>
            <dl className="profile-review">
              <div><dt>Nickname</dt><dd>{profile.nickname ?? "Not added"}</dd></div>
              <div><dt>Birth month and year</dt><dd>{birthMonths[profile.birthMonth - 1]} {profile.birthYear}</dd></div>
              <div><dt>Interests</dt><dd>{interestLabels.join(", ")}</dd></div>
              <div><dt>Play styles</dt><dd>{playStyleLabels.join(", ")}</dd></div>
            </dl>
            <p className="privacy-note">Only your signed-in parent account can access and update this profile.</p>
            <div className="onboarding-actions profile-page-actions">
              <Link className="button button-soft" to="/">Back to activities</Link>
              <button className="button button-primary" onClick={beginEditing}>Edit profile</button>
            </div>
          </div>
        )}
      </section>
      <aside className="onboarding-aside" aria-label="Recommendation information">
        <span aria-hidden="true">✦</span>
        <h2>Children change.<br />Their play can too.</h2>
        <p>Refresh these choices as interests grow so upcoming ideas continue to feel useful at home.</p>
      </aside>
    </main>
  );
}
