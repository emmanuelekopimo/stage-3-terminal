import axios from "axios";
import ora from "ora";
import chalk from "chalk";
import open from "open";
import { config } from "../config.js";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
} from "./pkce.js";
import { startCallbackServer } from "./callback-server.js";
import { saveTokens } from "./token-store.js";
import { handleError } from "../utils/errors.js";

/**
 * Executes the full PKCE GitHub OAuth login flow:
 *
 *  1. Generate PKCE `state`, `code_verifier`, and `code_challenge`.
 *  2. Start a local callback server to receive the redirect.
 *  3. GET /api/v1/auth/github/authorize → backend returns the GitHub OAuth URL.
 *  4. Open the GitHub URL in the browser.
 *  5. Wait for GitHub to redirect back with an auth `code`.
 *  6. Validate the returned `state` to prevent CSRF.
 *  7. POST /api/v1/auth/token with code + code_verifier → get tokens.
 *  8. Persist tokens and print the success message.
 */
export async function login() {
  // ── Step 1: PKCE parameters ──────────────────────────────────────────────
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // ── Step 2: Local callback server ────────────────────────────────────────
  let port;
  let waitForCallback;

  try {
    ({ port, waitForCallback } = await startCallbackServer());
  } catch (err) {
    handleError(err, "login");
  }

  const redirectUri = `http://localhost:${port}/callback`;

  // ── Step 3: Ask backend for the GitHub OAuth URL ─────────────────────────
  let authUrl;
  try {
    const { data } = await axios.get(
      `${config.BACKEND_URL}/api/v1/auth/github/authorize`,
      {
        params: {
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          redirect_uri: redirectUri,
        },
        timeout: 10_000,
      },
    );
    // Backend returns { status: 'success', data: { auth_url: '...' } }
    authUrl = data?.data?.auth_url ?? data?.auth_url;
    if (!authUrl) throw new Error("Backend did not return an auth_url.");
  } catch (err) {
    handleError(err, "login");
  }

  // ── Step 4: Open the GitHub URL ──────────────────────────────────────────
  console.log(
    chalk.cyan(`\nOpening GitHub authentication in your browser...\n`) +
      chalk.dim(`  If your browser does not open, visit:\n  ${authUrl}\n`),
  );

  try {
    await open(authUrl);
  } catch {
    console.log(
      chalk.yellow(
        `Could not open browser automatically. Please visit the URL above.`,
      ),
    );
  }

  // ── Step 5 & 6: Wait for callback and validate state ─────────────────────
  const spinner = ora({
    text: "Waiting for GitHub authentication...",
    color: "cyan",
  }).start();

  let code;

  try {
    const callbackResult = await waitForCallback;

    if (callbackResult.state !== state) {
      spinner.fail(
        chalk.red("State mismatch — possible CSRF attack. Login aborted."),
      );
      process.exit(1);
    }

    code = callbackResult.code;
    spinner.text = "Exchanging code for tokens...";
  } catch (err) {
    spinner.fail(chalk.red("Authentication failed."));
    handleError(err, "login");
  }

  // ── Step 7: POST /api/v1/auth/token ─────────────────────────────────────
  try {
    const { data } = await axios.post(
      `${config.BACKEND_URL}/api/v1/auth/token`,
      { code, code_verifier: codeVerifier, redirect_uri: redirectUri },
      { headers: { "Content-Type": "application/json" }, timeout: 15_000 },
    );

    // Backend returns { status: 'success', data: { access_token, refresh_token, token_type, expires_in } }
    const payload = data?.data ?? data;
    const accessToken = payload.access_token ?? payload.accessToken;
    const refreshToken = payload.refresh_token ?? payload.refreshToken ?? "";

    if (!accessToken) {
      throw new Error("Backend did not return an access token.");
    }

    // ── Step 8: Fetch username from /me then persist ─────────────────────
    let username = "unknown";
    try {
      const meRes = await axios.get(`${config.BACKEND_URL}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 8_000,
      });
      username =
        meRes.data?.data?.username ?? meRes.data?.username ?? "unknown";
    } catch {
      // Non-fatal — we still log in, just without a username
    }

    saveTokens(accessToken, refreshToken, username);

    spinner.succeed(chalk.green(`✓ Logged in as @${username}`));
  } catch (err) {
    spinner.fail(chalk.red("Failed to complete authentication."));
    handleError(err, "login");
  }
}
