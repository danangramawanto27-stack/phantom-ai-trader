const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

app.use(express.static(__dirname));

app.get("/health", (req, res) => {
    res.json({
        status: "online",
        bot: "Phantom AI Trader",
        mode: "Paper Trading"
    });
});

app.get("/api/status", (req, res) => {
    res.json({
        bot: "Phantom AI Trader",
        status: "running",
        tradingMode: "paper",
        network: "Solana"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Phantom AI Trader running on port ${PORT}`);
});
