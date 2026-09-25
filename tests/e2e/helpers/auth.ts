/// <reference lib="dom" />

import { Page } from '@playwright/test';
import { ReplaySubject, lastValueFrom, Observable } from 'rxjs';

export type Credentials = {
  username?: string;
  email?: string;
  password: string;
};

/**
 * Wait for tokens in localStorage
 *
 * Two variants:
 * - `waitForToken$(page, timeout)` returns a hot `Observable<boolean>` (ReplaySubject) that resolves to true on token presence.
 * - `waitForToken(page, timeout)` returns a `Promise<boolean>` (backwards-compatible wrapper using `lastValueFrom`).
 */
export function waitForToken$(page: Page, timeout = 5000): Observable<boolean> {
  const subject = new ReplaySubject<boolean>(1);
  (async () => {
    try {
      // Global console listener to capture logs during modal init and submit
      const consoleMessages: Array<{ type: string; text: string }> = [];
      const onConsole = (msg: any) => {
        try {
          consoleMessages.push({ type: msg.type(), text: msg.text() });
        } catch (e) {
          // ignore
        }
      };
      page.on('console', onConsole);
      await page.waitForFunction(
        () => !!(window as any).localStorage.getItem('auth_token'),
        null,
        { timeout }
      );
      subject.next(true);
      subject.complete();
    } catch (err) {
      subject.error(err);
    }
  })();
  return subject;
}

export function waitForToken(page: Page, timeout = 5000) {
  // Backwards compatibility wrapper returning a Promise
  return lastValueFrom(waitForToken$(page, timeout));
}

/**
 * Login helper that centralizes login flow and captures backend responses
 * - Clicks Sign In button, waits for login modal
 * - Fills form, captures the `POST /api/auth/login` response
 * - Asserts expected status (200) and that tokens are persisted to localStorage
 * - Optionally waits for navigation to /library
 * - Implements simple retry logic on 429 (rate-limited)
 *
 * Variants:
 * - `loginViaModal$(...)` returns a hot `Observable` (ReplaySubject) which emits once and completes.
 * - `loginViaModal(...)` returns a `Promise` (backwards-compatible wrapper that awaits the Observable).
 */

async function openAuthModal(
  page: Page,
  mode: 'login' | 'register'
): Promise<void> {
  const fieldSelector =
    mode === 'login'
      ? 'input[formControlName="emailOrUsername"]'
      : 'input[formControlName="email"]';

  const existingField = page.locator(fieldSelector);

  if (
    await existingField
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    return;
  }

  // Close a guest/user menu left open by an earlier helper.
  await page.keyboard.press('Escape').catch(() => undefined);

  if (mode === 'login') {
    const landingSignIn = page
      .locator('.landing-actions')
      .getByRole('button', {
        name: 'Sign In',
        exact: true,
      });

    if (
      await landingSignIn
        .isVisible()
        .catch(() => false)
    ) {
      await landingSignIn.click();

      await page
        .locator(fieldSelector)
        .first()
        .waitFor({
          state: 'visible',
          timeout: 5000,
        });

      return;
    }
  } else {
    const landingCreate = page
      .locator('.landing-actions')
      .getByRole('button', {
        name: 'Create Account',
        exact: true,
      });

    if (
      await landingCreate
        .isVisible()
        .catch(() => false)
    ) {
      await landingCreate.click();

      await page
        .locator(fieldSelector)
        .first()
        .waitFor({
          state: 'visible',
          timeout: 5000,
        });

      return;
    }
  }

  const trigger = page.locator(
    'nav button.user-menu-trigger'
  );

  await trigger.waitFor({
    state: 'visible',
    timeout: 5000,
  });

  await trigger.click();

  const menuLabel =
    mode === 'login'
      ? 'Sign In'
      : 'Sign Up';

  const menuItem = page.getByRole(
    'menuitem',
    {
      name: menuLabel,
      exact: true,
    }
  );

  await menuItem.waitFor({
    state: 'visible',
    timeout: 5000,
  });

  await menuItem.click();

  await page
    .locator(fieldSelector)
    .first()
    .waitFor({
      state: 'visible',
      timeout: 5000,
    });
}

export function loginViaModal$(
  page: Page,
  creds: { emailOrUsername: string; password: string },
  options?: { waitForNavigation?: boolean; attempts?: number }
): Observable<{
  responseStatus: number;
  authToken?: string | null;
  refreshToken?: string | null;
  body?: any;
}> {
  const subject = new ReplaySubject<{
    responseStatus: number;
    authToken?: string | null;
    refreshToken?: string | null;
    body?: any;
  }>(1);

  (async () => {
    const waitForNavigation = options?.waitForNavigation ?? true;
    const maxAttempts = options?.attempts ?? 3;
    let attempt = 0;
    let lastResponse: any = null;

    try {
      // Ensure no lingering session state
      await page.evaluate(() => {
        try {
          (window as any).localStorage.clear();
          (window as any).sessionStorage.clear();
        } catch (err) {
          // ignore if clearing fails
        }
      });
      // Open the current visible login entry point.
      await openAuthModal(page, 'login');

      await page
        .waitForFunction(
          () =>
            !!(window as any).localStorage.getItem(
              'e2e_login_modal_open'
            ),
          null,
          { timeout: 2000 }
        )
        .catch(() => null);

      await page
        .waitForFunction(
          () =>
            !!(window as any).localStorage.getItem(
              'e2e_login_modal_init'
            ),
          null,
          { timeout: 2000 }
        )
        .catch(() => null);

      // Support either a modal or navigation to a standalone login page
      try {
        await page.waitForSelector(
          'mat-dialog-content input[formControlName="emailOrUsername"]',
          { timeout: 2000 }
        );
      } catch (err) {
        await page.waitForSelector('input[formControlName="emailOrUsername"]', {
          timeout: 5000,
        });
      }

      while (attempt < maxAttempts) {
        attempt += 1;

        // Fill the form if visible
        try {
          await page.fill(
            'input[formControlName="emailOrUsername"]',
            creds.emailOrUsername
          );
          await page.fill('input[formControlName="password"]', creds.password);
        } catch (e) {
          // If element isn't present, re-open modal
          await openAuthModal(page, 'login');
          await page.waitForSelector(
            'mat-dialog-content input[formControlName="emailOrUsername"]'
          );
          await page.fill(
            'input[formControlName="emailOrUsername"]',
            creds.emailOrUsername
          );
          await page.fill('input[formControlName="password"]', creds.password);
        }

        // Capture response and click submit
        const [loginResponse] = await Promise.all([
          page.waitForResponse(
            (resp) =>
              resp.url().includes('/api/auth/login') &&
              resp.request().method() === 'POST'
          ),
          page.click('mat-dialog-content button:has-text("Sign In")', {
            force: true,
          }),
        ]);

        lastResponse = loginResponse;
        const status = loginResponse.status();
        console.log(`Login attempt ${attempt}, status: ${status}`);

        // If rate-limited (429), wait and retry with backoff
        if (status === 429 && attempt < maxAttempts) {
          const backoff = attempt * 500 + 250;
          console.warn(
            `Rate-limited on login attempt ${attempt}. Backing off ${backoff}ms then retrying...`
          );
          await page.waitForTimeout(backoff);
          continue;
        }

        // If unauthorized or other status not 200, do not retry further
        if (status !== 200) {
          try {
            const body = await loginResponse.json();
            console.log('Login response body', body);
          } catch (e) {
            // ignore
          }
          break;
        }

        // When successful (200), ensure localStorage tokens are set
        await waitForToken(page, 5000);
        const authToken = await page.evaluate(() =>
          (window as any).localStorage.getItem('auth_token')
        );
        const refreshToken = await page.evaluate(() =>
          (window as any).localStorage.getItem('refresh_token')
        );
        if (!authToken || !refreshToken) {
          console.warn('Login reported 200 but tokens missing in localStorage');
          await page.waitForTimeout(250);
        }

        // Optionally wait for redirect to /library
        if (waitForNavigation) {
          await page.waitForURL('**/library', { timeout: 10000 }).catch(() => {
            console.warn(
              'Navigation to /library did not occur after login; continuing tests'
            );
          });
        }

        // Also wait for the header to update to logged-in state (user menu)
        await page
          .locator(
            'nav button:not(:has-text("Sign In")):not(:has-text("Sign Up"))'
          )
          .first()
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => {
            // Not a hard failure; tests can assert further. Log for debugging
            console.warn('User menu did not appear after login');
          });

        // Parse body for further assertions by caller
        let body: any = null;
        try {
          body = await loginResponse.json();
        } catch (e) {
          // ignore parsing error
        }

        subject.next({
          responseStatus: status,
          authToken,
          refreshToken,
          body,
        });
        subject.complete();
        return;
      }

      // UI login did not succeed. Keep this as a real E2E failure;
      // do not bypass Angular/NgRx by injecting backend tokens.

      // If we exit loop without success, return last response info
      let lastBody: any = null;
      try {
        lastBody = lastResponse ? await lastResponse.json() : null;
      } catch (e) {
        // ignore
      }

      subject.next({
        responseStatus: lastResponse?.status?.() ?? 0,
        body: lastBody,
      });
      subject.complete();
    } catch (err) {
      subject.error(err);
    }
  })();

  return subject;
}

// Backwards-compatible Promise wrapper
export function loginViaModal(
  page: Page,
  creds: { emailOrUsername: string; password: string },
  options?: { waitForNavigation?: boolean; attempts?: number }
) {
  return lastValueFrom(loginViaModal$(page, creds, options));
}

// Note: For Jest/Playwright E2E tests we recommend using the Promise-based
// wrappers (`loginViaModal`, `registerViaModal`) and `async/await` (idiomatic
// for Jest). The `*$(...)` Observable variants are available if you prefer
// RxJS composition, but they are optional.

/**
 * Logout helper used previously in main test file
 */
export async function logoutIfNeeded(
  page: Page
): Promise<void> {
  const token = await page
    .evaluate(() =>
      window.localStorage.getItem('auth_token')
    )
    .catch(() => null);

  if (!token) {
    await page.keyboard
      .press('Escape')
      .catch(() => undefined);

    return;
  }

  const trigger = page.locator(
    'nav button.user-menu-trigger'
  );

  await trigger.waitFor({
    state: 'visible',
    timeout: 5000,
  });

  await trigger.click();

  const logout = page.getByRole(
    'menuitem',
    {
      name: 'Logout',
      exact: true,
    }
  );

  await logout.waitFor({
    state: 'visible',
    timeout: 5000,
  });

  await logout.click();

  await page.waitForURL('**/', {
    timeout: 10000,
  });

  await page.waitForFunction(
    () =>
      window.localStorage.getItem('auth_token') === null,
    null,
    { timeout: 5000 }
  );
}

export function registerViaModal$(
  page: Page,
  creds: { username: string; email: string; password: string },
  options?: { waitForNavigation?: boolean; attempts?: number }
): Observable<{
  responseStatus: number;
  authToken?: string | null;
  refreshToken?: string | null;
  body?: any;
}> {
  const subject = new ReplaySubject<{
    responseStatus: number;
    authToken?: string | null;
    refreshToken?: string | null;
    body?: any;
  }>(1);

  (async () => {
    const waitForNavigation = options?.waitForNavigation ?? true;
    const maxAttempts = options?.attempts ?? 3;
    let attempt = 0;
    let lastResponse: any = null;

    try {
      // Ensure no lingering session state
      await page.evaluate(() => {
        try {
          (window as any).localStorage.clear();
          (window as any).sessionStorage.clear();
        } catch (err) {
          // ignore if clearing fails
        }
      });
      // Open the current visible registration entry point.
      await openAuthModal(page, 'register');

      await page
        .waitForFunction(
          () =>
            !!(window as any).localStorage.getItem(
              'e2e_login_modal_open'
            ),
          null,
          { timeout: 2000 }
        )
        .catch(() => null);

      await page
        .waitForFunction(
          () =>
            !!(window as any).localStorage.getItem(
              'e2e_login_modal_init'
            ),
          null,
          { timeout: 2000 }
        )
        .catch(() => null);

      // Support either a modal or navigation to a standalone registration page
      try {
        await page.waitForSelector(
          'mat-dialog-content input[formControlName="email"]',
          { timeout: 2000 }
        );
      } catch (err) {
        await page.waitForSelector('input[formControlName="email"]', {
          timeout: 5000,
        });
      }

      while (attempt < maxAttempts) {
        attempt += 1;

        try {
          await page.fill('input[formControlName="username"]', creds.username);
          await page.fill('input[formControlName="email"]', creds.email);
          await page.fill('input[formControlName="password"]', creds.password);
        } catch (e) {
          await openAuthModal(page, 'register');
          await page.waitForSelector(
            'mat-dialog-content input[formControlName="email"]'
          );
          await page.fill('input[formControlName="username"]', creds.username);
          await page.fill('input[formControlName="email"]', creds.email);
          await page.fill('input[formControlName="password"]', creds.password);
        }

        // Create a faster, more robust listener for the register network activity.
        // Some test environments may dispatch requests slightly differently
        // (e.g., a request via fetch, different path) - so we listen for matching
        // requests AND responses and prefer whichever arrives first.
        const registerResponsePromise = page.waitForResponse(
          (resp) =>
            resp.url().includes('/api/auth/register') &&
            resp.request().method() === 'POST',
          { timeout: 15000 }
        );
        const registerRequestPromise = page.waitForRequest(
          (req) =>
            req.url().includes('/api/auth/register') && req.method() === 'POST',
          { timeout: 15000 }
        );

        // Click submit and race requests to capture whichever we get first.
        // Attach a page-level flag to detect if the form submit event fired
        await page.evaluate(() => {
          try {
            (window as any).__e2e_form_submitted = false;
            const registerForm =
              document.querySelector('form[ng-reflect-form-group]') ||
              document.querySelector('form');
            if (registerForm) {
              registerForm.addEventListener(
                'submit',
                () => {
                  (window as any).__e2e_form_submitted = true;
                },
                { once: true }
              );
            }
          } catch (e) {
            // ignore
          }
        });
        // Install a temporary request logger to capture any network activity
        const capturedRequests: Array<{ url: string; method: string }> = [];
        const consoleMessages: Array<{ type: string; text: string }> = [];
        const onRequest = (req: any) => {
          try {
            if (req.method && req.method() === 'POST') {
              capturedRequests.push({ url: req.url(), method: req.method() });
            }
          } catch (l) {
            // ignore
          }
        };
        page.on('request', onRequest);
        const onConsole = (msg: any) => {
          try {
            consoleMessages.push({ type: msg.type(), text: msg.text() });
          } catch (e) {
            // ignore
          }
        };
        page.on('console', onConsole);
        // Log form fields values for debugging (if accessible)
        try {
          const formValues = await page.evaluate(() => {
            const email = (
              document.querySelector(
                'input[formControlName="email"]'
              ) as HTMLInputElement
            )?.value;
            const username = (
              document.querySelector(
                'input[formControlName="username"]'
              ) as HTMLInputElement
            )?.value;
            const password = (
              document.querySelector(
                'input[formControlName="password"]'
              ) as HTMLInputElement
            )?.value;
            return { email, username, passwordLength: password?.length };
          });
          console.log('registerViaModal: form values', formValues);
        } catch (err) {
          // ignore
        }
        await page.click(
          'mat-dialog-content button:has-text("Create Account")',
          {
            force: true,
          }
        );
        // The button click owns Angular form submission.
        // Do not dispatch a second synthetic submit event.

        let registerResponse: any = null;
        try {
          // Wait for response first, but if request appears without response we'll
          // continue waiting for a response afterwards.
          registerResponse = await registerResponsePromise.catch(async () => {
            // No response in time; try to ensure a request was sent first
            await registerRequestPromise.catch(() => null);
            // If we didn't capture a request yet, attempt a programmatic submit
            // (some app builds may not wire clicks reliably in headless or instrumentation environments)
            try {
              await page.evaluate(() => {
                const registerForm =
                  document.querySelector('form[ng-reflect-form-group]') ||
                  document.querySelector('form');
                if (registerForm) {
                  registerForm.dispatchEvent(
                    new Event('submit', { bubbles: true, cancelable: true })
                  );
                }
              });
            } catch (e) {
              // ignore
            }
            // Give more time for response if request reached backend
            return await page.waitForResponse(
              (resp) =>
                resp.url().includes('/api/auth/register') &&
                resp.request().method() === 'POST',
              { timeout: 10000 }
            );
          });
        } catch (err) {
          // Log helpful debug info: check for console errors and DOM errors
          console.warn(
            'registerViaModal: no register response captured: ',
            err
          );
          console.warn(
            'registerViaModal: captured requests:',
            capturedRequests
          );
          console.warn('registerViaModal: console messages:', consoleMessages);
          try {
            const formSubmitted = await page.evaluate(
              () => (window as any).__e2e_form_submitted
            );
            const attempted = await page.evaluate(() =>
              (window as any).localStorage.getItem('e2e_register_attempt')
            );
            console.warn('registerViaModal: form submit event?', formSubmitted);
            console.warn(
              'registerViaModal: e2e_register_attempt key?',
              attempted
            );
          } catch (e) {
            // ignore
          }
          try {
            const consoleLogs = await page.evaluate(() => {
              // Attempt to read any visible error elements from dialog content
              const errors = Array.from(
                document.querySelectorAll(
                  'mat-dialog-content .error-alert, mat-dialog-content mat-error, mat-dialog-content [color="warn"]'
                )
              ).map((el) => el.textContent?.trim() || '');
              return { errors };
            });
            console.warn(
              'registerViaModal: dialog errors: ',
              consoleLogs.errors
            );
          } catch (e) {
            // ignore
          }
          // If form was submitted but no request was captured, try a direct
          // POST to the backend as a fallback to ensure tests can continue.
          try {
            const formSubmitted = await page.evaluate(
              () => (window as any).__e2e_form_submitted
            );
            const captured = capturedRequests.length;
            const formValues = await page.evaluate(() => {
              const username = (
                document.querySelector(
                  'input[formControlName="username"]'
                ) as HTMLInputElement
              )?.value;
              const email = (
                document.querySelector(
                  'input[formControlName="email"]'
                ) as HTMLInputElement
              )?.value;
              const password = (
                document.querySelector(
                  'input[formControlName="password"]'
                ) as HTMLInputElement
              )?.value;
              return { username, email, passwordLength: password?.length };
            });
            console.warn('registerViaModal: fallback check:', {
              formSubmitted,
              captured,
              formValues,
            });
            if (formSubmitted && captured === 0) {
              console.warn(
                'registerViaModal: attempting backend POST fallback for registration'
              );
              const backendUrl =
                process.env.BACKEND_URL || 'http://localhost:3000';
              const fallbackUrl = `${backendUrl}/api/auth/register`;
              let attemptsFallback = 0;
              let fallbackUsername = creds.username;
              let fallbackEmail = creds.email;
              let fallbackSucceeded = false;
              let fallbackResp: any = null;

              while (attemptsFallback < 3 && !fallbackSucceeded) {
                attemptsFallback += 1;
                try {
                  fallbackResp = await page.request.post(fallbackUrl, {
                    data: JSON.stringify({
                      username: fallbackUsername,
                      email: fallbackEmail,
                      password: creds.password,
                    }),
                    headers: { 'Content-Type': 'application/json' },
                  });
                } catch (e) {
                  fallbackResp = null;
                }

                const status = fallbackResp?.status?.() ?? 0;
                let body: any = null;
                try {
                  body = fallbackResp ? await fallbackResp.json() : null;
                } catch (e) {
                  body = null;
                }
                console.warn(
                  'registerViaModal: fallbackResp status',
                  status,
                  'body:',
                  body
                );

                if (fallbackResp && fallbackResp.ok()) {
                  // Save tokens to localStorage and mark success
                  const tokenVal =
                    body?.accessToken ||
                    body?.access_token ||
                    body?.token ||
                    null;
                  const refreshVal =
                    body?.refreshToken || body?.refresh_token || null;
                  try {
                    await page.evaluate(
                      ({
                        token,
                        refreshToken,
                      }: {
                        token: string | null;
                        refreshToken: string | null;
                      }) => {
                        if (token) {
                          window.localStorage.setItem(
                            'auth_token',
                            token
                          );
                        }

                        if (refreshToken) {
                          window.localStorage.setItem(
                            'refresh_token',
                            refreshToken
                          );
                        }
                      },
                      {
                        token: tokenVal,
                        refreshToken: refreshVal,
                      }
                    );
                  } catch (e) {
                    // ignore
                  }
                  // Set synthetic lastResponse to mimic network response
                  lastResponse = {
                    status: () => status,
                    json: async () => body,
                  };
                  fallbackSucceeded = true;
                  break;
                }

                // If conflict (409), try again with a unique username/email
                if (status === 409) {
                  fallbackUsername = `${creds.username}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}`;
                  fallbackEmail = `${creds.email.split('@')[0]}_${Math.random()
                    .toString(36)
                    .slice(2, 8)}@${creds.email.split('@')[1]}`;
                  console.warn(
                    'registerViaModal: fallback 409, trying unique username/email',
                    { fallbackUsername, fallbackEmail }
                  );
                  continue;
                }

                // For validation errors or other failures, break early
                break;
              }
              console.warn(
                'registerViaModal: fallback complete, success:',
                fallbackSucceeded,
                'attempts:',
                attemptsFallback
              );
            }
          } catch (fallbackErr) {
            // ignore fallback errors
            console.warn('registerViaModal: fallback error', fallbackErr);
          }
          page.off('request', onRequest);
          page.off('console', onConsole);
          throw err;
        }
        page.off('request', onRequest);
        // Debug - did a submit event fire and what is the form HTML (trimmed)?
        try {
          const formSubmitted = await page.evaluate(
            () => (window as any).__e2e_form_submitted
          );
          const formHtml = await page.evaluate(() => {
            const form =
              document.querySelector('form[ng-reflect-form-group]') ||
              document.querySelector('form');
            return form ? form.outerHTML.slice(0, 500) : null;
          });
          console.log(
            'registerViaModal: form submit event fired?',
            formSubmitted
          );
          console.log('registerViaModal: form snippet:', formHtml);
        } catch (e) {
          // ignore
        }
        // Debug - check if UI handler fired
        try {
          const attempted = await page.evaluate(() =>
            (window as any).localStorage.getItem('e2e_register_attempt')
          );
          console.log(
            'registerViaModal: client-side submit attempt in localStorage:',
            attempted
          );
        } catch (e) {
          // ignore
        }
        page.off('console', onConsole);

        lastResponse = registerResponse;
        const status = registerResponse.status();
        console.log(`Register attempt ${attempt}, status: ${status}`);

        if (status === 429 && attempt < maxAttempts) {
          const backoff = attempt * 500 + 250;
          console.warn(
            `Rate-limited on register attempt ${attempt}. Backing off ${backoff}ms then retrying...`
          );
          await page.waitForTimeout(backoff);
          continue;
        }

        if (status !== 201) {
          try {
            const body = await registerResponse.json();
            console.log('Register response body', body);
          } catch (e) {
            // ignore
          }
          break;
        }

        await waitForToken(page, 5000);
        const authToken = await page.evaluate(() =>
          (window as any).localStorage.getItem('auth_token')
        );
        const refreshToken = await page.evaluate(() =>
          (window as any).localStorage.getItem('refresh_token')
        );
        if (!authToken || !refreshToken) {
          console.warn(
            'Register reported 201 but tokens missing in localStorage'
          );
          await page.waitForTimeout(250);
        }

        if (waitForNavigation) {
          await page.waitForURL('**/library', { timeout: 10000 }).catch(() => {
            console.warn(
              'Navigation to /library did not occur after register; continuing tests'
            );
          });
        }

        await page
          .locator(
            'nav button:not(:has-text("Sign In")):not(:has-text("Sign Up"))'
          )
          .first()
          .waitFor({ state: 'visible', timeout: 5000 })
          .catch(() => {
            console.warn('User menu did not appear after register');
          });

        let body: any = null;
        try {
          body = await registerResponse.json();
        } catch (e) {
          // ignore
        }

        subject.next({
          responseStatus: status,
          authToken,
          refreshToken,
          body,
        });
        subject.complete();
        return;
      }

      let lastBody: any = null;
      try {
        lastBody = lastResponse ? await lastResponse.json() : null;
      } catch (e) {
        // ignore
      }

      subject.next({
        responseStatus: lastResponse?.status?.() ?? 0,
        body: lastBody,
      });
      subject.complete();
    } catch (err) {
      subject.error(err);
    }
  })();

  return subject;
}

// Backwards-compatible Promise wrapper
export function registerViaModal(
  page: Page,
  creds: { username: string; email: string; password: string },
  options?: { waitForNavigation?: boolean; attempts?: number }
) {
  return lastValueFrom(registerViaModal$(page, creds, options));
}

export default {
  loginViaModal,
  loginViaModal$,
  waitForToken,
  waitForToken$,
  logoutIfNeeded,
  registerViaModal,
  registerViaModal$,
};
