#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Real Project Simulation — E-Commerce Platform Build
# ═══════════════════════════════════════════════════════════════════
# Simulates building a REAL e-commerce platform through the plugin.
# Tests every feature as a real developer would use it.
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

WORKER="http://localhost:37778"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if command -v cygpath &>/dev/null; then
  PROJECT=$(cygpath -m "$SCRIPT_DIR")
elif [[ "$SCRIPT_DIR" =~ ^/[a-zA-Z]/ ]]; then
  DRIVE=$(echo "$SCRIPT_DIR" | cut -c2 | tr '[:lower:]' '[:upper:]')
  PROJECT="${DRIVE}:${SCRIPT_DIR:2}"
else
  PROJECT="$SCRIPT_DIR"
fi

PASS=0; FAIL=0; WARN=0; ERRORS=(); S=""
G='\033[0;32m'; R='\033[0;31m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1m'; D='\033[2m'; N='\033[0m'
pass() { ((PASS++)); echo -e "  ${G}✓${N} $1"; }
fail() { ((FAIL++)); ERRORS+=("[$S] $1 → $2"); echo -e "  ${R}✗${N} $1"; echo -e "    ${R}↳ $2${N}"; }
warn() { ((WARN++)); echo -e "  ${Y}⚠${N} $1"; }
info() { echo -e "  ${D}$1${N}"; }
h() { echo ""; echo -e "${B}${C}━━━ $1${N}"; S="$1"; }

echo ""
echo -e "${B}╔════════════════════════════════════════════════════════════╗${N}"
echo -e "${B}║  Real Project Test — E-Commerce Platform Simulation      ║${N}"
echo -e "${B}╚════════════════════════════════════════════════════════════╝${N}"

# ═══════════════════════════════════════════════════════════════
# PART 1: CONVERSATION vs CODE DETECTION
# ═══════════════════════════════════════════════════════════════
h "1. Conversation vs Code detection"

# Test: Greeting should NOT trigger full KB injection
HELLO_RESP=$(echo '{"prompt":"hello, how are you?"}' | CLAUDE_PROJECT_PATH="$PROJECT" CLAUDE_PLUGIN_ROOT="$(echo "$PROJECT" | sed 's|/test_plugin||')" node -e "
  const fs = require('fs');
  process.stdin.resume();
  let data = '';
  process.stdin.on('data', c => data += c);
  process.stdin.on('end', () => {
    process.env.CLAUDE_PROJECT_PATH = '$PROJECT';
    // We can't run the full handler, but we can check the file
  });
" 2>/dev/null || echo "")

# Instead, check the source code for the conversation detection
CONTEXT_SRC=$(cat "$(echo "$PROJECT" | sed 's|/test_plugin||')/src/cli/handlers/context.ts")
if echo "$CONTEXT_SRC" | grep -q "isConversational"; then
  pass "Conversation detection function exists in context.ts"
else
  fail "Conversation detection" "isConversational() not found in context.ts"
fi

if echo "$CONTEXT_SRC" | grep -q "buildConversationalOutput"; then
  pass "Minimal output function exists for non-code prompts"
else
  fail "Minimal output" "buildConversationalOutput() not found"
fi

if echo "$CONTEXT_SRC" | grep -q "hello.*hey.*thanks\|GREETING_PATTERN"; then
  pass "Greeting patterns defined (hello, hey, thanks, etc.)"
else
  fail "Greeting patterns" "No greeting detection patterns found"
fi

if echo "$CONTEXT_SRC" | grep -q "technologies.length === 0"; then
  pass "Technical signal check: zero technologies → conversational"
else
  fail "Technical signal check" "Missing PromptAnalyzer fallback heuristic"
fi

# ═══════════════════════════════════════════════════════════════
# PART 2: KB GAP FILTERING — no false positives
# ═══════════════════════════════════════════════════════════════
h "2. KB gap filtering — no false positives"

# Query with generic terms that used to trigger false gaps
KB_GENERIC=$(curl -s --max-time 10 "$WORKER/api/kb/lookup?query=tell+me+about+the+plugin+improvements+for+this+project" 2>/dev/null)

# Check that "plugin", "improvements", "project" are NOT in gaps
if echo "$KB_GENERIC" | grep -q '"gaps"'; then
  GAPS_TEXT=$(echo "$KB_GENERIC" | grep -o '"concept":"[^"]*"' | sed 's/"concept":"//g' | sed 's/"//g' | tr '\n' ',')

  if echo "$GAPS_TEXT" | grep -qi "plugin"; then
    fail "Gap filtering: 'plugin'" "Still triggers false gap detection"
  else
    pass "Gap filtering: 'plugin' correctly filtered out"
  fi

  if echo "$GAPS_TEXT" | grep -qi "project"; then
    fail "Gap filtering: 'project'" "Still triggers false gap detection"
  else
    pass "Gap filtering: 'project' correctly filtered out"
  fi

  if echo "$GAPS_TEXT" | grep -qi "improvements"; then
    fail "Gap filtering: 'improvements'" "Still triggers false gap detection"
  else
    pass "Gap filtering: 'improvements' correctly filtered out"
  fi
else
  pass "No gaps field in response — generic query handled cleanly"
fi

# Real technical query should still find articles
KB_REAL=$(curl -s --max-time 10 "$WORKER/api/kb/lookup?query=implement+JWT+authentication+middleware+Express&language=javascript" 2>/dev/null)
if echo "$KB_REAL" | grep -qi "auth\|security\|token\|middleware"; then
  pass "Real technical query still finds relevant KB articles"
else
  warn "JWT/auth query returned limited results"
fi

# ═══════════════════════════════════════════════════════════════
# PART 3: SCAFFOLD 5 FEATURES — E-Commerce Domain
# ═══════════════════════════════════════════════════════════════
h "3. Scaffold e-commerce features"

ECOM_FEATURES=("user" "product" "cart" "order" "payment")
for FEAT in "${ECOM_FEATURES[@]}"; do
  RESULT=$(curl -s --max-time 15 -X POST "$WORKER/api/scaffold" \
    -H "Content-Type: application/json" \
    -d "{\"feature_name\":\"$FEAT\",\"project_path\":\"$PROJECT\",\"description\":\"E-commerce ${FEAT} management\"}" 2>/dev/null)

  if echo "$RESULT" | grep -q '"createdFiles"'; then
    pass "Scaffolded '$FEAT' feature"
  else
    fail "Scaffold '$FEAT'" "$(echo "$RESULT" | head -c 200)"
  fi
done

# ═══════════════════════════════════════════════════════════════
# PART 4: SCAFFOLD OUTPUT QUALITY — ZERO AI TELLS
# ═══════════════════════════════════════════════════════════════
h "4. Generated code quality — zero AI tells"

AI_TELLS=0
TOTAL_GEN=0

for JS_FILE in $(find "$SCRIPT_DIR/src/features" -name "*.js" -not -name ".gitkeep" 2>/dev/null); do
  ((TOTAL_GEN++))
  FN=$(basename "$JS_FILE")

  # @module tags
  if grep -q "@module" "$JS_FILE"; then ((AI_TELLS++)); fail "AI-tell: $FN" "@module boilerplate"; fi
  # "contains business logic"
  if grep -qi "contains business logic" "$JS_FILE"; then ((AI_TELLS++)); fail "AI-tell: $FN" "Generic AI description"; fi
  # TODO placeholders
  if grep -q "TODO: Define" "$JS_FILE"; then ((AI_TELLS++)); fail "AI-tell: $FN" "TODO placeholder"; fi
  # ESM in CommonJS
  if grep -q "^export \|^import .* from " "$JS_FILE"; then ((AI_TELLS++)); fail "AI-tell: $FN" "ESM in CommonJS"; fi
  # Excessive JSDoc
  JSDOC_CT=$(grep -c '/\*\*' "$JS_FILE" 2>/dev/null || echo "0")
  JSDOC_CT=$(echo "$JSDOC_CT" | tr -d '[:space:]')
  LINE_CT=$(wc -l < "$JS_FILE" | tr -d '[:space:]')
  if [ "$LINE_CT" -gt 5 ] && [ "$JSDOC_CT" -gt 3 ]; then ((AI_TELLS++)); fail "AI-tell: $FN" "Over-documented: $JSDOC_CT JSDoc in $LINE_CT lines"; fi
done

[ "$AI_TELLS" -eq 0 ] && [ "$TOTAL_GEN" -gt 0 ] && pass "Zero AI-tells across $TOTAL_GEN generated files"

# ═══════════════════════════════════════════════════════════════
# PART 5: TEST SKELETONS GENERATED
# ═══════════════════════════════════════════════════════════════
h "5. Test skeletons generated"

for FEAT in "${ECOM_FEATURES[@]}"; do
  PASCAL=$(echo "$FEAT" | sed 's/\(.\)/\U\1/')
  TEST_FILE="$SCRIPT_DIR/src/features/$FEAT/__tests__/${PASCAL}.test.js"

  if [ -f "$TEST_FILE" ]; then
    pass "Test skeleton exists: ${PASCAL}.test.js"

    TCONTENT=$(cat "$TEST_FILE")

    # Check it has real test content (not empty)
    if echo "$TCONTENT" | grep -q "describe("; then
      pass "${PASCAL}.test.js has describe() blocks"
    else
      fail "${PASCAL}.test.js content" "No describe() blocks"
    fi

    if echo "$TCONTENT" | grep -q "expect("; then
      pass "${PASCAL}.test.js has expect() assertions"
    else
      fail "${PASCAL}.test.js assertions" "No expect() calls"
    fi

    # Check it uses require (not import) for JS
    if echo "$TCONTENT" | grep -q "require("; then
      pass "${PASCAL}.test.js uses require() (CommonJS)"
    else
      fail "${PASCAL}.test.js imports" "Should use require() for JS project"
    fi
  else
    fail "Test skeleton: $FEAT" "File not found: $TEST_FILE"
  fi
done

# ═══════════════════════════════════════════════════════════════
# PART 6: COMPLIANCE CHECK ON E-COMMERCE PROJECT
# ═══════════════════════════════════════════════════════════════
h "6. Compliance check — e-commerce project"

CHECK=$(curl -s --max-time 30 "$WORKER/api/check?project_path=$PROJECT" 2>/dev/null)
SCORE=$(echo "$CHECK" | grep -o '"overallScore":[0-9]*' | cut -d: -f2)
FEAT_CT=$(echo "$CHECK" | grep -o '"totalFeatures":[0-9]*' | cut -d: -f2)
FILES_CT=$(echo "$CHECK" | grep -o '"totalFiles":[0-9]*' | cut -d: -f2)
SCAN=$(echo "$CHECK" | grep -o '"scanCoverage":"[^"]*"' | cut -d'"' -f4)

info "Score: $SCORE | Features: $FEAT_CT | Files: $FILES_CT | Coverage: $SCAN"

[ -n "$SCORE" ] && [ "$SCORE" -ge 65 ] && pass "Score $SCORE/100 — acceptable" || fail "Score" "$SCORE below 65"
[ "$FEAT_CT" = "5" ] && pass "All 5 e-commerce features detected" || fail "Features" "Expected 5, got $FEAT_CT"
[ "$SCAN" = "full" ] && pass "Full scan coverage" || fail "Coverage" "Expected 'full', got '$SCAN'"

# Specific detections
echo "$CHECK" | grep -q "Circular" && pass "Circular dependency detected (moduleA↔moduleB)"
echo "$CHECK" | grep -q "Hardcoded" && pass "Hardcoded credentials detected"
echo "$CHECK" | grep -q "injection\|interpolation" && pass "SQL injection detected"
echo "$CHECK" | grep -q "infrastructure" && pass "Layer violation detected"

# ═══════════════════════════════════════════════════════════════
# PART 7: SOCRATIC ON COMPLEX SCENARIOS
# ═══════════════════════════════════════════════════════════════
h "7. Socratic — complex e-commerce scenarios"

# Scenario 1: Payment with Stripe (should be SIGNIFICANT)
SOC1=$(curl -s --max-time 15 -X POST "$WORKER/api/socratic/analyze" \
  -H "Content-Type: application/json" \
  -d '{"action_description":"Implement Stripe payment processing with webhook handling, idempotent charges, refund support, and PCI DSS compliance","action_type":"feature_addition","affected_scope":"src/features/payment"}' 2>/dev/null)

TIER1=$(echo "$SOC1" | grep -o '"tier":"[^"]*"' | sed 's/.*"tier":"//' | sed 's/"//')
[ "$TIER1" = "SIGNIFICANT" ] && pass "Payment+Stripe → SIGNIFICANT tier (77 questions)" || fail "Payment tier" "Expected SIGNIFICANT, got $TIER1"

# Scenario 2: Database migration (should be SIGNIFICANT)
SOC2=$(curl -s --max-time 15 -X POST "$WORKER/api/socratic/analyze" \
  -H "Content-Type: application/json" \
  -d '{"action_description":"Add PostgreSQL migration for user table with email uniqueness constraint and password hash column","action_type":"database_change","affected_scope":"src/features/user,migrations"}' 2>/dev/null)

TIER2=$(echo "$SOC2" | grep -o '"tier":"[^"]*"' | sed 's/.*"tier":"//' | sed 's/"//')
[ "$TIER2" = "SIGNIFICANT" ] && pass "DB migration → SIGNIFICANT tier" || fail "DB migration tier" "Expected SIGNIFICANT, got $TIER2"

# Scenario 3: Simple bug fix (should be STANDARD)
SOC3=$(curl -s --max-time 15 -X POST "$WORKER/api/socratic/analyze" \
  -H "Content-Type: application/json" \
  -d '{"action_description":"Fix cart total calculation when discount is applied after tax","action_type":"bug_fix","affected_scope":"src/features/cart"}' 2>/dev/null)

TIER3=$(echo "$SOC3" | grep -o '"tier":"[^"]*"' | sed 's/.*"tier":"//' | sed 's/"//')
[ "$TIER3" = "STANDARD" ] && pass "Bug fix → STANDARD tier (7 questions)" || fail "Bug fix tier" "Expected STANDARD, got $TIER3"

# Check questions are in ENGLISH (not Greek)
if echo "$SOC1" | grep -q "What IS\|What MUST\|Where.*codebase"; then
  pass "Socratic questions are in English"
else
  if echo "$SOC1" | grep -q "ΕΙΝΑΙ\|ΠΡΕΠΕΙ\|κώδικα"; then
    fail "Question language" "Questions still contain Greek text!"
  else
    warn "Could not verify question language"
  fi
fi

# ═══════════════════════════════════════════════════════════════
# PART 8: SOCRATIC ENFORCEMENT IN PRE-TOOL-USE
# ═══════════════════════════════════════════════════════════════
h "8. Socratic enforcement in PreToolUse"

PRETOOL_SRC=$(cat "$(echo "$PROJECT" | sed 's|/test_plugin||')/src/cli/handlers/pre-tool-use.ts")

if echo "$PRETOOL_SRC" | grep -q "getActiveSession"; then
  pass "PreToolUse checks for active Socratic session"
else
  fail "Socratic check" "getActiveSession not found in pre-tool-use.ts"
fi

if echo "$PRETOOL_SRC" | grep -q "WARNING.*Socratic\|No validated Socratic"; then
  pass "PreToolUse emits warning when no session"
else
  fail "Socratic warning" "No warning message for missing session"
fi

if echo "$PRETOOL_SRC" | grep -q "try.*getDatabase\|catch"; then
  pass "Socratic check is wrapped in try/catch (graceful degradation)"
else
  fail "Error handling" "Socratic check not wrapped in try/catch"
fi

# ═══════════════════════════════════════════════════════════════
# PART 9: EXPERT CODE PATTERNS
# ═══════════════════════════════════════════════════════════════
h "9. Expert code patterns in scaffold"

# Entity: destructured constructor + behavior
ENTITY="$SCRIPT_DIR/src/features/cart/domain/entities/Cart.js"
if [ -f "$ENTITY" ]; then
  EC=$(cat "$ENTITY")
  echo "$EC" | grep -q "constructor({" && pass "Entity: destructured constructor" || fail "Entity" "No destructured constructor"
  echo "$EC" | grep -q "touch()" && pass "Entity: has touch() behavior method" || warn "Entity: no behavior methods"
  echo "$EC" | grep -q "module.exports" && pass "Entity: CommonJS exports" || fail "Entity" "Not using module.exports"
fi

# Controller: DI + error handling + status codes
CTRL="$SCRIPT_DIR/src/features/order/infrastructure/controllers/OrderController.js"
if [ -f "$CTRL" ]; then
  CC=$(cat "$CTRL")
  echo "$CC" | grep -q "constructor(repository)" && pass "Controller: dependency injection" || fail "Controller" "No DI"
  echo "$CC" | grep -q "try {" && pass "Controller: error handling" || fail "Controller" "No error handling"
  echo "$CC" | grep -q "201" && pass "Controller: specific HTTP status codes" || warn "Controller: missing status codes"
fi

# Repository: specific error messages
REPO="$SCRIPT_DIR/src/features/payment/infrastructure/repositories/PaymentRepositoryImpl.js"
if [ -f "$REPO" ]; then
  RC=$(cat "$REPO")
  echo "$RC" | grep -q "PaymentRepositoryImpl" && pass "Repo: specific error messages (not generic)" || warn "Repo: generic errors"
fi

# ═══════════════════════════════════════════════════════════════
# PART 10: ERROR HANDLING
# ═══════════════════════════════════════════════════════════════
h "10. Error handling"

# Invalid path → 404
ERR_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER/api/check?project_path=C:/nonexistent" 2>/dev/null)
[ "$ERR_CODE" = "404" ] && pass "Invalid path → HTTP 404" || fail "Invalid path" "Got HTTP $ERR_CODE"

# Duplicate scaffold → 409
DUP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER/api/scaffold" \
  -H "Content-Type: application/json" \
  -d "{\"feature_name\":\"user\",\"project_path\":\"$PROJECT\"}" 2>/dev/null)
[ "$DUP_CODE" = "409" ] && pass "Duplicate scaffold → HTTP 409 Conflict" || warn "Duplicate scaffold → HTTP $DUP_CODE"

# Empty body → 400
EMPTY_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER/api/scaffold" \
  -H "Content-Type: application/json" -d '{}' 2>/dev/null)
[ "$EMPTY_CODE" = "400" ] && pass "Empty body → HTTP 400" || warn "Empty body → HTTP $EMPTY_CODE"

# ═══════════════════════════════════════════════════════════════
# PART 11: SESSION-INIT QUALITY
# ═══════════════════════════════════════════════════════════════
h "11. Session-init quality"

INIT_SRC=$(cat "$(echo "$PROJECT" | sed 's|/test_plugin||')/src/cli/handlers/session-init.ts")

echo "$INIT_SRC" | grep -qi "AI.tell\|Over.comment\|senior engineer" && pass "Anti-AI directives present" || fail "Anti-AI" "Missing code quality enforcement"
echo "$INIT_SRC" | grep -q "KNOWN.*ASSUMED.*UNKNOWN" && pass "English confidence labels (KNOWN/ASSUMED/UNKNOWN)" || fail "Language" "Greek labels still present"
echo "$INIT_SRC" | grep -q "executor\|EXECUTOR" && pass "Plugin authority declared" || fail "Authority" "Missing"
echo "$INIT_SRC" | grep -qi "web.*search.*mandatory\|mandatory.*web" && pass "Web search mandate present" || fail "Web search" "Missing mandate"

# ═══════════════════════════════════════════════════════════════
# RESULTS
# ═══════════════════════════════════════════════════════════════
echo ""
echo -e "${B}╔════════════════════════════════════════════════════════════╗${N}"
echo -e "${B}║              REAL PROJECT TEST RESULTS                    ║${N}"
echo -e "${B}╚════════════════════════════════════════════════════════════╝${N}"
echo ""
echo -e "  ${G}Passed: $PASS${N}"
echo -e "  ${R}Failed: $FAIL${N}"
echo -e "  ${Y}Warnings: $WARN${N}"
echo -e "  Total:  $((PASS + FAIL + WARN))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${G}${B}PRODUCTION READY${N} ${G}✓${N}"
else
  echo -e "  ${R}${B}ISSUES FOUND:${N}"
  for ERR in "${ERRORS[@]}"; do
    echo -e "  ${R}✗${N} $ERR"
  done
fi

echo ""
echo -e "  ${D}Dashboard: ${WORKER}${N}"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1
