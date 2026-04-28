package endpoint

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ecumeurs/upsiloncli/internal/api"
	"github.com/ecumeurs/upsiloncli/internal/session"
)

// AdminUserList implements Endpoint for GET /api/v1/admin/users.
type AdminUserList struct{}

func (e *AdminUserList) Name() string        { return "admin_users" }
func (e *AdminUserList) Description() string { return "List all system users (id, name, email, role, deleted_at)" }
func (e *AdminUserList) Method() string      { return "GET" }
func (e *AdminUserList) Path() string        { return "/api/v1/admin/users" }
func (e *AdminUserList) Auth() bool          { return true }
func (e *AdminUserList) Params() []Param     { return nil }

func (e *AdminUserList) Next() []string {
	return []string{"admin_user_anonymize", "admin_user_delete", "admin_history"}
}

func (e *AdminUserList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}

func (e *AdminUserList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}

	if data, ok := resp.Data.([]interface{}); ok {
		client.Printer.System(fmt.Sprintf("Registry: Found %d entities.", len(data)))
		// In a real CLI we'd print a table, for now we let the default printer handle it or use Printer.Result
	}
	return nil
}

// AdminUserAnonymize implements Endpoint for POST /api/v1/admin/users/{account_name}/anonymize.
type AdminUserAnonymize struct{}

func (e *AdminUserAnonymize) Name() string        { return "admin_user_anonymize" }
func (e *AdminUserAnonymize) Description() string { return "GDPR Force Anonymize a target user by account_name" }
func (e *AdminUserAnonymize) Method() string      { return "POST" }
func (e *AdminUserAnonymize) Path() string        { return "/api/v1/admin/users/{account_name}/anonymize" }
func (e *AdminUserAnonymize) Auth() bool          { return true }
func (e *AdminUserAnonymize) Params() []Param {
	return []Param{
		{Name: "account_name", Hint: "target account name", Required: true},
	}
}

func (e *AdminUserAnonymize) Next() []string {
	return []string{"admin_users"}
}

func (e *AdminUserAnonymize) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{account_name}", inputs["account_name"])
	return client.Post(path, nil)
}

func (e *AdminUserAnonymize) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	client.Printer.System(fmt.Sprintf("Anonymize: %s", resp.Message))
	return nil
}

// AdminUserDelete implements Endpoint for DELETE /api/v1/admin/users/{account_name}.
type AdminUserDelete struct{}

func (e *AdminUserDelete) Name() string        { return "admin_user_delete" }
func (e *AdminUserDelete) Description() string { return "Administrative Soft Delete of a target user" }
func (e *AdminUserDelete) Method() string      { return "DELETE" }
func (e *AdminUserDelete) Path() string        { return "/api/v1/admin/users/{account_name}" }
func (e *AdminUserDelete) Auth() bool          { return true }
func (e *AdminUserDelete) Params() []Param {
	return []Param{
		{Name: "account_name", Hint: "target account name", Required: true},
	}
}

func (e *AdminUserDelete) Next() []string {
	return []string{"admin_users"}
}

func (e *AdminUserDelete) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{account_name}", inputs["account_name"])
	return client.Delete(path)
}

func (e *AdminUserDelete) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	client.Printer.System(fmt.Sprintf("Deactivation: %s", resp.Message))
	return nil
}

// AdminHistory implements Endpoint for GET /api/v1/admin/history.
type AdminHistory struct{}

func (e *AdminHistory) Name() string        { return "admin_history" }
func (e *AdminHistory) Description() string { return "List match history with manual pagination and search" }
func (e *AdminHistory) Method() string      { return "GET" }
func (e *AdminHistory) Path() string        { return "/api/v1/admin/history" }
func (e *AdminHistory) Auth() bool          { return true }
func (e *AdminHistory) Params() []Param {
	return []Param{
		{Name: "search", Hint: "search by match ID or player", Required: false},
		{Name: "cursor", Hint: "pagination cursor", Required: false},
	}
}

func (e *AdminHistory) Next() []string {
	return []string{"admin_history_purge"}
}

func (e *AdminHistory) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	params := make(map[string]string)
	if v, ok := inputs["search"]; ok {
		params["search"] = v
	}
	if v, ok := inputs["cursor"]; ok {
		params["cursor"] = v
	}
	return client.GetWithParams(e.Path(), params)
}

func (e *AdminHistory) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	if data, ok := resp.Data.(map[string]interface{}); ok {
		if items, ok := data["items"].([]interface{}); ok {
			client.Printer.System(fmt.Sprintf("History: Found %d records.", len(items)))
		}
	}
	return nil
}

// AdminPurge implements Endpoint for POST /api/v1/admin/history/purge.
type AdminPurge struct{}

func (e *AdminPurge) Name() string        { return "admin_history_purge" }
func (e *AdminPurge) Description() string { return "Purge match history older than 90 days" }
func (e *AdminPurge) Method() string      { return "POST" }
func (e *AdminPurge) Path() string        { return "/api/v1/admin/history/purge" }
func (e *AdminPurge) Auth() bool          { return true }
func (e *AdminPurge) Params() []Param     { return nil }

func (e *AdminPurge) Next() []string {
	return []string{"admin_history"}
}

func (e *AdminPurge) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Post(e.Path(), nil)
}

func (e *AdminPurge) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	client.Printer.System(resp.Message)
	return nil
}

// ── Admin Skill Template CRUD ─────────────────────────────────────────────

// @spec-link [[api_skill_template_admin_crud]]

type AdminSkillTemplateList struct{}

func (e *AdminSkillTemplateList) Name() string        { return "admin_skill_template_list" }
func (e *AdminSkillTemplateList) Description() string { return "List all skill templates (admin)" }
func (e *AdminSkillTemplateList) Method() string      { return "GET" }
func (e *AdminSkillTemplateList) Path() string        { return "/api/v1/admin/skill-templates" }
func (e *AdminSkillTemplateList) Auth() bool          { return true }
func (e *AdminSkillTemplateList) Params() []Param     { return nil }
func (e *AdminSkillTemplateList) Next() []string {
	return []string{"admin_skill_template_create", "admin_skill_template_update", "admin_skill_template_delete"}
}
func (e *AdminSkillTemplateList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}
func (e *AdminSkillTemplateList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminSkillTemplateGet struct{}

func (e *AdminSkillTemplateGet) Name() string        { return "admin_skill_template_get" }
func (e *AdminSkillTemplateGet) Description() string { return "Get a single skill template (admin)" }
func (e *AdminSkillTemplateGet) Method() string      { return "GET" }
func (e *AdminSkillTemplateGet) Path() string        { return "/api/v1/admin/skill-templates/{id}" }
func (e *AdminSkillTemplateGet) Auth() bool          { return true }
func (e *AdminSkillTemplateGet) Params() []Param {
	return []Param{{Name: "id", Hint: "skill template UUID", Required: true}}
}
func (e *AdminSkillTemplateGet) Next() []string {
	return []string{"admin_skill_template_list"}
}
func (e *AdminSkillTemplateGet) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Get(path)
}
func (e *AdminSkillTemplateGet) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminSkillTemplateCreate struct{}

func (e *AdminSkillTemplateCreate) Name() string        { return "admin_skill_template_create" }
func (e *AdminSkillTemplateCreate) Description() string { return "Create a new skill template" }
func (e *AdminSkillTemplateCreate) Method() string      { return "POST" }
func (e *AdminSkillTemplateCreate) Path() string        { return "/api/v1/admin/skill-templates" }
func (e *AdminSkillTemplateCreate) Auth() bool          { return true }
func (e *AdminSkillTemplateCreate) Params() []Param {
	return []Param{
		{Name: "name", Hint: "skill name", Required: true},
		{Name: "behavior", Hint: "Direct|Reaction|Passive|Counter|Trap", Required: true},
		{Name: "grade", Hint: "I|II|III|IV|V", Required: true},
		{Name: "weight_positive", Hint: "positive weight (int)", Required: true},
		{Name: "weight_negative", Hint: "negative weight (int)", Required: true},
		{Name: "targeting", Hint: "targeting map as JSON (e.g. {})"},
		{Name: "costs", Hint: "costs map as JSON (e.g. {})"},
		{Name: "effect", Hint: "effect map as JSON (e.g. {})"},
		{Name: "available", Hint: "true|false (default true)"},
	}
}
func (e *AdminSkillTemplateCreate) Next() []string {
	return []string{"admin_skill_template_list", "skill_template_list"}
}
func (e *AdminSkillTemplateCreate) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	body := buildSkillTemplateBody(inputs)
	return client.Post(e.Path(), body)
}
func (e *AdminSkillTemplateCreate) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	SyncSession(resp, sess)
	return nil
}

type AdminSkillTemplateUpdate struct{}

func (e *AdminSkillTemplateUpdate) Name() string        { return "admin_skill_template_update" }
func (e *AdminSkillTemplateUpdate) Description() string { return "Update an existing skill template" }
func (e *AdminSkillTemplateUpdate) Method() string      { return "PUT" }
func (e *AdminSkillTemplateUpdate) Path() string        { return "/api/v1/admin/skill-templates/{id}" }
func (e *AdminSkillTemplateUpdate) Auth() bool          { return true }
func (e *AdminSkillTemplateUpdate) Params() []Param {
	return []Param{
		{Name: "id", Hint: "skill template UUID", Required: true},
		{Name: "name", Hint: "new name"},
		{Name: "behavior", Hint: "Direct|Reaction|Passive|Counter|Trap"},
		{Name: "grade", Hint: "I|II|III|IV|V"},
		{Name: "weight_positive", Hint: "positive weight (int)"},
		{Name: "weight_negative", Hint: "negative weight (int)"},
		{Name: "targeting", Hint: "targeting map as JSON"},
		{Name: "costs", Hint: "costs map as JSON"},
		{Name: "effect", Hint: "effect map as JSON"},
		{Name: "available", Hint: "true|false"},
	}
}
func (e *AdminSkillTemplateUpdate) Next() []string {
	return []string{"admin_skill_template_list"}
}
func (e *AdminSkillTemplateUpdate) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	body := buildSkillTemplateBody(inputs)
	return client.Put(path, body)
}
func (e *AdminSkillTemplateUpdate) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminSkillTemplateDelete struct{}

func (e *AdminSkillTemplateDelete) Name() string        { return "admin_skill_template_delete" }
func (e *AdminSkillTemplateDelete) Description() string { return "Delete a skill template" }
func (e *AdminSkillTemplateDelete) Method() string      { return "DELETE" }
func (e *AdminSkillTemplateDelete) Path() string        { return "/api/v1/admin/skill-templates/{id}" }
func (e *AdminSkillTemplateDelete) Auth() bool          { return true }
func (e *AdminSkillTemplateDelete) Params() []Param {
	return []Param{{Name: "id", Hint: "skill template UUID", Required: true}}
}
func (e *AdminSkillTemplateDelete) Next() []string {
	return []string{"admin_skill_template_list"}
}
func (e *AdminSkillTemplateDelete) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Delete(path)
}
func (e *AdminSkillTemplateDelete) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	client.Printer.System(resp.Message)
	return nil
}

// ── Admin Shop Item CRUD ──────────────────────────────────────────────────

// @spec-link [[api_shop_item_admin_crud]]

type AdminShopItemList struct{}

func (e *AdminShopItemList) Name() string        { return "admin_shop_item_list" }
func (e *AdminShopItemList) Description() string { return "List all shop items (admin)" }
func (e *AdminShopItemList) Method() string      { return "GET" }
func (e *AdminShopItemList) Path() string        { return "/api/v1/admin/shop-items" }
func (e *AdminShopItemList) Auth() bool          { return true }
func (e *AdminShopItemList) Params() []Param     { return nil }
func (e *AdminShopItemList) Next() []string {
	return []string{"admin_shop_item_create", "admin_shop_item_update", "admin_shop_item_delete"}
}
func (e *AdminShopItemList) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Get(e.Path())
}
func (e *AdminShopItemList) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminShopItemCreate struct{}

func (e *AdminShopItemCreate) Name() string        { return "admin_shop_item_create" }
func (e *AdminShopItemCreate) Description() string { return "Create a new shop item" }
func (e *AdminShopItemCreate) Method() string      { return "POST" }
func (e *AdminShopItemCreate) Path() string        { return "/api/v1/admin/shop-items" }
func (e *AdminShopItemCreate) Auth() bool          { return true }
func (e *AdminShopItemCreate) Params() []Param {
	return []Param{
		{Name: "name", Hint: "item name", Required: true},
		{Name: "slot", Hint: "armor|utility|weapon", Required: true},
		{Name: "cost", Hint: "credit cost (int)", Required: true},
		{Name: "properties", Hint: "properties map as JSON (e.g. {})"},
		{Name: "type", Hint: "item type tag"},
		{Name: "available", Hint: "true|false (default true)"},
		{Name: "skill_template_id", Hint: "skill template UUID (D11 exotic items, optional)"},
	}
}
func (e *AdminShopItemCreate) Next() []string {
	return []string{"admin_shop_item_list"}
}
func (e *AdminShopItemCreate) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	return client.Post(e.Path(), buildShopItemBody(inputs))
}
func (e *AdminShopItemCreate) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminShopItemUpdate struct{}

func (e *AdminShopItemUpdate) Name() string        { return "admin_shop_item_update" }
func (e *AdminShopItemUpdate) Description() string { return "Update an existing shop item" }
func (e *AdminShopItemUpdate) Method() string      { return "PUT" }
func (e *AdminShopItemUpdate) Path() string        { return "/api/v1/admin/shop-items/{id}" }
func (e *AdminShopItemUpdate) Auth() bool          { return true }
func (e *AdminShopItemUpdate) Params() []Param {
	return []Param{
		{Name: "id", Hint: "shop item UUID", Required: true},
		{Name: "name", Hint: "item name"},
		{Name: "slot", Hint: "armor|utility|weapon"},
		{Name: "cost", Hint: "credit cost (int)"},
		{Name: "properties", Hint: "properties map as JSON"},
		{Name: "available", Hint: "true|false"},
		{Name: "skill_template_id", Hint: "skill template UUID or empty to clear"},
	}
}
func (e *AdminShopItemUpdate) Next() []string {
	return []string{"admin_shop_item_list"}
}
func (e *AdminShopItemUpdate) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Put(path, buildShopItemBody(inputs))
}
func (e *AdminShopItemUpdate) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	_, err := e.ExecuteRaw(client, sess, inputs)
	return err
}

type AdminShopItemDelete struct{}

func (e *AdminShopItemDelete) Name() string        { return "admin_shop_item_delete" }
func (e *AdminShopItemDelete) Description() string { return "Delete a shop item" }
func (e *AdminShopItemDelete) Method() string      { return "DELETE" }
func (e *AdminShopItemDelete) Path() string        { return "/api/v1/admin/shop-items/{id}" }
func (e *AdminShopItemDelete) Auth() bool          { return true }
func (e *AdminShopItemDelete) Params() []Param {
	return []Param{{Name: "id", Hint: "shop item UUID", Required: true}}
}
func (e *AdminShopItemDelete) Next() []string {
	return []string{"admin_shop_item_list"}
}
func (e *AdminShopItemDelete) ExecuteRaw(client *api.Client, sess *session.Session, inputs map[string]string) (*api.Response, error) {
	path := strings.ReplaceAll(e.Path(), "{id}", inputs["id"])
	return client.Delete(path)
}
func (e *AdminShopItemDelete) Execute(client *api.Client, sess *session.Session, inputs map[string]string) error {
	resp, err := e.ExecuteRaw(client, sess, inputs)
	if err != nil {
		return err
	}
	client.Printer.System(resp.Message)
	return nil
}

// ── helpers ───────────────────────────────────────────────────────────────

func buildSkillTemplateBody(inputs map[string]string) map[string]interface{} {
	body := map[string]interface{}{}
	if v := inputs["name"]; v != "" {
		body["name"] = v
	}
	if v := inputs["behavior"]; v != "" {
		body["behavior"] = v
	}
	if v := inputs["grade"]; v != "" {
		body["grade"] = v
	}
	if v := inputs["weight_positive"]; v != "" {
		body["weight_positive"] = v
	}
	if v := inputs["weight_negative"]; v != "" {
		body["weight_negative"] = v
	}
	if v := inputs["available"]; v != "" {
		body["available"] = v == "true"
	}
	// Accept raw JSON for complex fields; default to empty map if omitted
	body["targeting"] = jsonOrEmpty(inputs["targeting"])
	if _, ok := body["targeting"].(map[string]interface{}); !ok || len(body["targeting"].(map[string]interface{})) == 0 {
		if v := inputs["targeting_json"]; v != "" {
			body["targeting"] = jsonOrEmpty(v)
		}
	}

	body["costs"] = jsonOrEmpty(inputs["costs"])
	if _, ok := body["costs"].(map[string]interface{}); !ok || len(body["costs"].(map[string]interface{})) == 0 {
		if v := inputs["costs_json"]; v != "" {
			body["costs"] = jsonOrEmpty(v)
		}
	}

	body["effect"] = jsonOrEmpty(inputs["effect"])
	if _, ok := body["effect"].(map[string]interface{}); !ok || len(body["effect"].(map[string]interface{})) == 0 {
		if v := inputs["effect_json"]; v != "" {
			body["effect"] = jsonOrEmpty(v)
		}
	}
	return body
}

func buildShopItemBody(inputs map[string]string) map[string]interface{} {
	body := map[string]interface{}{}
	if v := inputs["name"]; v != "" {
		body["name"] = v
	}
	if v := inputs["slot"]; v != "" {
		body["slot"] = v
	}
	if v := inputs["cost"]; v != "" {
		body["cost"] = v
	}
	if v := inputs["type"]; v != "" {
		body["type"] = v
	}
	if v := inputs["available"]; v != "" {
		body["available"] = v == "true"
	}
	if v := inputs["skill_template_id"]; v != "" {
		body["skill_template_id"] = v
	}
	if pj := inputs["properties"]; pj != "" {
		body["properties"] = jsonOrEmpty(pj)
	} else if pj := inputs["properties_json"]; pj != "" {
		body["properties"] = jsonOrEmpty(pj)
	} else {
		body["properties"] = map[string]interface{}{}
	}
	return body
}

func jsonOrEmpty(raw string) interface{} {
	if raw == "" {
		return map[string]interface{}{}
	}
	var out interface{}
	if err := json.Unmarshal([]byte(raw), &out); err != nil {
		return map[string]interface{}{}
	}
	return out
}
