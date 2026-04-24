---
id: uc_progression_stat_allocation
human_name: "Progression & Stat Allocation Use Case"
type: MODULE
layer: ARCHITECTURE
version: 1.0
status: STABLE
priority: 5
tags: [progression, stats]
parents:
  - [[req_player_experience]]
  - [[rule_progression]]
  - [[ui_dashboard]]
dependents: []
---

# Progression & Stat Allocation Use Case

## INTENT
Allows players to manually distribute earned attribute points and upgrade character stats from the Dashboard.

## THE RULE / LOGIC
1. From the Character Review Dashboard, the user accesses the Progression interface.
2. User allocates available attribute points to character stats [[rule_progression]].
3. System validates allocation (e.g., attribute caps, movement upgrade gating).
4. System persists the updated character state.

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[uc_progression_stat_allocation]]`
- **Related Issue:** `#progression-allocation`

## EXPECTATION (For Testing)
- Attribute points cannot be allocated beyond the `10 + total_wins` cap.
- Movement upgrades are only available every 5 wins.
- Successful allocation persists and updates the Dashboard display.
