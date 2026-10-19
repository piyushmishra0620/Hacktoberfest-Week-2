// Job sources: Remotive + Arbeitnow (no API key), Adzuna (optional key)

const strip = (html = '') =>
  html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&amp;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'MatchForge/1.0' } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

async function fromRemotive(queries) {
  const results = await Promise.all(
    queries.map((q) =>
      getJson(`https://remotive.com/api/remote-jobs?limit=25&search=${encodeURIComponent(q)}`).then(
        (d) => d.jobs || []
      )
    )
  );
  return results.flat().map((j) => ({
    source: 'Remotive',
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location || 'Remote',
    url: j.url,
    posted: j.publication_date,
    description: strip(j.description).slice(0, 3000),
    tags: j.tags || []
  }));
}

async function fromArbeitnow() {
  const d = await getJson('https://www.arbeitnow.com/api/job-board-api');
  return (d.data || []).map((j) => ({
    source: 'Arbeitnow',
    title: j.title,
    company: j.company_name,
    location: j.remote ? `${j.location} (Remote)` : j.location,
    url: j.url,
    posted: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
    description: strip(j.description).slice(0, 3000),
    tags: j.tags || []
  }));
}

async function fromAdzuna(query) {
  const { ADZUNA_APP_ID, ADZUNA_APP_KEY, ADZUNA_COUNTRY = 'in' } = process.env;
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];
  const url =
    `https://api.adzuna.com/v1/api/jobs/${ADZUNA_COUNTRY}/search/1` +
    `?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=25` +
    `&what=${encodeURIComponent(query)}`;
  const d = await getJson(url);
  return (d.results || []).map((j) => ({
    source: 'Adzuna',
    title: j.title,
    company: j.company?.display_name || 'Unknown',
    location: j.location?.display_name || '',
    url: j.redirect_url,
    posted: j.created,
    description: strip(j.description),
    tags: []
  }));
}

function rank(jobs, role, skills) {
  const roleWords = role.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const skillList = skills.map((s) => s.toLowerCase());
  const denom = Math.max(1, Math.min(skillList.length, 10));

  return jobs
    .map((job) => {
      const hay = `${job.title} ${job.tags.join(' ')} ${job.description}`.toLowerCase();
      const title = job.title.toLowerCase();
      const matchedSkills = skills.filter((s) => hay.includes(s.toLowerCase()));
      const titleHits = roleWords.filter((w) => title.includes(w)).length;
      const titleScore = roleWords.length ? titleHits / roleWords.length : 0;
      const skillScore = Math.min(1, matchedSkills.length / denom);
      return {
        ...job,
        matchedSkills,
        matchPercent: Math.round((0.6 * skillScore + 0.4 * titleScore) * 100)
      };
    })
    .filter((j) => j.matchPercent > 0)
    .sort((a, b) => b.matchPercent - a.matchPercent);
}

async function findJobs({ role, skills = [], keywords = [] }) {
  const queries = [role, ...keywords.slice(0, 2)].filter(Boolean);

  const settled = await Promise.allSettled([
    fromRemotive(queries),
    fromArbeitnow(),
    fromAdzuna(role)
  ]);
  const sources = ['Remotive', 'Arbeitnow', 'Adzuna'];
  const failed = settled.map((r, i) => (r.status === 'rejected' ? sources[i] : null)).filter(Boolean);

  const all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  const seen = new Set();
  const unique = all.filter((j) => j.url && !seen.has(j.url) && seen.add(j.url));

  return { jobs: rank(unique, role, skills).slice(0, 15), failedSources: failed };
}

module.exports = { findJobs };
