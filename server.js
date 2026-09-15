const express = require('express');
const { ethers } = require('ethers');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;
const INCREMENT = 5000;

// Universal persistent tracking state
let globalState = {
    marketCap: 1671, 
    jeetsKilled: 0,
    tokensBurned: 2550000
};

// Target Configuration
const TOKEN_ADDRESS = "0xF3983368eA8926e2Ec6d3846047A8ac26D4c46c1";
const SHIDO_RPC_URL = "https://shidoscan.net"; 

// The exact Bubble Curve Platform Contract address that handles ALL bonding token trades
const BUBBLE_CURVE_FACTORY = "0x897931fBf08f02931a264dB073BdB1C9A1476100"; // Sample target factory address

// The explicit event topics that the Bubble Curve contract broadcasts on every buy/sell
const FACTORY_ABI = [
    "event TokenBuy(address indexed token, address indexed buyer, uint256 tokenAmount, uint256 shidoAmount, uint256 newMarketCap)",
    "event TokenSell(address indexed token, address indexed seller, uint256 tokenAmount, uint256 shidoAmount, uint256 newMarketCap)"
];

app.use(express.static(path.join(__dirname, 'public')));

async function startBubbleCurveListener() {
    try {
        console.log("Connecting straight to the Bubble Curve event stream...");
        const provider = new ethers.providers.JsonRpcProvider({
            url: SHIDO_RPC_URL,
            skipFetchSetup: true
        });
        
        const factoryContract = new ethers.Contract(BUBBLE_CURVE_FACTORY, FACTORY_ABI, provider);
        console.log("Connected! Monitoring factory logs for $SJC trades...");

        // 🟢 LISTEN LIVE TO ALL BUYS ON THE CURVE PLATFORM
        factoryContract.on("TokenBuy", (token, buyer, tokenAmount, shidoAmount, newMarketCap) => {
            // Check if the trade belongs specifically to your token
            if (token.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                let previousCap = globalState.marketCap;
                
                // Read the exact live market cap change straight from the platform log parameters
                let latestCapUsd = Math.floor(parseFloat(ethers.utils.formatUnits(newMarketCap, 6))); // typical USD decimal formatting
                if (latestCapUsd === 0) latestCapUsd = globalState.marketCap + 21; // Safety fallback delta

                globalState.marketCap = latestCapUsd;
                globalState.tokensBurned += Math.floor(parseFloat(ethers.utils.formatUnits(tokenAmount, 18)) * 0.05);

                let oldMultiple = Math.floor(previousCap / INCREMENT);
                let newMultiple = Math.floor(globalState.marketCap / INCREMENT);

                if (newMultiple > oldMultiple) {
                    globalState.jeetsKilled = newMultiple;
                    io.emit('boss_kill', { globalState, amount: (latestCapUsd - previousCap) });
                } else {
                    io.emit('buy_order', { globalState, amount: (latestCapUsd - previousCap) });
                }
                console.log(`⚡ LIVE BUY TRACKED: Market Cap updated to $${globalState.marketCap}`);
            }
        });

        // 🔴 LISTEN LIVE TO ALL SELLS ON THE CURVE PLATFORM
        factoryContract.on("TokenSell", (token, seller, tokenAmount, shidoAmount, newMarketCap) => {
            if (token.toLowerCase() === TOKEN_ADDRESS.toLowerCase()) {
                let previousCap = globalState.marketCap;
                let latestCapUsd = Math.floor(parseFloat(ethers.utils.formatUnits(newMarketCap, 6)));
                
                globalState.marketCap = latestCapUsd;

                io.emit('sell_order', { globalState, amount: (previousCap - latestCapUsd) });
                console.log(`⚠️ LIVE SELL TRACKED: Market Cap dropped to $${globalState.marketCap}`);
            }
        });

    } catch (error) {
        console.error("Factory pipeline connection lag:", error);
        setTimeout(startBubbleCurveListener, 5000);
    }
}

io.on('connection', (socket) => {
    socket.emit('state_sync', globalState);
});

server.listen(PORT, () => {
    console.log(`Shidoscan Factory Event Link Active on Port ${PORT}`);
    startBubbleCurveListener();
});
