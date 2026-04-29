import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { formatProfileDetail } from "../utils/table.js";
import { handleError } from "../utils/errors.js";
import { requireAuth } from "../auth/token-store.js";

/**
 * @typedef {object} CreateOptions
 * @property {string} name - The display name for the new profile.
 */

/**
 * Creates a new profile on the backend.
 *
 * @param {CreateOptions} options - Parsed Commander options.
 */
export async function createProfile(options) {
  requireAuth();

  const name = options.name?.trim();

  if (!name) {
    console.error(chalk.red("\n✖ --name is required.\n"));
    console.error(
      chalk.dim('  Usage: insighta profiles create --name "Jane Doe"\n'),
    );
    process.exit(1);
  }

  const spinner = ora({
    text: `Creating profile for ${chalk.cyan(name)}...`,
    color: "cyan",
  }).start();

  try {
    const { data } = await apiClient.post("/api/v1/profiles", { name });

    spinner.stop();

    // Normalise — profile may be at the top level or under a `profile` key
    const profile = data.profile ?? data.data ?? data;

    console.log(chalk.green("\n✓ Profile created successfully!\n"));

    if (profile && typeof profile === "object") {
      console.log(formatProfileDetail(profile));
    }

    console.log();
  } catch (err) {
    spinner.fail(chalk.red(`Failed to create profile for "${name}".`));

    if (err.response?.status === 409) {
      console.error(
        chalk.red(`\n✖ A profile with the name "${name}" already exists.\n`),
      );
      process.exit(1);
    }

    if (err.response?.status === 422) {
      const detail =
        err.response.data?.message ??
        err.response.data?.error ??
        "Validation failed.";
      console.error(chalk.red(`\n✖ ${detail}\n`));
      process.exit(1);
    }

    handleError(err, "profiles create");
  }
}
