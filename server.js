require('dotenv').config();
const express = require('express');
const { generateFitnessData, powerZones, summary} = require('./data/mock');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

//Routes
app.get('/api/fitness', (req, res) => {
    res.json(generateFitnessData());
});
app.get('/api/zones', (req, res) => {
    res.json(powerZones)
})

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
})



