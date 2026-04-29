import axios from "axios";
import { config } from "../config.js";
import { getTokens, saveTokens, clearTokens } from "../auth/token-store.js";

/**
 * Whether a token refresh is currently in-flight.
 * Used to avoid sending multiple simultaneous refresh requests.
 */
let isRefreshing = false;

/**
 * Queue of { resolve, reject } callbacks waiting for the in-flight refresh.
 * Once the refresh succeeds (or fails), all queued requests are replayed.
 *
 * @type {Array<{ resolve: (token: string) => void, reject: (err: unknown) => void }>}
 */
let refreshQueue = [];

/**
 * Resolves all queued requests after a successful token refresh.
 *
 * @param {string} newAccessToken
 */
function flushQueue(newAccessToken) {
  for (const { resolve } of refreshQueue) {
    resolve(newAccessToken);
  }
  refreshQueue = [];
}

/**
 * Rejects all queued requests after a failed token refresh.
 *
 * @param {unknown} err
 */
function rejectQueue(err) {
  for (const { reject } of refreshQueue) {
    reject(err);
  }
  refreshQueue = [];
}

/**
 * Returns a Promise that will resolve/reject once the current in-flight
 * refresh completes.  The resolved value is the new access token.
 *
 * @returns {Promise<string>}
 */
function waitForRefresh() {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject });
  });
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

/**
 * Pre-configured Axios instance for all Insighta API calls.
 *
 * Features:
 *  - baseURL from config
 *  - `X-API-Version: 1` on every request
 *  - Automatic `Authorization: Bearer` injection from the token store
 *  - Transparent token refresh on HTTP 401
 */
export const apiClient = axios.create({
  baseURL: config.BACKEND_URL,
  headers: {
    "Content-Type": "application/json",
    "X-API-Version": "1",
  },
  timeout: 30_000, // 30 s — accounts for Railway/Render cold starts
});

// ---------------------------------------------------------------------------
// Request interceptor — inject access token
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (requestConfig) => {
    const tokens = getTokens();
    if (tokens?.accessToken) {
      requestConfig.headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    }
    return requestConfig;
  },
  (err) => Promise.reject(err),
);

// ---------------------------------------------------------------------------
// Response interceptor — handle 401 / token refresh
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  // Pass successful responses straight through
  (response) => response,

  async (err) => {
    const originalRequest = err.config;

    // Only attempt refresh for 401 responses that haven't been retried yet
    const is401 = err.response?.status === 401;
    const alreadyRetried = originalRequest._retried === true;

    if (!is401 || alreadyRetried) {
      return Promise.reject(err);
    }

    // Mark this request so we don't retry it again
    originalRequest._retried = true;

    if (isRefreshing) {
      // Another request already started a refresh — wait for it
      try {
        const newToken = await waitForRefresh();
        originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    // We are the first 401 — kick off the refresh
    isRefreshing = true;

    const tokens = getTokens();
    if (!tokens?.refreshToken) {
      // Nothing to refresh with — clear state and bail
      isRefreshing = false;
      clearTokens();
      rejectQueue(
        new Error("Session expired. Please run `insighta login` again."),
      );
      return Promise.reject(
        new Error("Session expired. Please run `insighta login` again."),
      );
    }

    try {
      const { data } = await axios.post(
        `${config.BACKEND_URL}/api/v1/auth/refresh`,
        { refresh_token: tokens.refreshToken },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Version": "1",
          },
          timeout: 10_000,
        },
      );

      // Backend returns { status, data: { access_token, refresh_token, ... } }
      const payload = data.data ?? data;
      const newAccessToken = payload.access_token ?? payload.accessToken;
      const newRefreshToken =
        payload.refresh_token ?? payload.refreshToken ?? tokens.refreshToken;

      if (!newAccessToken) {
        throw new Error("Refresh response did not include a new access token.");
      }

      // Persist the new tokens
      saveTokens(newAccessToken, newRefreshToken, tokens.username);

      // Unblock any queued requests
      flushQueue(newAccessToken);

      // Retry the original request with the fresh token
      originalRequest.headers["Authorization"] = `Bearer ${newAccessToken}`;
      return apiClient(originalRequest);
    } catch (refreshErr) {
      // Refresh failed — the user needs to log in again
      clearTokens();
      rejectQueue(refreshErr);
      const displayErr = new Error(
        "Your session has expired. Please run `insighta login` again.",
      );
      return Promise.reject(displayErr);
    } finally {
      isRefreshing = false;
    }
  },
);
