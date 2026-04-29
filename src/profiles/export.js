import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { apiClient } from "../utils/api-client.js";
import { handleError } from "../utils/errors.js";
import { requireAuth } from "../auth/token-store.js";

/** Supported export formats. */
const SUPPORTED_FORMATS = ["csv"];

/**
 * @typedef {object} ExportOptions
 * @property {string}  format    - Export format — currently only "csv".
 * @property {string}  [gender]  - Filter by gender.
 * @property {string}  [country] - Filter by country.
 * @property {string}  [ageGroup]- Filter by age group.
 * @property {string}  [minAge]  - Minimum age.
 * @property {string}  [maxAge]  - Maximum age.
 */

/**
 * Exports profiles from the API to a file in the current working directory.
 *
 * @param {ExportOptions} options - Parsed Commander options.
 */
export async function exportProfiles(options) {
  requireAuth();

  const format = (options.format ?? "").toLowerCase().trim();

  if (!format) {
    console.error(chalk.red("\n✖ --format is required.\n"));
    console.error(
      chalk.dim("  Usage: insighta profiles export --format csv\n"),
    );
    console.error(
      chalk.dim(`  Supported formats: ${SUPPORTED_FORMATS.join(", ")}\n`),
    );
    process.exit(1);
  }

  if (!SUPPORTED_FORMATS.includes(format)) {
    console.error(
      chalk.red(
        `\n✖ Unsupported format "${format}". Supported: ${SUPPORTED_FORMATS.join(", ")}\n`,
      ),
    );
    process.exit(1);
  }

  const spinner = ora({
    text: `Exporting profiles as ${chalk.cyan(format.toUpperCase())}...`,
    color: "cyan",
  }).start();

  try {
    // Build query params — include any active filters alongside format
    const params = { format };

    if (options.gender) params.gender = options.gender;
    if (options.country) params.country_id = options.country; // v1 backend uses country_id
    if (options.ageGroup) params.age_group = options.ageGroup;
    if (options.minAge) params.min_age = options.minAge;
    if (options.maxAge) params.max_age = options.maxAge;

    const { data } = await apiClient.get("/api/v1/profiles/export", {
      params,
      // Tell axios to treat the response as a plain string (CSV text)
      responseType: "text",
      headers: {
        // Prefer CSV over JSON for this request
        Accept: "text/csv,application/octet-stream,*/*",
      },
    });

    spinner.text = "Saving file...";

    // Generate a filename with the current UTC timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-") // colons and dots are invalid on Windows
      .replace("T", "_")
      .slice(0, 19); // e.g. 2024-06-15_14-30-00

    const filename = `profiles_${timestamp}.${format}`;
    const outputPath = path.resolve(process.cwd(), filename);

    // Write the file (create or overwrite)
    fs.writeFileSync(outputPath, data ?? "", { encoding: "utf8" });

    spinner.succeed(chalk.green(`✓ Exported to ${chalk.bold(filename)}`));
    console.log(chalk.dim(`  Full path: ${outputPath}\n`));
  } catch (err) {
    spinner.fail(chalk.red("Export failed."));
    handleError(err, "profiles export");
  }
}
