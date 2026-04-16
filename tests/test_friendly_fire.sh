#!/bin/bash
# test_friendly_fire.sh - Verify Friendly Fire Blocking

set -e

cd "$(dirname "$0")/.."

# Configuration
CLI="./bin/upsiloncli"
LOG_DIR="tests/logs/friendly_fire"
SCRIPT="samples/friendly_fire_check.js"

mkdir -p "$LOG_DIR"

if [ ! -f "$CLI" ]; then
    echo "Building CLI..."
    go build -o bin/upsiloncli cmd/upsiloncli/main.go
fi

echo "--------------------------------------------------"
echo "TESTING FRIENDLY FIRE PROTECTION (2v2)"
echo "--------------------------------------------------"

export UPSILON_GAME_MODE="2v2_PVP"
log_file="$LOG_DIR/friendly_fire_2v2.log"

echo "Running 4 bots in 2v2..."
timeout 300 $CLI --farm $SCRIPT $SCRIPT $SCRIPT $SCRIPT > "$log_file" 2>&1 || true

if grep -q "Server correctly blocked friendly fire." "$log_file"; then
     echo -e "\033[32m[SUCCESS]\033[0m Friendly Fire is correctly blocked."
else
     echo -e "\033[31m[FAILURE]\033[0m Friendly Fire test failed or timed out."
     tail -n 20 "$log_file"
     exit 1
fi

echo ""
