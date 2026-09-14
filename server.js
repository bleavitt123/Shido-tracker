const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const INCREMENT = 5000;

// Shared live network metrics state
let globalState = {
    marketCap: 0, 
    jeetsKilled: 0,
    tokensBurned: 0
};

const TOKEN_ADDRESS = "0xF3983368eA8926e2Ec6d3846047A8ac26D4c46c1";
app.use(express.static(path.join(__dirname, 'public')));

// 📡 STREAM DYNAMIC POOL METRICS DIRECTLY FROM DEXSCREENER REAL-TIME PIPELINES
async function syncLiveDexData() {
    try {
        const response = await fetch(`https://dexscreener.com{TOKEN_ADDRESS}`);
        const json = await response.json();
        
        if (json && json.pairs && json.pairs.length > 0) {
            // Pull data straight from the primary active liquidity pool pair
            const primaryPair = json.pairs[0];
            let liveMarketCap = Math.floor(parseFloat(primaryPair.marketCap || 0));
            
            // Safety parsing baseline logic
            if (liveMarketCap === 0 && primaryPair.priceUsd) {
                const supply = 1000000000; // Total supply multiplier
                liveMarketCap = Math.floor(parseFloat(primaryPair.priceUsd) * supply);
            }

            if (liveMarketCap > 0 && liveMarketCap !== globalState.marketCap) {
                let previousCap = globalState.marketCap;
                globalState.marketCap = liveMarketCap;
                
                // Track total jeets eliminated mathematically by checking structural 5k brackets
                let oldMultiple = Math.floor(previousCap / INCREMENT);
                let newMultiple = Math.floor(liveMarketCap / INCREMENT);
                
                // Approximate burn analytics relative to pool changes
                globalState.tokensBurned += Math.abs(liveMarketCap - previousCap) * 500;

                if (newMultiple > oldMultiple) {
                    globalState.jeetsKilled = newMultiple;
                    io.emit('boss_kill', { globalState, amount: (liveMarketCap - previousCap) });
                } else if (liveMarketCap > previousCap) {
                    io.emit('buy_order', { globalState, amount: (liveMarketCap - previousCap) });
                } else if (liveMarketCap < previousCap) {
                    io.emit('sell_order', { globalState, amount: (previousCap - liveMarketCap) });
                }
            }
        }
    } catch (error) {
        console.error("DexScreener API update delay:", error);
    }
}

// Scans the decentralized exchange pool metrics loop continuously every 4 seconds
setInterval(syncLiveDexData, 4000);

io.on('connection', (socket) => {
    socket.emit('state_sync', globalState);
});

server.listen(PORT, () => {
    console.log(`Live 24/7 DexScreener Event Router running on Port ${PORT}`);
    syncLiveDexData();
});
