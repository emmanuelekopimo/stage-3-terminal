import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { getTokens } from "./token-store.js";
import { formatProfileDetail } from "../utils/table.js";
import { handleError } from "../utils/errors.js";

/**
 * Displays the currently authenticated user's identity.
 *
 *  - If no credentials are stored, prints a "not logged in" message.
 *  - Otherwise, calls GET /auth/me for live data (role, email, etc.)
 *    and falls back to the locally stored username on network failure.
 */
export async function whoami() {
  const tokens = getTokens();

  if (!tokens) {
    console.log(
      chalk.yellow("\nNot logged in. Run `insighta login` to authenticate.\n"),
    );
    return;
  }

  const spinner = ora({
    text: "Fetching user info...",
    color: "cyan",
  }).start();

  try {
    const { data } = await apiClient.get("/api/v1/auth/me");

    spinner.stop();

    // Backend returns { status: 'success', data: { id, username, role } }
    const user = data.data ?? data.user ?? data;

    const username =
      user.username ?? user.login ?? user.name ?? tokens.username ?? "unknown";

    console.log(chalk.cyan.bold(`\n  Logged in as @${username}\n`));

    // Build a detail table from whatever fields the backend returns
    const profileData = {
      id: user.id ?? user._id,
      name: user.name,
      username: user.username ?? user.login,
      email: user.email,
      role: user.role,
      country: user.country,
      createdAt: user.createdAt ?? user.created_at,
      updatedAt: user.updatedAt ?? user.updated_at,
    };

    // Filter out undefined/null fields before rendering
    const cleanProfile = Object.fromEntries(
      Object.entries(profileData).filter(([, v]) => v != null),
    );

    if (Object.keys(cleanProfile).length > 0) {
      console.log(formatProfileDetail(cleanProfile));
    }

    console.log();
  } catch (err) {
    // Graceful degradation: show locally cached info if the request fails
    const status = err.response?.status;

    if (status === 401) {
      spinner.fail(
        chalk.red("Session expired. Please run `insighta login` again."),
      );
      return;
    }

    spinner.warn(
      chalk.yellow("Could not fetch live user info — showing cached data."),
    );
    console.log(
      chalk.cyan(`\n  Logged in as @${tokens.username ?? "unknown"}\n`) +
        chalk.dim(`  (Could not connect to server for fresh details)\n`),
    );
  }
}
