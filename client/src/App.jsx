import { useEffect, useState } from 'react';

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const tone = (score) => (score >= 80 ? 'good' : score >= 60 ? 'mid' : 'low');

function ScoreMeter({ score }) {
  return (
    <div className={`meter ${tone(score)}`}>
      <div className="meter-number">
        {score}
        <span>/100</span>
      </div>
      <div className="meter-track" role="img" aria-label={`Score ${score} out of 100`}>
        <div className="meter-fill" style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function Results({ analysis, role }) {
  return (
    <section className="panel">
      <h2>Your resume for {role}</h2>
      <ScoreMeter score={analysis.score} />
      <p className="summary">{analysis.summary}</p>

      {analysis.isPerfect ? (
        <div className="perfect">
          <strong>Perfect resume.</strong> Nothing to fix for this role. Go apply.
        </div>
      ) : (
        <>
          <h3>What to improve</h3>
          <ol className="fixes">
            {analysis.improvements.map((item, i) => (
              <li key={i}>
                <h4>{item.area}</h4>
                <p className="issue">{item.issue}</p>
                <p className="fix">{item.fix}</p>
              </li>
            ))}
          </ol>
        </>
      )}

      {analysis.strengths.length > 0 && (
        <>
          <h3>What already works</h3>
          <ul className="plain">
            {analysis.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </>
      )}

      {analysis.missingKeywords.length > 0 && (
        <>
          <h3>Keywords to consider adding</h3>
          <div className="chips">
            {analysis.missingKeywords.map((k) => (
              <span className="chip missing" key={k}>
                {k}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Jobs({ state }) {
  if (state.status === 'loading') return <section className="panel"><h2>Matching jobs</h2><p className="muted">Searching job boards…</p></section>;
  if (state.status === 'error') return <section className="panel"><h2>Matching jobs</h2><p className="error">{state.error}</p></section>;
  if (state.status !== 'done') return null;

  return (
    <section className="panel">
      <h2>Matching jobs</h2>
      {state.failedSources.length > 0 && (
        <p className="muted">Could not reach: {state.failedSources.join(', ')}.</p>
      )}
      {state.jobs.length === 0 ? (
        <p className="muted">No matching openings found right now. Try a broader role title.</p>
      ) : (
        <ul className="jobs">
          {state.jobs.map((job) => (
            <li key={job.url}>
              <div className="job-head">
                <a href={job.url} target="_blank" rel="noreferrer">
                  {job.title}
                </a>
                <span className="match">{job.matchPercent}% match</span>
              </div>
              <p className="job-meta">
                {job.company} · {job.location || 'Location not listed'} · via {job.source}
              </p>
              {job.matchedSkills.length > 0 && (
                <div className="chips">
                  {job.matchedSkills.slice(0, 6).map((s) => (
                    <span className="chip" key={s}>
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function App() {
  const [file, setFile] = useState(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('idle'); // idle | analyzing | done
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [analyzedRole, setAnalyzedRole] = useState('');
  const [jobs, setJobs] = useState({ status: 'idle', jobs: [], failedSources: [], error: '' });
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api('/api/health').then(setHealth).catch(() => setHealth({ ollama: false }));
  }, []);

  async function loadJobs(result, targetRole) {
    setJobs({ status: 'loading', jobs: [], failedSources: [], error: '' });
    try {
      const data = await api('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: targetRole,
          skills: result.skills,
          keywords: result.searchKeywords
        })
      });
      setJobs({ status: 'done', jobs: data.jobs, failedSources: data.failedSources, error: '' });
    } catch (err) {
      setJobs({ status: 'error', jobs: [], failedSources: [], error: err.message });
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!file || !role.trim()) return;
    setError('');
    setStatus('analyzing');
    setAnalysis(null);
    setJobs({ status: 'idle', jobs: [], failedSources: [], error: '' });

    const form = new FormData();
    form.append('resume', file);
    form.append('role', role.trim());

    try {
      const { analysis: result } = await api('/api/analyze', { method: 'POST', body: form });
      setAnalysis(result);
      setAnalyzedRole(role.trim());
      setStatus('done');
      loadJobs(result, role.trim());
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  }

  const busy = status === 'analyzing';
  const healthIssue =
    health && !health.ollama
      ? 'Ollama is not reachable. Start it with "ollama serve".'
      : health && !health.modelInstalled
        ? `Model "${health.model}" is not installed. Run "ollama pull ${health.model}".`
        : '';

  return (
    <main className="shell">
      <header className="masthead">
        <h1>MatchForge</h1>
        <p>Upload your resume, name the role, and get a score, fixes and openings that fit.</p>
      </header>

      {healthIssue && <p className="banner">{healthIssue}</p>}

      <form className="panel form" onSubmit={onSubmit}>
        <label className="field">
          <span>Resume (PDF, DOCX or TXT, up to 5 MB)</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={(e) => setFile(e.target.files[0] || null)}
            disabled={busy}
          />
        </label>
        <label className="field">
          <span>Role you are applying for</span>
          <input
            type="text"
            value={role}
            placeholder="e.g. Frontend Developer"
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
          />
        </label>
        <button type="submit" disabled={busy || !file || !role.trim()}>
          {busy ? 'Reading your resume…' : 'Analyse resume'}
        </button>
        {busy && <p className="muted">A local model is working, this can take up to a minute.</p>}
        {error && <p className="error">{error}</p>}
      </form>

      {analysis && <Results analysis={analysis} role={analyzedRole} />}
      {analysis && <Jobs state={jobs} />}
    </main>
  );
}
