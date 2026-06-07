// app.js — fetches data from Express server and renders the dashboard

async function init() {
  await renderFitnessChart();
  await renderZonesChart();
  await renderInsight();
}

// ── 1. Fitness chart (CTL / ATL / TSB) ────────────────────────────────
async function renderFitnessChart() {
  const data   = await fetchJSON('/api/fitness');
  const labels = data.map(d => d.date);
  const ctl    = data.map(c => Math.round(c.ctl * 10) / 10);
  const atl    = data.map(a => Math.round(a.atl * 10) / 10);
  const tsb    = data.map(t => Math.round(t.tsb * 10) / 10);
  const last   = data[data.length - 1];

  // Update stat chips
  document.getElementById('stat-ctl').textContent = Math.round(last.ctl * 10) / 10;
  document.getElementById('stat-atl').textContent = Math.round(last.atl * 10) / 10;
  const tsbEl = document.getElementById('stat-tsb');
  tsbEl.textContent  = Math.round(last.tsb * 10) / 10;
  tsbEl.style.color  = last.tsb >= 0 ? '#4ade80' : '#f87171';

  new Chart(document.getElementById('fitness-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'CTL (Fitness)',
          data: ctl,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,0.08)',
          fill: true,
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'ATL (Fatigue)',
          data: atl,
          borderColor: '#f87171',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: 'TSB (Form)',
          data: tsb,
          borderColor: '#4ade80',
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: chartOptions(),
  });
}

// ── 2. Power zones bar chart ───────────────────────────────────────────
async function renderZonesChart() {
  const data = await fetchJSON('/api/zones');

  new Chart(document.getElementById('zones-chart'), {
    type: 'bar',
    data: {
      labels: data.map(z => `Z${z.zone}`),
      datasets: [{
        label: 'Minutes',
        data: data.map(z => z.minutes),
        backgroundColor: data.map(z => z.color),
        borderRadius: 6,
        borderSkipped: false,
      }],
    },
    options: {
      ...chartOptions('Minutes'),
      plugins: {
        ...chartOptions().plugins,
        tooltip: {
          callbacks: {
            title: (items) => data[items[0].dataIndex].name,
            label: (item)  => ` ${item.raw} min`,
          },
        },
      },
    },
  });
}

// ── 3. AI insight ──────────────────────────────────────────────────────
async function renderInsight() {
  const el = document.getElementById('insight-text');
  try {
    const { insight } = await fetchJSON('/api/insight');
    el.innerHTML = marked.parse(insight);
  } catch {
    el.textContent = 'Could not load insight.';
  }
}

// ── Helpers ────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}

function chartOptions(yLabel = '') {
  return {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: '#475569',
          boxWidth: 10,
          boxHeight: 10,
          borderRadius: 3,
          useBorderRadius: true,
          font: { size: 11, family: 'Inter' },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#334155',
          maxTicksLimit: 8,
          font: { size: 11, family: 'Inter' },
        },
        grid:   { color: 'rgba(255,255,255,0.03)' },
        border: { color: 'transparent' },
      },
      y: {
        title: {
          display: !!yLabel,
          text: yLabel,
          color: '#475569',
          font: { size: 11, family: 'Inter' },
        },
        ticks: {
          color: '#334155',
          font: { size: 11, family: 'Inter' },
        },
        grid:   { color: 'rgba(255,255,255,0.04)' },
        border: { color: 'transparent' },
      },
    },
  };
}

init();
