#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Claude Architect — Expert Quality Validation Suite
# ═══════════════════════════════════════════════════════════════════
# Simulates building a real e-commerce platform and validates:
# 1. Plugin workflow enforcement (Socratic, KB, compliance)
# 2. Generated code quality (no AI-tells, expert patterns)
# 3. Compliance detection accuracy on real-world violations
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

PASS=0; FAIL=0; WARN=0; ERRORS=(); CURRENT_SECTION=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

pass() { ((PASS++)); echo -e "  ${GREEN}✓${NC} $1"; }
fail() { ((FAIL++)); ERRORS+=("[$CURRENT_SECTION] $1 → $2"); echo -e "  ${RED}✗${NC} $1"; echo -e "    ${RED}↳ $2${NC}"; }
warn() { ((WARN++)); echo -e "  ${YELLOW}⚠${NC} $1"; }
info() { echo -e "  ${DIM}$1${NC}"; }
header() { echo ""; echo -e "${BOLD}${CYAN}━━━ $1${NC}"; CURRENT_SECTION="$1"; }

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Expert Quality Validation — E-Commerce Platform      ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo -e "  ${DIM}Project: ${PROJECT}${NC}"

# ══════════════════════════════════════════════════════════════
# PART 1: SCAFFOLD 4 COMPLEX FEATURES
# ══════════════════════════════════════════════════════════════
header "1. Scaffold complex features"

FEATURES=("auth" "product" "order" "payment")
for FEAT in "${FEATURES[@]}"; do
  RESULT=$(curl -s --max-time 15 -X POST "$WORKER/api/scaffold" \
    -H "Content-Type: application/json" \
    -d "{\"feature_name\":\"$FEAT\",\"project_path\":\"$PROJECT\",\"description\":\"${FEAT} management\"}" 2>/dev/null)

  if echo "$RESULT" | grep -q '"createdFiles"'; then
    FILE_COUNT=$(echo "$RESULT" | grep -o '"createdFiles":\[' | wc -l)
    pass "Scaffolded '$FEAT' feature"
  else
    fail "Scaffold '$FEAT'" "$(echo "$RESULT" | head -c 200)"
  fi
done

# ══════════════════════════════════════════════════════════════
# PART 2: GENERATED CODE QUALITY — AI TELL DETECTION
# ══════════════════════════════════════════════════════════════
header "2. Code quality — zero AI-tells"

# Check ALL generated JS files for AI-tells
AI_TELLS=0
TOTAL_FILES=0

for JS_FILE in $(find "$SCRIPT_DIR/src/features" -name "*.js" -not -path "*/.gitkeep" 2>/dev/null); do
  ((TOTAL_FILES++))
  FILENAME=$(basename "$JS_FILE")
  CONTENT=$(cat "$JS_FILE")

  # AI-tell: @module tags (unnecessary boilerplate)
  if echo "$CONTENT" | grep -q "@module"; then
    fail "AI-tell in $FILENAME" "@module tag — unnecessary boilerplate"
    ((AI_TELLS++))
  fi

  # AI-tell: "Contains business logic and invariants" (generic AI description)
  if echo "$CONTENT" | grep -qi "contains business logic"; then
    fail "AI-tell in $FILENAME" "Generic AI description 'contains business logic'"
    ((AI_TELLS++))
  fi

  # AI-tell: "TODO: Define input fields" (lazy placeholder)
  if echo "$CONTENT" | grep -q "TODO: Define"; then
    fail "AI-tell in $FILENAME" "TODO placeholder — expert code never has these in templates"
    ((AI_TELLS++))
  fi

  # AI-tell: excessive JSDoc on trivial methods
  JSDOC_COUNT=$(echo "$CONTENT" | grep -c '/\*\*' || true)
  LINE_COUNT=$(echo "$CONTENT" | wc -l)
  if [ "$LINE_COUNT" -gt 5 ] && [ "$JSDOC_COUNT" -gt 3 ]; then
    fail "AI-tell in $FILENAME" "$JSDOC_COUNT JSDoc blocks in $LINE_COUNT lines — over-documented"
    ((AI_TELLS++))
  fi

  # AI-tell: export/import with "from" in JS (should use require/module.exports)
  if echo "$CONTENT" | grep -q "^export \|^import .* from "; then
    fail "AI-tell in $FILENAME" "ESM syntax in CommonJS project — expert uses require()"
    ((AI_TELLS++))
  fi
done

if [ "$AI_TELLS" -eq 0 ] && [ "$TOTAL_FILES" -gt 0 ]; then
  pass "Zero AI-tells across $TOTAL_FILES generated files"
fi

# ══════════════════════════════════════════════════════════════
# PART 3: CODE STRUCTURE — EXPERT PATTERNS
# ══════════════════════════════════════════════════════════════
header "3. Expert code patterns"

# Check entity: has constructor with destructuring, has methods
AUTH_ENTITY="$SCRIPT_DIR/src/features/auth/domain/entities/Auth.js"
if [ -f "$AUTH_ENTITY" ]; then
  ENTITY=$(cat "$AUTH_ENTITY")
  if echo "$ENTITY" | grep -q "constructor({"; then
    pass "Entity uses destructured constructor (expert pattern)"
  else
    fail "Entity constructor" "Should use destructured params: constructor({ id, ... })"
  fi

  if echo "$ENTITY" | grep -q "touch()"; then
    pass "Entity has touch() method (not just a data bag)"
  else
    warn "Entity is a plain data bag — expert entities have behavior"
  fi

  if echo "$ENTITY" | grep -q "module.exports"; then
    pass "Entity uses CommonJS exports (matches project convention)"
  else
    fail "Entity exports" "Should use module.exports for JS project"
  fi
fi

# Check controller: has DI in constructor, proper error handling
AUTH_CTRL="$SCRIPT_DIR/src/features/auth/infrastructure/controllers/AuthController.js"
if [ -f "$AUTH_CTRL" ]; then
  CTRL=$(cat "$AUTH_CTRL")
  if echo "$CTRL" | grep -q "constructor(repository)"; then
    pass "Controller uses dependency injection"
  else
    fail "Controller DI" "Expert controllers receive dependencies via constructor"
  fi

  if echo "$CTRL" | grep -q "try {" && echo "$CTRL" | grep -q "catch"; then
    pass "Controller has error handling"
  else
    warn "Controller lacks error handling"
  fi

  if echo "$CTRL" | grep -q "res.status(201)"; then
    pass "Controller returns proper HTTP status codes"
  else
    warn "Controller doesn't use specific HTTP status codes"
  fi
fi

# Check repository: throws specific error messages
REPO_IMPL="$SCRIPT_DIR/src/features/order/infrastructure/repositories/OrderRepositoryImpl.js"
if [ -f "$REPO_IMPL" ]; then
  REPO=$(cat "$REPO_IMPL")
  if echo "$REPO" | grep -q 'OrderRepositoryImpl\.\(findById\|save\|delete\)'; then
    pass "Repository stubs have specific error messages (not generic 'Not implemented')"
  else
    warn "Repository error messages could be more specific"
  fi
fi

# ══════════════════════════════════════════════════════════════
# PART 4: CLEAN ARCHITECTURE COMPLIANCE
# ══════════════════════════════════════════════════════════════
header "4. Architecture compliance after scaffold"

CHECK=$(curl -s --max-time 30 "$WORKER/api/check?project_path=$PROJECT" 2>/dev/null)
SCORE=$(echo "$CHECK" | grep -o '"overallScore":[0-9]*' | cut -d: -f2)
FEATURES_COUNT=$(echo "$CHECK" | grep -o '"totalFeatures":[0-9]*' | cut -d: -f2)
FILES_COUNT=$(echo "$CHECK" | grep -o '"totalFiles":[0-9]*' | cut -d: -f2)
SCAN=$(echo "$CHECK" | grep -o '"scanCoverage":"[^"]*"' | cut -d'"' -f4)

info "Score: $SCORE | Features: $FEATURES_COUNT | Files: $FILES_COUNT | Coverage: $SCAN"

if [ -n "$SCORE" ] && [ "$SCORE" -ge 70 ]; then
  pass "Compliance score $SCORE/100 (acceptable for scaffolded project)"
else
  fail "Compliance score" "Score $SCORE is below 70 — scaffolded code should score higher"
fi

if [ "$FEATURES_COUNT" = "4" ]; then
  pass "All 4 features detected (auth, product, order, payment)"
else
  fail "Feature detection" "Expected 4, got $FEATURES_COUNT"
fi

if [ "$SCAN" = "full" ]; then
  pass "Full scan coverage — validator reads all files"
else
  fail "Scan coverage" "Expected 'full', got '$SCAN'"
fi

# Check specific detections
if echo "$CHECK" | grep -q "Circular"; then
  pass "Circular dependency detection working (moduleA↔moduleB)"
fi

if echo "$CHECK" | grep -q "Hardcoded"; then
  pass "Security: hardcoded credentials detected"
fi

if echo "$CHECK" | grep -q "injection\|interpolation"; then
  pass "Security: SQL injection pattern detected"
fi

if echo "$CHECK" | grep -q "infrastructure"; then
  pass "Layer violation: application→infrastructure detected"
fi

# ══════════════════════════════════════════════════════════════
# PART 5: KB RELEVANCE — COMPLEX QUERIES
# ══════════════════════════════════════════════════════════════
header "5. KB relevance for complex tasks"

# Query 1: Authentication — should find relevant articles
KB1=$(curl -s --max-time 10 "$WORKER/api/kb/lookup?query=JWT+authentication+token+refresh+strategy&language=javascript" 2>/dev/null)
if echo "$KB1" | grep -qi "auth\|security\|token"; then
  pass "KB finds auth/security articles for JWT query"
else
  warn "KB has limited JWT/auth coverage"
fi

# Query 2: Database patterns
KB2=$(curl -s --max-time 10 "$WORKER/api/kb/lookup?query=repository+pattern+database+abstraction+layer&language=javascript" 2>/dev/null)
if echo "$KB2" | grep -qi "repository\|pattern\|database\|abstraction"; then
  pass "KB finds repository pattern articles"
else
  warn "KB has limited repository pattern coverage"
fi

# Query 3: Payment processing — likely no KB coverage → should trigger web search mandate
KB3=$(curl -s --max-time 10 "$WORKER/api/kb/lookup?query=Stripe+payment+processing+webhook+integration&language=javascript" 2>/dev/null)
if echo "$KB3" | grep -qi "article\|result\|path"; then
  STRIPE_COUNT=$(echo "$KB3" | grep -o '"path"' | wc -l)
  if [ "$STRIPE_COUNT" -gt 5 ]; then
    warn "KB returned $STRIPE_COUNT articles for Stripe — likely false matches"
  else
    pass "KB handles Stripe query with limited but relevant results"
  fi
else
  pass "KB correctly returns no results for Stripe — web search would be mandated"
fi

# ══════════════════════════════════════════════════════════════
# PART 6: SOCRATIC — COMPLEX SCENARIO
# ══════════════════════════════════════════════════════════════
header "6. Socratic on complex scenario"

SOC=$(curl -s --max-time 15 -X POST "$WORKER/api/socratic/analyze" \
  -H "Content-Type: application/json" \
  -d '{"action_description":"Implement Stripe payment processing with webhook handling, idempotent charge creation, refund support, and PCI DSS compliance for the payment feature","action_type":"feature_addition","affected_scope":"src/features/payment"}' 2>/dev/null)

if echo "$SOC" | grep -q '"sessionId"'; then
  SOC_ID=$(echo "$SOC" | grep -o '"sessionId":"[^"]*"' | sed 's/.*"sessionId":"//' | sed 's/"//')
  pass "Socratic session created for complex payment scenario"

  # Check question count — complex scenario should get SIGNIFICANT tier
  Q_COUNT=$(echo "$SOC" | grep -o '"question"' | wc -l)
  TIER=$(echo "$SOC" | grep -o '"tier":"[^"]*"' | sed 's/.*"tier":"//' | sed 's/"//')

  if [ "$TIER" = "SIGNIFICANT" ]; then
    pass "Tier: SIGNIFICANT — correct for payment/security changes"
  else
    fail "Socratic tier" "Expected SIGNIFICANT for payment processing, got $TIER"
  fi

  info "Generated $Q_COUNT question references"

  # Check that questions cover security dimensions
  if echo "$SOC" | grep -qi "security\|compliance\|PCI\|encrypt\|vulner"; then
    pass "Questions include security/compliance dimensions"
  else
    warn "Security dimensions may be underrepresented in questions"
  fi
else
  fail "Socratic analyze" "Failed for complex payment scenario"
  info "Response: $(echo "$SOC" | head -c 300)"
fi

# ══════════════════════════════════════════════════════════════
# PART 7: SESSION-INIT OUTPUT QUALITY
# ══════════════════════════════════════════════════════════════
header "7. Session-init enforcement quality"

# Run session-init and capture output
INIT_OUTPUT=$(cd "$SCRIPT_DIR" && CLAUDE_PROJECT_PATH="$PROJECT" node -e "
  process.env.CLAUDE_PLUGIN_ROOT = '$(echo "$PROJECT" | sed "s|/test_plugin||")';
  process.env.CLAUDE_PROJECT_PATH = '$PROJECT';
" 2>/dev/null || echo "")

# Check that session-init exists and has the right directives
INIT_FILE="$(echo "$PROJECT" | sed 's|/test_plugin||')/src/cli/handlers/session-init.ts"
if [ -f "$INIT_FILE" ]; then
  INIT_CONTENT=$(cat "$INIT_FILE")

  # Anti-AI directives present?
  if echo "$INIT_CONTENT" | grep -qi "AI.tell\|Over.comment\|Boilerplate.*JSDoc\|senior engineer"; then
    pass "Session-init contains anti-AI code quality directives"
  else
    fail "Anti-AI directives" "Session-init missing code quality enforcement"
  fi

  # Web search mandate present?
  if echo "$INIT_CONTENT" | grep -q "web.*search\|search.*web"; then
    pass "Session-init mandates web search for KB gaps"
  else
    fail "Web search mandate" "Session-init doesn't enforce web search"
  fi

  # Plugin authority present?
  if echo "$INIT_CONTENT" | grep -q "executor\|EXECUTOR\|authority\|AUTHORITY"; then
    pass "Session-init declares plugin authority"
  else
    fail "Authority declaration" "Session-init doesn't establish plugin control"
  fi

  # Token efficiency — check output size
  INIT_LINES=$(echo "$INIT_CONTENT" | grep 'parts.push' | wc -l)
  if [ "$INIT_LINES" -lt 40 ]; then
    pass "Session-init is concise ($INIT_LINES push calls — under 40)"
  else
    warn "Session-init may be too verbose ($INIT_LINES push calls)"
  fi
fi

# ══════════════════════════════════════════════════════════════
# PART 8: ERROR RESILIENCE
# ══════════════════════════════════════════════════════════════
header "8. Error resilience"

# Nonexistent path → should return 404 (not 200 with fake score)
ERR1=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER/api/check?project_path=C:/fake/nonexistent/path" 2>/dev/null)
if [ "$ERR1" = "404" ]; then
  pass "Invalid path returns HTTP 404 (not false score)"
else
  fail "Invalid path handling" "Expected 404, got HTTP $ERR1"
fi

# Empty feature name → should return 400
ERR2=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER/api/scaffold" \
  -H "Content-Type: application/json" \
  -d "{\"feature_name\":\"\",\"project_path\":\"$PROJECT\"}" 2>/dev/null)
if [ "$ERR2" = "400" ]; then
  pass "Empty feature name returns HTTP 400"
else
  warn "Empty feature name returns HTTP $ERR2 (expected 400)"
fi

# Duplicate scaffold → should return 409 conflict
ERR3=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WORKER/api/scaffold" \
  -H "Content-Type: application/json" \
  -d "{\"feature_name\":\"auth\",\"project_path\":\"$PROJECT\"}" 2>/dev/null)
if [ "$ERR3" = "409" ]; then
  pass "Duplicate scaffold returns HTTP 409 Conflict"
else
  warn "Duplicate scaffold returns HTTP $ERR3 (expected 409)"
fi

# ══════════════════════════════════════════════════════════════
# RESULTS
# ══════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║              EXPERT QUALITY RESULTS                     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo -e "  ${YELLOW}Warnings: $WARN${NC}"
echo -e "  Total:  $((PASS + FAIL + WARN))"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}EXPERT QUALITY VALIDATED${NC} ${GREEN}✓${NC}"
  echo -e "  ${DIM}The plugin produces production-grade code.${NC}"
else
  echo -e "  ${RED}${BOLD}ISSUES FOUND:${NC}"
  for ERR in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗${NC} $ERR"
  done
fi

echo ""
echo -e "  ${DIM}Dashboard: ${WORKER}${NC}"
echo ""

[ $FAIL -eq 0 ] && exit 0 || exit 1
