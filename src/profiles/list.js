import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { formatProfilesTable, printPaginationInfo } from "../utils/table.js";
import { handleError } from "../utils/errors.js";
import { requireAuth } from "../auth/token-store.js";

/**
 * @typedef {object} ListOptions
 * @property {string}  [gender]    - Filter by gender (e.g. "male", "female").
 * @property {string}  [country]   - Filter by country name.
 * @property {string}  [ageGroup]  - Filter by age group bucket (e.g. "18-24").
 * @property {string}  [minAge]    - Minimum age (inclusive).
 * @property {string}  [maxAge]    - Maximum age (inclusive).
 * @property {string}  [sortBy]    - Field to sort by (e.g. "age", "name").
 * @property {string}  [order]     - Sort direction: "asc" or "desc".
 * @property {string}  [page]      - Page number (1-based). Default: 1.
 * @property {string}  [limit]     - Records per page. Default: 20.
 */

/**
 * Lists profiles from the API with optional filtering and pagination.
 *
 * @param {ListOptions} options - Parsed Commander options.
 */
export async function listProfiles(options) {
  requireAuth();

  const spinner = ora({
    text: "Fetching profiles...",
    color: "cyan",
  }).start();

  try {
    // Build query params — only include defined values
    const params = {};

    if (options.gender) params.gender = options.gender;
    if (options.country) params.country_id = options.country; // v1 backend uses country_id
    if (options.ageGroup) params.age_group = options.ageGroup;
    if (options.minAge) params.min_age = options.minAge;
    if (options.maxAge) params.max_age = options.maxAge;
    if (options.sortBy) params.sort_by = options.sortBy;
    if (options.order) params.order = options.order;

    params.page = options.page ?? 1;
    params.limit = options.limit ?? 20;

    const { data } = await apiClient.get("/api/v1/profiles", { params });

    spinner.stop();

    // Backend returns { status, data: [...], pagination: { page, limit, total, totalPages } }
    const profiles =
      (Array.isArray(data.data) ? data.data : null) ??
      data.profiles ??
      data.results ??
      (Array.isArray(data) ? data : []);

    if (!profiles.length) {
      console.log(
        chalk.yellow("\n  No profiles found matching your criteria.\n"),
      );
      return;
    }

    console.log(formatProfilesTable(profiles));

    // Backend returns pagination as { page, limit, total, totalPages }
    const pagination = data.pagination ?? data.meta ?? {};
    const page = Number(pagination.page ?? data.page ?? params.page);
    const totalPages = Number(
      pagination.totalPages ?? pagination.total_pages ?? data.total_pages ?? 1,
    );
    const total = Number(pagination.total ?? data.total ?? profiles.length);

    printPaginationInfo({ page, totalPages, total });
  } catch (err) {
    spinner.fail(chalk.red("Failed to fetch profiles."));
    handleError(err, "profiles list");
  }
}
