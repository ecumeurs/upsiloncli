package script

import (
	"github.com/ecumeurs/upsiloncli/internal/dto"
)

type queueItem struct {
	pos  dto.Position
	path []dto.Position
}

// FindPath calculates the shortest path from start to end on the board.
// It avoids obstacles and cells occupied by living entities.
func FindPath(board *dto.BoardState, start, end dto.Position) []dto.Position {
	if board == nil {
		return nil
	}

	grid := board.Grid
	width := len(grid.Cells)
	height := 0
	if width > 0 {
		height = len(grid.Cells[0])
	}

	// BFS for shortest path
	queue := []queueItem{{pos: start, path: []dto.Position{}}}
	visited := make(map[dto.Position]bool)
	visited[start] = true

	// Pre-calculate blocked cells
	blocked := make(map[dto.Position]bool)
	for x, col := range grid.Cells {
		for y, cell := range col {
			if cell.Obstacle {
				blocked[dto.Position{X: x, Y: y}] = true
			}
		}
	}
	for _, entity := range board.Entities {
		if entity.HP > 0 {
			blocked[entity.Position] = true
		}
	}
	
	// Ensure the starting point isn't blocked by the acting unit itself
	delete(blocked, start)
	
	// Ensure the end point isn't blocked (though it usually is if it's an enemy, 
	// but the script should ask for a path to an empty tile).
	// If the user specifically asks for a path to a blocked tile, we return nil.

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current.pos == end {
			return current.path
		}

		// Neighbors: Up, Down, Left, Right
		neighbors := []dto.Position{
			{X: current.pos.X, Y: current.pos.Y - 1},
			{X: current.pos.X, Y: current.pos.Y + 1},
			{X: current.pos.X - 1, Y: current.pos.Y},
			{X: current.pos.X + 1, Y: current.pos.Y},
		}

		for _, next := range neighbors {
			if next.X >= 0 && next.X < width && next.Y >= 0 && next.Y < height {
				if !visited[next] && !blocked[next] {
					visited[next] = true
					newPath := append([]dto.Position{}, current.path...)
					newPath = append(newPath, next)
					queue = append(queue, queueItem{pos: next, path: newPath})
				}
			}
		}
	}

	return nil
}

// PlanTravelToward calculates a path for an entity toward a target position.
// If the target position is occupied, it finds the shortest path to an adjacent tile.
// The resulting path is truncated by the entity's movement credits.
// @spec-link [[api_plan_travel_toward]]
func PlanTravelToward(board *dto.BoardState, actingEntityID string, target dto.Position) []dto.Position {
	if board == nil {
		return nil
	}

	// 1. Find the acting entity
	var actingEntity *dto.Entity
	for i := range board.Entities {
		if board.Entities[i].ID == actingEntityID {
			actingEntity = &board.Entities[i]
			break
		}
	}

	if actingEntity == nil {
		return nil
	}

	// 2. Determine if target is occupied or an obstacle
	destOccupied := false
	grid := board.Grid
	if target.X >= 0 && target.X < len(grid.Cells) && target.Y >= 0 && target.Y < len(grid.Cells[0]) {
		if grid.Cells[target.X][target.Y].Obstacle {
			destOccupied = true
		}
	}
	if !destOccupied {
		for _, e := range board.Entities {
			if e.HP > 0 && e.Position == target {
				destOccupied = true
				break
			}
		}
	}

	// 3. Find path
	var path []dto.Position
	if !destOccupied {
		path = FindPath(board, actingEntity.Position, target)
	} else {
		// Find path to all 4 adjacent spots and pick the best one
		adjacents := []dto.Position{
			{X: target.X + 1, Y: target.Y},
			{X: target.X - 1, Y: target.Y},
			{X: target.X, Y: target.Y + 1},
			{X: target.X, Y: target.Y - 1},
		}

		var bestPath []dto.Position
		for _, spot := range adjacents {
			p := FindPath(board, actingEntity.Position, spot)
			if p != nil && (bestPath == nil || len(p) < len(bestPath)) {
				bestPath = p
			}
		}
		path = bestPath
	}

	if path == nil {
		return nil
	}

	// 4. Truncate by movement credits
	if len(path) > actingEntity.Move {
		path = path[:actingEntity.Move]
	}

	return path
}
