const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const INCREMENT = 5000;

// Shared universal multi-user memory state variables (Synced exactly to your live \$1,300 base)
let globalState = {
    marketCap: 1300, 
    jeetsKilled: 0,
    tokensBurned: 145000
};

const TOKEN_ADDRESS = "0xF3983368eA8926e2Ec6d3846047A8ac26D4c46c1";
let lastCheckedTimestamp = 0;

app.use(express.static(path.join(__dirname, 'public')));

// 📡 DIRECT BACKEND SCAPER: Queries Shidoscan Internal Call Arrays
async function scanBubbleCurveInternalTraces() {
    try {
        // Targets internal contract calls directly to capture bonding curve buy/sell actions
        const response = await fetch(`https://shidoscan.net{TOKEN_ADDRESS}&page=1&offset=3&sort=desc`);
        const data = await response.json();
        
        if (data && data.result && data.result.length > 0) {
            const latestInternalTx = data.result[0];
            const txTimestamp = parseInt(latestInternalTx.timeStamp);

            // Execute combat animations if a fresh timestamp prints to the ledger blocks
            if (lastCheckedTimestamp !== 0 && txTimestamp > lastCheckedTimestamp) {
                lastCheckedTimestamp = txTimestamp;
                
                // Convert raw internal values into local dollar impacts
                let rawValue = parseFloat(latestInternalTx.value) / 1e18;
                let calculatedImpact = Math.floor(rawValue * 21); // Scaling multiplier
                if (calculatedImpact < 5) calculatedImpact = 22; // Sets standard baseline jump metric

                let previousCap = globalState.marketCap;
                
                // Identify buy vs sell based on contract input-output properties
                let isBuy = latestInternalTx.to.toLowerCase() === TOKEN_ADDRESS.toLowerCase();

                if (isBuy) {
                    globalState.marketCap += calculatedImpact;
                    globalState.tokensBurned += Math.floor(calculatedImpact * 900);
                    
                    let oldMultiple = Math.floor(previousCap / INCREMENT);
                    let newMultiple = Math.floor(globalState.marketCap / INCREMENT);

                    if (newMultiple > oldMultiple) {
                        globalState.jeetsKilled = newMultiple;
                        io.emit('boss_kill', { globalState, amount: calculatedImpact });
                    } else {
                        io.emit('buy_order', { globalState, amount: calculatedImpact });
                    }
                } else {
                    if (globalState.marketCap > 500) {
                        globalState.marketCap = Math.max(300, globalState.marketCap - calculatedImpact);
                    }
                    io.emit('sell_order', { globalState, amount: calculatedImpact });
                }
            } else if (lastCheckedTimestamp === 0) {
                lastCheckedTimestamp = txTimestamp;
            }
        }
    } catch (error) {
        console.log("Network pipeline update lag, retrying...");
    }
}

// Scans the Shidoscan internal ledger contract layers every 3.5 seconds on the server
setInterval(scanBubbleCurveInternalTraces, 3500);

io.on('connection', (socket) => {
    socket.emit('state_sync', globalState);
});

server.listen(PORT, () => {
    console.log(`Shidoscan Internal Trace Pipeline Active on Port ${PORT}`);
});
