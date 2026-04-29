# Insighta Labs+ CLI

A Node.js command-line tool for the **Insighta Labs+** platform — authenticate via GitHub OAuth, manage profiles, search, and export data directly from your terminal.

---

## System Architecture

```
insighta (CLI)
    │
    │  HTTP requests (Bearer token, X-API-Version: 1)
    ▼
Backend API  (Insighta Labs+ backend)
    │
    ├── /auth/*         Authentication & token management
    └── /api/profiles/* Profile CRUD, search, export
```

The CLI communicates **exclusively** with the backend REST API. It never talks to GitHub directly — all OAuth exchanges are proxied through the backend.

### Credential Storage

```
~/.insighta/credentials.json
{
  "accessToken":  "<JWT>",
  "refreshToken": "<opaque token>",
  "username":     "github-login",
  "savedAt":      "2024-01-01T00:00:00.000Z"
}
```

File permissions are set to `0600` (owner read/write only).

---

## Authentication Flow (PKCE)

```
insighta login
     │
     ├─ 1. Generate state (32-byte random hex)
     ├─ 2. Generate code_verifier (64-byte base64url)
     ├─ 3. Derive code_challenge = BASE64URL(SHA256(verifier))
     ├─ 4. Start local HTTP callback server  →  http://localhost:7749/callback
     ├─ 5. Open browser:
     │       GET {BACKEND_URL}/auth/github
     │           ?state=...
     │           &code_challenge=...
     │           &code_challenge_method=S256
     │           &redirect_uri=http://localhost:7749/callback
     │
     │  [User authenticates on GitHub]
     │
     ├─ 6. GitHub redirects → http://localhost:7749/callback?code=...&state=...
     ├─ 7. CLI validates state (CSRF check)
     ├─ 8. CLI calls backend:
     │       GET {BACKEND_URL}/auth/github/callback
     │           ?code=...&state=...&code_verifier=...&redirect_uri=...
     │
     │  [Backend exchanges code+verifier with GitHub, creates/updates user]
     │
     ├─ 9. Backend responds with { accessToken, refreshToken, username }
     └─ 10. CLI stores tokens → ~/.insighta/credentials.json
            Prints: ✓ Logged in as @username
```

### Token Handling

| Token        | Expiry    | Storage                           |
|--------------|-----------|-----------------------------------|
| Access token | 3 minutes | `~/.insighta/credentials.json`    |
| Refresh token| 5 minutes | `~/.insighta/credentials.json`    |

**Auto-refresh**: When the access token expires (HTTP 401), the CLI automatically:
1. Calls `POST /auth/refresh` with the stored refresh token
2. Saves the new token pair
3. Retries the original request — transparent to the user

If the refresh token is also expired, the user is prompted to run `insighta login` again.

A request queue ensures concurrent 401 responses only trigger one refresh attempt.

---

## Role Enforcement Logic

The backend enforces two roles:

| Role     | Permissions                                |
|----------|--------------------------------------------|
| `admin`  | Full access: list, search, create, export  |
| `analyst`| Read-only: list, search, export only       |

The CLI passes the access token on every request. The backend validates the token and checks the user's role. If a user attempts an action beyond their role (e.g. `analyst` calling `profiles create`), the backend returns `403 Forbidden` and the CLI displays the error clearly.

---

## Natural Language Parsing

The `insighta profiles search <query>` command sends the raw query string to:

```
GET /api/profiles/search?q=<query>
```

The backend's natural language parser interprets phrases like:
- `"young males from Nigeria"` → gender=male, country=Nigeria, age_group=youth
- `"female adults over 30"` → gender=female, min_age=30, age_group=adult

All parsing logic lives in the backend; the CLI is a transparent pass-through.

---

## Requirements

- Node.js >= 18.0.0
- pnpm

---

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd stage-3-terminal

# Install dependencies
pnpm install

# Install globally so `insighta` works from any directory
pnpm link --global
```

After linking, verify it works:

```bash
insighta --version
insighta --help
```

---

## Configuration

The backend URL is configured in `src/config.js`:

```js
export const config = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3000',
};
```

You can override it via a `.env` file or environment variable:

```bash
# .env
BACKEND_URL=https://your-backend.example.com
```

Copy the example:

```bash
cp .env.example .env
# then edit .env with your backend URL
```

---

## CLI Usage

### Authentication Commands

```bash
# Log in via GitHub OAuth (opens browser)
insighta login

# Show the currently authenticated user
insighta whoami

# Log out and revoke the session
insighta logout
```

### Profile Commands

```bash
# List all profiles (paginated)
insighta profiles list

# Filter by gender
insighta profiles list --gender male

# Filter by country and age group
insighta profiles list --country NG --age-group adult

# Filter by age range
insighta profiles list --min-age 25 --max-age 40

# Sort results
insighta profiles list --sort-by age --order desc

# Paginate
insighta profiles list --page 2 --limit 20

# Get a single profile by ID
insighta profiles get <uuid>

# Natural language search
insighta profiles search "young males from nigeria"
insighta profiles search "female adults" --page 2

# Create a profile (admin only)
insighta profiles create --name "Harriet Tubman"

# Export all profiles to CSV
insighta profiles export --format csv

# Export with filters
insighta profiles export --format csv --gender male --country NG
```

---

## Options Reference

### `insighta profiles list`

| Option        | Description                                  | Example              |
|---------------|----------------------------------------------|----------------------|
| `--gender`    | Filter by gender                             | `male`, `female`     |
| `--country`   | Filter by country code or name               | `NG`, `"Nigeria"`    |
| `--age-group` | Filter by age group                          | `adult`, `youth`     |
| `--min-age`   | Minimum age (inclusive)                      | `25`                 |
| `--max-age`   | Maximum age (inclusive)                      | `40`                 |
| `--sort-by`   | Field to sort by                             | `age`, `name`        |
| `--order`     | Sort direction (`asc` or `desc`)             | `desc`               |
| `--page`      | Page number (default: `1`)                   | `2`                  |
| `--limit`     | Results per page (default: `20`)             | `50`                 |

### `insighta profiles search`

| Option    | Description              | Default |
|-----------|--------------------------|---------|
| `--page`  | Page number              | `1`     |
| `--limit` | Results per page         | `20`    |

### `insighta profiles export`

| Option        | Description                     |
|---------------|---------------------------------|
| `--format`    | Export format — `csv` (required)|
| `--gender`    | Filter by gender                |
| `--country`   | Filter by country               |
| `--age-group` | Filter by age group             |
| `--min-age`   | Minimum age                     |
| `--max-age`   | Maximum age                     |

Exported CSV is saved to the **current working directory** as `profiles_<timestamp>.csv`.

---

## Error Handling

| Scenario                          | CLI Behaviour                                     |
|-----------------------------------|---------------------------------------------------|
| Not logged in                     | Shows "Run `insighta login`" message              |
| Access token expired              | Auto-refreshes silently, retries request          |
| Refresh token expired             | Clears credentials, prompts re-login              |
| HTTP 403 Forbidden                | Displays role-permission error                    |
| HTTP 404 Not Found                | Displays "not found" message with the ID          |
| Server unreachable                | Displays "Could not connect to server" message    |
| `DEBUG=insighta` env var set      | Prints full stack traces for debugging            |

---

## Project Structure

```
stage-3-terminal/
├── bin/
│   └── insighta.js          # Entry point + Commander setup
├── src/
│   ├── config.js            # Backend URL configuration (change here)
│   ├── auth/
│   │   ├── pkce.js          # PKCE helpers (state, verifier, challenge)
│   │   ├── token-store.js   # ~/.insighta/credentials.json read/write
│   │   ├── callback-server.js # Local OAuth callback HTTP server
│   │   ├── login.js         # Full PKCE login flow
│   │   ├── logout.js        # Token revocation + local cleanup
│   │   └── whoami.js        # Current user display
│   ├── profiles/
│   │   ├── list.js          # profiles list (filters + pagination)
│   │   ├── get.js           # profiles get <id>
│   │   ├── search.js        # profiles search <query>
│   │   ├── create.js        # profiles create --name
│   │   └── export.js        # profiles export --format csv
│   └── utils/
│       ├── api-client.js    # Axios instance (auth headers, auto-refresh)
│       ├── table.js         # cli-table3 formatters
│       └── errors.js        # Error extraction + display helpers
├── .env.example             # Environment variable template
├── .gitignore
└── package.json
```

---

## License

MIT
