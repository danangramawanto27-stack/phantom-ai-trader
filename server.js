
const express = require("express");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(__dirname));

let cache = { time: 0, tokens: [] };

async function getData(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: "Phantom AI Trader",
    mode: "Paper Trading"
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    status: "running",
    tradingMode: "paper",
    network: "Solana"
  });
});

app.get("/api/tokens", async (req, res) => {
  try {
    if (Date.now() - cache.time < 30000) {
      return res.json({
        source: "DexScreener",
        cached: true,
        tokens: cache.tokens
      });
    }

    const [profiles, boosts] = await Promise.all([
      getData("https://api.dexscreener.com/token-profiles/latest/v1"),
      getData("https://api.dexscreener.com/token-boosts/latest/v1")
    ]);

    const addresses = [...new Set([
      ...(Array.isArray(profiles) ? profiles : [])
        .filter(x => x.chainId === "solana")
        .map(x => x.tokenAddress),
      ...(Array.isArray(boosts) ? boosts : [])
        .filter(x => x.chainId === "solana")
        .map(x => x.tokenAddress)
    ])].filter(Boolean).slice(0, 30);

    if (!addresses.length) {
      return res.json({
        source: "DexScreener",
        tokens: []
      });
    }

    const pairs = await getData(
      "https://api.dexscreener.com/tokens/v1/solana/" +
      addresses.map(encodeURIComponent).join(",")
    );

    const best = new Map();

    for (const p of Array.isArray(pairs) ? pairs : []) {
      if (p.chainId !== "solana" || !p.baseToken?.address) continue;

      const old = best.get(p.baseToken.address);

      if (!old ||
          Number(p.liquidity?.usd || 0) >
          Number(old.liquidity?.usd || 0)) {
        best.set(p.baseToken.address, p);
      }
    }

    const tokens = [...best.values()].map(p => ({
      name: p.baseToken.name || "Unknown",
      symbol: p.baseToken.symbol || "-",
      address: p.baseToken.address,
      price: p.priceUsd || null,
      marketCap: p.marketCap || p.fdv || null,
      liquidity: p.liquidity?.usd || 0,
      volume24h: p.volume?.h24 || 0,
      buys24h: p.txns?.h24?.buys || 0,
      sells24h: p.txns?.h24?.sells || 0,
      change24h: p.priceChange?.h24 || 0,
      dex: p.dexId || "-",
      url: p.url || null
    })).sort((a, b) =>
      Number(b.volume24h) - Number(a.volume24h)
    );

    cache = {
      time: Date.now(),
      tokens
    };

    res.json({
      source: "DexScreener",
      cached: false,
      note: "Latest profiles and boosted Solana tokens with market pairs. Not all new launches.",
      tokens
    });

  } catch (error) {
    res.status(502).json({
      error: "Market data unavailable",
      detail: error.message
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("Phantom AI Trader running on port " + PORT);
});
