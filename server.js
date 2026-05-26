import 'dotenv/config';
import express from 'express'
import fetch from 'node-fetch'
import { generateFitnessData, powerZones, summary } from './data/mock.js'

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());


const USE_MOCK = !process.env.INTERVALS_API_KEY ||
                  process.env.INTERVALS_API_KEY === 'your_api_key_here';

app.get('/api/fitness', async (req, res) => {
  if (USE_MOCK) {
    return res.json(generateFitnessData());
  }

  const id  = process.env.INTERVALS_ATHLETE_ID;
  const key = process.env.INTERVALS_API_KEY;

  const auth = 'Basic ' + Buffer.from(`API_KEY:${key}`).toString('base64');

  const oldDate = ninetyDaysAgo();
  const url = `https://intervals.icu/api/v1/athlete/${id}/wellness?oldest=${oldDate}`;

  const resp = await fetch(url, { headers: { Authorization: auth } })
  const raw = await resp.json();

  const extractedData = raw.map(entry => ({
    date: entry.id,
    ctl: entry.ctl,
    atl: entry.atl,
    tsb: entry.ctl - entry.atl
  })) 

  return res.json(extractedData)
});

app.get('/api/zones', (req, res) => {
  res.json(powerZones);
});

// ── Route 3: GET /api/insight ──────────────────────────────────────────

// ── Utility ───────────────────────────────────────────────────────────
function ninetyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split('T')[0];
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Mode: ${USE_MOCK ? 'MOCK data' : 'Live intervals.icu API'}`);
});
