const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const INCREMENT = 5000;

// Central global tracking values
let globalState = {
    marketCap: 0, 
    jeetsKilled: 0,
    tokensBurned: 0
};

const TOKEN_ADDRESS = "0xF3983368eA8926e2Ec6d3846047A8ac26D4c46c1";
app.use(express.static(path.join(__dirname, 'public')));

// 📡 FETCH LIVE SWAP METRICS DIRECTLY FROM THE DEFI POOL APIS
async function fetchLiveOnChainData() {
    try {
        // Queries the explicit on-chain data registry for the token address
        const response = await fetch(`https://geckoterminal.com{TOKEN_ADDRESS}`);
        const json = await response.json();
        
        if (json && json.data && json.data.attributes) {
            const attributes = json.data.attributes;
            let realMarketCap = Math.floor(parseFloat(attributes.market_cap_usd || 0));
            
            // Backup protection if pool cap indexer is processing blocks:
            if (realMarketCap === 0 && attributes.price_usd) {
                let circulatingSupply = 1000000000; // Adjust placeholder to match your total token supply if needed
                realMarketCap = Math.floor(parseFloat(attributes.price_usd) * circulatingSupply);
            }

            if (realMarketCap > 0 && realMarketCap !== globalState.marketCap) {
                let previousCap = globalState.marketCap;
                globalState.marketCap = realMarketCap;
                globalState.tokensBurned = Math.floor(realMarketCap * 450); // Relative scale burn output tracking

                let oldMultiple = Math.floor(previousCap / INCREMENT);
                let newMultiple = Math.floor(globalState.marketCap / INCREMENT);

                if (newMultiple > oldMultiple) {
                    globalState.jeetsKilled = newMultiple;
                    io.emit('boss_kill', { globalState, amount: (realMarketCap - previousCap) });
                    console.log(`🔥 OBLITERATED: Milestone cross mapped at $${realMarketCap}`);
                } else if (realMarketCap > previousCap) {
                    io.emit('buy_order', { globalState, amount: (realMarketCap - previousCap) });
                    console.log(`🟢 BUY EVENT: Market cap pushed up to $${realMarketCap}`);
                } else if (realMarketCap < previousCap) {
                    io.emit('sell_order', { globalState, amount: (previousCap - realMarketCap) });
                    console.log(`🔴 SELL EVENT: Market cap dropped down to $${realMarketCap}`);
                }
            }
        }
    } catch (error) {
        console.error("API Pipeline congestion, retrying sync in next loop sequence...", error);
    }
}

// Check the token's trading pool data loop every 4.5 seconds for instant responses
setInterval(fetchLiveOnChainData, 4500);

io.on('connection', (socket) => {
    socket.emit('state_sync', globalState);
});

server.listen(PORT, () => {
    console.log(`Live 24/7 Pool Router Tracking Hub active on Port ${PORT}`);
    fetchLiveOnChainData(); // Initial immediate scan on server run
});
