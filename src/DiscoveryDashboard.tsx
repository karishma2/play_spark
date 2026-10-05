import { useEffect, useState } from "react";
import {
  getRecommendations,
  type RecommendationCard,
  type RecommendationConstraint,
  type RecommendationSelection,
  type RecommendationState,
} from "./api";

const durationChoices = [10, 20, 30] as const;
const energyChoices: Array<{ value: RecommendationState; label: string; detail: string }> = [
  { value: "calm", label: "Calm", detail: "Something gentle" },
  { value: "ready_to_play", label: "Ready", detail: "A balanced activity" },
  { value: "full_energy", label: "Full energy", detail: "Time to move" },
];
const constraintChoices: Array<{ value: RecommendationConstraint; label: string }> = [
  { value: "small_space", label: "Small space" },
  { value: "quiet", label: "Keep it quiet" },
  { value: "low_mess", label: "Low mess" },
  { value: "mostly_independent", label: "Mostly independent" },
];
const themeChoices = [
  { value: "", label: "Any interest" },
  { value: "vehicles", label: "Vehicles" },
  { value: "animals", label: "Animals" },
  { value: "art", label: "Art & colour" },
  { value: "music", label: "Music" },
  { value: "nature", label: "Nature" },
  { value: "stories", label: "Stories" },
];

const initialSelection: RecommendationSelection = {
  availableMinutes: 20,
  currentState: "ready_to_play",
  constraints: [],
};

function effortLabel(value: RecommendationCard["parentEffort"]) {
  if (value === "independent_after_setup") return "Independent after setup";
  if (value === "check_in_occasionally") return "Check in occasionally";
  return "Parent guided";
}

function RecommendationResult({ card, onSelect }: { card: RecommendationCard; onSelect: () => void }) {
  return (
    <article className="recommendation-card">
      <div className="recommendation-image">
        <img src={card.imageUrl} alt={card.imageAlt} />
        <span className={card.matchType === "exact" ? "match-badge" : "match-badge match-fallback"}>
          {card.matchType === "exact" ? "Strong match" : "Best available"}
        </span>
      </div>
      <div className="recommendation-card-body">
        <div className="recommendation-meta">
          <span>◷ {card.durationMinutes} min</span>
          <span>Prep {card.setupMinutes} min</span>
          <span>{effortLabel(card.parentEffort)}</span>
        </div>
        <div>
          <h3>{card.title}</h3>
          <p>{card.summary}</p>
        </div>
        <div className="recommendation-reason">
          <strong>Why this fits</strong>
          <p>{card.explanation}</p>
        </div>
        <div className="recommendation-purpose">
          <strong>What they practise</strong>
          <p>{card.goal}</p>
          <ul>{card.supports.map((support) => <li key={support}>{support}</li>)}</ul>
        </div>
        <p className="recommendation-materials"><strong>You’ll need:</strong> {card.materials.join(", ")}</p>
        <button className="button button-primary" onClick={onSelect}>View Play Path <span aria-hidden="true">→</span></button>
      </div>
    </article>
  );
}

export function DiscoveryDashboard({ onSelect }: { onSelect: (playPathId: string) => void }) {
  const [selection, setSelection] = useState<RecommendationSelection>(initialSelection);
  const [recommendations, setRecommendations] = useState<RecommendationCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(undefined);
    getRecommendations(selection)
      .then(({ recommendations: nextRecommendations }) => {
        if (current) setRecommendations(nextRecommendations);
      })
      .catch(() => {
        if (current) setError("We couldn't find activities right now. Please try again.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [selection, requestVersion]);

  function toggleConstraint(value: RecommendationConstraint) {
    setSelection((current) => ({
      ...current,
      constraints: current.constraints.includes(value)
        ? current.constraints.filter((constraint) => constraint !== value)
        : [...current.constraints, value],
    }));
  }

  return (
    <section className="discovery-page" id="top">
      <div className="discovery-intro">
        <p className="eyebrow">Your Play Spark dashboard</p>
        <h1>What would work well right now?</h1>
        <p>Tell us about this moment. We’ll combine it with the child profile to suggest a few purposeful activities.</p>
      </div>

      <div className="discovery-layout">
        <aside className="recommendation-filter" aria-labelledby="recommendation-filter-title">
          <div>
            <p className="eyebrow">Quick check-in</p>
            <h2 id="recommendation-filter-title">Shape today’s ideas</h2>
          </div>

          <fieldset>
            <legend>How much time do you have?</legend>
            <div className="choice-row">
              {durationChoices.map((minutes) => (
                <button
                  type="button"
                  className={selection.availableMinutes === minutes ? "choice-chip selected" : "choice-chip"}
                  aria-pressed={selection.availableMinutes === minutes}
                  onClick={() => setSelection((current) => ({ ...current, availableMinutes: minutes }))}
                  key={minutes}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>How is your child feeling?</legend>
            <div className="energy-choices">
              {energyChoices.map((choice) => (
                <button
                  type="button"
                  className={selection.currentState === choice.value ? "energy-choice selected" : "energy-choice"}
                  aria-pressed={selection.currentState === choice.value}
                  onClick={() => setSelection((current) => ({ ...current, currentState: choice.value }))}
                  key={choice.value}
                >
                  <strong>{choice.label}</strong>
                  <small>{choice.detail}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>What would make this easier?</legend>
            <div className="constraint-list">
              {constraintChoices.map((choice) => (
                <label key={choice.value}>
                  <input
                    type="checkbox"
                    checked={selection.constraints.includes(choice.value)}
                    onChange={() => toggleConstraint(choice.value)}
                  />
                  <span>{choice.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="theme-field">
            <span>Interest for today <small>Optional</small></span>
            <select
              value={selection.themeKey ?? ""}
              onChange={(event) => setSelection((current) => ({
                ...current,
                themeKey: event.target.value || undefined,
              }))}
            >
              {themeChoices.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}
            </select>
          </label>

          <p className="filter-note">Suggestions refresh automatically. We use the saved child profile and these choices only to rank the available Play Paths.</p>
        </aside>

        <div className="recommendation-results" aria-live="polite">
          <div className="recommendation-heading">
            <div>
              <p className="eyebrow">Picked for this moment</p>
              <h2>Your recommended Play Paths</h2>
            </div>
            {!loading && !error && <span>{recommendations.length} ideas</span>}
          </div>

          {loading ? (
            <div className="recommendation-state" role="status"><span className="spinner" /><p>Finding a good fit…</p></div>
          ) : error ? (
            <div className="recommendation-state state-error" role="alert">
              <h3>Recommendations did not load</h3>
              <p>{error}</p>
              <button className="button button-primary" onClick={() => setRequestVersion((value) => value + 1)}>Try again</button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="recommendation-state">
              <h3>No suitable Play Path is available yet</h3>
              <p>Try another time or energy choice while we add more age-suitable activities.</p>
            </div>
          ) : (
            <div className="recommendation-list">
              {recommendations.map((card) => (
                <RecommendationResult card={card} onSelect={() => onSelect(card.playPathId)} key={card.playPathId} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
