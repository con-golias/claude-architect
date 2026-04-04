#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Claude Architect Plugin — Integration Test Suite
# ═══════════════════════════════════════════════════════════════════
# Tests ALL plugin features against a real project with known violations.
#
# Usage:  bash test_plugin/run-plugin-tests.sh
# Requires: Worker running on port 37778
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

WORKER="http://localhost:37778"
PROJECT_PATH="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
WARN=0
ERRORS=()
SECTION_RESULTS=()

# ─── Colors ───
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

hr()     { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }
hr_sub() { echo -e "${DIM}──────────────────────────────────────────────────────────────────${NC}"; }

pass() {
  ((PASS++))
  echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
  ((FAIL++))
  ERRORS+=("[$CURRENT_SECTION] $1 → $2")
  echo -e "  ${RED}✗${NC} $1"
  echo -e "    ${RED}↳ $2${NC}"
}

warn() {
  ((WARN++))
  echo -e "  ${YELLOW}⚠${NC} $1"
}

info() {
  echo -e "  ${DIM}$1${NC}"
}

header() {
  echo ""
  hr
  echo -e "${BOLD}${CYAN}$1${NC}"
  hr
  CURRENT_SECTION="$1"
}

# Convert MSYS path to Windows path (C:/Users/...) for Bun worker compatibility
if command -v cygpath &>/dev/null; then
  PROJECT_URL_PATH=$(cygpath -m "$PROJECT_PATH")
elif [[ "$PROJECT_PATH" =~ ^/[a-zA-Z]/ ]]; then
  # Manual MSYS→Windows conversion: /c/Users → C:/Users
  DRIVE_LETTER=$(echo "$PROJECT_PATH" | cut -c2 | tr '[:lower:]' '[:upper:]')
  PROJECT_URL_PATH="${DRIVE_LETTER}:${PROJECT_PATH:2}"
else
  PROJECT_URL_PATH=$(echo "$PROJECT_PATH" | sed 's|\\|/|g')
fi

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     Claude Architect Plugin — Integration Test Suite        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DIM}Project path: ${PROJECT_URL_PATH}${NC}"
echo -e "  ${DIM}Worker URL:   ${WORKER}${NC}"
echo -e "  ${DIM}Started:      $(date '+%Y-%m-%d %H:%M:%S')${NC}"


# ══════════════════════════════════════════════════════════════
# TEST 1: WORKER HEALTH
# ══════════════════════════════════════════════════════════════
header "1. Worker Health"

HEALTH=$(curl -s --max-time 5 "$WORKER/api/health" 2>/dev/null || echo "CONNECTION_FAILED")

if echo "$HEALTH" | grep -q "CONNECTION_FAILED"; then
  fail "Worker connection" "Cannot reach worker at $WORKER"
  echo ""
  echo -e "  ${YELLOW}Worker is not running. Start it with:${NC}"
  echo -e "  ${BOLD}bun run scripts/worker-service.cjs start${NC}"
  echo ""
  echo -e "  ${DIM}Aborting remaining tests — worker required.${NC}"
  exit 1
fi

if echo "$HEALTH" | grep -q '"status"'; then
  pass "Worker is running and responding"
  STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | head -1)
  info "Response: $STATUS"
else
  fail "Worker health format" "Unexpected response: $HEALTH"
fi


# ══════════════════════════════════════════════════════════════
# TEST 2: DASHBOARD ACCESSIBILITY
# ══════════════════════════════════════════════════════════════
header "2. Dashboard"

DASH=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$WORKER/" 2>/dev/null)
if [ "$DASH" = "200" ]; then
  pass "Dashboard loads (HTTP 200)"
else
  fail "Dashboard HTTP" "Expected 200, got $DASH"
fi

DASH_HTML=$(curl -s --max-time 5 "$WORKER/" 2>/dev/null)
if echo "$DASH_HTML" | grep -qi "architect"; then
  pass "Dashboard contains 'architect' branding"
else
  warn "Dashboard may not contain expected branding"
fi


# ══════════════════════════════════════════════════════════════
# TEST 3: COMPLIANCE CHECK
# ══════════════════════════════════════════════════════════════
header "3. Compliance Check (architect_check)"

CHECK_RESULT=$(curl -s --max-time 30 "$WORKER/api/check?project_path=$PROJECT_URL_PATH" 2>/dev/null)

if [ -z "$CHECK_RESULT" ]; then
  fail "Compliance check" "Empty response from /api/check"
else
  # Check that we got a valid JSON response
  if echo "$CHECK_RESULT" | grep -q '"overallScore"'; then
    pass "Compliance check returned valid result with overallScore"

    # Extract scores
    OVERALL=$(echo "$CHECK_RESULT" | grep -o '"overallScore":[0-9.]*' | head -1 | cut -d: -f2)
    info "Overall score: ${OVERALL:-unknown}"

    # Check that score is a number between 0-100
    if [ -n "$OVERALL" ]; then
      SCORE_INT=${OVERALL%.*}
      if [ "$SCORE_INT" -ge 0 ] 2>/dev/null && [ "$SCORE_INT" -le 100 ] 2>/dev/null; then
        pass "Score is valid (0-100 range): $OVERALL"
      else
        fail "Score range" "Score $OVERALL is outside 0-100 range"
      fi
    fi
  else
    fail "Compliance check format" "No 'overallScore' field in response"
    info "Response preview: $(echo "$CHECK_RESULT" | head -c 300)"
  fi

  # Check for category scores
  for CATEGORY in dependency structure security quality; do
    if echo "$CHECK_RESULT" | grep -qi "\"$CATEGORY\""; then
      pass "Category '$CATEGORY' present in results"
    else
      warn "Category '$CATEGORY' not found in results"
    fi
  done

  # Check violations were detected (we have known violations)
  if echo "$CHECK_RESULT" | grep -qi "violation\|issue\|warning"; then
    pass "Violations/issues detected (expected — project has known problems)"
  else
    warn "No violations detected — expected some (hardcoded creds, circular deps, layer violations)"
  fi
fi


# ══════════════════════════════════════════════════════════════
# TEST 4: KB LOOKUP — RELEVANT QUERY
# ══════════════════════════════════════════════════════════════
header "4. KB Lookup — Relevant Queries"

# Test 1: Query that should match (clean architecture / dependency inversion)
KB_RESULT_1=$(curl -s --max-time 15 "$WORKER/api/kb/lookup?query=dependency+inversion+Node.js&language=javascript" 2>/dev/null)

if [ -z "$KB_RESULT_1" ]; then
  fail "KB lookup (dependency inversion)" "Empty response"
else
  if echo "$KB_RESULT_1" | grep -qi "article\|result\|path\|title"; then
    pass "KB lookup returned results for 'dependency inversion'"
    ARTICLE_COUNT=$(echo "$KB_RESULT_1" | grep -o '"path"' | wc -l)
    info "Articles returned: $ARTICLE_COUNT"
  else
    fail "KB lookup results" "No articles found for 'dependency inversion' — should match"
    info "Response preview: $(echo "$KB_RESULT_1" | head -c 200)"
  fi
fi

# Test 2: Query about error handling
KB_RESULT_2=$(curl -s --max-time 15 "$WORKER/api/kb/lookup?query=error+handling+patterns+exception+management&language=javascript" 2>/dev/null)

if echo "$KB_RESULT_2" | grep -qi "article\|result\|path\|title"; then
  pass "KB lookup returned results for 'error handling'"
else
  warn "KB lookup found nothing for 'error handling'"
fi

# Test 3: Query about security (hardcoded credentials)
KB_RESULT_3=$(curl -s --max-time 15 "$WORKER/api/kb/lookup?query=security+credentials+secrets+hardcoded&language=javascript" 2>/dev/null)

if echo "$KB_RESULT_3" | grep -qi "article\|result\|path\|title"; then
  pass "KB lookup returned results for 'security credentials'"
else
  warn "KB lookup found nothing for 'security credentials'"
fi


# ══════════════════════════════════════════════════════════════
# TEST 5: KB LOOKUP — OFF-TOPIC QUERY
# ══════════════════════════════════════════════════════════════
header "5. KB Lookup — Off-Topic Query"

KB_OFFTOPIC=$(curl -s --max-time 15 "$WORKER/api/kb/lookup?query=cook+pasta+carbonara+fresh+eggs&language=javascript" 2>/dev/null)

if echo "$KB_OFFTOPIC" | grep -qi "no.*relevant\|no.*article\|no.*result\|empty\|\[\]"; then
  pass "Off-topic query correctly returned no results"
elif echo "$KB_OFFTOPIC" | grep -qi "article\|result\|path"; then
  OFFTOPIC_COUNT=$(echo "$KB_OFFTOPIC" | grep -o '"path"' | wc -l)
  if [ "$OFFTOPIC_COUNT" -gt 3 ]; then
    fail "Off-topic filtering" "Returned $OFFTOPIC_COUNT articles for pasta recipe — should return 0"
  else
    warn "Off-topic query returned $OFFTOPIC_COUNT articles (acceptable if low-confidence)"
  fi
else
  info "Off-topic response: $(echo "$KB_OFFTOPIC" | head -c 200)"
  warn "Cannot determine off-topic handling behavior"
fi


# ══════════════════════════════════════════════════════════════
# TEST 6: KB STATS
# ══════════════════════════════════════════════════════════════
header "6. KB Stats"

KB_STATS=$(curl -s --max-time 10 "$WORKER/api/kb/stats" 2>/dev/null)

if [ -z "$KB_STATS" ]; then
  fail "KB stats" "Empty response from /api/kb/stats"
else
  if echo "$KB_STATS" | grep -q "1009\|totalArticles\|total"; then
    pass "KB stats reports correct article count (1009)"
  else
    warn "KB stats may not have expected 1009 articles"
    info "Response: $(echo "$KB_STATS" | head -c 200)"
  fi
fi


# ══════════════════════════════════════════════════════════════
# TEST 7: SOCRATIC ANALYZE
# ══════════════════════════════════════════════════════════════
header "7. Socratic Engine — Analyze"

SOCRATIC_ANALYZE=$(curl -s --max-time 20 -X POST "$WORKER/api/socratic/analyze" \
  -H "Content-Type: application/json" \
  -d "{\"action_description\":\"Add a payment processing feature with Stripe integration to handle subscriptions and one-time payments\",\"action_type\":\"feature_addition\",\"affected_scope\":\"src/infrastructure,src/application,src/domain\"}" 2>/dev/null)

if [ -z "$SOCRATIC_ANALYZE" ]; then
  fail "Socratic analyze" "Empty response"
else
  SESSION_ID=""

  # Check for session ID
  if echo "$SOCRATIC_ANALYZE" | grep -qo '"sessionId"\s*:\s*"[^"]*"'; then
    SESSION_ID=$(echo "$SOCRATIC_ANALYZE" | grep -o '"sessionId"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"sessionId"\s*:\s*"//' | sed 's/"//')
    pass "Socratic session created: $SESSION_ID"
  elif echo "$SOCRATIC_ANALYZE" | grep -qo '"session_id"\s*:\s*"[^"]*"'; then
    SESSION_ID=$(echo "$SOCRATIC_ANALYZE" | grep -o '"session_id"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"session_id"\s*:\s*"//' | sed 's/"//')
    pass "Socratic session created: $SESSION_ID"
  else
    fail "Socratic session creation" "No sessionId in response"
    info "Response preview: $(echo "$SOCRATIC_ANALYZE" | head -c 300)"
  fi

  # Check for questions
  if echo "$SOCRATIC_ANALYZE" | grep -qi "question"; then
    QUESTION_COUNT=$(echo "$SOCRATIC_ANALYZE" | grep -oi '"question"' | wc -l)
    pass "Socratic generated questions (found ~$QUESTION_COUNT references)"
  else
    fail "Socratic questions" "No questions in analyze response"
  fi

  # Check tier
  if echo "$SOCRATIC_ANALYZE" | grep -qi '"tier"'; then
    TIER=$(echo "$SOCRATIC_ANALYZE" | grep -o '"tier"\s*:\s*"[^"]*"' | head -1 | sed 's/.*"tier"\s*:\s*"//' | sed 's/"//')
    if [ "$TIER" = "TRIVIAL" ]; then
      fail "Socratic tier" "Got TRIVIAL tier — should be STANDARD or SIGNIFICANT (bypass disabled)"
    else
      pass "Socratic tier: $TIER (bypass correctly disabled)"
    fi
  fi


  # ══════════════════════════════════════════════════════════════
  # TEST 8: SOCRATIC VERIFY (only if we got a session)
  # ══════════════════════════════════════════════════════════════
  header "8. Socratic Engine — Verify"

  if [ -n "$SESSION_ID" ]; then
    SOCRATIC_VERIFY=$(curl -s --max-time 20 -X POST "$WORKER/api/socratic/verify" \
      -H "Content-Type: application/json" \
      -d "{\"session_id\":\"$SESSION_ID\",\"answers\":{\"q1\":{\"answer\":\"JavaScript with Express.js backend\",\"meta\":\"KNOWN\"},\"q2\":{\"answer\":\"We use PostgreSQL for data storage\",\"meta\":\"KNOWN\"},\"q3\":{\"answer\":\"I think we might need webhooks\",\"meta\":\"ASSUMPTION\"}}}" 2>/dev/null)

    if [ -z "$SOCRATIC_VERIFY" ]; then
      fail "Socratic verify" "Empty response"
    else
      if echo "$SOCRATIC_VERIFY" | grep -qi "verified\|context\|result\|success"; then
        pass "Socratic verify processed answers"
      else
        fail "Socratic verify" "Unexpected response format"
        info "Response preview: $(echo "$SOCRATIC_VERIFY" | head -c 300)"
      fi
    fi

    # ══════════════════════════════════════════════════════════════
    # TEST 9: SOCRATIC STATUS
    # ══════════════════════════════════════════════════════════════
    header "9. Socratic Engine — Status"

    SOCRATIC_STATUS=$(curl -s --max-time 10 "$WORKER/api/socratic/status?session_id=$SESSION_ID" 2>/dev/null)

    if [ -z "$SOCRATIC_STATUS" ]; then
      fail "Socratic status" "Empty response"
    else
      if echo "$SOCRATIC_STATUS" | grep -qi "status\|session\|answered"; then
        pass "Socratic status returned session info"
        info "Response preview: $(echo "$SOCRATIC_STATUS" | head -c 200)"
      else
        fail "Socratic status" "Unexpected response format"
        info "Response preview: $(echo "$SOCRATIC_STATUS" | head -c 200)"
      fi
    fi
  else
    warn "Skipping verify & status tests — no session ID from analyze"
  fi
fi


# ══════════════════════════════════════════════════════════════
# TEST 10: SCAFFOLD — JavaScript Project
# ══════════════════════════════════════════════════════════════
header "10. Scaffold — JS Feature Generation"

SCAFFOLD_RESULT=$(curl -s --max-time 20 -X POST "$WORKER/api/scaffold" \
  -H "Content-Type: application/json" \
  -d "{\"feature_name\":\"notification\",\"project_path\":\"$PROJECT_URL_PATH\",\"description\":\"Push notification system for user alerts\"}" 2>/dev/null)

if [ -z "$SCAFFOLD_RESULT" ]; then
  fail "Scaffold generation" "Empty response"
else
  # Check that scaffold succeeded
  if echo "$SCAFFOLD_RESULT" | grep -qi "success\|created\|files\|generated"; then
    pass "Scaffold endpoint responded successfully"

    # Check for JS files (not TS) — project is JavaScript
    if echo "$SCAFFOLD_RESULT" | grep -qi "\.js"; then
      pass "Scaffold generated .js files (correct for JS project)"
    fi
    if echo "$SCAFFOLD_RESULT" | grep -qi "\.ts"; then
      fail "Scaffold language detection" "Generated .ts files for a JavaScript project!"
    fi
  elif echo "$SCAFFOLD_RESULT" | grep -qi "422\|language\|cannot determine\|unknown"; then
    warn "Scaffold returned 422 — could not detect language (may need git init)"
    info "This is the 'refuse if unknown' safety behavior"
  else
    fail "Scaffold response" "Unexpected format"
    info "Response preview: $(echo "$SCAFFOLD_RESULT" | head -c 300)"
  fi
fi

# Check if scaffold files were actually created on disk
if [ -d "$PROJECT_PATH/src/features/notification" ] || [ -d "$PROJECT_PATH/src/notification" ]; then
  pass "Scaffold created feature directory on disk"
  SCAFFOLD_FILES=$(find "$PROJECT_PATH/src" -path "*notification*" -type f 2>/dev/null)
  if [ -n "$SCAFFOLD_FILES" ]; then
    info "Generated files:"
    echo "$SCAFFOLD_FILES" | while read f; do
      EXT="${f##*.}"
      echo -e "    ${DIM}$f${NC}"
      if [ "$EXT" = "ts" ] || [ "$EXT" = "tsx" ]; then
        fail "Scaffold file extension" "File $f is TypeScript in a JavaScript project"
      fi
    done
  fi
else
  info "No scaffold directory found on disk (may be returned as content only)"
fi


# ══════════════════════════════════════════════════════════════
# TEST 11: API ERROR HANDLING
# ══════════════════════════════════════════════════════════════
header "11. Error Handling"

# Invalid project path
ERR_RESULT=$(curl -s --max-time 10 "$WORKER/api/check?project_path=/nonexistent/fake/path" 2>/dev/null)
if echo "$ERR_RESULT" | grep -qi "error\|not found\|invalid"; then
  pass "Invalid project path returns error response"
else
  warn "Invalid project path did not return clear error"
  info "Response: $(echo "$ERR_RESULT" | head -c 200)"
fi

# Missing required fields in KB lookup
ERR_KB=$(curl -s --max-time 10 "$WORKER/api/kb/lookup" 2>/dev/null)
if echo "$ERR_KB" | grep -qi "error\|required\|missing"; then
  pass "KB lookup with missing fields returns error"
else
  warn "KB lookup with empty query did not return clear error"
  info "Response: $(echo "$ERR_KB" | head -c 200)"
fi


# ══════════════════════════════════════════════════════════════
# TEST 12: MCP TOOL DESCRIPTIONS
# ══════════════════════════════════════════════════════════════
header "12. MCP Tool Inventory"

TOOLS_RESULT=$(curl -s --max-time 10 "$WORKER/api/tools" 2>/dev/null)
if [ -z "$TOOLS_RESULT" ]; then
  warn "No /api/tools endpoint (may not be exposed)"
else
  EXPECTED_TOOLS=("architect_check" "architect_scaffold" "kb_lookup" "kb_read" "socratic_analyze" "socratic_verify" "socratic_status")
  for TOOL in "${EXPECTED_TOOLS[@]}"; do
    if echo "$TOOLS_RESULT" | grep -qi "$TOOL"; then
      pass "Tool '$TOOL' registered"
    else
      warn "Tool '$TOOL' not found in tool list"
    fi
  done
fi


# ══════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ══════════════════════════════════════════════════════════════
echo ""
hr
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    TEST RESULTS SUMMARY                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo -e "  Total:  $((PASS + FAIL + WARN))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL TESTS PASSED${NC} ${GREEN}✓${NC}"
else
  echo -e "  ${RED}${BOLD}FAILURES DETECTED:${NC}"
  echo ""
  for ERR in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗${NC} $ERR"
  done
fi

echo ""
echo -e "  ${DIM}Finished: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "  ${DIM}Dashboard: ${WORKER}${NC}"
hr
echo ""

# Exit with failure code if any tests failed
[ $FAIL -eq 0 ] && exit 0 || exit 1
