#!/bin/bash
# test_progression.sh - Dedicated Progression Testing

set -e

cd "$(dirname "$0")/.."

CLI="./bin/upsiloncli"
LOG_DIR="tests/logs/progression"

mkdir -p "$LOG_DIR"

if [ ! -f "$CLI" ]; then
    echo "Building CLI..."
    go build -o bin/upsiloncli cmd/upsiloncli/main.go
fi

run_single() {
    local script=$1
    local log_file="$LOG_DIR/$(basename $script).log"
    echo "Running $script..."
    timeout 120 $CLI --farm "$script" > "$log_file" 2>&1 || true
    
    if grep -q "Finished reroll checks." "$log_file"; then
        echo -e "\033[32m[SUCCESS]\033[0m $script passed."
    else
        echo -e "\033[31m[FAILURE]\033[0m $script failed or timed out."
        tail -n 10 "$log_file"
        exit 1
    fi
}

run_farm() {
    local mode=$1
    local script=$2
    local log_file="$LOG_DIR/${mode}.log"
    
    export UPSILON_GAME_MODE="$mode"
    
    echo "Running progression farm $mode..."
    timeout 200 $CLI --farm $script $script > "$log_file" 2>&1 || true
    
    if grep -q "Finished." "$log_file" || awk 'BEGIN{count=0} /Finished./{count++} END{if(count >= 2) exit 0; else exit 1}' "$log_file"; then
         echo -e "\033[32m[SUCCESS]\033[0m $mode (farm) passed."
    else
         echo -e "\033[31m[FAILURE]\033[0m $mode (farm) failed."
         tail -n 15 "$log_file"
         exit 1
    fi
}

# Run Reroll check (Single bot)
run_single "samples/reroll_check.js"

# Run Progression Check (Requires 2 bots in farm to simulate win/loss)
run_farm "1v1_PVP" "samples/progression_check.js"

echo "=================================================="
echo -e "\033[32m\033[1mALL PROGRESSION SCENARIOS PASSED!\033[0m"
echo "=================================================="
