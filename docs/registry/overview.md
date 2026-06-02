# Container Registries

TernakClouds manages container registry credentials at two scopes: workspace-level (registry provider configuration) and environment-level (registry binding). Credentials are stored in Vault — never in the database.

---

## Two-Level Model

```
Workspace
  └── RegistryProvider (e.g. "prod-ecr", "dockerhub-team")
        │  credentials stored in Vault
        │
        └── RegistryBinding (per Environment)
              allowed paths: ["myorg/service-*"]
```

**RegistryProvider** — the registry credential configuration. Defined once per workspace and reused across environments.

**RegistryBinding** — makes a registry provider available in a specific environment, optionally scoped to a set of image path prefixes.

---

## Supported Registries

Any OCI-compatible registry is supported:

- Docker Hub
- Amazon ECR
- Google Container Registry (GCR) / Artifact Registry
- GitHub Container Registry (GHCR)
- GitLab Container Registry
- Self-hosted registries (Harbor, Nexus, etc.)

---

## Adding a Registry Provider

Requirements: workspace `owner` role and `registries:write` platform permission.

1. Navigate to your workspace → **Registries**
2. Click **Add registry**
3. Select the registry type
4. Enter the registry URL (e.g. `https://registry.example.com`)
5. Enter credentials (username + password or token — stored in Vault)
6. Give the registry a display name
7. Click **Save**

### Configuration Fields

| Field | Description |
|---|---|
| Name | Display name for this registry |
| Type | Registry type (`dockerhub`, `ecr`, `gcr`, `ghcr`, `custom`) |
| Endpoint | Registry base URL |
| Username | Registry username or IAM access key ID |
| Password / Token | Password, access token, or IAM secret key (stored in Vault) |

Credentials are written to Vault at:
```
idp/registries/{workspaceID}/{registryID}/credentials
```

The database stores only the Vault path — credentials are never returned in API responses.

---

## Binding a Registry to an Environment

Once a registry provider is configured, bind it to any environment where it's needed.

1. Navigate to the environment → **Platform → Registries** (or from the Registries page)
2. Click **Bind registry**
3. Select the registry provider
4. Optionally enter allowed image paths (comma-separated prefixes)
5. Click **Bind**

**Allowed paths** restrict which images can be pulled from this registry in this environment. For example, `myorg/payments` would allow only images under the `myorg/payments` prefix. Leave empty to allow all images from this registry.

---

## Using Registries in Deployments

When deploying a [Service Catalog](../deployments/service-catalog.md) item or [Platform Application](../deployments/platform-apps.md) that uses a private image, select the registry binding in the deployment form. The platform injects the registry credentials into the generated manifest:

- **Kubernetes** — creates or references a `Secret` of type `kubernetes.io/dockerconfigjson`
- **Nomad** — adds auth credentials to the `docker` driver stanza
- **Docker** — uses the daemon's auth configuration

---

## API Reference

### Workspace-level (Registry Providers)

| Method | Path | Description |
|---|---|---|
| `GET` | `/registries` | List workspace registry providers |
| `GET` | `/registries/:id` | Get a registry provider |
| `POST` | `/registries` | Create a registry provider |
| `PUT` | `/registries/:id` | Update a registry provider |
| `DELETE` | `/registries/:id` | Delete a registry provider |

### Environment-level (Registry Bindings)

| Method | Path | Description |
|---|---|---|
| `GET` | `/registries/bindings` | List registry bindings for the environment |
| `POST` | `/registries/bindings` | Bind a registry provider to the environment |
| `DELETE` | `/registries/bindings/:id` | Remove a registry binding |
