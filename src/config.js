// Load .env from the project root if it exists. We use a try/catch so the CLI
// still works when dotenv is not installed or when no .env file is present.
try {
  const { default: dotenv } = await import("dotenv");
  dotenv.config();
} catch {
  // dotenv not available or no .env file — continue with process.env as-is
}

/**
 * Central configuration object for Insighta Labs+ CLI.
 * Change BACKEND_URL here (or via the environment) to point at a different server.
 */
export const config = {
  /** Base URL of the Insighta backend API. */
  BACKEND_URL:
    process.env.BACKEND_URL ||
    "https://stage-1-hng-backend-production.up.railway.app",
};
