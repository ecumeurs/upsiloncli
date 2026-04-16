#!/bin/bash
# test_match_resolution.sh - Dedicated Match Resolution Testing

set -e

cd "$(dirname "$0")/.."

# Configuration
CLI="./bin/upsiloncli"
LOG_DIR="tests/logs/match_res"

mkdir -p "$LOG_DIR"

if [ ! -f "$CLI" ]; then
    echo "Building CLI..."
    go build -o bin/upsiloncli cmd/upsiloncli/main.go
fi

run_test() {
    local mode=$1
    local script_win=$2
    local script_lose=$3
    local agents_win=$4
    local agents_lose=$5
    local log_file="$LOG_DIR/${mode}.log"
    
    echo "--------------------------------------------------"
    echo "TESTING MODE: $mode"
    echo "--------------------------------------------------"
    
    local paths=""
    for i in $(seq 1 "$agents_win"); do
        paths="$paths $script_win"
    done
    for i in $(seq 1 "$agents_lose"); do
        paths="$paths $script_lose"
    done
    
    export UPSILON_GAME_MODE="$mode"
    
    # Cleanup state before every run to ensure isolation
    cd .. && ./zombie_killer.sh && ./clear_matches.sh && cd upsiloncli
    
    echo "Running arena..."
    timeout 300 $CLI --farm $paths > "$log_file" 2>&1 || true
    
    # Analyze results based on mode
    if grep -q "Game Over! Winner:" "$log_file" || grep -q "STALEMATE" "$log_file"; then
        echo -e "\033[32m[OK]\033[0m Match concluded naturally."
    else
        echo -e "\033[31m[CRITICAL]\033[0m $mode did not finish or timed out."
        tail -n 10 "$log_file"
        exit 1
    fi

    echo "Analyzing logs for errors..."
    if python3 upsilon_log_parser.py "$log_file"; then
        echo -e "\033[32m[SUCCESS]\033[0m No engine errors detected in $mode."
    else
        echo -e "\033[31m[FAILURE]\033[0m Engine errors or protocol violations detected in $mode."
        exit 1
    fi
    echo ""
}

# Run tests
# 1v1 Normal
export UPSILON_GAME_MODE="1v1_PVP"
run_test "1v1_PVP" "samples/pvp_bot_battle.js" "samples/pvp_bot_battle.js" 1 1

# 2v2 Normal
export UPSILON_GAME_MODE="2v2_PVP"
run_test "2v2_PVP" "samples/match_resolution_2v2.js" "samples/match_resolution_2v2.js" 2 2

# 1v1 Forfeit
export UPSILON_GAME_MODE="1v1_PVP"
run_test "1v1_Forfeit" "samples/pvp_bot_battle.js" "samples/match_resolution_forfeit.js" 1 1

# 2v2 Forfeit (One player forfeits, bringing down the whole team)
export UPSILON_GAME_MODE="2v2_PVP"
run_test "2v2_Forfeit" "samples/match_resolution_2v2.js" "samples/match_resolution_forfeit_2v2.js" 2 2

echo "=================================================="
echo -e "\033[32m\033[1mALL MATCH RESOLUTION SCENARIOS PASSED!\033[0m"
echo "=================================================="
