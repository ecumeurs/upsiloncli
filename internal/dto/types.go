package dto

import (
	"encoding/json"
	"time"
)

// Position represents 2D coordinates.
type Position struct {
	X int `json:"x"`
	Y int `json:"y"`
}

// Entity represents a tactical unit on the board.
type Entity struct {
	ID             string          `json:"id"`
	PlayerID       string          `json:"player_id,omitempty"` // Player ID is masked in some responses
	Team           int             `json:"team"`
	Name           string          `json:"name"`
	HP             int             `json:"hp"`
	MaxHP          int             `json:"max_hp"`
	Attack         int             `json:"attack"`
	Defense        int             `json:"defense"`
	Move           int             `json:"move"`
	MaxMove        int             `json:"max_move"`
	Position       Position        `json:"position"`
	EquippedItems  []EquippedItem  `json:"equipped_items"`
	Buffs          []Buff          `json:"buffs"`
	EquippedSkills []EquippedSkill `json:"equipped_skills"`
	IsSelf         bool            `json:"is_self"`
	Dead           bool            `json:"dead"`
}

// Flex handles inconsistent JSON where an empty object might be represented as an empty array [].
type Flex[T any] struct {
	Data T
}

func (f *Flex[T]) UnmarshalJSON(data []byte) error {
	if string(data) == "[]" {
		return nil
	}
	return json.Unmarshal(data, &f.Data)
}

func (f Flex[T]) MarshalJSON() ([]byte, error) {
	return json.Marshal(f.Data)
}

type PropertyDTO struct {
	Value  *int     `json:"value,omitempty"`
	FValue *float64 `json:"fvalue,omitempty"`
	Max    *int     `json:"max,omitempty"`
	BValue *bool    `json:"bvalue,omitempty"`
	SValue *string  `json:"svalue,omitempty"`
}

type PropertyMap = map[string]PropertyDTO

type EquippedSkill struct {
	SkillID   string            `json:"skill_id"`
	Name      string            `json:"name"`
	Behavior  string            `json:"behavior"`
	Targeting Flex[PropertyMap] `json:"targeting"`
	Costs     Flex[PropertyMap] `json:"costs"`
	Effect    Flex[PropertyMap] `json:"effect"`
	Origin    string            `json:"origin,omitempty"`
}

type Buff struct {
	OriginID   string            `json:"origin_id"`
	Forever    bool              `json:"forever"`
	Properties Flex[PropertyMap] `json:"properties"`
}

type EquippedItem struct {
	ItemID     string            `json:"item_id"`
	Name       string            `json:"name"`
	Slot       string            `json:"slot"`
	Properties Flex[PropertyMap] `json:"properties"`
}

// Cell is the topmost cell at a (x, y) column. Caves/underground are not
// exposed; what you see here IS the walkable surface.
type Cell struct {
	EntityID string `json:"entity_id"`
	Obstacle bool   `json:"obstacle"`
	Height   int    `json:"height"` // Z index of the topmost cell (surface elevation)
}

// Grid is the tactical map layout. Cells is a topmost-cell projection of the
// engine's 3D grid (see Cell). MaxHeight is the engine's Z ceiling.
type Grid struct {
	Width     int      `json:"width"`
	Height    int      `json:"height"`
	MaxHeight int      `json:"max_height"`
	Cells     [][]Cell `json:"cells"`
}

// Turn represents an entry in the initiative timeline.
type Turn struct {
	EntityID string `json:"entity_id"`
	Delay    int    `json:"delay"`
	IsSelf   bool   `json:"is_self"`
	Team     int    `json:"team"`
}

// ActionFeedback provides explicit data about the last tactical action.
type ActionFeedback struct {
	Type     string     `json:"type"` // "move", "attack", "pass"
	ActorID  string     `json:"actor_id"`
	TargetID string     `json:"target_id,omitempty"`
	Path     []Position `json:"path,omitempty"`
	Damage   int        `json:"damage,omitempty"`
	PrevHP   int        `json:"prev_hp,omitempty"`
	NewHP    int        `json:"new_hp,omitempty"`
}

// Player represents a participant in the match and their entities.
type Player struct {
	Nickname string   `json:"nickname"`
	Team     int      `json:"team"`
	IsSelf   bool     `json:"is_self"`
	IA       bool     `json:"ia"`
	Entities []Entity `json:"entities"`
}

// BoardState is the full DTO for the tactical situation.
type BoardState struct {
	Players             []Player  `json:"players"`           // Consolidated roster
	Entities            []Entity  `json:"entities,omitempty"` // Deprecated: use players[].entities
	Grid                Grid      `json:"grid"`
	Turn                []Turn    `json:"turn"`
	CurrentPlayerIsSelf bool      `json:"current_player_is_self"`
	CurrentEntityID     string    `json:"current_entity_id"`
	Timeout             time.Time `json:"timeout"`
	StartTime           time.Time `json:"start_time"`
	WinnerIsSelf        bool      `json:"winner_is_self"`
	WinnerTeamID        *int            `json:"winner_team_id"`
	Action              *ActionFeedback `json:"action,omitempty"`
	Version             uint64          `json:"version"`
	GameFinished        bool            `json:"game_finished"`
}

// GameResponse is the expanded response from GET /api/v1/game/{id}
type GameResponse struct {
	MatchID      string     `json:"match_id"`
	GameMode     string     `json:"game_mode"`
	GameState    BoardState `json:"game_state"`
	StartedAt    *time.Time `json:"started_at"`
	ConcludedAt  *time.Time `json:"concluded_at"`
	WinnerTeamID *int       `json:"winner_team_id"`
}
