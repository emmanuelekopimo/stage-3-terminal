import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { formatProfilesTable, printPaginationInfo } from "../utils/table.js";
import { handleError } from "../utils/errors.js";
import { requireAuth } from "../auth/token-store.js";

/**
 * @typedef {object} SearchOptions
 * @property {string|number} [page]  - Page number. Default: 1.
 * @property {string|number} [limit] - Results per page. Default: 20.
 */

/**
 * Searches profiles using a free-text query string.
 *
 * @param {string}        query   - The search string entered by the user.
 * @param {SearchOptions} options - Optional pagination overrides.
 */
export async function searchProfiles(query, options) {
  requireAuth();

  if (!query || !String(query).trim()) {
    console.error(chalk.red("\n✖ Please provide a search query.\n"));
    console.error(chalk.dim("  Usage: insighta profiles search <query>\n"));
    process.exit(1);
  }

  const trimmedQuery = String(query).trim();

  const spinner = ora({
    text: `Searching for ${chalk.cyan(`"${trimmedQuery}"`)}...`,
    color: "cyan",
  }).start();

  try {
    const params = {
      q: trimmedQuery,
      page: options.page ?? 1,
      limit: options.limit ?? 20,
    };

    const { data } = await apiClient.get("/api/v1/profiles/search", { params });

    spinner.stop();

    // Backend returns { status, data: [...], pagination: { page, limit, total, totalPages } }
    const profiles =
      (Array.isArray(data.data) ? data.data : null) ??
      data.profiles ??
      data.results ??
      (Array.isArray(data) ? data : []);

    if (!profiles.length) {
      console.log(
        chalk.yellow(`\n  No profiles found matching "${trimmedQuery}".\n`),
      );
      return;
    }

    console.log(chalk.cyan.bold(`\n  Search results for "${trimmedQuery}"\n`));
    console.log(formatProfilesTable(profiles));

    const pagination = data.pagination ?? data.meta ?? {};
    const page = Number(pagination.page ?? data.page ?? params.page);
    const totalPages = Number(
      pagination.totalPages ?? pagination.total_pages ?? data.total_pages ?? 1,
    );
    const total = Number(pagination.total ?? data.total ?? profiles.length);

    printPaginationInfo({ page, totalPages, total });
  } catch (err) {
    spinner.fail(chalk.red("Search failed."));
    handleError(err, "profiles search");
  }
}
