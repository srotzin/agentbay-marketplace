#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# HiveAgent Quick Test — verify your MCP connection and discover tools
# Usage: bash quick-test.sh
#
# No API keys needed. HiveAgent is open to all MCP-compatible agents.
# ─────────────────────────────────────────────────────────────────────────────

HIVEAGENT_URL="https://hiveagentiq.com/mcp"
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}HiveAgent MCP Quick Test${RESET}"
echo "Endpoint: $HIVEAGENT_URL"
echo "──────────────────────────────────────────────────────"

# ─── Helper ──────────────────────────────────────────────────────────────────

mcp_call() {
  local method="$1"
  local params="$2"
  curl -s -X POST "$HIVEAGENT_URL" \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"${method}\",\"params\":${params}}"
}

check_pass() { echo -e "  ${GREEN}✓ PASS${RESET} — $1"; }
check_fail() { echo -e "  ${RED}✗ FAIL${RESET} — $1"; }

# ─── Test 1: Connectivity — initialize ───────────────────────────────────────

echo ""
echo -e "${BOLD}Test 1: MCP handshake (initialize)${RESET}"
INIT_RESP=$(mcp_call "initialize" '{
  "protocolVersion": "2024-11-05",
  "clientInfo": {"name": "quick-test", "version": "1.0"},
  "capabilities": {}
}')

if echo "$INIT_RESP" | grep -q "serverInfo"; then
  SERVER_NAME=$(echo "$INIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['serverInfo']['name'])" 2>/dev/null || echo "HiveAgent")
  SERVER_VER=$(echo "$INIT_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['result']['serverInfo']['version'])" 2>/dev/null || echo "?")
  check_pass "Connected to $SERVER_NAME v$SERVER_VER"
else
  check_fail "Could not initialize MCP session"
  echo "Response: $INIT_RESP"
  exit 1
fi

# ─── Test 2: Tool Discovery — tools/list ─────────────────────────────────────

echo ""
echo -e "${BOLD}Test 2: Discover available tools (tools/list)${RESET}"
TOOLS_RESP=$(mcp_call "tools/list" '{}')

if echo "$TOOLS_RESP" | grep -q '"tools"'; then
  TOOL_COUNT=$(echo "$TOOLS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']['tools']))" 2>/dev/null || echo "many")
  check_pass "$TOOL_COUNT tools available"

  echo ""
  echo "  Sample tools discovered:"
  echo "$TOOLS_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
tools = d['result']['tools'][:10]
for t in tools:
    desc = t.get('description', '')[:60]
    print(f'    • {t[\"name\"]}: {desc}...')
" 2>/dev/null || echo "  (install python3 to see tool list)"
else
  check_fail "tools/list returned unexpected response"
  echo "Response: $TOOLS_RESP"
fi

# ─── Test 3: hiveagent_discover ──────────────────────────────────────────────

echo ""
echo -e "${BOLD}Test 3: Vertical discovery (hiveagent_discover)${RESET}"
DISCOVER_RESP=$(mcp_call "tools/call" '{
  "name": "hiveagent_discover",
  "arguments": {}
}')

if echo "$DISCOVER_RESP" | grep -q '"result"'; then
  check_pass "hiveagent_discover returned results"
  echo ""
  echo "  Available verticals:"
  echo "$DISCOVER_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
content = d.get('result', {}).get('content', [{}])
if content and content[0].get('type') == 'text':
    data = json.loads(content[0]['text'])
    verticals = data.get('verticals', [])
    for v in verticals[:12]:
        name = v.get('name', v) if isinstance(v, dict) else v
        print(f'    • {name}')
" 2>/dev/null || echo "  (install python3 to see verticals)"
else
  check_fail "hiveagent_discover failed"
  echo "Response: $DISCOVER_RESP"
fi

# ─── Test 4: Insurance vertical ──────────────────────────────────────────────

echo ""
echo -e "${BOLD}Test 4: Insurance vertical (hiveagent_discover vertical=insurance)${RESET}"
INS_RESP=$(mcp_call "tools/call" '{
  "name": "hiveagent_discover",
  "arguments": {"vertical": "insurance"}
}')

if echo "$INS_RESP" | grep -q '"result"'; then
  check_pass "Insurance vertical accessible"
else
  check_fail "Insurance vertical query failed"
fi

# ─── Test 5: Tool call — insurance_claim_intake ───────────────────────────────

echo ""
echo -e "${BOLD}Test 5: Live tool call (insurance_claim_intake)${RESET}"
CLAIM_RESP=$(mcp_call "tools/call" '{
  "name": "insurance_claim_intake",
  "arguments": {
    "claimant_name": "Test User",
    "policy_number": "TEST-0000-00000",
    "incident_date": "2025-01-01",
    "incident_description": "Quick test claim — not a real claim",
    "claim_type": "auto"
  }
}')

if echo "$CLAIM_RESP" | grep -q '"result"'; then
  check_pass "insurance_claim_intake executed successfully"
  echo ""
  echo "  Sample response:"
  echo "$CLAIM_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
content = d.get('result', {}).get('content', [{}])
if content and content[0].get('type') == 'text':
    data = json.loads(content[0]['text'])
    claim_id = data.get('claim_id', 'N/A')
    status = data.get('status', 'N/A')
    print(f'    claim_id: {claim_id}')
    print(f'    status: {status}')
" 2>/dev/null || echo "  (install python3 to see response)"
else
  check_fail "insurance_claim_intake failed"
  echo "  Response: $CLAIM_RESP"
fi

# ─── Test 6: Workflow tool — workflow_book_full_trip ──────────────────────────

echo ""
echo -e "${BOLD}Test 6: Workflow tool (workflow_book_full_trip)${RESET}"
TRIP_RESP=$(mcp_call "tools/call" '{
  "name": "workflow_book_full_trip",
  "arguments": {
    "origin": "New York",
    "destination": "London",
    "departure_date": "2025-06-01",
    "return_date": "2025-06-10",
    "travelers": 1,
    "budget_usd": 3000
  }
}')

if echo "$TRIP_RESP" | grep -q '"result"'; then
  check_pass "workflow_book_full_trip executed successfully"
else
  check_fail "workflow_book_full_trip failed"
  echo "  Response: $TRIP_RESP"
fi

# ─── Test 7: Marketplace stats ────────────────────────────────────────────────

echo ""
echo -e "${BOLD}Test 7: Marketplace stats (hiveagent_stats)${RESET}"
STATS_RESP=$(mcp_call "tools/call" '{
  "name": "hiveagent_stats",
  "arguments": {}
}')

if echo "$STATS_RESP" | grep -q '"result"'; then
  check_pass "hiveagent_stats returned data"
  echo ""
  echo "  Marketplace snapshot:"
  echo "$STATS_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
content = d.get('result', {}).get('content', [{}])
if content and content[0].get('type') == 'text':
    stats = json.loads(content[0]['text'])
    for k, v in list(stats.items())[:6]:
        print(f'    {k}: {v}')
" 2>/dev/null || echo "  (install python3 to see stats)"
else
  check_fail "hiveagent_stats failed"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "──────────────────────────────────────────────────────"
echo -e "${BOLD}All tests complete.${RESET}"
echo ""
echo "Next steps:"
echo "  • Python + LangChain → langchain-example.py"
echo "  • Python + CrewAI    → crewai-example.py"
echo "  • Python + AutoGen   → autogen-example.py"
echo "  • Python + OAI SDK   → openai-agents-example.py"
echo ""
echo "Docs: https://hiveagentiq.com"
echo ""
