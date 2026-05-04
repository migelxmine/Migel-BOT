
// created and experimented by me, MIGEL

const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
let db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));

function saveConfig() {
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
}

function saveDB() {
    fs.writeFileSync('./database.json', JSON.stringify(db, null, 2));
}

app.get('/api/config', (req, res) => {
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    res.json(config);
});

app.post('/api/config', (req, res) => {
    config = { ...config, ...req.body };
    saveConfig();
    res.json({ success: true, config });
});

app.get('/api/stats', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    res.json(db.stats);
});

app.get('/api/bans', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const bans = Object.entries(db.bans).map(([userId, ban]) => ({
        userId,
        ...ban
    }));
    res.json(bans);
});

app.get('/api/appeals', (req, res) => {
    db = JSON.parse(fs.readFileSync('./database.json', 'utf8'));
    const appeals = Object.entries(db.appeals).map(([userId, appeal]) => ({
        userId,
        ...appeal
    }));
    res.json(appeals);
});

app.post('/api/rules/:ruleKey/toggle', (req, res) => {
    const { ruleKey } = req.params;
    config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    if (config.rules[ruleKey]) {
        config.rules[ruleKey].enabled = !config.rules[ruleKey].enabled;
        saveConfig();
        res.json({ success: true, enabled: config.rules[ruleKey].enabled });
    } else {
        res.status(404).json({ error: 'Regra não encontrada' });
    }
});

app.post('/api/spam-config', (req, res) => {
    const { spamLimit, spamTimeWindow } = req.body;
    config.spamLimit = spamLimit;
    config.spamTimeWindow = spamTimeWindow;
    saveConfig();
    res.json({ success: true });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`📱 Telemóvel: http://[IP_DO_PI]:${PORT}`);
});
