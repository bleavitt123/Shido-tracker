const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve all website layout assets directly from the public subfolder
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route to guarantee index.html loads on any refresh
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`SHIDO Tracker completely active on Port ${PORT}`);
});
