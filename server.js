const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const cors = require('cors');
const Mutex = require('async-mutex').Mutex;

const app = express();
app.use(express.json());
app.use(cors());

const server = http.createServer(app);

/**
 * UPDATE THIS VALUE WITH YOUR VEX TM SERVER IP
 */
const SERVER_PATH = 'http://10.0.0.2/division1/teams';

const dbFile = 'team_data.json';
let writeLock = new Mutex();

// database lmfao
let nowServing = [];
let queue = [];
let violations = {};

const wss = new WebSocket.Server({ server, path: '/queue' });

// WebSocket connection handling
wss.on('connection', (ws) => {
    console.log('WebSocket connection established');

    ws.send(JSON.stringify({ nowServing, queue, violations }));

    // Handle disconnection
    ws.on('close', () => {
        console.log('WebSocket connection closed');
    });
});

const updateClients = () => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ nowServing, queue, violations }));
        }
    });
};

const fileData = fs.readFileSync(dbFile, 'utf-8');
if (fileData) {
    const data = JSON.parse(fileData);
    if (data) {
        nowServing = data.nowServing;
        queue = data.queue;
        violations = data.violations;
    }
}

const updateFile = () => {
    // Write the array to a JSON file
    fs.writeFileSync(
        dbFile,
        JSON.stringify({
                nowServing,
                queue,
                violations
            },
            null,
            2
        ), { flag: 'w' }
    );
};

// Express route handling
app.get('/', (req, res) => {
    res.send('Hello, Express Server!');
});

app.post('/add', (req, res) => {
    writeLock.acquire();
    const { team } = req.body;
    if (
        queue.find((t) => t.number === team) ||
        nowServing.find((t) => t.number === team)
    ) {
        return res.status(400).json({ error: 'Team is already in queue' });
    }
    queue.push({ number: team, at: null });
    updateFile();
    updateClients();
    writeLock.release();
    res.status(200).json({ team });
});

app.post('/add_violation', (req, res) => {
    writeLock.acquire();
    // receive object from front-end
    const { team, rule, severity } = req.body;
    console.log(team)
    console.log(rule)
    console.log(severity)
        // add violation to JSON file
    violations.push({ number: team, ruleId: rule, severity: severity });
    updateFile();
    updateClients();
    writeLock.release();
    res.status(200).json({ team, rule, severity });
});

app.post('/serve', (req, res) => {
    if (queue.length) {
        writeLock.acquire();
        const next = queue.shift();
        nowServing.push({...next, at: next.at || new Date() });
        updateFile();
        updateClients();
        writeLock.release();
        res.status(200).json({ team: next });
    } else {
        res.status(400).json({ error: 'empty' });
    }
});

app.post('/unserve', (req, res) => {
    const { team } = req.body;
    if (nowServing.length) {
        writeLock.acquire();
        const unservedIndex = nowServing.findIndex((t) => t.number === team);
        const unserved = nowServing.find((t) => t.number === team);
        nowServing.splice(unservedIndex, 1);
        queue.unshift(unserved);
        updateFile();
        updateClients();
        writeLock.release();
        res.status(200).json({ team: unserved.number });
    } else {
        res.status(400).json({ error: 'empty' });
    }
});

app.post('/remove', (req, res) => {
    writeLock.acquire();
    const { team } = req.body;
    nowServing = nowServing.filter((t) => t.number !== team);
    queue = queue.filter((t) => t.number !== team);
    updateFile();
    updateClients();
    writeLock.release();
    res.status(200).json({ team });
});

app.get('/teams', async(req, res) => {
    //const html = await axios.get(SERVER_PATH);
    //const $ = cheerio.load(html.data);

    const teamData = [
        { number: "98549A", school: "Burnsview" },
        { number: "98549B", school: "Burnsview" },
        { number: "98549C", school: "Burnsview" },
        { number: "98549D", school: "Burnsview" },
        { number: "98549E", school: "Burnsview" },
        { number: "98549F", school: "Burnsview" },
        { number: "98549G", school: "Burnsview" },
        { number: "98549H", school: "Burnsview" },
        { number: "98549K", school: "Burnsview" },
        { number: "98549M", school: "Burnsview" },
        { number: "98549N", school: "Burnsview" },
        { number: "98549P", school: "Burnsview" },
        { number: "98549Q", school: "Burnsview" },
        { number: "98549R", school: "Burnsview" },
        { number: "98549S", school: "Burnsview" },
        { number: "98549T", school: "Burnsview" },
        { number: "98549U", school: "Burnsview" },
        { number: "98549V", school: "Burnsview" },
        { number: "98549W", school: "Burnsview" },
        { number: "98549X", school: "Burnsview" },
        { number: "98549Y", school: "Burnsview" },
        { number: "98549Z", school: "Burnsview" }
    ];
    /*$('tbody tr').each((index, element) => {
      const $tds = $(element).find('td');
      const number = $tds
        .eq(0)
        .text()
        .trim();
      const school = $tds
        .eq(3)
        .text()
        .trim();

      teamData.push({ number, school });
    });*/

    res.status(200).json(teamData);
});

// Start the server on port 4000
const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});