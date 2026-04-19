package endpoint

import (
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
