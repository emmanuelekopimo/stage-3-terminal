import chalk from 'chalk';

/**
 * Extracts a human-readable message from an Axios error or a generic Error.
 *
 * Priority order:
 *  1. Backend JSON error body  (response.data.message | response.data.error)
 *  2. HTTP status text         (e.g. "404 Not Found")
 *  3. Network / request error  (e.g. "ECONNREFUSED")
 *  4. Plain error message
 *
 * @param {unknown} err - The caught error value.
 * @returns {string} A user-friendly error message string.
 */
export function extractErrorMessage(err) {
  if (!err) return 'An unknown error occurred.';

  // Axios errors have a `response` or `request` property
  if (err.response) {
    const { status, statusText, data } = err.response;

    // Try to get a message from the JSON body
    const bodyMessage =
      (data && typeof data === 'object' && (data.message || data.error)) ||
      null;

    if (bodyMessage) return String(bodyMessage);

    return `HTTP ${status} ${statusText || ''}`.trim();
  }

  if (err.request) {
    // Request was made but no response received (e.g. server is down)
    const backendUrl = err.config?.baseURL || 'the server';
    return `Could not connect to ${backendUrl}. Is the server running?`;
  }

  // Generic JS error
  return err.message || String(err);
}

/**
 * Prints a formatted error message to stderr and exits the process.
 * This is the standard way to handle fatal CLI errors.
 *
 * @param {unknown} err        - The error to display.
 * @param {string}  [context]  - Optional context string (e.g. "login", "profiles list").
 */
export function handleError(err, context) {
  const message = extractErrorMessage(err);
  const prefix = context ? chalk.dim(`[${context}] `) : '';

  console.error(chalk.red(`\n✖ ${prefix}${message}\n`));

  // Show the full stack in debug mode
  if (process.env.DEBUG === 'insighta' && err instanceof Error && err.stack) {
    console.error(chalk.dim(err.stack));
  }

  process.exit(1);
}

/**
 * Prints a warning message to stderr (non-fatal).
 *
 * @param {string} message - The warning to display.
 */
export function warnUser(message) {
  console.error(chalk.yellow(`\n⚠ ${message}\n`));
}

/**
 * Prints an info message to stdout.
 *
 * @param {string} message
 */
export function infoMessage(message) {
  console.log(chalk.cyan(`ℹ ${message}`));
}

/**
 * Prints a success message to stdout.
 *
 * @param {string} message
 */
export function successMessage(message) {
  console.log(chalk.green(`✓ ${message}`));
}
