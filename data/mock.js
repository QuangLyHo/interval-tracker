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


