// Mock Data until we setup API for real stats
export function generateFitnessData() {
  const days = [];
  const today = new Date();

  let ctl = 45; // starting fitness
  let atl = 50; // starting fatigue

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    // Simulate a training block: build load, then taper
    const week = Math.floor((89 - i) / 7);
    const isRestWeek = week % 4 === 3; // every 4th week is recovery
    const dailyTSS = isRestWeek
      ? Math.random() * 40 + 10          // rest week: low load
      : Math.random() * 80 + 40;          // build week: higher load

    // CTL = 42-day exponential weighted average of TSS
    ctl = ctl + (dailyTSS - ctl) / 42;
    // ATL = 7-day exponential weighted average of TSS
    atl = atl + (dailyTSS - atl) / 7;

    days.push({
      date: date.toISOString().split('T')[0],
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,  // form = fitness - fatigue
    });
  }

  return days;
}

// Power zone distribution (seconds in each zone) for the last 4 weeks
export const powerZones = [
  { zone: 1, name: 'Active Recovery', minutes: 320, color: '#94a3b8' },
  { zone: 2, name: 'Endurance',       minutes: 640, color: '#60a5fa' },
  { zone: 3, name: 'Tempo',           minutes: 210, color: '#34d399' },
  { zone: 4, name: 'Threshold',       minutes: 95,  color: '#fbbf24' },
  { zone: 5, name: 'VO2 Max',         minutes: 40,  color: '#f97316' },
  { zone: 6, name: 'Anaerobic',       minutes: 15,  color: '#ef4444' },
  { zone: 7, name: 'Neuromuscular',   minutes: 5,   color: '#a855f7' },
];

// Summary stats for the AI insight prompt
export const summary = {
  weeks: 4,
  totalHours: 22,
  avgCTL: 58,
  currentCTL: 61,
  currentATL: 68,
  currentTSB: -7,
  dominantZone: 'Endurance (Zone 2)',
  recentWorkouts: ['Long ride 4h Z2', 'Threshold intervals 1h', 'Recovery spin 1h', 'Tempo 2h'],
};


