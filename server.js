const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// Tell the hosting platform to look straight into your public UI folder
app.use(express.static(path.join(__dirname, 'public')));

// Simple cross-user interaction gateway relay
io.on('connection', (socket) => {
    socket.on('blockchain_tx', (data) => {
        // Echoes transaction hits instantly to everyone currently viewing the page
        socket.broadcast.emit('sync_tx', data);
    });
});

server.listen(PORT, () => {
    console.log(`Shido Multi-User Delivery Node running perfectly on Port ${PORT}`);
});
