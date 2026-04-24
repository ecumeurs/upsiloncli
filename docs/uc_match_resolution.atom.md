---
id: uc_match_resolution
human_name: Match Resolution Use Case
type: MODULE
layer: ARCHITECTURE
version: 1.0
status: STABLE
priority: 5
tags: []
parents:
  - [[req_player_experience]]
dependents: []
---
# Match Resolution Use Case

## INTENT
Evaluates the game state at the conclusion of each turn/action and handles the final match resolution.

## THE RULE / LOGIC
1. **Win Detection/Forfeit**: System identifies a victor if all characters on an opposing team reach 0 HP [[spec_match_format_win_condition_rule]] or if a player **Forfeits** during UC-4.
2. **State Check (No Winner)**: If no win condition is met at the end of a character turn, the flow returns to **Combat Turn Management (UC-4)** for the next character's turn.
3. **Match Conclusion**: If a winner is detected:
   - System persists match history to the database (`match_history`, `match_participants`).
   - System awards exactly 1 attribute point to the winner's account.
   - If winner's total wins is a multiple of 5, a movement upgrade is unlocked.
4. **Transition**: Winning players see a Progression reward screen. All players can then transition to **Progression (UC-6)** or the **Dashboard**.

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[uc_match_resolution]]`
- **Internal Specs:** `[[uc_match_resolution_win_detection]]`, `[[uc_match_resolution_match_persistence]]`, `[[uc_match_resolution_progression_reward]]`

## EXPECTATION (For Testing)
- Victor detected -> Database entry created -> Progression points awarded.
- Forfeit action -> Immediate defeat applied to current turn holder.
- No winner -> Control returned to next character in initiative ticker.
