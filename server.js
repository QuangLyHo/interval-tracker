import fs from 'fs'
import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import fetch from 'node-fetch';
import { generateFitnessData } from './data/mock.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());


const USE_MOCK = !process.env.INTERVALS_API_KEY ||
                  process.env.INTERVALS_API_KEY === 'your_api_key_here';

const intervals_id = process.env.INTERVALS_ATHLETE_ID;
const key = process.env.INTERVALS_API_KEY;
const auth = 'Basic ' + Buffer.from(`API_KEY:${key}`).toString('base64');
const base_url = `https://intervals.icu/api/v1/athlete/${intervals_id}`;

// -- Cache
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

const cache = {
    activities: {data: null, fetchedAt: 0},
    ftp: {data: null, fetchedAt: 0}
};

function isFresh(entry) {
    const fetchedAt = Date.now() - entry.fetchedAt;
    if (entry.data && fetchedAt < CACHE_TTL) {
        return true;
    }
    return false;
}

app.get('/api/fitness', async (req, res) => {
  if (USE_MOCK) {
    return res.json(generateFitnessData());
  }

  const resp = await fetch(`${base_url}/wellness?oldest=${ninetyDaysAgo()}`, 
                            { headers: { Authorization: auth } })
  const raw = await resp.json();

  const extractedData = raw.map(entry => ({
    date: entry.id,
    ctl: entry.ctl,
    atl: entry.atl,
    tsb: entry.ctl - entry.atl
  })) 

  return res.json(extractedData)
});

//get power zones
app.get('/api/zones', async (req, res) => {
    const zones = await fetchPowerZones();
    res.json(zones);
});

// ── Route 3: GET /api/insight ──────────────────────────────────────────

app.get('/api/insight', async (req, res) => {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const url = 'https://api.anthropic.com/v1/messages';

    const {ctl, atl, tsb}   = await fetchLatestStats();
    const activities        = await fetchStravaActivities();
    const ftp               = await fetchFTP();

    const rideIntensities = activities.map(act=> ({
        if: act.weighted_average_watts ? (act.weighted_average_watts / ftp).toFixed(2) : 'no power data'
    }))

    const totalHours = (activities.reduce((sum, a) => sum + a.moving_time, 0) / 3600).toFixed(1);

    const prompt = `
        - You are a cycling coach, based on this athlete's training data, give me 2-3 sentence insight and one specific recommendation. 
        - You MUST mention in the training insight the total hours in the last 10 days.

        totalHours: ${totalHours} in the last 10 days,
        currentCTL: ${ctl},
        currentATL: ${atl},
        currentTSB: ${tsb},
        recent ride intensities: ${rideIntensities.map(r => `IF: ${r.if}`).join('\n')}
    `;

    console.log('Prompt being sent:', prompt);
    console.log('totalHours value:', totalHours);

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: 'claude-opus-4-5',
            max_tokens: 350,
            messages: [
                {role: 'user', content: prompt}
            ]
        })
    })

    const data = await resp.json();

    if (data.error) {
        return res.json({insight: `API error: ${data.error.message}`});
    }
    const insight = data.content[0].text;
    res.json({insight: insight});
})

//Strava OAuth
app.get('/auth/strava', (req, res) => {
    const params = new URLSearchParams({
        client_id: process.env.STRAVA_CLIENT_ID,
        redirect_uri: 'http://localhost:3000/auth/callback',
        response_type: 'code',
        scope: 'activity:read_all'
    });

    res.redirect(`https://www.strava.com/oauth/authorize?${params}`)
})

app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;

    const resp = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        })
    })
    const data = await resp.json()
    fs.writeFileSync('tokens.json', JSON.stringify(data, null, 2))
    res.send('Strava connected! You can close this tab.')
})

/**
 * 
    HELPERS
 * 
 */

// Current FTP
async function fetchFTP() {
    if (isFresh(cache.ftp)) {
        return cache.ftp.data;
    }

    const resp = await fetch(base_url, { headers: {Authorization: auth} });

    const data = await resp.json();
    const ftp = data.sportSettings.find(s => s.types?.includes('Ride'))?.ftp;

    cache.ftp.data = ftp;
    cache.ftp.fetchedAt = Date.now();

    return ftp;
}

// Fitness, Form, Fatigue
async function fetchLatestStats() {
    const resp = await fetch(`${base_url}/wellness?oldest=${ninetyDaysAgo()}`, 
                            { headers: {Authorization: auth} });
    const raw = await resp.json();

    const { ctl, atl } = raw[raw.length - 1];
    const tsb = ctl - atl;
    return {ctl, atl, tsb};
}

// Activites from Strava
async function fetchStravaActivities() {
    if (isFresh(cache.activities)) {
        return cache.activities.data;
    }

    const after = Math.floor(Date.now() / 1000) - (10 * 24 * 60 * 60);
    const token = await getStravaToken();

    const resp = await fetch(   `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=50`, {
                                headers: { Authorization: `Bearer ${token}`}
    })

    const raw = await resp.json();

    cache.activities.data = raw;
    cache.activities.fetchedAt = Date.now();

    return raw;
}

async function fetchPowerZones() {
    const activities = await fetchStravaActivities();
    const token = await getStravaToken();
    const ftp = await fetchFTP();

    const poweredRides = activities.filter(a => a.device_watts);

    const streams = await Promise.all(
        poweredRides.map(async (activity) => {
            const resp = await fetch(`https://www.strava.com/api/v3/activities/${activity.id}/streams?keys=watts&resolution=low`, 
                                    {headers: {Authorization: `Bearer ${token}`}})
            const data = await resp.json();
            return { stream: data, movingTime: activity.moving_time };
        })
    );

    const zoneTotals = [0, 0, 0, 0, 0, 0, 0];
    const ZONE_BOUNDARIES = [0, 0.55, 0.75, 0.90, 1.05, 1.20, 1.50];

    streams.forEach(({stream, movingTime}) => {
        const wattsData = stream.find(s => s.type === 'watts');
        if (!wattsData) return;

        const secsPerPoint = movingTime / wattsData.data.length;

        wattsData.data.forEach(watts => {
            const pct = watts/ftp;

            const zoneIndex = ZONE_BOUNDARIES.findLastIndex(b => pct >= b);
            zoneTotals[zoneIndex] += secsPerPoint;
        });
    });

    const zoneNames = ['Active Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2 Max', 'Anaerobic', 'Neuromuscular'];
    const zoneColors = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f97316', '#ef4444', '#a855f7'];


    return zoneTotals.map((seconds, i) => ({
        zone: i+1,
        name: zoneNames[i],
        minutes: Math.round(seconds/60),
        color: zoneColors[i]
    }));
}

async function getStravaToken() {
    try {
        const data = fs.readFileSync('tokens.json', 'utf-8')
        const tokens = JSON.parse(data)
        if (tokens.expires_at < Date.now() / 1000) 
            return await refreshStravaToken()

        return tokens.access_token;
    } catch (err) {
        console.error('Failed to load tokens:', err);
    }
}

async function refreshStravaToken() {
    try {
        const tokens = JSON.parse(fs.readFileSync('tokens.json', 'utf-8'));

        const resp = await fetch('https://www.strava.com/oauth/token', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                client_id: process.env.STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                refresh_token: tokens.refresh_token,
                grant_type: 'refresh_token'
            })
        })
        const new_tokens = await resp.json();
        fs.writeFileSync('tokens.json', JSON.stringify(new_tokens, null, 2));
        
        return new_tokens.access_token;
    } catch (err) {
        console.error('Failed to load tokens:', err);
    }
}

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
