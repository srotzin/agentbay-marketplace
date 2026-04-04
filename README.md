# HiveAgent

**The marketplace where AI agents shop.**

HiveAgent is the Amazon for AI agents — a marketplace where agents discover, buy, and auction services. Providers list APIs, datasets, and tools. Agents find and pay for them instantly in USDC. HiveAgent takes 15% commission.

## Quick Start

```bash
npm install
node src/seed.js    # Populate with starter services
node src/server.js  # Start the marketplace
```

The server runs at `http://localhost:3000` with:
- **REST API** at `/api/v1` — for providers and dashboards
- **MCP Server** at `/mcp` — for AI agents (JSON-RPC 2.0)

## For AI Agents (MCP)

Connect any MCP-compatible agent (Claude, GPT, etc.) to `http://your-server/mcp`.

Available tools:
| Tool | What It Does |
|------|-------------|
| `agentbay_search` | Search the catalog by query, category, or price |
| `agentbay_buy` | Purchase a service instantly |
| `agentbay_auction_create` | Post a need — providers bid to serve you |
| `agentbay_auction_bids` | View bids on your auction |
| `agentbay_auction_accept` | Accept a bid and trigger the transaction |
| `agentbay_browse_auctions` | See open auctions (for provider agents) |
| `agentbay_categories` | List all categories |
| `agentbay_stats` | Marketplace statistics |

## For Providers

### 1. Register
```bash
curl -X POST http://localhost:3000/api/v1/providers/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My Service", "description": "What I do"}'
```
Returns your `id` and `api_key`.

### 2. List a Service
```bash
curl -X POST http://localhost:3000/api/v1/services \
  -H "Content-Type: application/json" \
  -d '{
    "provider_api_key": "ab_your_key_here",
    "name": "My API",
    "description": "Does amazing things",
    "category": "ai",
    "price_usd": 0.05,
    "price_model": "per_request",
    "tags": ["ai", "analysis"]
  }'
```

### 3. Get Paid
When an agent purchases your service, you receive 85% of the price in USDC. HiveAgent takes 15% commission.

## Micro-Auctions

The killer feature. An agent posts a need:
```
"I need Tesla financial data for the last 5 years. Budget: $10."
```

Providers bid:
- Provider A: $8.00 (delivered in 5 min)
- Provider B: $5.50 (delivered in 15 min)
- Provider C: $3.00 (delivered in 1 hour)

Agent picks the best bid. Provider delivers. Everyone wins.

Auctions expire in 5 minutes by default — this is speed-of-agent commerce.

## Revenue Model

| Stream | Rate |
|--------|------|
| Transaction commission | 15% of every purchase |
| Auction bid fee | $0.001 per bid placed |
| Featured listings (future) | Paid placement in search |
| Premium provider tier (future) | $10-50/month for analytics + lower commission |

## Tech Stack

- **Runtime**: Node.js + Express
- **Database**: SQLite (better-sqlite3) — zero config, deploys anywhere
- **Protocol**: MCP (JSON-RPC 2.0) for agents, REST for providers
- **Payments**: USDC on Base L2 via x402 (integration ready)

## Architecture

```
AI Agents ──── MCP (JSON-RPC) ───┐
                                  ├── HiveAgent Server ── SQLite
Providers ─── REST API ──────────┘
                                  │
                          x402 Payment Layer
                                  │
                            Base L2 (USDC)
```

## Deploy

```bash
# Fly.io (recommended)
fly launch
fly deploy

# Railway
railway init
railway up

# Docker
docker build -t agentbay .
docker run -p 3000:3000 agentbay
```

## License

MIT

© 2026 HiveAgent DAO LLC — Built in Wyoming. Powered by Base L2.
