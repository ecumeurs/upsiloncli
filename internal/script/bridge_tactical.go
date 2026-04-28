package script

import (
	"encoding/json"
	"fmt"

	"github.com/dop251/goja"
	"github.com/ecumeurs/upsiloncli/internal/dto"
)

func (a *Agent) flattenEntities(board *dto.BoardState) []dto.Entity {
	var all []dto.Entity
	if board == nil {
		return all
	}
	for _, p := range board.Players {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsFindPath(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return a.VM.ToValue(nil)
	}

	var start, end dto.Position
	var board dto.BoardState

	// Marshal/Unmarshal is the most reliable way to convert deep JS objects to Go DTOs
	startBytes, _ := json.Marshal(call.Arguments[0].Export())
	json.Unmarshal(startBytes, &start)

	endBytes, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(endBytes, &end)

	boardBytes, _ := json.Marshal(call.Arguments[2].Export())
	json.Unmarshal(boardBytes, &board)

	// Inject flattened entities for pathfinding algorithms that expect them
	board.Entities = a.flattenEntities(&board)

	path := FindPath(&board, start, end)

	// Ensure proper JSON mapping for the return value
	var result interface{}
	pathBytes, _ := json.Marshal(path)
	json.Unmarshal(pathBytes, &result)

	return a.VM.ToValue(result)
}

// @spec-link [[api_plan_travel_toward]]
func (a *Agent) jsPlanTravelToward(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return a.VM.ToValue(nil)
	}

	entityID := call.Arguments[0].String()

	var target dto.Position
	targetBytes, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(targetBytes, &target)

	var board dto.BoardState
	boardBytes, _ := json.Marshal(call.Arguments[2].Export())
	json.Unmarshal(boardBytes, &board)

	// Inject flattened entities
	board.Entities = a.flattenEntities(&board)

	// Enforcement: if the unit has already attacked this turn, movement is blocked
	if a.hasAttackedThisTurn && entityID == a.currentTurnEntityID {
		return a.VM.ToValue([]dto.Position{})
	}

	path := PlanTravelToward(&board, entityID, target)

	// Ensure proper JSON mapping for the return value
	var result interface{}
	pathBytes, _ := json.Marshal(path)
	json.Unmarshal(pathBytes, &result)

	return a.VM.ToValue(result)
}

// --- Tactical Utility Implementations ---

func (a *Agent) jsMyPlayer() interface{} {
	parts := a.Session.Participants()
	for _, p := range parts {
		if p.IsSelf {
			return p
		}
	}
	return nil
}

func (a *Agent) jsCurrentPlayer() interface{} {
	board := a.Session.LastBoard()
	if board == nil {
		return nil
	}

	if board.CurrentPlayerIsSelf {
		return a.jsMyPlayer()
	}

	// Find owner of the current entity
	for _, p := range board.Players {
		for _, e := range p.Entities {
			if e.ID == board.CurrentEntityID {
				return p
			}
		}
	}

	return nil
}

func (a *Agent) jsCurrentCharacter() interface{} {
	board := a.Session.LastBoard()
	if board == nil || board.Players == nil {
		return nil
	}
	for _, p := range board.Players {
		for _, e := range p.Entities {
			if e.ID == board.CurrentEntityID {
				return a.decorateEntity(e, board)
			}
		}
	}
	return nil
}

func (a *Agent) decorateEntity(e dto.Entity, board *dto.BoardState) interface{} {
	// Convert to map to add dynamic fields
	data, _ := json.Marshal(e)
	var res map[string]interface{}
	json.Unmarshal(data, &res)

	// Inject internal turn memory
	if e.ID == a.currentTurnEntityID {
		res["has_attacked"] = a.hasAttackedThisTurn
	} else {
		res["has_attacked"] = false
	}

	return res
}

func (a *Agent) jsMyCharacters() []dto.Entity {
	board := a.Session.LastBoard()
	if board == nil {
		return nil
	}
	var mine []dto.Entity
	for _, p := range board.Players {
		if p.IsSelf {
			mine = append(mine, p.Entities...)
		}
	}
	return mine
}

func (a *Agent) jsMyAllies() []dto.Player {
	board := a.Session.LastBoard()
	if board == nil {
		return nil
	}

	var allies []dto.Player
	var myTeam int
	found := false
	for _, p := range board.Players {
		if p.IsSelf {
			myTeam = p.Team
			found = true
			break
		}
	}

	if !found {
		return nil
	}

	for _, p := range board.Players {
		if p.Team == myTeam && !p.IsSelf {
			allies = append(allies, p)
		}
	}
	return allies
}

func (a *Agent) jsMyAlliesCharacters() []dto.Entity {
	allies := a.jsMyAllies()
	var all []dto.Entity
	for _, p := range allies {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsMyFoes() []dto.Player {
	board := a.Session.LastBoard()
	if board == nil {
		return nil
	}

	var foes []dto.Player
	var myTeam int
	found := false
	for _, p := range board.Players {
		if p.IsSelf {
			myTeam = p.Team
			found = true
			break
		}
	}

	if !found {
		return nil
	}

	for _, p := range board.Players {
		if p.Team != myTeam {
			foes = append(foes, p)
		}
	}
	return foes
}

func (a *Agent) jsMyFoesCharacters() []dto.Entity {
	foes := a.jsMyFoes()
	var all []dto.Entity
	for _, p := range foes {
		all = append(all, p.Entities...)
	}
	return all
}

func (a *Agent) jsCellContentAt(x, y int) interface{} {
	board := a.Session.LastBoard()
	if board == nil {
		return nil
	}

	if x < 0 || x >= len(board.Grid.Cells) || y < 0 || y >= len(board.Grid.Cells[0]) {
		return nil
	}

	cell := board.Grid.Cells[x][y]
	var foundEntity *dto.Entity
	if cell.EntityID != "" {
		for _, p := range board.Players {
			for _, e := range p.Entities {
				if e.ID == cell.EntityID {
					foundEntity = &e
					break
				}
			}
			if foundEntity != nil {
				break
			}
		}
	}

	return map[string]interface{}{
		"obstacle": cell.Obstacle,
		"entity":   foundEntity,
	}
}

// resolveGridFromArg accepts either a board (BoardState-like) or a grid directly
// and returns a normalized *dto.Grid. This lets JS callers write cellAt(board, x, y)
// or cellAt(board.grid, x, y) interchangeably.
func (a *Agent) resolveGridFromArg(v goja.Value) *dto.Grid {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	m, ok := v.Export().(map[string]interface{})
	if !ok {
		return nil
	}
	// Prefer inner "grid" if it looks like a board
	if inner, ok := m["grid"].(map[string]interface{}); ok {
		g := &dto.Grid{}
		b, _ := json.Marshal(inner)
		if err := json.Unmarshal(b, g); err == nil && len(g.Cells) > 0 {
			return g
		}
	}
	// Otherwise treat the argument itself as a Grid
	g := &dto.Grid{}
	b, _ := json.Marshal(m)
	if err := json.Unmarshal(b, g); err == nil && len(g.Cells) > 0 {
		return g
	}
	return nil
}

// jsCellAt is the ONLY sanctioned way for scenario scripts to read a cell.
// It hides the underlying storage layout so we can migrate to Y-major
// (see [[ISS-079]]) without touching every test. The returned object is
// { x, y, obstacle, height, entity_id } or null if out of bounds / no board.
// @spec-link [[ISS-079]]
func (a *Agent) jsCellAt(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 3 {
		return goja.Null()
	}
	g := a.resolveGridFromArg(call.Arguments[0])
	if g == nil {
		// Fall back to the session board so cellAt(null, x, y) still works.
		if b := a.Session.LastBoard(); b != nil {
			g = &b.Grid
		}
	}
	if g == nil {
		return goja.Null()
	}
	x := int(call.Arguments[1].ToInteger())
	y := int(call.Arguments[2].ToInteger())

	// Current contract: cells[x][y] (width-major). Keep the check strict so
	// callers get a hard null on bad bounds instead of a wrong cell.
	if x < 0 || x >= len(g.Cells) {
		return goja.Null()
	}
	col := g.Cells[x]
	if y < 0 || y >= len(col) {
		return goja.Null()
	}
	c := col[y]
	return a.VM.ToValue(map[string]interface{}{
		"x":         x,
		"y":         y,
		"obstacle":  c.Obstacle,
		"height":    c.Height,
		"entity_id": c.EntityID,
	})
}

// jsForEachCell iterates every cell in (x, y) order and invokes the callback
// with the cell object produced by jsCellAt. Returning a truthy value from the
// callback stops iteration early, mirroring Array.prototype.some semantics.
// @spec-link [[ISS-079]]
func (a *Agent) jsForEachCell(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		return goja.Undefined()
	}
	g := a.resolveGridFromArg(call.Arguments[0])
	if g == nil {
		if b := a.Session.LastBoard(); b != nil {
			g = &b.Grid
		}
	}
	if g == nil {
		return goja.Undefined()
	}
	cb, ok := goja.AssertFunction(call.Arguments[1])
	if !ok {
		return goja.Undefined()
	}
	for x := 0; x < len(g.Cells); x++ {
		for y := 0; y < len(g.Cells[x]); y++ {
			c := g.Cells[x][y]
			cellVal := a.VM.ToValue(map[string]interface{}{
				"x":         x,
				"y":         y,
				"obstacle":  c.Obstacle,
				"height":    c.Height,
				"entity_id": c.EntityID,
			})
			res, err := cb(goja.Undefined(), cellVal)
			if err != nil {
				panic(a.VM.ToValue(fmt.Sprintf("forEachCell callback error: %v", err)))
			}
			if res != nil && !goja.IsUndefined(res) && !goja.IsNull(res) && res.ToBoolean() {
				return res
			}
		}
	}
	return goja.Undefined()
}

// jsDistance2D computes the 2D Manhattan distance between two positions.
func (a *Agent) jsDistance2D(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		return a.VM.ToValue(0)
	}
	var p1, p2 dto.Position
	b1, _ := json.Marshal(call.Arguments[0].Export())
	json.Unmarshal(b1, &p1)
	b2, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(b2, &p2)

	return a.VM.ToValue(abs(p1.X-p2.X) + abs(p1.Y-p2.Y))
}

// jsHeightDifference computes the absolute vertical distance between two positions.
// It requires a board/grid to look up the height at each position.
func (a *Agent) jsHeightDifference(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 2 {
		return a.VM.ToValue(0)
	}
	var p1, p2 dto.Position
	b1, _ := json.Marshal(call.Arguments[0].Export())
	json.Unmarshal(b1, &p1)
	b2, _ := json.Marshal(call.Arguments[1].Export())
	json.Unmarshal(b2, &p2)

	var board *dto.BoardState
	if len(call.Arguments) >= 3 {
		boardBytes, _ := json.Marshal(call.Arguments[2].Export())
		json.Unmarshal(boardBytes, &board)
	} else {
		board = a.Session.LastBoard()
	}

	if board == nil {
		return a.VM.ToValue(0)
	}

	h1 := a.getHeightAt(board, p1.X, p1.Y)
	h2 := a.getHeightAt(board, p2.X, p2.Y)

	return a.VM.ToValue(abs(h1 - h2))
}

func (a *Agent) getHeightAt(board *dto.BoardState, x, y int) int {
	if x < 0 || x >= len(board.Grid.Cells) {
		return 0
	}
	col := board.Grid.Cells[x]
	if y < 0 || y >= len(col) {
		return 0
	}
	return col[y].Height
}

// jsActiveHeightDifference computes the vertical distance between the current active character and a target position.
func (a *Agent) jsActiveHeightDifference(call goja.FunctionCall) goja.Value {
	if len(call.Arguments) < 1 {
		return a.VM.ToValue(0)
	}

	var board *dto.BoardState
	if len(call.Arguments) >= 2 {
		boardBytes, _ := json.Marshal(call.Arguments[1].Export())
		json.Unmarshal(boardBytes, &board)
	} else {
		board = a.Session.LastBoard()
	}

	if board == nil {
		return a.VM.ToValue(0)
	}

	var me *dto.Entity
	for i := range board.Players {
		for j := range board.Players[i].Entities {
			if board.Players[i].Entities[j].ID == board.CurrentEntityID {
				me = &board.Players[i].Entities[j]
				break
			}
		}
		if me != nil {
			break
		}
	}
	if me == nil {
		return a.VM.ToValue(0)
	}

	var target dto.Position
	bt, _ := json.Marshal(call.Arguments[0].Export())
	json.Unmarshal(bt, &target)

	hMe := a.getHeightAt(board, me.Position.X, me.Position.Y)
	hTarget := a.getHeightAt(board, target.X, target.Y)

	return a.VM.ToValue(abs(hMe - hTarget))
}
