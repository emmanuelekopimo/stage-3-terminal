import fs from "fs";
import os from "os";
import path from "path";

/** Directory where credentials are stored: ~/.insighta/ */
const CREDENTIALS_DIR = path.join(os.homedir(), ".insighta");

/** Full path to the credentials file: ~/.insighta/credentials.json */
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "credentials.json");

/**
 * Ensures the ~/.insighta directory exists.
 */
function ensureCredentialsDir() {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Saves OAuth tokens and the username to disk.
 *
 * @param {string} accessToken  - The JWT access token.
 * @param {string} refreshToken - The opaque refresh token.
 * @param {string} username     - The authenticated user's GitHub login.
 */
export function saveTokens(accessToken, refreshToken, username) {
  ensureCredentialsDir();

  const credentials = {
    accessToken,
    refreshToken,
    username,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), {
    encoding: "utf8",
    mode: 0o600, // owner read/write only
  });
}

/**
 * Reads stored credentials from disk.
 *
 * @returns {{ accessToken: string, refreshToken: string, username: string, savedAt: string } | null}
 *   The stored credentials, or null if none exist or the file is malformed.
 */
export function getTokens() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf8");
    const parsed = JSON.parse(raw);

    // Basic integrity check — ensure the essential fields are present
    if (!parsed.accessToken || !parsed.refreshToken) {
      return null;
    }

    return parsed;
  } catch {
    // File is corrupted or unreadable — treat as no credentials
    return null;
  }
}

/**
 * Asserts credentials are stored; exits with a friendly message if not.
 * Call this at the top of any command that requires authentication.
 */
export function requireAuth() {
  if (!getTokens()) {
    // Use dynamic import to avoid circular deps with chalk
    console.error(
      "\n✖ You are not logged in. Run `insighta login` to authenticate.\n",
    );
    process.exit(1);
  }
}

/**
 * Removes the stored credentials file. Call this on logout or auth failure.
 */
export function clearTokens() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}
