---
id: us_leaderboard_view
human_name: Leaderboard View Story
type: MODULE
layer: ARCHITECTURE
version: 1.0
status: STABLE
priority: 5
tags: []
parents: []
dependents:
  - [[rule_leaderboard_cycle]]
  - [[rule_leaderboard_score_calculation]]
  - [[us_leaderboard_view_auth_leaderboard]]
  - [[us_leaderboard_view_sort_leaderboard]]
---
# Leaderboard View Story

## INTENT
To aggregate the constituent rules of Leaderboard View Story.

## THE RULE / LOGIC
A logged-in player views a global leaderboard ranking all players by their wins and win/loss ratio.

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[us_leaderboard_view]]`
