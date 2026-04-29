import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { getTokens, clearTokens } from "./token-store.js";
import { handleError, warnUser } from "../utils/errors.js";

/**
 * Logs the current user out by:
 *  1. Checking for stored credentials.
 *  2. Revoking the refresh token on the backend (best-effort).
 *  3. Deleting the local credentials file.
 */
export async function logout() {
  const tokens = getTokens();

  if (!tokens) {
    console.log(chalk.yellow("You are not currently logged in."));
    return;
  }

  const spinner = ora({
    text: "Logging out...",
    color: "cyan",
  }).start();

  try {
    // Tell the backend to invalidate the refresh token.
    // We do this best-effort — if it fails we still clear local credentials.
    await apiClient.post("/api/v1/auth/logout", {
      refresh_token: tokens.refreshToken,
    });
  } catch (err) {
    // A 401 here just means the token was already expired — that is fine.
    // Any other error is worth mentioning but should not block logout.
    const status = err.response?.status;
    if (status !== 401) {
      spinner.warn(
        chalk.yellow("Could not reach the server to revoke the session."),
      );
      warnUser("Your local credentials will still be cleared.");
    }
  }

  // Always clear local tokens, regardless of server response
  clearTokens();

  spinner.succeed(chalk.green("✓ Logged out successfully"));
}
