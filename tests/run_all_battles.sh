#!/bin/bash
# run_all_battles.sh - Automated Tactical Engine Test Suite

set -e

# Configuration
CLI="${UPSILON_CLI_PATH:-./bin/upsiloncli}"
LOG_DIR="tests/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Ensure bin exists
if [ ! -f "$CLI" ]; then
    echo "Building CLI..."
    go build -o bin/upsiloncli cmd/upsiloncli/main.go
fi

run_test() {
    local mode=$1
    local agents=$2
    local script=$3
    local log_file="$LOG_DIR/${mode}.log"

    echo "--------------------------------------------------"
    echo "TESTING MODE: $mode (Agents: $agents)"
    echo "SCRIPT: $script"
    echo "--------------------------------------------------"

    # Construct paths array for the farm
    local paths=""
    for i in $(seq 1 "$agents"); do
        paths="$paths $script"
    done

    # Set environment variable for the bot script
    export UPSILON_GAME_MODE="$mode"

    # Cleanup state before every run to ensure isolation
    cd .. && ./scripts/zombie_killer.sh && ./scripts/clear_matches.sh && cd upsiloncli

    # Run the farm and capture output
    echo "Running arena..."
    timeout 300 $CLI --farm $paths > "$log_file" 2>&1 || true

    # 1. Basic Health Check (Success indicators)
    if grep -q "Game Over! Winner:" "$log_file" || grep -q "STALEMATE" "$log_file"; then
        echo -e "\033[32m[OK]\033[0m Match concluded naturally."
    else
        echo -e "\033[31m[CRITICAL]\033[0m $mode did not finish or timed out."
        tail -n 10 "$log_file"
        exit 1
    fi

    # 2. Detailed Diagnostic Analysis
    echo "Analyzing logs for errors/casualties..."
    if python3 upsilon_log_parser.py "$log_file"; then
        echo -e "\033[32m[SUCCESS]\033[0m No engine errors detected in $mode."
    else
        echo -e "\033[31m[FAILURE]\033[0m Engine errors or protocol violations detected in $mode."
        tail -n 5 "$log_file"
        exit 1
    fi
    echo ""
}

# Run the battery of tests with game-specific scripts
run_test "1v1_PVE" 1 "samples/pve_1v1_battle.js"
run_test "2v2_PVE" 2 "samples/pve_2v2_battle.js"
run_test "1v1_PVP" 2 "samples/pvp_1v1_battle.js"
run_test "2v2_PVP" 4 "samples/pvp_2v2_battle.js"

echo "=================================================="
echo -e "\033[32m\033[1mALL BATTLES PASSED AND LOGS ARE CLEAN!\033[0m"
echo "=================================================="
