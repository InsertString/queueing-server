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
                violations,
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

app.post('/remove_violation', (req, res) => {
    writeLock.acquire();
    const { team, rule, severity } = req.body;
    // find first instance of violation that matches team, rule and sev
    for (let i = 0; i < violations.length; i++) {
        if (violations.at(i).number === team && violations.at(i).ruleId === rule && violations.at(i).severity === severity) {
            violations.splice(i, 1);
            console.log("found");
            break;
        }
    }
    updateFile();
    updateClients();
    writeLock.release();
    res.status(200).json({ team, rule, severity });
});

app.get('/teams', async(req, res) => {
    //const html = await axios.get(SERVER_PATH);
    //const $ = cheerio.load(html.data);




    const teamData = [
        { number: "502A", school: "" },
        { number: "502U", school: "" },
        { number: "502W", school: "" },
        { number: "502X", school: "" },
        { number: "502Z", school: "" },
        { number: "604X", school: "" },
        { number: "604Y", school: "" },
        { number: "886N", school: "" },
        { number: "886Y", school: "" },
        { number: "886Z", school: "" },
        { number: "1010A", school: "" },
        { number: "1010B", school: "" },
        { number: "1010N", school: "" },
        { number: "1010T", school: "" },
        { number: "1010W", school: "" },
        { number: "1010X", school: "" },
        { number: "1010Y", school: "" },
        { number: "1010Z", school: "" },
        { number: "1011T", school: "" },
        { number: "1011Z", school: "" },
        { number: "6408F", school: "" },
        { number: "9181C", school: "" },
        { number: "9181E", school: "" },
        { number: "9181F", school: "" },
        { number: "9181S", school: "" },
        { number: "9181T", school: "" },
        { number: "9181X", school: "" },
        { number: "9594A", school: "" },
        { number: "9594J", school: "" },
        { number: "9652A", school: "" },
        { number: "77174B", school: "" },
        { number: "98549V", school: "" },
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