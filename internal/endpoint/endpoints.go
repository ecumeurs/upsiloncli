package endpoint

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/session"
	"github.com/ecumeurs/upsiloncli/internal/dto"
)

// --- Profile ---

// ProfileGet implements Endpoint for GET /api/v1/profile.
type ProfileGet struct{}

func (e *ProfileGet) Name() string        { return "profile_get" }
func (e *ProfileGet) Description() string { return "Get player profile with stats" }
func (e *ProfileGet) Method() string      { return "GET" }
func (e *ProfileGet) Path() string        { return "/api/v1/profile" }
func (e *ProfileGet) Auth() bool          { return true }
func (e *ProfileGet) Params() []Param     { return nil }

func (e *ProfileGet) Next() []string {
	return []string{"profile_characters"}
}

func (e *ProfileGet) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *ProfileGet) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Extract character IDs and token from response data for context
	SyncSession(resp, sess)
	return nil
}

// ProfileCharacters implements Endpoint for GET /api/v1/profile/characters.
type ProfileCharacters struct{}

func (e *ProfileCharacters) Name() string        { return "profile_characters" }
func (e *ProfileCharacters) Description() string { return "List character roster" }
func (e *ProfileCharacters) Method() string      { return "GET" }
func (e *ProfileCharacters) Path() string        { return "/api/v1/profile/characters" }
func (e *ProfileCharacters) Auth() bool          { return true }
func (e *ProfileCharacters) Params() []Param     { return nil }

func (e *ProfileCharacters) Next() []string {
	return []string{"profile_character", "character_reroll", "character_upgrade", "character_rename", "matchmaking_join"}
}

func (e *ProfileCharacters) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *ProfileCharacters) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Store first character_id in context for convenience
	if data, ok := resp.Data.([]interface{}); ok && len(data) > 0 {
		if char, ok := data[0].(map[string]interface{}); ok {
			if id, ok := char["id"].(string); ok {
				sess.Set("character_id", id)
			}
		}
		// Also store all character IDs
		var ids []string
		for _, item := range data {
			if char, ok := item.(map[string]interface{}); ok {
				if id, ok := char["id"].(string); ok {
					ids = append(ids, id)
				}
			}
		}
		if len(ids) > 0 {
			sess.Set("character_ids", strings.Join(ids, ","))
		}
	}
	return nil
}

// ProfileCharacter implements Endpoint for GET /api/v1/profile/character/{characterId}.
type ProfileCharacter struct{}

func (e *ProfileCharacter) Name() string        { return "profile_character" }
func (e *ProfileCharacter) Description() string { return "Get specific character details" }
func (e *ProfileCharacter) Method() string      { return "GET" }
func (e *ProfileCharacter) Path() string        { return "/api/v1/profile/character/{characterId}" }
func (e *ProfileCharacter) Auth() bool          { return true }
func (e *ProfileCharacter) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *ProfileCharacter) Next() []string {
	return []string{"profile_characters", "character_upgrade"}
}

func (e *ProfileCharacter) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Get(path)
}

func (e *ProfileCharacter) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// CharacterReroll implements Endpoint for POST /api/v1/profile/character/{characterId}/reroll.
type CharacterReroll struct{}

func (e *CharacterReroll) Name() string        { return "character_reroll" }
func (e *CharacterReroll) Description() string { return "Reroll character stats (new accounts)" }
func (e *CharacterReroll) Method() string      { return "POST" }
func (e *CharacterReroll) Path() string        { return "/api/v1/profile/character/{characterId}/reroll" }
func (e *CharacterReroll) Auth() bool          { return true }
func (e *CharacterReroll) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *CharacterReroll) Next() []string {
	return []string{"profile_character"}
}

func (e *CharacterReroll) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Post(path, nil)
}

func (e *CharacterReroll) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// CharacterUpgrade implements Endpoint for POST /api/v1/profile/character/{characterId}/upgrade.
type CharacterUpgrade struct{}

func (e *CharacterUpgrade) Name() string    { return "character_upgrade" }
func (e *CharacterUpgrade) Description() string { return "Allocate stat points from wins" }
func (e *CharacterUpgrade) Method() string  { return "POST" }
func (e *CharacterUpgrade) Path() string    { return "/api/v1/profile/character/{characterId}/upgrade" }
func (e *CharacterUpgrade) Auth() bool      { return true }
func (e *CharacterUpgrade) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "hp", Hint: "HP increment (int)"},
		{Name: "attack", Hint: "Attack increment (int)"},
		{Name: "defense", Hint: "Defense increment (int)"},
		{Name: "movement", Hint: "Movement increment (int)"},
	}
}

func (e *CharacterUpgrade) Next() []string {
	return []string{"profile_character"}
}

func (e *CharacterUpgrade) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	stats := make(map[string]string)
	for _, k := range []string{"hp", "attack", "defense", "movement"} {
		if v := inputs[k]; v != "" {
			stats[k] = v
		}
	}
	body := map[string]interface{}{"stats": stats}
	return client.Post(path, body)
}

func (e *CharacterUpgrade) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// CharacterRename implements Endpoint for POST /api/v1/profile/character/{characterId}/rename.
type CharacterRename struct{}

func (e *CharacterRename) Name() string        { return "character_rename" }
func (e *CharacterRename) Description() string { return "Rename a character" }
func (e *CharacterRename) Method() string      { return "POST" }
func (e *CharacterRename) Path() string        { return "/api/v1/profile/character/{characterId}/rename" }
func (e *CharacterRename) Auth() bool          { return true }
func (e *CharacterRename) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "name", Hint: "new character name", Required: true},
	}
}

func (e *CharacterRename) Next() []string {
	return []string{"profile_character"}
}

func (e *CharacterRename) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Post(path, map[string]string{"name": inputs["name"]})
}

func (e *CharacterRename) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// CharacterDelete implements Endpoint for DELETE /api/v1/profile/character/{characterId}.
type CharacterDelete struct{}

func (e *CharacterDelete) Name() string        { return "character_delete" }
func (e *CharacterDelete) Description() string { return "Delete a character" }
func (e *CharacterDelete) Method() string      { return "DELETE" }
func (e *CharacterDelete) Path() string        { return "/api/v1/profile/character/{characterId}" }
func (e *CharacterDelete) Auth() bool          { return true }
func (e *CharacterDelete) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *CharacterDelete) Next() []string {
	return []string{"profile_characters"}
}

func (e *CharacterDelete) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Delete(path)
}

func (e *CharacterDelete) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Matchmaking ---

// MatchmakingJoin implements Endpoint for POST /api/v1/matchmaking/join.
type MatchmakingJoin struct{}

func (e *MatchmakingJoin) Name() string        { return "matchmaking_join" }
func (e *MatchmakingJoin) Description() string { return "Enter the matchmaking queue" }
func (e *MatchmakingJoin) Method() string      { return "POST" }
func (e *MatchmakingJoin) Path() string        { return "/api/v1/matchmaking/join" }
func (e *MatchmakingJoin) Auth() bool          { return true }
func (e *MatchmakingJoin) Params() []Param {
	return []Param{
		{Name: "game_mode", Hint: "1v1_PVP|1v1_PVE|2v2_PVP|2v2_PVE", Required: true},
	}
}

func (e *MatchmakingJoin) Next() []string {
	return []string{"matchmaking_status", "game_state"}
}

func (e *MatchmakingJoin) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Post(e.Path(), map[string]string{
		"game_mode": inputs["game_mode"],
	})
}

func (e *MatchmakingJoin) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Capture match_id if matched immediately
	if data, ok := resp.Data.(map[string]interface{}); ok {
		if matchID, ok := data["match_id"].(string); ok && matchID != "" {
			sess.Set("match_id", matchID)
			client.Printer.System(fmt.Sprintf("Match found! match_id: %s", matchID))
		}
		if status, ok := data["status"].(string); ok {
			sess.Set("matchmaking_status", status)
		}
	}
	return nil
}

// MatchmakingStatus implements Endpoint for GET /api/v1/matchmaking/status.
type MatchmakingStatus struct{}

func (e *MatchmakingStatus) Name() string        { return "matchmaking_status" }
func (e *MatchmakingStatus) Description() string { return "Poll matchmaking queue status" }
func (e *MatchmakingStatus) Method() string      { return "GET" }
func (e *MatchmakingStatus) Path() string        { return "/api/v1/matchmaking/status" }
func (e *MatchmakingStatus) Auth() bool          { return true }
func (e *MatchmakingStatus) Params() []Param     { return nil }

func (e *MatchmakingStatus) Next() []string {
	return []string{"matchmaking_join", "game_state", "matchmaking_leave"}
}

func (e *MatchmakingStatus) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *MatchmakingStatus) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	if data, ok := resp.Data.(map[string]interface{}); ok {
		if matchID, ok := data["match_id"].(string); ok && matchID != "" {
			sess.Set("match_id", matchID)
		}
		if status, ok := data["status"].(string); ok {
			sess.Set("matchmaking_status", status)
		}
	}
	return nil
}

// MatchmakingLeave implements Endpoint for DELETE /api/v1/matchmaking/leave.
type MatchmakingLeave struct{}

func (e *MatchmakingLeave) Name() string        { return "matchmaking_leave" }
func (e *MatchmakingLeave) Description() string { return "Leave the matchmaking queue" }
func (e *MatchmakingLeave) Method() string      { return "DELETE" }
func (e *MatchmakingLeave) Path() string        { return "/api/v1/matchmaking/leave" }
func (e *MatchmakingLeave) Auth() bool          { return true }
func (e *MatchmakingLeave) Params() []Param     { return nil }

func (e *MatchmakingLeave) Next() []string {
	return []string{"matchmaking_join", "profile_get"}
}

func (e *MatchmakingLeave) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Delete(e.Path())
}

func (e *MatchmakingLeave) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	sess.Delete("matchmaking_status")
	client.Printer.System(fmt.Sprintf("Leave: %s", resp.Message))
	return nil
}

// --- Stats ---

// StatsWaiting implements Endpoint for GET /api/v1/match/stats/waiting.
type StatsWaiting struct{}

func (e *StatsWaiting) Name() string        { return "stats_waiting" }
func (e *StatsWaiting) Description() string { return "Get waiting players count" }
func (e *StatsWaiting) Method() string      { return "GET" }
func (e *StatsWaiting) Path() string        { return "/api/v1/match/stats/waiting" }
func (e *StatsWaiting) Auth() bool          { return true }
func (e *StatsWaiting) Params() []Param     { return nil }

func (e *StatsWaiting) Next() []string {
	return []string{"matchmaking_join"}
}

func (e *StatsWaiting) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *StatsWaiting) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// StatsActive implements Endpoint for GET /api/v1/match/stats/active.
type StatsActive struct{}

func (e *StatsActive) Name() string        { return "stats_active" }
func (e *StatsActive) Description() string { return "Get active match count" }
func (e *StatsActive) Method() string      { return "GET" }
func (e *StatsActive) Path() string        { return "/api/v1/match/stats/active" }
func (e *StatsActive) Auth() bool          { return true }
func (e *StatsActive) Params() []Param     { return nil }

func (e *StatsActive) Next() []string {
	return []string{"matchmaking_join"}
}

func (e *StatsActive) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *StatsActive) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Leaderboard ---

// LeaderboardGet implements Endpoint for GET /api/v1/leaderboard.
type LeaderboardGet struct{}

func (e *LeaderboardGet) Name() string        { return "leaderboard" }
func (e *LeaderboardGet) Description() string { return "Get competitive rankings" }
func (e *LeaderboardGet) Method() string      { return "GET" }
func (e *LeaderboardGet) Path() string        { return "/api/v1/leaderboard" }
func (e *LeaderboardGet) Auth() bool          { return true }
func (e *LeaderboardGet) Params() []Param {
	return []Param{
		{Name: "mode", Hint: "1v1_PVP|2v2_PVP|1v1_PVE|2v2_PVE", Required: true},
		{Name: "page", Hint: "page index (Default: 1)"},
		{Name: "search", Hint: "filter by name (Optional)"},
	}
}

func (e *LeaderboardGet) Next() []string {
	return []string{"matchmaking_join"}
}

func (e *LeaderboardGet) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := "/api/v1/leaderboard"
	params := make(map[string]string)
	if v := inputs["mode"]; v != "" {
		params["mode"] = v
	}
	if v := inputs["page"]; v != "" {
		params["page"] = v
	} else {
		params["page"] = "1"
	}
	if v := inputs["search"]; v != "" {
		params["search"] = v
	}
	return client.GetWithParams(path, params)
}

func (e *LeaderboardGet) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Shop & Inventory (ISS-074) ---

// ShopBrowse implements Endpoint for GET /api/v1/shop/items.
type ShopBrowse struct{}

func (e *ShopBrowse) Name() string        { return "shop_browse" }
func (e *ShopBrowse) Description() string { return "Browse items available in the shop" }
func (e *ShopBrowse) Method() string      { return "GET" }
func (e *ShopBrowse) Path() string        { return "/api/v1/shop/items" }
func (e *ShopBrowse) Auth() bool          { return true }
func (e *ShopBrowse) Params() []Param     { return nil }

func (e *ShopBrowse) Next() []string {
	return []string{"shop_purchase", "profile_inventory"}
}

func (e *ShopBrowse) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *ShopBrowse) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// ShopPurchase implements Endpoint for POST /api/v1/shop/purchase.
type ShopPurchase struct{}

func (e *ShopPurchase) Name() string        { return "shop_purchase" }
func (e *ShopPurchase) Description() string { return "Purchase an item from the shop" }
func (e *ShopPurchase) Method() string      { return "POST" }
func (e *ShopPurchase) Path() string        { return "/api/v1/shop/purchase" }
func (e *ShopPurchase) Auth() bool          { return true }
func (e *ShopPurchase) Params() []Param {
	return []Param{
		{Name: "shop_item_id", Hint: "catalog item UUID", Required: true},
		{Name: "quantity", Hint: "amount to buy (default: 1)"},
	}
}

func (e *ShopPurchase) Next() []string {
	return []string{"profile_inventory", "shop_browse"}
}

func (e *ShopPurchase) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	body := map[string]interface{}{
		"shop_item_id": inputs["shop_item_id"],
	}
	if v := inputs["quantity"]; v != "" {
		body["quantity"] = v
	}
	return client.Post(e.Path(), body)
}

func (e *ShopPurchase) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	SyncSession(resp, sess)
	return nil
}

// InventoryList implements Endpoint for GET /api/v1/profile/inventory.
type InventoryList struct{}

func (e *InventoryList) Name() string        { return "profile_inventory" }
func (e *InventoryList) Description() string { return "List owned items in inventory" }
func (e *InventoryList) Method() string      { return "GET" }
func (e *InventoryList) Path() string        { return "/api/v1/profile/inventory" }
func (e *InventoryList) Auth() bool          { return true }
func (e *InventoryList) Params() []Param     { return nil }

func (e *InventoryList) Next() []string {
	return []string{"character_equipment_list", "shop_browse"}
}

func (e *InventoryList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *InventoryList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// EquipmentList implements Endpoint for GET /api/v1/profile/character/{characterId}/equipment.
type EquipmentList struct{}

func (e *EquipmentList) Name() string        { return "character_equipment_list" }
func (e *EquipmentList) Description() string { return "Show items equipped on a character" }
func (e *EquipmentList) Method() string      { return "GET" }
func (e *EquipmentList) Path() string        { return "/api/v1/profile/character/{characterId}/equipment" }
func (e *EquipmentList) Auth() bool          { return true }
func (e *EquipmentList) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *EquipmentList) Next() []string {
	return []string{"character_equip", "character_unequip", "profile_inventory"}
}

func (e *EquipmentList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Get(path)
}

func (e *EquipmentList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// EquipmentEquip implements Endpoint for POST /api/v1/profile/character/{characterId}/equip.
type EquipmentEquip struct{}

func (e *EquipmentEquip) Name() string        { return "character_equip" }
func (e *EquipmentEquip) Description() string { return "Equip an item from inventory to a character" }
func (e *EquipmentEquip) Method() string      { return "POST" }
func (e *EquipmentEquip) Path() string        { return "/api/v1/profile/character/{characterId}/equip" }
func (e *EquipmentEquip) Auth() bool          { return true }
func (e *EquipmentEquip) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "item_id", Hint: "inventory item UUID", Required: true},
	}
}

func (e *EquipmentEquip) Next() []string {
	return []string{"character_equipment_list", "character_unequip"}
}

func (e *EquipmentEquip) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Post(path, map[string]string{"item_id": inputs["item_id"]})
}

func (e *EquipmentEquip) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// EquipmentUnequip implements Endpoint for DELETE /api/v1/profile/character/{characterId}/unequip/{slot}.
type EquipmentUnequip struct{}

func (e *EquipmentUnequip) Name() string        { return "character_unequip" }
func (e *EquipmentUnequip) Description() string { return "Unequip an item from a character slot" }
func (e *EquipmentUnequip) Method() string      { return "DELETE" }
func (e *EquipmentUnequip) Path() string        { return "/api/v1/profile/character/{characterId}/unequip/{slot}" }
func (e *EquipmentUnequip) Auth() bool          { return true }
func (e *EquipmentUnequip) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "slot", Hint: "armor|utility|weapon", Required: true},
	}
}

func (e *EquipmentUnequip) Next() []string {
	return []string{"character_equipment_list", "character_equip"}
}

func (e *EquipmentUnequip) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	path = strings.ReplaceAll(path, "{slot}", inputs["slot"])
	return client.Delete(path)
}

func (e *EquipmentUnequip) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Game Proxy ---

// GameState implements Endpoint for GET /api/v1/game/{id}.
type GameState struct{}

func (e *GameState) Name() string        { return "game_state" }
func (e *GameState) Description() string { return "Get cached board state for a match" }
func (e *GameState) Method() string      { return "GET" }
func (e *GameState) Path() string        { return "/api/v1/game/{id}" }
func (e *GameState) Auth() bool          { return true }
func (e *GameState) Params() []Param {
	return []Param{
		{Name: "id", Hint: "match UUID", Required: true, ContextKey: "match_id"},
	}
}

func (e *GameState) Next() []string {
	return []string{"game_action", "game_state"}
}

func (e *GameState) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Get(path)
}

func (e *GameState) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}

	// Parse custom response structure
	var game dto.GameResponse
	// Re-marshal/unmarshal because resp.Data is interface{}
	dataBytes, _ := json.Marshal(resp.Data)
	if err := json.Unmarshal(dataBytes, &game); err == nil {
		sess.SetParticipants(game.GameState.Players)
		sess.SetLastBoard(&game.GameState)
		client.Printer.System("Tactical state synchronized.")
		client.Printer.Board(&game.GameState, sess.UserIdentifier(), game.GameState.Players)

		// Detect game conclusion
		if game.GameState.GameFinished {
			if game.GameState.WinnerIsSelf {
				name, _ := sess.Get("account_name")
				client.Printer.Victory(name)
			} else if game.GameState.WinnerTeamID != nil {
				client.Printer.Defeat(fmt.Sprintf("Team %d", *game.GameState.WinnerTeamID))
			} else {
				client.Printer.Draw()
			}
		}
	}

	return nil
}

// json tag helper
func (e *GameState) marshal(data interface{}) []byte {
	b, _ := json.Marshal(data)
	return b
}

// GameAction implements Endpoint for POST /api/v1/game/{id}/action.
type GameAction struct{}

func (e *GameAction) Name() string        { return "game_action" }
func (e *GameAction) Description() string { return "Send tactical action (move/attack/pass/forfeit)" }
func (e *GameAction) Method() string      { return "POST" }
func (e *GameAction) Path() string        { return "/api/v1/game/{id}/action" }
func (e *GameAction) Auth() bool          { return true }
func (e *GameAction) Params() []Param {
	return []Param{
		{Name: "id", Hint: "match UUID", Required: true, ContextKey: "match_id"},
		{Name: "entity_id", Hint: "acting entity UUID", Required: true, ContextKey: "current_entity_id"},
		{Name: "type", Hint: "move|attack|pass", Required: true},
		{Name: "target_coords", Hint: "x,y coordinates (e.g. 3,2;4,2) semicolon-separated path"},
	}
}

func (e *GameAction) Next() []string {
	return []string{"game_state", "game_action"}
}

func (e *GameAction) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])

	body := map[string]interface{}{
		"player_id": inputs["player_id"],
		"entity_id": inputs["entity_id"],
		"type":      inputs["type"],
	}

	// Parse target_coords "x,y" into [{x, y}] OR JSON Array
	if tc := inputs["target_coords"]; tc != "" {
		if strings.HasPrefix(tc, "[") {
			var coords []map[string]int
			if err := json.Unmarshal([]byte(tc), &coords); err == nil {
				body["target_coords"] = coords
			} else {
				// If unmarshal fails, maybe it's not JSON? Fallback to legacy
				body["target_coords"] = parseLegacyCoords(tc)
			}
		} else {
			body["target_coords"] = parseLegacyCoords(tc)
		}
	}

	return client.Post(path, body)
}

func parseLegacyCoords(tc string) []map[string]int {
	var coords []map[string]int
	parts := strings.Split(tc, ";") // support multiple coords separated by ;
	for _, part := range parts {
		xy := strings.Split(strings.TrimSpace(part), ",")
		if len(xy) == 2 {
			x, y := 0, 0
			fmt.Sscanf(xy[0], "%d", &x)
			fmt.Sscanf(xy[1], "%d", &y)
			coords = append(coords, map[string]int{"x": x, "y": y})
		}
	}
	return coords
}

func (e *GameAction) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// GameForfeit implements Endpoint for POST /api/v1/game/{id}/forfeit.
type GameForfeit struct{}

func (e *GameForfeit) Name() string        { return "game_forfeit" }
func (e *GameForfeit) Description() string { return "Concede the match" }
func (e *GameForfeit) Method() string      { return "POST" }
func (e *GameForfeit) Path() string        { return "/api/v1/game/{id}/forfeit" }
func (e *GameForfeit) Auth() bool          { return true }
func (e *GameForfeit) Params() []Param {
	return []Param{
		{Name: "id", Hint: "match UUID", Required: true, ContextKey: "match_id"},
	}
}

func (e *GameForfeit) Next() []string {
	return []string{"profile_get"}
}

func (e *GameForfeit) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Post(path, nil)
}

func (e *GameForfeit) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Help ---

// HelpEndpoint implements Endpoint for GET /api/v1/help.
type HelpEndpoint struct{}

func (e *HelpEndpoint) Name() string        { return "api_help" }
func (e *HelpEndpoint) Description() string { return "Get machine-readable API documentation" }
func (e *HelpEndpoint) Method() string      { return "GET" }
func (e *HelpEndpoint) Path() string        { return "/api/v1/help" }
func (e *HelpEndpoint) Auth() bool          { return false }
func (e *HelpEndpoint) Params() []Param     { return nil }

func (e *HelpEndpoint) Next() []string {
	return nil
}

func (e *HelpEndpoint) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *HelpEndpoint) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Helpers ---

// SyncSession extracts contextual state (JWT, user_id, match_id, character_ids)
// from a standard API response envelope and updates the session.
func SyncSession(resp *api.Response, sess *session.Session) {
	data, ok := resp.Data.(map[string]interface{})
	if !ok {
		return
	}

	// Capture security tokens
	if token, ok := data["token"].(string); ok && token != "" {
		sess.SetToken(token)
	}

	// Capture user info if present (flat or nested)
	if id, ok := data["user_id"].(string); ok {
		sess.Set("user_id", id)
	}
	if name, ok := data["account_name"].(string); ok {
		sess.Set("account_name", name)
	}
	if credits, ok := data["credits"].(float64); ok {
		sess.Set("credits", fmt.Sprintf("%.0f", credits))
	}
	if key, ok := data["ws_channel_key"].(string); ok {
		sess.SetWSChannelKey(key)
	}

	// Deep capture if nested in "user" object
	if user, ok := data["user"].(map[string]interface{}); ok {
		if id, ok := user["id"].(string); ok {
			sess.Set("user_id", id)
		}
		if name, ok := user["account_name"].(string); ok {
			sess.Set("account_name", name)
		}
		if key, ok := user["ws_channel_key"].(string); ok {
			sess.SetWSChannelKey(key)
		}
	}

	if chars, ok := data["characters"].([]interface{}); ok && len(chars) > 0 {
		var ids []string
		for _, item := range chars {
			if char, ok := item.(map[string]interface{}); ok {
				if id, ok := char["id"].(string); ok {
					ids = append(ids, id)
				}
			}
		}
		if len(ids) > 0 {
			sess.Set("character_id", ids[0])
			sess.Set("character_ids", strings.Join(ids, ","))
		}
	}

	// Capture match info
	if matchID, ok := data["match_id"].(string); ok && matchID != "" {
		sess.Set("match_id", matchID)
	}

	// Tactical State Auto-Sync
	// If the response contains a game_state or participants (e.g. from a poll),
	// we sync it to the session so that bridge methods like upsilon.currentCharacter()
	// are always up to date.
	// Tactical State Auto-Sync
	var game dto.GameResponse
	dataBytes, _ := json.Marshal(resp.Data)
	if err := json.Unmarshal(dataBytes, &game); err == nil {
		if game.MatchID != "" {
			if len(game.GameState.Players) > 0 {
				sess.SetParticipants(game.GameState.Players)
			}
			// Only sync board if it looks populated or the game is finished
			if len(game.GameState.Players) > 0 || game.GameState.GameFinished {
				sess.SetLastBoard(&game.GameState)
			}
		}
	}
}

// RegisterAll populates the registry with all known endpoints.
func RegisterAll(reg *Registry) {
	// Auth
	reg.Register(&AuthLogin{})
	reg.Register(&AuthRegister{})
	reg.Register(&AuthLogout{})
	reg.Register(&AuthUpdate{})
	reg.Register(&AuthPassword{})
	reg.Register(&AuthExport{})
	reg.Register(&AuthDelete{})
	reg.Register(&AdminLogin{})

	// Admin
	reg.Register(&AdminUserList{})
	reg.Register(&AdminUserAnonymize{})
	reg.Register(&AdminUserDelete{})
	reg.Register(&AdminHistory{})
	reg.Register(&AdminPurge{})

	// Profile & Characters
	reg.Register(&ProfileGet{})
	reg.Register(&ProfileCharacters{})
	reg.Register(&ProfileCharacter{})
	reg.Register(&CharacterReroll{})
	reg.Register(&CharacterUpgrade{})
	reg.Register(&CharacterRename{})
	reg.Register(&CharacterDelete{})

	// Matchmaking
	reg.Register(&MatchmakingJoin{})
	reg.Register(&MatchmakingStatus{})
	reg.Register(&MatchmakingLeave{})

	// Stats
	reg.Register(&StatsWaiting{})
	reg.Register(&StatsActive{})

	// Shop & Inventory (ISS-074)
	reg.Register(&ShopBrowse{})
	reg.Register(&ShopPurchase{})
	reg.Register(&InventoryList{})
	reg.Register(&EquipmentList{})
	reg.Register(&EquipmentEquip{})
	reg.Register(&EquipmentUnequip{})

	// Game Proxy
	reg.Register(&GameState{})
	reg.Register(&GameAction{})
	reg.Register(&GameForfeit{})

	// Leaderboard
	reg.Register(&LeaderboardGet{})

	// Help
	reg.Register(&HelpEndpoint{})
}
