# Repository Providers

TernakClouds integrates with source control providers to enable GitOps workflows. When a repository provider is configured in a workspace, Platform Applications can automatically commit generated manifests and open pull requests.

---

## Supported Providers

| Provider | Cloud | Self-hosted |
|---|---|---|
| GitHub | Yes | No |
| GitLab | Yes | Yes (custom BaseURL) |

---

## Concepts

### Repository Provider

A repository provider is a workspace-level SCM credential configuration. It stores:

- Provider type (GitHub or GitLab)
- Base URL (for self-hosted GitLab)
- A Personal Access Token (PAT) stored in Vault
- An optional `AllowedRepos` whitelist

The PAT is written to Vault at:
```
idp/repos/{workspaceID}/{providerID}/token
```

The database stores only the Vault path — the token is never returned in API responses.

### AllowedRepos

`AllowedRepos` is an optional list of repository paths (e.g. `myorg/infra`, `myorg/services`) that this PAT is permitted to access. This is useful when using fine-grained PATs with restricted repository access. The platform validates repository access against this list before committing or listing repos.

Leave `AllowedRepos` empty to allow access to all repositories the PAT can reach.

---

## Adding a Repository Provider

Requirements: workspace `owner` role.

1. Navigate to your workspace → **Repositories**
2. Click **Add provider**
3. Select the provider type (GitHub or GitLab)
4. For self-hosted GitLab, enter the base URL (e.g. `https://gitlab.internal`)
5. Enter the Personal Access Token
6. Optionally enter allowed repository paths
7. Click **Save**

### Required PAT Scopes

**GitHub:**
- `repo` — full repository access (read + write + pull requests)

**GitLab:**
- `api` — full API access
- Or `read_repository` + `write_repository` + `create_merge_request` for minimal scope

---

## Browsing Repositories

Once a provider is configured, navigate to **Repositories** in the sidebar to browse all repositories accessible via the PAT. The list is fetched live from the provider.

Filtering by `AllowedRepos` is applied before displaying results.

---

## GitOps Workflow

When a [Platform Application](../deployments/platform-apps.md) is provisioned with a repository provider configured, the platform:

1. Renders the deployment manifest (Nomad HCL, Kubernetes YAML, or Docker Compose)
2. Optionally renders CI/CD pipeline files (GitHub Actions, GitLab CI)
3. Creates or updates a branch in the target repository
4. Commits the manifest files
5. Opens a pull request / merge request against the default branch

The PR is opened as a draft by default. Your team reviews and merges it. The workload is deployed when the runtime reconciles against the manifest (for GitOps-driven runtimes) or when the CI/CD pipeline runs.

### What Gets Committed

| File | Description |
|---|---|
| `deploy/<app-name>.nomad.hcl` | Nomad job specification |
| `deploy/<app-name>.yaml` | Kubernetes manifests |
| `deploy/docker-compose.yml` | Docker Compose file |
| `.github/workflows/<app-name>.yml` | GitHub Actions pipeline (optional) |
| `.gitlab-ci.yml` | GitLab CI pipeline (optional) |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/repositories` | List workspace repository providers |
| `GET` | `/repositories/:id` | Get a repository provider |
| `POST` | `/repositories` | Create a repository provider |
| `PUT` | `/repositories/:id` | Update a repository provider |
| `DELETE` | `/repositories/:id` | Delete a repository provider |
| `GET` | `/repositories/:id/repos` | List repositories accessible via this provider |

---

## Security Notes

- PATs are stored exclusively in Vault and never returned in API responses
- The `AllowedRepos` whitelist should be used with fine-grained PATs to limit blast radius
- Rotate PATs by updating the provider — the new token replaces the old one in Vault
- Deleting a repository provider removes the token from Vault
