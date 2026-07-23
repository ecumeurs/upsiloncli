package endpoint
// @lint-ignore-documentation

import (
	"fmt"

	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// ── Phase-4 auth cutover: battle enrollment ────────────────────────────────
// Post-cutover, auth_register only creates the account + token; the roster
// and player_stats row are provisioned by this endpoint. Every bot/scenario
// must enroll before it can touch characters, matchmaking or game state.

// @spec-link [[mechanic_bot_enrollment]]

// BattleEnroll implements Endpoint for POST /api/v1/battle/enroll.
type BattleEnroll struct{}

func (e *BattleEnroll) Name() string { return "battle_enroll" }
func (e *BattleEnroll) Description() string {
	return "Enroll the authenticated account into tactical battle (creates roster + player_stats, registers 'tactical')"
}
func (e *BattleEnroll) Method() string  { return "POST" }
func (e *BattleEnroll) Path() string    { return "/api/v1/battle/enroll" }
func (e *BattleEnroll) Auth() bool      { return true }
func (e *BattleEnroll) Params() []Param { return nil }

func (e *BattleEnroll) Next() []string {
	return []string{"profile_characters", "matchmaking_join"}
}

func (e *BattleEnroll) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Post(e.Path(), nil)
}

func (e *BattleEnroll) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Reuses the generic envelope sync: whether the hub echoes the new roster
	// under "characters" or nothing at all, SyncSession degrades gracefully.
	SyncSession(resp, sess)
	client.Printer.System(fmt.Sprintf("Enroll: %s", resp.Message))
	return nil
}
