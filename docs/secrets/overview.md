# Secrets

TernakClouds integrates with HashiCorp Vault to give workspace members access to secrets without ever exposing Vault paths or credentials directly. There are two separate parts to the secrets system: connecting a Vault instance to an environment (platform configuration), and managing secret grants that developers use to read and write secrets (developer workflow).

---

## How It Works

```
Workspace owner configures                Developer browses
  Vault capability binding                  secret grants
       │                                         │
       ▼                                         ▼
  Platform → Secrets               Environment → Secrets page
  (which Vault to use)               (what paths are exposed)
       │                                         │
       └──────────────┬──────────────────────────┘
                      ▼
              Vault KV v2 API
              (real secret data)
```

**Platform → Secrets** (per-environment capability) — binds an external Vault instance to the environment. If no binding is configured, the platform falls back to its own internal Vault.

**Secret grants** — named pointers to Vault KV paths. Workspace owners create grants and set the Vault path. Members see the name and description; the path is hidden from them. Anyone in the workspace can expand a grant to read or write secret values via the platform.

---

## Step 1 — Connect a Vault Instance (Platform → Secrets)

This step is optional if you want to use TernakClouds' own internal Vault. Skip it for development environments.

Requirements: platform role `admin` or `manager` + workspace `owner`.

1. Navigate to your environment → **Platform** → **Secrets**
2. Click **Add provider** and select **Vault**
3. Fill in the configuration:

| Field | Example | Description |
|---|---|---|
| Endpoint | `https://vault.internal:8200` | Vault server URL |
| Token | `hvs.XXXXXXXX` | Token with read/write access to the KV mount (stored in IDP Vault, never in DB) |
| Namespace | `secret` | KV v2 mount name (defaults to `secret` if left blank) |

4. Click **Add provider**

Once bound, all secret operations in this environment — reading grant values and writing new versions — are routed to this Vault instance instead of the platform's internal one.

> The token provided here is stored in the platform's own Vault at `idp/capabilities/{envID}/secrets/vault/token`. It is never returned in any API response.

---

## Step 2 — Create Secret Grants

A **secret grant** maps a friendly name to a Vault KV path. Grants are what developers see — the actual Vault path is only visible to workspace owners.

Navigate to your environment → **Secrets** → **Add grant**.

### For workspace owners

| Field | Example | Description |
|---|---|---|
| Name | `database-credentials` | Friendly name shown to all members |
| Vault path | `myapp/dev` | Path within the KV v2 mount — **do not include the mount name or `/data/` prefix** |
| Description | `PostgreSQL credentials for dev` | Optional — shown to members |

> **Path format:** If your secret lives at `secret/data/myapp/dev` in Vault, enter `myapp/dev` as the path. The mount name (`secret`) is already configured on the capability binding.

### For workspace members

Members can create grants without setting a Vault path. The grant is created with an empty path and the owner fills it in later by clicking **Edit Grant**.

> Members see: name and description only. They never see the Vault path in any API response or the UI.

---

## Browsing and Reading Secrets

After creating a grant, expand it on the Secrets page by clicking **View secrets**. The platform fetches the full KV tree rooted at the grant's Vault path — it walks sub-paths recursively up to 5 levels deep.

Each **secret entry** represents one Vault path node:

| Entry label | Meaning |
|---|---|
| `(root)` | Keys stored directly at the grant's Vault path |
| `config`, `credentials`, etc. | Sub-path under the grant path (e.g. `myapp/dev/config`) |

Click any entry to open the detail drawer. In the drawer:

- Key names are shown in the left column
- Values are masked by default — click the eye icon to reveal a value
- Click the copy icon to copy a value to the clipboard
- Owners also see the full Vault path for each entry in the header

---

## Writing and Updating Secrets

Anyone in the workspace (owner or member) can write secret values. Writing creates a **new KV v2 version** — Vault keeps the full version history.

In the secret detail drawer:

1. Click **Create new version**
2. Edit the key-value pairs using the inline editor
   - Keys that look sensitive (`password`, `token`, `key`, `secret`, etc.) are auto-masked in the value field
   - Add new pairs with **Add key-value pair**
   - Remove rows with ✕
3. Click **Save version**

The data is written to Vault via:

```
PUT /api/v1/workspaces/{slug}/environments/{env}/secrets/{grantID}/value
{
  "path": "",           // empty = write to grant root path
  "data": {
    "DB_HOST": "localhost",
    "DB_PASS": "hunter2"
  }
}
```

To write to a sub-path under the grant (e.g. `myapp/dev/config`), provide the sub-path relative to the grant path:

```json
{ "path": "config", "data": { "LOG_LEVEL": "debug" } }
```

The backend appends this to the grant's Vault path: `myapp/dev` + `config` → `myapp/dev/config`.

---

## Vault Path Resolution

The backend resolves which Vault instance to use at read/write time:

```
ReadValue / WriteValue called
          │
          ▼
Does the environment have a "secrets" capability binding
with a "vault" provider that has an endpoint configured?
          │
     Yes  │  No
          │   └──→ Use IDP's own internal Vault client
          ▼
Retrieve the provider token from IDP Vault
          │
          ▼
Build a new Vault client (endpoint + token + KV mount from Namespace field)
          │
          ▼
Execute the KV read/write against the environment's Vault
```

This means different environments (dev, staging, production) can use completely different Vault instances or KV mounts.

---

## Access Control

| Action | Owner | Member |
|---|---|---|
| See grant names and descriptions | Yes | Yes |
| See Vault path on a grant | Yes | No |
| Set Vault path when creating a grant | Yes | No (path stripped silently) |
| Update Vault path on existing grant | Yes | No (field ignored) |
| Read secret values (expand grant) | Yes | Yes |
| Write new secret version | Yes | Yes |
| Delete a grant | Yes | Yes |

The `vault_path` field is never included in API responses to non-owner callers — it is stripped at the handler layer, not by database-level filtering.

---

## API Reference

All endpoints are scoped under `/{workspace-slug}/environments/{env-slug}/`.

| Method | Path | Description |
|---|---|---|
| `GET` | `/secrets` | List grants — owners get `AdminGrantView` (includes `vault_path`), members get `MemberGrantView` |
| `POST` | `/secrets` | Create a grant — non-owners cannot set `vault_path` |
| `PUT` | `/secrets/:id` | Update grant metadata — non-owners cannot change `vault_path` |
| `DELETE` | `/secrets/:id` | Delete a grant (does not delete the Vault path) |
| `GET` | `/secrets/:id/value` | Read all secret entries at the grant's Vault path tree |
| `PUT` | `/secrets/:id/value` | Write a new KV v2 version at the grant path (or sub-path) |

### Example: read grant values

```
GET /api/v1/workspaces/my-team/environments/dev/secrets/{grantID}/value
Authorization: Bearer <token>

{
  "name": "database-credentials",
  "entries": [
    {
      "path": "",
      "data": { "DB_HOST": "localhost", "DB_PORT": "5432" }
    },
    {
      "path": "replica",
      "data": { "DB_HOST": "replica.internal", "DB_PORT": "5432" }
    }
  ]
}
```

`path: ""` means the data is at the grant's root Vault path. `path: "replica"` means the data is at `{vault_path}/replica`.

---

## Deleting a Grant

Deleting a grant removes the grant record from the platform database. It does **not** delete the data from Vault — the actual secrets remain at the Vault path. This is intentional: grant deletion is an access-revocation operation, not a secret destruction operation.

To destroy the underlying Vault data, delete the path directly in Vault using the Vault UI or CLI.

---

## Development Without Vault

When `VAULT_ENABLED=false` in `server/.env`, all Vault operations are no-ops:

- Creating grants and setting vault paths works (stored in DB)
- Reading secret values returns an empty entries list (or an error)
- Writing values silently succeeds but nothing is written

This allows running the platform locally without a Vault cluster while still developing the secrets UI.
