package endpoint

// @spec-link [[api_skill_template_browse]]
// @spec-link [[api_character_skill_inventory]]

import (
	"strings"

	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// --- Skill Templates ---

// SkillTemplateList implements Endpoint for GET /api/v1/skills/templates.
type SkillTemplateList struct{}

func (e *SkillTemplateList) Name() string        { return "skill_template_list" }
func (e *SkillTemplateList) Description() string { return "List all available skill templates" }
func (e *SkillTemplateList) Method() string      { return "GET" }
func (e *SkillTemplateList) Path() string        { return "/api/v1/skills/templates" }
func (e *SkillTemplateList) Auth() bool          { return true }
func (e *SkillTemplateList) Params() []Param     { return nil }

func (e *SkillTemplateList) Next() []string {
	return []string{"skill_template_get", "skill_roll"}
}

func (e *SkillTemplateList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *SkillTemplateList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// SkillTemplateGet implements Endpoint for GET /api/v1/skills/templates/{id}.
type SkillTemplateGet struct{}

func (e *SkillTemplateGet) Name() string        { return "skill_template_get" }
func (e *SkillTemplateGet) Description() string { return "Inspect a single skill template" }
func (e *SkillTemplateGet) Method() string      { return "GET" }
func (e *SkillTemplateGet) Path() string        { return "/api/v1/skills/templates/{id}" }
func (e *SkillTemplateGet) Auth() bool          { return true }
func (e *SkillTemplateGet) Params() []Param {
	return []Param{
		{Name: "id", Hint: "skill template UUID", Required: true},
	}
}

func (e *SkillTemplateGet) Next() []string {
	return []string{"skill_template_list"}
}

func (e *SkillTemplateGet) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Get(path)
}

func (e *SkillTemplateGet) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// --- Character Skill Inventory ---

// CharacterSkillList implements Endpoint for GET /api/v1/profile/character/{characterId}/skills.
type CharacterSkillList struct{}

func (e *CharacterSkillList) Name() string        { return "character_skill_list" }
func (e *CharacterSkillList) Description() string { return "List skills in a character's inventory" }
func (e *CharacterSkillList) Method() string      { return "GET" }
func (e *CharacterSkillList) Path() string {
	return "/api/v1/profile/character/{characterId}/skills"
}
func (e *CharacterSkillList) Auth() bool { return true }
func (e *CharacterSkillList) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *CharacterSkillList) Next() []string {
	return []string{"skill_equip", "skill_unequip", "skill_roll"}
}

func (e *CharacterSkillList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Get(path)
}

func (e *CharacterSkillList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Persist character_id for downstream commands
	if inputs["characterId"] != "" {
		sess.Set("character_id", inputs["characterId"])
	}
	_ = resp
	return nil
}

// SkillRoll implements Endpoint for POST /api/v1/profile/character/{characterId}/skills/roll.
type SkillRoll struct{}

func (e *SkillRoll) Name() string        { return "skill_roll" }
func (e *SkillRoll) Description() string { return "Roll (acquire) a new random skill for a character" }
func (e *SkillRoll) Method() string      { return "POST" }
func (e *SkillRoll) Path() string {
	return "/api/v1/profile/character/{characterId}/skills/roll"
}
func (e *SkillRoll) Auth() bool { return true }
func (e *SkillRoll) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *SkillRoll) Next() []string {
	return []string{"character_skill_list", "skill_equip"}
}

func (e *SkillRoll) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Post(path, nil)
}

func (e *SkillRoll) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	// Persist the new skill_id in session so skill_equip can use it immediately
	SyncSession(resp, sess)
	return nil
}

// SkillEquip implements Endpoint for POST /api/v1/profile/character/{characterId}/skills/{skillId}/equip.
type SkillEquip struct{}

func (e *SkillEquip) Name() string        { return "skill_equip" }
func (e *SkillEquip) Description() string { return "Equip a skill into an active slot" }
func (e *SkillEquip) Method() string      { return "POST" }
func (e *SkillEquip) Path() string {
	return "/api/v1/profile/character/{characterId}/skills/{skillId}/equip"
}
func (e *SkillEquip) Auth() bool { return true }
func (e *SkillEquip) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "skillId", Hint: "skill UUID from character_skill_list", Required: true, ContextKey: "skill_id"},
	}
}

func (e *SkillEquip) Next() []string {
	return []string{"character_skill_list", "skill_unequip"}
}

func (e *SkillEquip) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	path = strings.ReplaceAll(path, "{skillId}", inputs["skillId"])
	return client.Post(path, nil)
}

func (e *SkillEquip) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// SkillUnequip implements Endpoint for DELETE /api/v1/profile/character/{characterId}/skills/{skillId}/unequip.
type SkillUnequip struct{}

func (e *SkillUnequip) Name() string        { return "skill_unequip" }
func (e *SkillUnequip) Description() string { return "Remove a skill from its active slot" }
func (e *SkillUnequip) Method() string      { return "DELETE" }
func (e *SkillUnequip) Path() string {
	return "/api/v1/profile/character/{characterId}/skills/{skillId}/unequip"
}
func (e *SkillUnequip) Auth() bool { return true }
func (e *SkillUnequip) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
		{Name: "skillId", Hint: "skill UUID from character_skill_list", Required: true, ContextKey: "skill_id"},
	}
}

func (e *SkillUnequip) Next() []string {
	return []string{"character_skill_list", "skill_equip"}
}

func (e *SkillUnequip) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	path = strings.ReplaceAll(path, "{skillId}", inputs["skillId"])
	return client.Delete(path)
}

func (e *SkillUnequip) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

// SkillInspect implements Endpoint for GET /api/v1/profile/character/{characterId}/skills
// filtered to a single entry. Convenience wrapper that lists then the user picks.
// For now it delegates to character_skill_list — a dedicated /skills/{id} route can
// be added server-side in a future pass.
type SkillInspect struct{}

func (e *SkillInspect) Name() string        { return "skill_inspect" }
func (e *SkillInspect) Description() string { return "Inspect full detail of one character skill" }
func (e *SkillInspect) Method() string      { return "GET" }
func (e *SkillInspect) Path() string {
	return "/api/v1/profile/character/{characterId}/skills"
}
func (e *SkillInspect) Auth() bool { return true }
func (e *SkillInspect) Params() []Param {
	return []Param{
		{Name: "characterId", Hint: "character UUID", Required: true, ContextKey: "character_id"},
	}
}

func (e *SkillInspect) Next() []string {
	return []string{"skill_equip", "skill_unequip"}
}

func (e *SkillInspect) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{characterId}", inputs["characterId"])
	return client.Get(path)
}

func (e *SkillInspect) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}
