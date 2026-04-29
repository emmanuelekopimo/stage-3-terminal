import http from 'http';
import { URL } from 'url';

/** Primary port to try first before falling back to an OS-assigned port. */
const PREFERRED_PORT = 7749;

/**
 * Attempts to start a TCP server on the given port.
 * Resolves with the port number on success, rejects on EADDRINUSE or other errors.
 *
 * @param {http.Server} server - An already-created http.Server instance.
 * @param {number}      port   - The port to attempt to listen on (0 = OS picks).
 * @returns {Promise<number>}
 */
function tryListen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', (err) => {
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      resolve(address.port);
    });
  });
}

/**
 * Starts a local HTTP server that waits for a single OAuth callback request.
 *
 * The server listens on `http://localhost:{port}/callback`, extracts the
 * `code` and `state` query parameters, responds with a success page, and
 * shuts itself down.
 *
 * @returns {Promise<{ port: number, waitForCallback: Promise<{ code: string, state: string }> }>}
 *   - `port`            — The port the server is actually listening on.
 *   - `waitForCallback` — A Promise that resolves once the callback is received.
 */
export async function startCallbackServer() {
  let resolveCallback;
  let rejectCallback;

  /** Promise that resolves with { code, state } on successful callback. */
  const waitForCallback = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = http.createServer((req, res) => {
    // Only handle GET /callback — ignore favicon requests, etc.
    const parsedUrl = new URL(req.url, `http://127.0.0.1`);

    if (req.method !== 'GET' || parsedUrl.pathname !== '/callback') {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const code = parsedUrl.searchParams.get('code');
    const state = parsedUrl.searchParams.get('state');
    const error = parsedUrl.searchParams.get('error');
    const errorDescription = parsedUrl.searchParams.get('error_description');

    if (error) {
      // GitHub returned an OAuth error (e.g. user denied access)
      const html = buildHtmlPage(
        'Authentication Failed',
        `<p style="color:#e74c3c">Error: <strong>${escapeHtml(error)}</strong></p>` +
          (errorDescription
            ? `<p>${escapeHtml(errorDescription)}</p>`
            : ''),
        false,
      );
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      server.close();
      rejectCallback(new Error(`OAuth error: ${error}${errorDescription ? ` — ${errorDescription}` : ''}`));
      return;
    }

    if (!code || !state) {
      const html = buildHtmlPage(
        'Authentication Failed',
        '<p style="color:#e74c3c">Missing <code>code</code> or <code>state</code> parameter.</p>',
        false,
      );
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      server.close();
      rejectCallback(new Error('Callback missing required parameters: code, state'));
      return;
    }

    // Success — send a friendly HTML page and close the server
    const html = buildHtmlPage(
      'Authentication Successful',
      '<p style="color:#27ae60">You have been authenticated successfully.</p>' +
        '<p>You can close this tab and return to your terminal.</p>',
      true,
    );
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);

    // Give the browser time to receive the response before closing
    setImmediate(() => {
      server.close();
      resolveCallback({ code, state });
    });
  });

  // Try preferred port first; fall back to an OS-assigned port on conflict
  let port;
  try {
    port = await tryListen(server, PREFERRED_PORT);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      // Port is busy — let the OS pick a free port
      port = await tryListen(server, 0);
    } else {
      throw err;
    }
  }

  return { port, waitForCallback };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal HTML page for the callback response.
 *
 * @param {string}  title   - Page <title> and <h1>.
 * @param {string}  body    - Inner HTML for the message body.
 * @param {boolean} success - Whether this is a success (green) or failure (red) page.
 * @returns {string} Complete HTML document.
 */
function buildHtmlPage(title, body, success) {
  const accentColor = success ? '#27ae60' : '#e74c3c';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} — Insighta Labs+</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0,0,0,.12);
      padding: 2.5rem 3rem;
      max-width: 480px;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; color: ${accentColor}; margin-bottom: 1rem; }
    p { color: #555; line-height: 1.6; margin-bottom: 0.5rem; }
    code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; }
    .brand { margin-top: 2rem; font-size: 0.8rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${escapeHtml(title)}</h1>
    ${body}
    <p class="brand">Insighta Labs+</p>
  </div>
</body>
</html>`;
}

/**
 * Escapes HTML special characters to prevent XSS in the callback page.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
