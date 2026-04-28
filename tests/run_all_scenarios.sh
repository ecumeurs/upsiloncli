#!/bin/bash
# run_all_scenarios.sh - Centralized E2E Customer Scenario Runner

set -e

# Configuration
CLI="${UPSILON_CLI_PATH:-upsiloncli}"
SCENARIO_DIR="tests/scenarios"
LOG_DIR="tests/logs"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

echo "=================================================="
echo "      UPSILON E2E CENTRALIZED SUITE RUNNER"
echo "=================================================="

FAILED_TESTS=""
PASSED_COUNT=0
FAILED_COUNT=0

run_scenario() {
    local script=$1
    local name=$(basename "$script" .js)
    local log_file="$LOG_DIR/${name}.log"
    
    # Determine agent count from _with_N filename suffix (canonical convention).
    local agents=1
    if [[ "$name" == *"_with_4"* ]] || [[ "$name" == *"2v2"* ]]; then
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
    if timeout 180 $CLI --farm $paths > "$log_file" 2>&1; then
        echo -e "\033[32m[PASSED]\033[0m"
        echo "[SCENARIO_RESULT: PASSED]" >> "$log_file"
        PASSED_COUNT=$((PASSED_COUNT + 1))
    else
        echo -e "\033[31m[FAILED]\033[0m"
        FAILED_COUNT=$((FAILED_COUNT + 1))
        FAILED_TESTS="$FAILED_TESTS $name"
    fi
}

# Run all scenarios in alphabetical order
for script in $(ls $SCENARIO_DIR/e2e_*.js | sort); do
    run_scenario "$script"
done

echo "=================================================="
echo "Suite Results:"
echo "  Passed: $PASSED_COUNT"
echo "  Failed: $FAILED_COUNT"
echo "=================================================="

if [ $FAILED_COUNT -gt 0 ]; then
    echo "Failed scenarios: $FAILED_TESTS"
    exit 1
fi

exit 0
