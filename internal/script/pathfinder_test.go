package script

import (
	"testing"
	"github.com/ecumeurs/upsiloncli/internal/dto"
)

func TestFindPath_Transposition(t *testing.T) {
	// 3x2 grid (3 columns, 2 rows)
	// . . # (col 0, col 1, col 2)
	// . . .
	// If column-major: grid.Cells[2][0] is the obstacle.
	grid := dto.Grid{
		Width:  3,
		Height: 2,
		Cells: [][]dto.Cell{
			{{Obstacle: false}, {Obstacle: false}}, // Col 0
			{{Obstacle: false}, {Obstacle: false}}, // Col 1
			{{Obstacle: true}, {Obstacle: false}},  // Col 2
		},
	}
	board := &dto.BoardState{Grid: grid}

	// Path from (0,0) to (2,1). Obstacle is at (2,0).
	// Grid is:
	// (0,0) (1,0) (2,0:OBS)
	// (0,1) (1,1) (2,1)
	start := dto.Position{X: 0, Y: 0}
	end := dto.Position{X: 2, Y: 1}

	path := FindPath(board, start, end)
	if path == nil {
		t.Fatal("Expected path, got nil")
	}

	foundEnd := false
	for _, p := range path {
		if p.X == end.X && p.Y == end.Y {
			foundEnd = true
		}
		if grid.Cells[p.X][p.Y].Obstacle {
			t.Errorf("Path contains obstacle at %v", p)
		}
	}
	if !foundEnd {
		t.Errorf("Path did not reach destination %v", end)
	}
    
    // Check if it correctly identifies the obstacle at (2,0)
    blocked := dto.Position{X: 2, Y: 0}
    foundBlocked := false
    // Internal check (re-implementing logic to verify)
    for x, col := range grid.Cells {
        for y, cell := range col {
            if cell.Obstacle && x == blocked.X && y == blocked.Y {
                foundBlocked = true
            }
        }
    }
    if !foundBlocked {
        t.Fatal("Test setup failed: obstacle not found where expected")
    }
}

func TestPlanTravelToward(t *testing.T) {
	grid := dto.Grid{
		Width:  3,
		Height: 3,
		Cells: [][]dto.Cell{
			{{}, {}, {}},
			{{}, {}, {}},
			{{}, {}, {}},
		},
	}
	board := &dto.BoardState{
		Grid: grid,
		Entities: []dto.Entity{
			{ID: "self", Position: dto.Position{X: 0, Y: 0}, Move: 2, HP: 10},
			{ID: "enemy", Position: dto.Position{X: 2, Y: 0}, HP: 10},
		},
	}

	// Target is enemy at (2,0). Adjacency is required.
	// Path should be (0,0) -> (1,0) -> (2,0) truncated to Move=2 -> (0,0)->(1,0)
    // Wait, path returned by FindPath doesn't include start. So path is [(1,0)]. 
    // Wait, dist is 2. Path to (1,0) is length 1. 1 <= 2, so path is [(1,0)].
	path := PlanTravelToward(board, "self", dto.Position{X: 2, Y: 0})
	if len(path) != 1 {
		t.Errorf("Expected path length 1, got %d: %v", len(path), path)
	}
	if path[0].X != 1 || path[0].Y != 0 {
		t.Errorf("Expected path [(1,0)], got %v", path)
	}
}
