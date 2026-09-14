const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const INCREMENT = 5000;

// Set your starting launch market cap baseline so the dashboard looks populated instantly
let globalState = {
    marketCap: 2350, 
    jeetsKilled: 0,
    tokensBurned: 145000
};

const TOKEN_ADDRESS = "0xF3983368eA8926e2Ec6d3846047A8ac26D4c46c1";
app.use(express.static(path.join(__dirname, 'public')));

// HYBRID DATA CONTROLLER: Combines live APIs with an active blockchain event simulator
async function trackingPipelineEngine() {
    // 1. Attempt to sync with live data indexers in the background
    try {
        const response = await fetch(`https://geckoterminal.com{TOKEN_ADDRESS}`);
        const json = await response.json();
        if (json && json.data && json.data.attributes && json.data.attributes.market_cap_usd) {
            let apiCap = Math.floor(parseFloat(json.data.attributes.market_cap_usd));
            if (apiCap > 0) {
                globalState.marketCap = apiCap;
            }
        }
    } catch (e) {
        // Keep moving smoothly if APIs are busy indexing the launch
    }

    // 2. High-speed transaction event engine (Ensures immediate action on the user UI screen)
    let isBuyAction = Math.random() > 0.25; // High buy bias so the Ninja keeps winning
    let tradeImpact = Math.floor(Math.random() * 240) + 70; 
    
    let previousCap = globalState.marketCap;

    if (isBuyAction) {
        globalState.marketCap += tradeImpact;
        globalState.tokensBurned += Math.floor(tradeImpact * 900);
        
        let oldMultiple = Math.floor(previousCap / INCREMENT);
        let newMultiple = Math.floor(globalState.marketCap / INCREMENT);
        
        if (newMultiple > oldMultiple) {
            globalState.jeetsKilled++;
            io.emit('boss_kill', { globalState, amount: tradeImpact });
        } else {
            io.emit('buy_order', { globalState, amount: tradeImpact });
        }
    } else {
        if (globalState.marketCap > 500) {
            globalState.marketCap = Math.max(200, globalState.marketCap - tradeImpact);
        }
        io.emit('sell_order', { globalState, amount: tradeImpact });
    }
}

// Keep the website highly active by checking and running actions every 4.5 seconds
setInterval(trackingPipelineEngine, 4500);

io.on('connection', (socket) => {
    // Instantly sync the global persistent state on connection so numbers never drop
    socket.emit('state_sync', globalState);
});

server.listen(PORT, () => {
    console.log(`Live 24/7 Operations Hub online on port ${PORT}`);
});
