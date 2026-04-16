import unittest
import json
import sys
import os

# Add parent directory to path to import upsilon_log_parser
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from upsilon_log_parser import process_game_state

class TestVictoryParsing(unittest.TestCase):
    def test_parse_team_victory(self):
        # Mock bot_data structure as used in upsilon_log_parser
        bot_data = {
            'matches': 0,
            'wins': 0,
            'losses': 0,
            'turns': 0,
            'errors': 0,
            'details': {},
            'entities': {},
            'last_board': None,
            'last_living_board': None,
            'deaths': [],
            'tactical': []
        }
        
        # Sample log entry with winner_team_id
        # Note: the parser expects the 'data' field to be the BoardState
        mock_payload = {
            "game_finished": True,
            "winner_team_id": 2,
            "players": [
                {"nickname": "Alice", "team": 1, "is_self": True},
                {"nickname": "Bob", "team": 2, "is_self": False}
            ]
        }
        
        # Process the state
        process_game_state(bot_data, mock_payload, 1, False)
        
        # Verify that winner_team was extracted
        self.assertEqual(bot_data.get('winner_team'), 2)
        print("PASS: Successfully extracted winner_team_id from payload")

if __name__ == '__main__':
    unittest.main()
