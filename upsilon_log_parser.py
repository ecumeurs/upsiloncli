#!/usr/bin/env python3
import sys
import json
import re
import argparse

def clean_line(line):
    # Remove prefix like [{2026-04-14T06:16:18Z}] [Bot-01] 
    line = re.sub(r'^\[\{[^}]+\}\]\s+\[[^\]]+\]\s+', '', line)
    # Remove ANSI escape codes
    line = re.sub(r'\x1b\[[0-9;]*m', '', line)
    return line.strip()

def render_ascii_board(gs):
    if not gs or 'grid' not in gs:
        return "  [No Grid Data Available]"
    
    grid = gs['grid']
    width = grid.get('width', 10)
    height = grid.get('height', 10)
    cells = grid.get('cells', [])
    
    # Map entities to positions for easy lookup
    entity_map = {}
    for p in gs.get('players', []):
        team_id = p.get('team', '?')
        nick = p.get('nickname', 'Unknown')
        for e in p.get('entities', []):
            if e.get('dead') or e.get('hp', 0) <= 0:
                continue
            pos = e.get('position')
            if pos:
                entity_map[(pos['x'], pos['y'])] = {
                    'team': team_id,
                    'name': e['name'],
                    'hp': e['hp'],
                    'max_hp': e['max_hp'],
                    'active': e.get('id') == gs.get('current_entity_id')
                }

    output = []
    header = "    " + "".join([f"{x:2}" for x in range(width)])
    output.append(header)
    output.append("    " + "--" * width)
    
    for y in range(height):
        row = [f"{y:2} |"]
        for x in range(width):
            char = " ."
            # Check for barriers/obstacles
            try:
                if y < len(cells) and x < len(cells[y]):
                    if cells[y][x].get('obstacle'):
                        char = " #"
            except: pass

            # Check for entities
            if (x, y) in entity_map:
                ent = entity_map[(x, y)]
                symbol = str(ent['team'])
                if ent['active']:
                    char = f"!{symbol}"
                else:
                    char = f" {symbol}"
            
            row.append(char)
        output.append("".join(row))
    
    output.append("\n  Legend: . Empty, # Obstacle, 1-4 Team ID, ! Active")
    return "\n".join(output)

def print_bot_summary(bot_id, data, tactical=False):
    print(f"\n>>>> STATUS FOR {bot_id} <<<<")
    
    is_finished = data.get('game_finished', False)
    bot_team = data.get('team_id')

    winner_team = data.get('winner_team')

    if is_finished:
        if winner_team is not None:
            if bot_team is not None and winner_team == bot_team:
                print(f"Outcome: CONCLUDED (Winner: Team {winner_team}) - VICTORY IS MINE!")
            else:
                print(f"Outcome: CONCLUDED (Winner: Team {winner_team})")
        else:
            print("Outcome: CONCLUDED (No Winner)")
    else:
        has_seen_board = data['last_board'] is not None
        survivors = [e for e in data['entities'].values() if e.get('id') in (data.get('last_board') or {}) and not e.get('dead')]
        if not survivors and has_seen_board:
            print("Outcome: CONCLUDED (ANNIHILATION)")
        elif not has_seen_board:
            print("Outcome: INCOMPLETE / NO DATA RECEIVED")
        else:
            print("Outcome: INCOMPLETE / MATCH TERMINATED")
        
    print("\nCasualties:")
    if not data['deaths']:
        print("  None recorded.")
    else:
        for name, line, owner, team in data['deaths']:
            print(f"  [L{line:05d}] {name} (Owner: {owner}, Team {team}) was eliminated.")
            if tactical:
                # Find pre-death board
                for victim_name, board in data['pre_death_boards']:
                    if victim_name == name:
                        print("\n  Board state just before elimination:")
                        print(render_ascii_board(board))
                        print("-" * 20)
                        break
            
    print("\nSurvivors:")
    last_board = data.get('last_board') or {}
    survivors = [e for e in data['entities'].values() if e.get('id') in last_board and not e.get('dead') and e.get('hp', 0) > 0]
    if not survivors:
         print("  None.")
    else:
        for s in survivors:
            print(f"  - {s['name']} (Owner: {s.get('nickname', 'AI')}, Team {s.get('team', '?')}): {s['hp']}/{s['max_hp']} HP")

    if tactical:
        print("\nRecent Tactical Actions:")
        for msg, line in data['tactical'][-15:]:
            print(f"  [L{line:05d}] {msg}")
        
        if data['last_living_board']:
            print("\nLast Known Board State:")
            print(render_ascii_board(data['last_living_board']))

    print("\nError Report:")
    if not data['errors']:
        print("  CLEAN (0 errors)")
    else:
        for msg, line in data['errors']:
            print(f"  [L{line:05d}] ERROR: {msg}")
    print("-" * 30)
    sys.stdout.flush()

def parse_log(filepath, tactical=False):
    bots = {}
    completed_bots = set()
    total_errors = 0
    
    # Regex patterns
    bot_pattern = re.compile(r'\[(Bot-\d+)\]')
    reply_pattern = re.compile(r'\[REPLY (\d+)\]')
    ws_pattern = re.compile(r'\[WS\].*board\.updated event received\.')
    cli_error_pattern = re.compile(r'(Event loop interrupted|Execution failed|timeout waiting for event):? (.*)')
    delete_marker = re.compile(r'Deleting temporary account')
    
    # Tactical Patterns for upsilon.log (Simplified one-liners)
    tactical_patterns = [
        (re.compile(r'--- (My Turn! Acting with entity: .*) ---'), r'\1'),
        (re.compile(r'Moving \d+ cells along path: (.*)'), r'Moving: \1'),
        (re.compile(r'Target in range! Attacking!'), r'Action: Attack'),
        (re.compile(r'Targeting nearest enemy: (\w+)'), r'Target: \1'),
        (re.compile(r'Ending turn with pass\.'), r'Action: Pass'),
        (re.compile(r'No enemies left\. Passing\.'), r'Action: Pass (No Enemies)'),
        (re.compile(r'Thinking\.\.\. \((\d+\.\d+)s\)'), r'Thinking: \1s'),
        (re.compile(r'Starting turn shot clock'), r'CLOCK: Started'),
        (re.compile(r'Turn timeout detected!'), r'CLOCK: TIMEOUT'),
        (re.compile(r'\[ERROR\] (.*)'), r'ERROR: \1'),
        (re.compile(r'Winner: (.*)'), r'RESULT: Winner \1'),
        (re.compile(r'VICTORY IS MINE!'), r'RESULT: VICTORY'),
        (re.compile(r'Defeated\.\.\. perishing with honor\.'), r'RESULT: DEFEAT')
    ]

    print("\n" + "="*60)
    print(" UPSILON BATTLE ENGINE DIAGNOSTIC SUMMARY")
    print("="*60)
    sys.stdout.flush()

    with open(filepath, 'r') as f:
        line_no = 0
        json_buffer = []
        in_json = False
        bracket_count = 0
        current_bot = None
        current_status_code = None
        is_ws_update = False
        last_log_was_delete = {} # bot_id -> bool
        
        for line in f:
            line_no += 1
            
            # Identify bot context from prefix
            bot_match = bot_pattern.search(line)
            if bot_match:
                bot_id = bot_match.group(1)
                
                # If we've already printed this bot, skip (unlikely unless log repeats)
                if bot_id in completed_bots:
                    continue
                    
                if bot_id != current_bot:
                    current_bot = bot_id
                    if current_bot not in bots:
                        bots[current_bot] = {
                            'entities': {},
                            'deaths': [],
                            'errors': [],
                            'tactical': [],
                            'pre_death_boards': [],
                            'game_finished': False,
                            'last_board': None,
                            'last_living_board': None
                        }
                        last_log_was_delete[current_bot] = False

            if not current_bot:
                continue

            # Check for tactical logs if enabled
            cleaned = clean_line(line)
            if tactical:
                for ptrn, fmt in tactical_patterns:
                    match = ptrn.search(cleaned)
                    if match:
                        msg = match.expand(fmt)
                        bots[current_bot]['tactical'].append((msg, line_no))
                        if getattr(args, 'filter', False):
                            print(f"[{current_bot}] {msg}")
                            sys.stdout.flush()
                        break
            
            # Detect teardown for "Finished" heuristic
            if delete_marker.search(cleaned):
                last_log_was_delete[current_bot] = True

            # Detected start of JSON (REPLY or WS)
            reply_match = reply_pattern.search(line)
            ws_match = ws_pattern.search(line)
            
            if (reply_match or ws_match) and not in_json:
                in_json = True
                json_buffer = []
                bracket_count = 0
                is_ws_update = bool(ws_match)
                if reply_match:
                    current_status_code = int(reply_match.group(1))
                    
                    # If this is a REPLY 200 following a DELETE account log, the bot is done
                    if current_status_code == 200 and last_log_was_delete.get(current_bot):
                        # Add a small note to tactical logs
                        if tactical:
                            bots[current_bot]['tactical'].append(("Agent disconnected (Cleanup successful).", line_no))
                        
                        # Process existing buffer if any (usually empty here)
                        # Then print summary
                        print_bot_summary(current_bot, bots[current_bot], tactical)
                        total_errors += count_bot_errors(bots[current_bot])
                        completed_bots.add(current_bot)
                        
                continue

            if in_json:
                if not cleaned: continue
                
                json_buffer.append(cleaned)
                bracket_count += cleaned.count('{')
                bracket_count -= cleaned.count('}')
                
                if bracket_count == 0 and '{' in "".join(json_buffer):
                    # Process JSON
                    try:
                        full_body = json.loads("".join(json_buffer))
                        
                        if is_ws_update:
                            gs = full_body.get('data', {})
                        else:
                            gs = full_body.get('data', {}).get('game_state') if full_body.get('data') else None
                            if current_status_code and current_status_code >= 400:
                                error_msg = full_body.get('message', 'Unknown Error')
                                bots[current_bot]['errors'].append((error_msg, line_no))

                        if gs:
                            process_game_state(bots[current_bot], gs, line_no, tactical)
                            
                    except Exception as e:
                        pass # JSON error or malformed
                        
                    in_json = False
                    json_buffer = []
                    continue

            # Detect CLI-level Errors
            cli_err_match = cli_error_pattern.search(line)
            if cli_err_match:
                error_msg = f"System Error: {cli_err_match.group(2)}"
                bots[current_bot]['errors'].append((error_msg, line_no))

    # Print remaining bots that didn't have a clear cleanup
    for bot_id, data in bots.items():
        if bot_id not in completed_bots:
            print_bot_summary(bot_id, data, tactical)
            total_errors += count_bot_errors(data)
            completed_bots.add(bot_id)

    print(f"\nOVERALL RESULT: {'PASS' if total_errors == 0 else 'FAIL'} ({total_errors} total errors detected)")
    print("="*60 + "\n")
    return total_errors

def count_bot_errors(data):
    errs = len(data['errors'])
    if not data.get('game_finished'):
        # Check if incomplete
        has_seen_board = data['last_board'] is not None
        survivors = [e for e in data['entities'].values() if e.get('id') in (data.get('last_board') or {}) and not e.get('dead')]
        if not (not survivors and has_seen_board) and has_seen_board:
            errs += 1
        elif not has_seen_board:
            errs += 1
    return errs

def process_game_state(bot_data, gs, line_no, tactical):
    players = gs.get('players', [])
    entities = []
    nick_map = {}
    
    for p in players:
        nick = p.get('nickname', 'Unknown')
        team = p.get('team')
        nick_map[team] = nick
        if p.get('is_self'):
            nick_map['self'] = nick
            bot_data['team_id'] = team
        
        for e in p.get('entities', []):
            e['nickname'] = nick
            entities.append(e)

    bot_data['nickname_map'] = nick_map
    bot_data['game_finished'] = gs.get('game_finished', False)
    winner_team = gs.get('winner_team_id')
    if winner_team is not None:
        bot_data['winner_team'] = winner_team

    new_entity_ids = {e['id']: e for e in entities}
    
    # Check for deaths and HP changes (Damage)
    if bot_data['last_board']:
        for old_id, old_entity in bot_data['last_board'].items():
            new_entity = new_entity_ids.get(old_id)
            
            # HP Change detection
            if new_entity and not new_entity.get('dead') and not old_entity.get('dead'):
                old_hp = old_entity.get('hp', 0)
                new_hp = new_entity.get('hp', 0)
                if new_hp < old_hp:
                    damage = old_hp - new_hp
                    if tactical:
                        bot_data['tactical'].append((f"{new_entity['name']} ({new_entity.get('nickname')}) took {damage} damage! ({new_hp} HP left)", line_no))

            # Death detection
            is_now_dead = new_entity and (new_entity.get('dead') or new_entity.get('hp') == 0)
            was_alive = not old_entity.get('dead') and old_entity.get('hp', 0) > 0
            
            if (is_now_dead and was_alive) or (old_id not in new_entity_ids and was_alive):
                bot_data['deaths'].append((old_entity['name'], line_no, old_entity.get('nickname', 'System/AI'), old_entity.get('team', '?')))
                if tactical and bot_data['last_living_board']:
                    bot_data['pre_death_boards'].append((old_entity['name'], bot_data['last_living_board']))

    bot_data['last_board'] = new_entity_ids
    bot_data['last_living_board'] = gs # Full object since we need grid
    
    # Process explicit Action Feedback from the engine
    action = gs.get('action')
    if action and tactical:
        action_type = action.get('type', 'action').upper()
        actor_id = action.get('actor_id', 'Unknown')
        
        # Find actor name
        actor_name = "Unknown"
        if actor_id in new_entity_ids:
            actor_name = f"{new_entity_ids[actor_id]['name']} ({new_entity_ids[actor_id].get('nickname', 'AI')})"
            
        if action_type == "ATTACK":
            target_id = action.get('target_id')
            damage = action.get('damage', 0)
            target_name = "Unknown"
            if target_id in new_entity_ids:
                target_name = f"{new_entity_ids[target_id]['name']}"
            bot_data['tactical'].append((f"Action: {actor_name} ATTACKED {target_name} for {damage} damage!", line_no))
        elif action_type == "MOVE":
            path_len = len(action.get('path', []))
            bot_data['tactical'].append((f"Action: {actor_name} MOVED {path_len} cells.", line_no))
        elif action_type == "PASS":
            bot_data['tactical'].append((f"Action: {actor_name} PASSED their turn.", line_no))

    for e in entities:
        bot_data['entities'][e['id']] = e

class BotState:
    def __init__(self, bot_id):
        self.bot_id = bot_id
        self.entities = {} # id -> data
        self.nicknames = {} # nickname -> info
        self.team_nicknames = {} # team -> nickname
        self.last_entity_ids = set()
        self.game_finished = False
        self.winner_team = None
        self.active_entity = None
        self.owner_map = {} # entity_id -> nickname

    def update_from_board(self, board):
        if not board: return
        self.game_finished = board.get('game_finished', False)
        self.winner_team = board.get('winner_team_id')
        self.active_entity = board.get('current_entity_id')
        
        new_seen = set()
        players = board.get('players', [])
        for p in players:
            nick = p.get('nickname')
            team = p.get('team')
            if nick and team is not None:
                self.team_nicknames[team] = nick
            
            for e in p.get('entities', []):
                eid = e.get('id')
                if not eid: continue
                new_seen.add(eid)
                self.owner_map[eid] = nick
                e['team'] = team # Inject team info
                
                # Check for deaths
                was_dead = self.entities.get(eid, {}).get('dead', False)
                is_dead = e.get('dead', False) or e.get('hp', 0) <= 0
                
                if is_dead and not was_dead and eid in self.last_entity_ids:
                    print(f"[{self.bot_id}] [DEATH] {e.get('name')} (Owner: {nick}, Team: {team}) was eliminated.")

                self.entities[eid] = e
        
        # Check for missing entities (alternative death detection)
        for old_id in self.last_entity_ids:
            if old_id not in new_seen:
                old_e = self.entities.get(old_id, {})
                if not old_e.get('dead'):
                    print(f"[{self.bot_id}] [DEATH] {old_e.get('name')} (Owner: {self.owner_map.get(old_id, '?')}) went missing/eliminated.")
        
        self.last_entity_ids = new_seen

    def get_summary(self):
        summary = [f"\n>>>> FINAL RESULT FOR {self.bot_id} <<<<"]
        if self.winner_team is not None:
            summary.append(f"Outcome: CONCLUDED (Winner: Team {self.winner_team} - {self.team_nicknames.get(self.winner_team, 'Unknown')})")
        else:
            summary.append("Outcome: CONCLUDED (No/Partial Winner)")
        
        summary.append("\nSurvivors:")
        for eid in self.last_entity_ids:
            e = self.entities[eid]
            if not e.get('dead') and e.get('hp', 0) > 0:
                summary.append(f"  - {e.get('name')} (Owner: {self.owner_map.get(eid, '?')}, Team: {e.get('team', '?')}): {e['hp']}/{e['max_hp']} HP")
        
        summary.append("-" * 30)
        return "\n".join(summary)

def parse_log_stream(stream, args):
    bot_pattern = re.compile(r'\[(Bot-\d+)\]')
    
    tactical_patterns = [
        (re.compile(r'--- (My Turn.*Acting with entity: .*) ---'), r'\1'),
        (re.compile(r'Moving \d+ cells along path: (.*)'), r'Moving: \1'),
        (re.compile(r'Targeting nearest enemy: (\w+)'), r'Target: \1'),
        (re.compile(r'\[FEEDBACK\] (.*)'), r'Action: \1'),
        (re.compile(r'Starting turn shot clock'), r'CLOCK: Started'),
        (re.compile(r'Turn timeout detected!'), r'CLOCK: TIMEOUT'),
        (re.compile(r'\[ERROR\] (.*)'), r'ERROR: \1'),
        (re.compile(r'\[REPLY ([45]\d+)\] (.*)'), r'ERROR (\1): \2'),
    ]
    
    bots = {} # bot_id -> BotState
    json_buffers = {} # bot_id -> list of lines
    is_collecting_json = {} # bot_id -> bool
    last_bot_id = None
    
    def get_state(bid):
        if bid not in bots:
            bots[bid] = BotState(bid)
        return bots[bid]

    try:
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        
        for line in stream:
            bot_match = bot_pattern.search(line)
            
            if bot_match:
                bot_id = bot_match.group(1)
                last_bot_id = bot_id
            else:
                bot_id = last_bot_id
            
            if not bot_id:
                continue
                
            state = get_state(bot_id)
            cleaned = clean_line(line).strip()
            
            # JSON collection logic
            # Note: We check the ORIGINAL line for markers as they might be removed by clean_line
            if "[WS]" in line or "[REPLY]" in line:
                is_collecting_json[bot_id] = True
                json_buffers[bot_id] = []
                continue
            
            if is_collecting_json.get(bot_id):
                # Strip ANSI from JSON lines before adding to buffer
                raw_json_line = ansi_escape.sub('', line)
                # JSON lines start with indentation in the CLI output
                if raw_json_line.startswith("  ") or raw_json_line.strip() in ("{", "}", "{,"):
                    json_buffers[bot_id].append(raw_json_line.strip())
                    if raw_json_line.strip() == "}":
                        try:
                            full_json = "".join(json_buffers[bot_id])
                            raw_data = json.loads(full_json)
                            # SUCCESS! Process it
                            data = raw_data.get('data', raw_data)
                            
                            # Handle Pusher/Reverb double-encoding
                            if isinstance(data, str):
                                try:
                                    data = json.loads(data)
                                except:
                                    pass

                            board = data
                            if isinstance(data, dict):
                                if 'game_state' in data:
                                    board = data['game_state']
                                elif 'match_id' in data and 'players' in data:
                                    board = data
                            
                            if isinstance(board, dict) and 'players' in board:
                                state.update_from_board(board)
                                if state.game_finished:
                                    print(state.get_summary())
                            
                            is_collecting_json[bot_id] = False
                        except:
                            pass # Keep collecting
                else:
                    # Line doesn't look like JSON and we were collecting? 
                    # If it's not a Bot-prefixed line, it might be the end of the block
                    if not bot_match:
                        is_collecting_json[bot_id] = False

            # Normal tactical patterns
            for ptrn, fmt in tactical_patterns:
                match = ptrn.search(cleaned)
                if match:
                    msg = match.expand(fmt)
                    # Resolve active entity name
                    if "Acting with entity:" in msg:
                        parts = msg.split(":")
                        if len(parts) > 1:
                            # Strip ID and trailing ---
                            eid = parts[-1].replace("---", "").strip()
                            name = state.entities.get(eid, {}).get('name', eid)
                            msg = f"--- My Turn! Acting with entity: {name} ---"
                    
                    print(f"[{bot_id}] {msg}")
                    sys.stdout.flush()
                    break
            
            # Additional fallback for actions logged by the bot itself
            if "Attacking!" in cleaned:
                print(f"[{bot_id}] Action: Attack")
            elif "Ending turn with pass" in cleaned or "No enemies left. Passing." in cleaned:
                # We already capture Action: Pass from FEEDBACK, but this is a double-check
                if not any(substring in cleaned for substring in ["[FEEDBACK]", "Action:"]):
                    print(f"[{bot_id}] Action: Pass")
            elif "Targeting nearest enemy:" in cleaned:
                # Capture the name directly from the bot log if available
                target_match = re.search(r'Targeting nearest enemy: (\w+)', cleaned)
                if target_match:
                    print(f"[{bot_id}] Target: {target_match.group(1)}")

    except KeyboardInterrupt:
        pass
    finally:
        # Final summary for any bots that didn't finish properly
        for bid, state in bots.items():
            if not state.game_finished:
                if state.entities:
                    print(f"\n[Terminated Summary for {bid}]")
                    print(state.get_summary())

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Upsilon Log Parser and Tactical Analyzer")
    parser.add_argument("logfile", nargs='?', help="Path to the .log file")
    parser.add_argument("--tactical", action="store_true", help="Enable tactical analysis and board visualization")
    parser.add_argument("--filter", action="store_true", help="Live filter mode: output tactical actions only from stdin or file")
    
    args = parser.parse_args()
    
    if args.filter:
        args.tactical = True
        input_stream = sys.stdin if not args.logfile else open(args.logfile, 'r')
        try:
            parse_log_stream(input_stream, args)
        except KeyboardInterrupt:
            sys.exit(0)
    else:
        if not args.logfile:
            parser.print_help()
            sys.exit(1)
        try:
            parse_log(args.logfile, tactical=args.tactical)
        except FileNotFoundError:
            print(f"Error: File {args.logfile} not found.")
            sys.exit(1)
        except KeyboardInterrupt:
            print("\nInterrupted by user.")
            sys.exit(0)
