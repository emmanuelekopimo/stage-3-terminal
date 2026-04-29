import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { formatProfileDetail } from "../utils/table.js";
import { handleError } from "../utils/errors.js";
import { requireAuth } from "../auth/token-store.js";

/**
 * Fetches a single profile by its ID and displays it as a key-value table.
 *
 * @param {string} id - The profile ID to look up.
 */
export async function getProfile(id) {
  requireAuth();

  if (!id || !id.trim()) {
    console.error(chalk.red("\n✖ Please provide a profile ID.\n"));
    console.error(chalk.dim("  Usage: insighta profiles get <id>\n"));
    process.exit(1);
  }

  const spinner = ora({
    text: `Fetching profile ${chalk.cyan(id)}...`,
    color: "cyan",
  }).start();

  try {
    const { data } = await apiClient.get(
      `/api/v1/profiles/${encodeURIComponent(id.trim())}`,
    );

    spinner.stop();

    // Normalise — the profile may be at the top level or under a `profile` key
    const profile = data.profile ?? data.data ?? data;

    if (!profile || typeof profile !== "object") {
      console.log(chalk.yellow(`\n  No profile found with ID: ${id}\n`));
      return;
    }

    console.log(chalk.cyan.bold(`\n  Profile — ${profile.name ?? id}\n`));
    console.log(formatProfileDetail(profile));
    console.log();
  } catch (err) {
    spinner.fail(chalk.red(`Failed to fetch profile ${id}.`));

    if (err.response?.status === 404) {
      console.error(chalk.red(`\n✖ No profile found with ID: ${id}\n`));
      process.exit(1);
    }

    handleError(err, "profiles get");
  }
}
