---
id: us_character_reroll_button_lockdown
human_name: Button Lockdown After Three Rerolls
type: USER_STORY
layer: CUSTOMER
version: 1.0
status: STABLE
priority: 5
tags: []
parents:
  - [[us_character_reroll]]
dependents: []
---
# Button Lockdown After Three Rerolls

## INTENT
After three successful rerolls, the button is disabled to prevent abuse.

## THE RULE / LOGIC
The "Reroll" button becomes unavailable after a predetermined number of successful uses.

## TECHNICAL INTERFACE (The Bridge)
- **Code Tag:** `@spec-link [[us_character_reroll_button_lockdown]]`
