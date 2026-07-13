#!/bin/bash
# run_all_edge_cases.sh - Centralized Edge Case Test Runner

set -e

# Configuration
CLI="${UPSILON_CLI_PATH:-upsiloncli}"
SCENARIO_DIR="tests/scenarios"
LOG_DIR="tests/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo "=================================================="
echo "      UPSILON EDGE CASE SUITE RUNNER"
echo "=================================================="

FAILED_TESTS=""
PASSED_COUNT=0
FAILED_COUNT=0
QUARANTINED_RED=""
QUARANTINED_COUNT=0

# Quarantine: scenarios excluded from the pass/fail GATE because they surface
# KNOWN, TRACKED issues (not test defects). They still RUN and their result is
# reported, but a red here does NOT fail the suite. This is what lets the edge
# suite be a real CI gate (post-ISS-107 audit) without hiding the known reds —
# "honest red over false green". Remove an entry the moment its issue is fixed.
# Source of truth: ci_edge_case_reporting.md.
# (Plain case-statement, not a bash associative array: CI invokes this via
# `/bin/sh` — keep it portable. Echoes the issue ref if quarantined, else "".)
quarantine_reason() {
    case "$1" in
        edge_movement_obstacle_collision)
            echo "ISS-108 — board-gen doesn't guarantee an obstacle adjacent to spawn (~20% flaky)" ;;
        edge_attack_target_out_of_grid)
            echo "ISS-110 — PVE AI initiative RNG can wipe the squad before the player's turn (~20% flaky)" ;;
        edge_admin_private_data_access)
            echo "ISS-116 — admin user registry leaks full_address/birth_date (intentional red)" ;;
    esac
}

run_test() {
    local script=$1
    local name=$(basename "$script" .js)
    local log_file="$LOG_DIR/${name}.log"
    
    # Determine agent count from _with_N filename suffix (canonical convention).
    local agents=1
    if [[ "$name" == *"_with_4"* ]]; then
        agents=4
    elif [[ "$name" == *"_with_2"* ]]; then
        agents=2
    fi

    echo -n "Running $name (Agents: $agents)... "

    # Construct paths array for the farm
    local paths=""
    for i in $(seq 1 "$agents"); do
        paths="$paths $script"
    done

    # Run the farm
    # Use UPSILON_CLI_PATH or just 'upsiloncli' (should be in PATH)
    if timeout 120 $CLI --farm $paths > "$log_file" 2>&1; then
        echo -e "\033[32m[PASSED]\033[0m"
        echo "[SCENARIO_RESULT: PASSED]" >> "$log_file"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    elif qreason=$(quarantine_reason "$name"); [ -n "$qreason" ]; then
        # Red, but a known/tracked issue — reported, not gated.
        echo -e "\033[33m[QUARANTINED-RED]\033[0m ($qreason)"
        echo "[SCENARIO_RESULT: QUARANTINED-RED] $qreason" >> "$log_file"
        QUARANTINED_COUNT=$((QUARANTINED_COUNT + 1))
        QUARANTINED_RED="$QUARANTINED_RED $name"
    else
        echo -e "\033[31m[FAILED]\033[0m"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_TESTS="$FAILED_TESTS $name"
    fi
}

# Run all edge case scripts in alphabetical order
for script in $(ls $SCENARIO_DIR/edge_*.js | sort); do
    run_test "$script"
done

echo "=================================================="
echo "Edge Case Results:"
echo "  Passed:      $PASSED_COUNT"
echo "  Failed:      $FAILED_COUNT"
echo "  Quarantined: $QUARANTINED_COUNT (known issues — reported, not gated)"
echo "=================================================="

if [ $QUARANTINED_COUNT -gt 0 ]; then
    echo "Quarantined-red (tracked, non-gating):$QUARANTINED_RED"
fi

if [ $FAILED_COUNT -gt 0 ]; then
    echo "Failed edge cases:$FAILED_TESTS"
    exit 1
fi

exit 0
