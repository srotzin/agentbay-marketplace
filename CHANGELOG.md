# Changelog

All notable changes to HiveAgent are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

---

## [1.4.0] — 2026-04-07

### Added
- **5 new composite workflows** bringing the total to 15:
  - `workflow_procurement_cycle` — supplier discovery → RFQ → bid evaluation → contract → invoice match (5 tools → 1)
  - `workflow_full_sales_cycle` — lead enrichment → ICP scoring → personalized outreach → meeting booking → pipeline forecast (5 tools → 1)
  - `workflow_screen_and_hire` — resume screen → shortlist → interview guide → comp benchmarking → onboarding automation (5+ tools → 1)
  - `workflow_full_fraud_check` — transaction screening → anomaly detection → identity check → chargeback prediction → network analysis (5 tools → 1)
  - `workflow_book_full_trip` — flights → hotel → car rental → dining → itinerary → visa requirements (6 tools → 1)
- **Chinese README** (`README_CN.md`) for ModelScope and Gitee audiences
- `hiveagent_suggest_workflow` intent router — describe a goal, receive a step-by-step tool plan
- `hiveagent_hitl_request` shoulder-tap tool — pause agent execution and request human review mid-workflow

### Changed
- Vertical count raised from 20 to **22** (Sales and Procurement graduated from beta)
- Tool count updated to **610** across all modules
- `hiveagent_discover` now returns confidence scores alongside tool recommendations
- Smithery score maintained at **95/100** after re-evaluation against updated rubric

### Fixed
- `workflow_agent_monitoring` timeout race condition when >6 endpoints registered simultaneously
- `hiveagent_mem_retrieve` returning stale entries after agent session reset
- Cross-border payment tool (`hiveagent_xborder_transfer`) incorrectly flagging EU→US SEPA transfers

---

## [1.3.0] — 2026-04-06

### Added
- **Education vertical** (`edu_*`) — 18 tools: credential verification, curriculum generation, progress tracking, financial aid lookup
- **Procurement vertical** (`procurement_*`) — 20 tools: supplier discovery, RFQ, bid management, contract drafting, invoice matching
- `hiveagent_vertical_guide` improvements: now returns estimated cost per tool call alongside tool descriptions
- Persistent agent memory (`hiveagent_mem_store` / `hiveagent_mem_retrieve`) — cross-session key-value store backed by SQLite
- `recovery_start_trace` distributed tracing for multi-agent workflows
- `fly.toml` and `render.yaml` for one-command cloud deploys

### Changed
- MCP server now returns `annotations` block on every tool definition (`readOnlyHint`, `destructiveHint`, `idempotentHint`)
- `hiveagent_discover` free-tier expanded: now returns top 10 results (was 5)
- Database schema migrated to WAL mode for concurrent read performance

### Fixed
- `construction_match_subcontractor` returning empty results when municipality name contained a comma
- Insurance adjuster report missing `policy_number` field in edge cases with `workers_comp` claim type
- `hiveagent_auction_create` 500 error when `duration_seconds` omitted (now defaults to 300)

---

## [1.2.0] — 2026-04-05

### Added
- **Sales vertical** (`sales_*`) — 20 tools: lead enrichment, ICP scoring, outreach generation, meeting scheduling, pipeline forecasting
- **Fraud vertical** (`fraud_*`) — 18 tools: transaction screening, anomaly detection, identity verification, chargeback prediction, network analysis
- `workflow_commerce_transaction` composite workflow — product verification + merchant trust + dark pattern scan + purchase order in one call
- `workflow_crop_season` composite workflow — crop diagnostics + yield forecast + commodity alerts + soil analysis + compliance checklist
- `hiveagent_rep_score` and `hiveagent_rep_record_event` — on-chain agent reputation layer on Base L2
- `hiveagent_escrow_create` / `hiveagent_escrow_release` — USDC escrow with delivery confirmation
- EXAMPLES.md and full `examples/` directory with LangChain, CrewAI, AutoGen, and OpenAI Agents SDK code

### Changed
- MCP endpoint upgraded to protocol version `2024-11-05`
- `hiveagent_stats` response now includes `verticals_active`, `workflows_available`, and `uptime_pct`
- Node.js dependency updated to `>=20.0.0`; ES module (`"type": "module"`) enforced throughout

### Fixed
- `trade_screen_sanctions` false positives on common English names in OFAC list lookup
- `health_prior_auth` hanging indefinitely when `insurance_provider` field contained special characters
- SQLite WAL checkpoint failing silently on low-disk environments (now throws with actionable message)

---

## [1.1.0] — 2026-04-04

### Added
- **10 initial composite workflow tools** in `src/mcp-tools-workflows.js`:
  - `workflow_full_insurance_claim`
  - `workflow_construction_project`
  - `workflow_legal_case_setup`
  - `workflow_healthcare_encounter`
  - `workflow_small_business_setup`
  - `workflow_trades_job`
  - `workflow_international_shipment`
  - `workflow_agent_monitoring`
  - `workflow_commerce_transaction`
  - `workflow_crop_season`
- `hiveagent_discover` free meta-tool — natural language query → ranked tool list with vertical context
- `hiveagent_vertical_guide` free meta-tool — full tool catalog for a named vertical
- `quick-test.sh` — 7-step shell connectivity test, no Python required
- Smithery registry listing (`server.json`) — achieved **95/100** on first submission
- Treasury wallet binding: `0x00383412D3d9B42540a4D536e4190b71d7d982b9` on Base L2 for USDC settlement
- `Dockerfile`, `Procfile`, `fly.toml`, `railway.json` deployment configs

### Changed
- README rewritten with full vertical table, workflow reference, and multi-framework code examples
- MCP server consolidated into `src/mcp-server.js` with modular tool loaders
- `better-sqlite3` upgraded to `^12.8.0` for Node.js 20 compatibility

### Fixed
- `agentbay_search` returning duplicate results when `category` and `query` matched the same service
- Provider registration endpoint returning 500 when `wallet_address` field omitted (now optional)
- MCP `tools/list` response exceeding Anthropic's 200-tool display limit in some clients (tools now paginated)

---

*Older entries available in git history.*
