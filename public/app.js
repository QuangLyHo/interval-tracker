async function init() {
  await renderFitnessChart();
  await renderZonesChart();
  await renderInsight();
}

async function renderFitnessChart() {
  const data = await fetchJSON('/api/fitness');

  const labels = data.map(d => d.date)
  const ctl = data.map(c => c.ctl = Math.round(c.ctl * 10) / 10)
  const atl = data.map(a => a.atl = Math.round(a.atl * 10) / 10)
  const tsb = data.map(t => t.tsb = Math.round(t.tsb * 10) / 10)
  const last = data[data.length - 1]

  const ctlE1 = document.getElementById('stat-ctl')
  const atlE1 = document.getElementById('stat-atl')
  const tsbE1 = document.getElementById('stat-tsb')
  ctlE1.textContent = last.ctl
  atlE1.textContent = last.atl
  tsbE1.textContent = last.tsb
  tsbE1.style.color = last.tsb >= 0 ? "#4ade80" : "#f87171"

  
  const canvasElement = document.getElementById('fitness-chart');

  new Chart(canvasElement, {
    type: 'line',
    data: {
      labels: labels, // date strings
      datasets: [
        {
          label: "CTL (Fitness)",
          data: ctl,
          borderColor: '#60a5fa',
          tension: 0.3,
          pointRadius: 0,
        },        {
          label: "ATL (Fatigue)",
          data: atl,
          borderColor: '#f87171',
          tension: 0.3,
          pointRadius: 0,
        },
        {
          label: "TSB (Form)",
          data: tsb,
          borderColor: '#4ade80',
          tension: 0.3,
          pointRadius: 0,
        }
      ]
    }
  })

}

async function renderZonesChart() {
  const data = await fetchJSON('/api/zones')

  const barChart = document.getElementById('zones-chart')
  new Chart(barChart, {
    type: 'bar',
    data: {
      labels: data.map(z => `Z${z.zone} ${z.name}`),
      datasets: [{
        data: data.map(z => z.minutes),
        backgroundColor: data.map(z => z.color)
      }]
    },
    options: {
      scales: {
        y: {
          title: {
            display: true,
            align: 'center',
            text: 'Minutes'
          }
        }
      }
    }
  })
}


async function renderInsight() {
  const data = await fetchJSON('/api/insight')
  document.getElementById('insight-text').innerHTML = marked.parse(data.insight);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Request failed: ${url}`);
  return res.json();
}


init();
