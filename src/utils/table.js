import Table from "cli-table3";
import chalk from "chalk";

/**
 * Creates a styled cli-table3 instance for list/search views.
 *
 * @param {string[]} headers - Column header labels.
 * @returns {Table} A configured Table instance. Call .toString() or console.log() it.
 */
export function createTable(headers) {
  return new Table({
    head: headers.map((h) => chalk.cyan.bold(h)),
    style: {
      head: [], // colours applied manually above
      border: ["grey"],
    },
    wordWrap: true,
  });
}

/**
 * Creates a two-column key-value table (used for single-record detail views).
 *
 * @returns {Table}
 */
export function createDetailTable() {
  return new Table({
    style: {
      border: ["grey"],
    },
    wordWrap: true,
    colWidths: [22, 50],
  });
}

/**
 * Formats a list of profile objects into a printable table string.
 *
 * @param {object[]} profiles - Array of profile objects from the API.
 * @returns {string} Rendered table string ready to be passed to console.log().
 */
export function formatProfilesTable(profiles) {
  const table = createTable([
    "Name",
    "Gender",
    "Age",
    "Age Group",
    "Country",
    "Created At",
  ]);

  for (const p of profiles) {
    table.push([
      p.name ?? chalk.dim("—"),
      formatGender(p.gender),
      p.age != null ? String(p.age) : chalk.dim("—"),
      p.ageGroup ?? p.age_group ?? chalk.dim("—"),
      p.country ?? chalk.dim("—"),
      formatDate(p.createdAt ?? p.created_at),
    ]);
  }

  return table.toString();
}

/**
 * Formats a single profile object into a detailed key-value table string.
 *
 * @param {object} profile - A single profile object from the API.
 * @returns {string} Rendered table string.
 */
export function formatProfileDetail(profile) {
  const table = createDetailTable();

  const rawFields = [
    ["ID", profile.id ?? profile._id],
    ["Name", profile.name],
    ["Gender", profile.gender ? formatGender(profile.gender) : null],
    ["Age", profile.age != null ? String(profile.age) : null],
    ["Age Group", profile.ageGroup ?? profile.age_group],
    ["Country", profile.country],
    ["Email", profile.email],
    ["Role", profile.role],
    ["Created At", profile.createdAt ?? profile.created_at],
    ["Updated At", profile.updatedAt ?? profile.updated_at],
  ];

  for (const [key, rawValue] of rawFields) {
    if (rawValue == null) continue;
    // Apply special formatting only after the null-check
    const displayValue =
      key === "Gender"
        ? formatGender(rawValue)
        : key === "Created At"
          ? formatDate(rawValue)
          : key === "Updated At"
            ? formatDate(rawValue)
            : String(rawValue);
    table.push([chalk.cyan.bold(key), displayValue]);
  }

  return table.toString();
}

/**
 * Prints pagination information below a table.
 *
 * @param {object} pagination
 * @param {number} pagination.page       - Current page number.
 * @param {number} pagination.totalPages - Total number of pages.
 * @param {number} pagination.total      - Total number of records.
 */
export function printPaginationInfo({ page, totalPages, total }) {
  console.log(
    chalk.dim(
      `\n  Page ${page} of ${totalPages} | Total: ${total} profile${total !== 1 ? "s" : ""}`,
    ),
  );
  if (page < totalPages) {
    console.log(chalk.dim(`  Use --page ${page + 1} to see the next page.\n`));
  } else {
    console.log(chalk.dim(`  Use --page to navigate.\n`));
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Applies a colour to gender values for quick visual scanning.
 *
 * @param {string|undefined} gender
 * @returns {string}
 */
function formatGender(gender) {
  if (!gender) return chalk.dim("—");
  const lower = gender.toLowerCase();
  if (lower === "male") return chalk.blue("Male");
  if (lower === "female") return chalk.magenta("Female");
  return gender;
}

/**
 * Formats an ISO date string into a locale-aware short date.
 *
 * @param {string|undefined} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return chalk.dim("—");
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
