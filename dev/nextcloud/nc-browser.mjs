/*
 * Playwright helpers that drive the Nextcloud web UI (tested with Nextcloud 34)
 * for the auth flows the proxy relies on. They only take a Playwright `page`,
 * so they work with `playwright` or `playwright-core` and any browser setup.
 *
 *   import { chromium } from 'playwright-core';
 *   import { grantLoginFlow, grantOAuth } from './dev/nextcloud/nc-browser.mjs';
 *   const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
 *   const page = await browser.newPage();
 *   await grantLoginFlow(page, flow.login, 'lehrer', 'lehrer-dev-password-123');
 *   const url = await grantOAuth(page, authorizeUrl, 'lehrer', 'lehrer-dev-password-123',
 *     'http://localhost:8787/oauth/callback');
 *
 * The pages are Vue apps and localized (German browser -> German labels), so the
 * selectors below avoid button texts. The login-flow pages expose their state
 * in a hidden input #initial-state-core-loginFlowState (base64 JSON string:
 * "auth" = "Connect to your account" picker, "grant" = "Account access" page
 * with the "Grant access" button, "done" = "Account connected").
 *
 * Not handled: two-factor auth, SSO/alternative logins, and the password
 * confirmation dialog Nextcloud shows on "Grant access" when the browser
 * session's last password entry is older than 30 minutes.
 */

const SEL = {
  loginForm: 'form[name="login"]',
  loginUser: 'form[name="login"] input[name="user"]',
  loginPassword: 'form[name="login"] input[name="password"]',
  loginSubmit: 'form[name="login"] button[type="submit"]',
  loginError: 'form[name="login"] .input-field__helper-text-message--error',
  flowState: '#initial-state-core-loginFlowState',
  // "Log in" button on the picker page (Login Flow v2 / OAuth2 respectively)
  pickerLoginV2: 'a[href*="/login/v2/grant"]',
  pickerLoginOAuth: 'a[href*="/login/flow/grant"]',
  // "Grant access" button (form posts to /login/v2/grant or /login/flow)
  grantButton: 'form[method="POST" i] button[type="submit"]',
};

// Texts of Nextcloud's error pages (English and German) on the flow routes.
const ERROR_TEXT = /not authorized|does not match|forbidden|invalid|expired|nicht autorisiert|stimm(?:t|en) nicht|verboten|ungültig|abgelaufen/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Returns "auth" | "grant" | "done" | null for the current login-flow page. */
async function flowState(page) {
  // Read without auto-waiting: most pages (e.g. the login form) have no such input.
  const raw = await page
    .evaluate((sel) => document.querySelector(sel)?.getAttribute('value') ?? null, SEL.flowState)
    .catch(() => null); // page navigating
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

async function isVisible(page, selector) {
  return page.locator(selector).first().isVisible().catch(() => false);
}

/** Short description of an unexpected page, for error messages. */
async function describe(page) {
  const text = await page.locator('body').innerText().catch(() => '');
  return `${page.url()} :: ${text.replace(/\s+/g, ' ').trim().slice(0, 300)}`;
}

/**
 * Fills and submits the Nextcloud login form if it is shown.
 * If the page is not on Nextcloud yet (e.g. about:blank), opens <baseUrl>/login first.
 * Resolves true if it logged in, false if no login form was shown (already logged in).
 * Throws on "Wrong login or password." (each failure counts towards brute-force
 * protection: >10 failures in 30 min block all logins from the IP with HTTP 429).
 */
export async function ncLogin(page, baseUrl, user, password) {
  const origin = new URL(baseUrl).origin;
  if (!page.url().startsWith(origin)) {
    await page.goto(new URL('/index.php/login', origin).href);
  }
  await page.waitForLoadState('domcontentloaded');
  // The form is rendered client-side by Vue.
  const form = page.locator(SEL.loginForm);
  try {
    await form.waitFor({ state: 'visible', timeout: 3000 });
  } catch {
    return false;
  }
  await page.fill(SEL.loginUser, user);
  await page.fill(SEL.loginPassword, password);
  // A successful login answers 303 to the redirect_url (or the default app);
  // a failed one answers 303 back to /login?direct=1&user=... with an error.
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/login')),
    page.click(SEL.loginSubmit),
  ]);
  await page.waitForLoadState('domcontentloaded');
  const stillLogin = await form.isVisible().catch(() => false);
  if (stillLogin) {
    const error = await page.locator(SEL.loginError).first().innerText().catch(() => '');
    // Note: after a failed attempt Nextcloud drops the redirect_url, so a flow
    // (Login Flow v2 / OAuth) has to be restarted from its start URL.
    throw new Error(`Nextcloud login failed for "${user}": ${error || await describe(page)}`);
  }
  return true;
}

/**
 * Completes a Login Flow v2 grant: opens the `login` URL returned by
 * POST /index.php/login/v2, clicks "Log in", logs in if needed and clicks
 * "Grant access". Resolves when Nextcloud shows "Account connected"; the app
 * password is then available from the poll endpoint.
 */
export async function grantLoginFlow(page, loginUrl, user, password, { timeout = 30000 } = {}) {
  const baseUrl = new URL(loginUrl).origin;
  const deadline = Date.now() + timeout;
  await page.goto(loginUrl);
  while (Date.now() < deadline) {
    await page.waitForLoadState('domcontentloaded');
    const state = await flowState(page);
    if (state === 'done') return;
    if (state === 'auth' && await isVisible(page, SEL.pickerLoginV2)) {
      await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login/v2/flow')), page.click(SEL.pickerLoginV2)]);
      continue;
    }
    if (state === 'grant' && await isVisible(page, SEL.grantButton)) {
      await Promise.all([page.waitForNavigation(), page.click(SEL.grantButton)]);
      continue;
    }
    if (await isVisible(page, SEL.loginForm)) {
      await ncLogin(page, baseUrl, user, password);
      continue;
    }
    if (state === null) {
      const text = await page.locator('body').innerText().catch(() => '');
      // e.g. "Your login token is invalid or has expired" or "State token does not match" (403)
      if (ERROR_TEXT.test(text)) {
        throw new Error(`Unexpected page during Login Flow v2: ${await describe(page)}`);
      }
    }
    await sleep(200);
  }
  throw new Error(`Login Flow v2 did not finish within ${timeout} ms: ${await describe(page)}`);
}

/**
 * Completes Nextcloud's OAuth2 authorize + grant for `authorizeUrl`
 * (…/index.php/apps/oauth2/authorize?response_type=code&client_id=…&state=…)
 * and resolves with the final redirect URL (starts with `redirectPrefix`,
 * e.g. "http://localhost:8787/oauth/callback?state=xyz&code=…").
 *
 * The redirect is intercepted: no server has to run at `redirectPrefix`, and
 * the code is never delivered there. Playwright does not call route handlers
 * for redirect targets, so every navigation to the Nextcloud origin is fetched
 * via route.fetch({ maxRedirects: 0 }) and a 3xx to `redirectPrefix` is
 * answered with a small placeholder page instead.
 */
export async function grantOAuth(page, authorizeUrl, user, password, redirectPrefix, { timeout = 30000 } = {}) {
  const origin = new URL(authorizeUrl).origin;
  let captured = null;
  const capture = (url) => { if (!captured && url.startsWith(redirectPrefix)) captured = url; };
  const placeholder = {
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>Redirect captured</title><p>OAuth redirect captured by nc-browser.mjs</p>',
  };

  const ncMatcher = (url) => url.origin === origin;
  const ncHandler = async (route) => {
    const request = route.request();
    if (!request.isNavigationRequest()) return route.fallback();
    let response;
    try {
      response = await route.fetch({ maxRedirects: 0 });
    } catch {
      return route.abort();
    }
    const location = response.headers()['location'];
    if (response.status() >= 300 && response.status() < 400 && location) {
      const target = new URL(location, request.url()).href;
      if (target.startsWith(redirectPrefix)) {
        capture(target);
        return route.fulfill(placeholder);
      }
    }
    return route.fulfill({ response });
  };
  // Fallbacks in case the browser reaches the redirect target some other way.
  const targetMatcher = (url) => url.href.startsWith(redirectPrefix);
  const targetHandler = (route) => { capture(route.request().url()); return route.fulfill(placeholder); };
  const onRequest = (request) => { if (!request.url().startsWith(origin)) capture(request.url()); };

  await page.route(ncMatcher, ncHandler);
  await page.route(targetMatcher, targetHandler);
  page.on('request', onRequest);
  try {
    const deadline = Date.now() + timeout;
    await page.goto(authorizeUrl);
    while (!captured && Date.now() < deadline) {
      await page.waitForLoadState('domcontentloaded');
      if (captured) break;
      if (!page.url().startsWith(origin)) {
        throw new Error(`OAuth flow left Nextcloud without matching redirectPrefix: ${page.url()}`);
      }
      const state = await flowState(page);
      if (state === 'auth' && await isVisible(page, SEL.pickerLoginOAuth)) {
        await Promise.all([page.waitForURL((u) => !u.pathname.endsWith('/login/flow')), page.click(SEL.pickerLoginOAuth)]);
        continue;
      }
      if (state === 'grant' && await isVisible(page, SEL.grantButton)) {
        await Promise.all([page.waitForNavigation(), page.click(SEL.grantButton)]);
        continue;
      }
      if (await isVisible(page, SEL.loginForm)) {
        await ncLogin(page, origin, user, password);
        continue;
      }
      if (state === null) {
        const text = await page.locator('body').innerText().catch(() => '');
        // e.g. "Your client is not authorized to connect." (unknown client_id)
        // or "State token does not match" (403)
        if (ERROR_TEXT.test(text)) {
          throw new Error(`Unexpected page during OAuth authorize: ${await describe(page)}`);
        }
      }
      await sleep(200);
    }
    if (!captured) throw new Error(`OAuth flow did not redirect to ${redirectPrefix} within ${timeout} ms: ${await describe(page)}`);
    return captured;
  } finally {
    page.off('request', onRequest);
    await page.unroute(ncMatcher, ncHandler).catch(() => {});
    await page.unroute(targetMatcher, targetHandler).catch(() => {});
  }
}
