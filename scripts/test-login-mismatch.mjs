/**
 * Login form role-mismatch behaviour, driven through a real DOM.
 *
 * Renders the shipped `LoginScreen` in jsdom and types into it, so the checks
 * below assert what a user actually sees and can click:
 *
 *   1. a mismatch is caught explicitly and rendered inline — never as the
 *      generic "Unable to sign in. Please try again." toast;
 *   2. the inline box carries the exact portal copy plus the
 *      "Switch to Employer Portal" action;
 *   3. Login is disabled while the entered email is flagged as the opposite
 *      role, and submitting anyway switches tabs instead of signing in.
 *
 *   npm run test:login
 */
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'https://jobs.example.com/login',
  pretendToBeVisual: true,
});

// React and the component both expect browser globals at import time.
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node exposes `navigator` as a getter-only global, so it has to be redefined.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
  writable: true,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.Event = dom.window.Event;
globalThis.PopStateEvent = dom.window.PopStateEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { LoginScreen } = await import('../src/components/auth/LoginScreen.tsx');
const { PortalRoleMismatchError } = await import('../src/lib/authErrors.ts');

const EMPLOYER_EMAIL = 'owner@glowsalon.com';
const MISMATCH_COPY =
  'This email is already registered as an Employer. Please sign in through the Employer portal.';
const checks = [];

async function check(name, fn) {
  await fn();
  checks.push(name);
}

const container = document.getElementById('root');
/** Recreated per scenario: re-rendering into the same root would keep state. */
let root = null;

/** React ignores a plain `value = …`; the native setter keeps it controlled. */
function typeInto(selector, value) {
  const input = document.querySelector(selector);
  const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
}

const text = () => container.textContent ?? '';
const submitButton = () => [...container.querySelectorAll('button[type="submit"]')][0];
const switchButton = () =>
  [...container.querySelectorAll('button')].find((button) => /Switch to .* Portal|Go to Admin Sign In/.test(button.textContent ?? ''));
const activeTab = () =>
  [...container.querySelectorAll('button')]
    .filter((button) => /^(Job Seeker|Employer)$/.test((button.textContent ?? '').trim()))
    .find((button) => (button.className ?? '').includes('bg-white'))?.textContent?.trim();

/** Lets the 400ms debounce and any pending React work settle. */
async function settle(ms = 550) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

async function renderLogin(props) {
  // Fresh root, clean DOM, clean URL: a previous scenario's tab switch leaves
  // ?role=…&email=… behind, which the screen legitimately reads as prefill.
  if (root) {
    const previous = root;
    await act(async () => {
      previous.unmount();
    });
    root = null;
  }
  container.innerHTML = '';
  dom.window.history.replaceState({}, '', '/login');
  root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(LoginScreen, {
        onLoginSuccess: () => undefined,
        onSignUp: () => undefined,
        onForgotPassword: () => undefined,
        ...props,
      }),
    );
  });
  await settle(0);
}

// ---------------------------------------------------------------------------
// 1. Pre-submit detection: inline box, exact copy, switch action
// ---------------------------------------------------------------------------

await check('an employer email on the seeker tab renders the inline mismatch box', async () => {
  await renderLogin({ onResolvePortalRole: async () => 'employer' });
  assert.equal(submitButton().disabled, false, 'login starts enabled');
  assert.equal(switchButton(), undefined, 'no card before the email is known');

  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
  });
  await settle();

  assert.ok(text().includes(MISMATCH_COPY), `exact inline copy, got: ${text().slice(0, 400)}`);
  assert.equal(switchButton()?.textContent?.trim(), 'Switch to Employer Portal');
});

await check('the login button is disabled while the email is flagged', async () => {
  assert.equal(submitButton().disabled, true, 'submit blocked');
  assert.equal(submitButton().getAttribute('aria-disabled'), 'true');
});

await check('submitting a flagged form switches tabs instead of signing in', async () => {
  let loginCalls = 0;
  await renderLogin({
    onResolvePortalRole: async () => 'employer',
    onLoginSuccess: () => {
      loginCalls += 1;
    },
  });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
  });
  await settle();
  assert.equal(submitButton().disabled, true);

  // Enter in a field submits the form even when the button is disabled.
  await act(async () => {
    container.querySelector('form').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await settle();

  assert.equal(loginCalls, 0, 'no sign-in attempt was posted');
  assert.equal(activeTab(), 'Employer', 'the tab followed the account');
  assert.ok(!text().includes(MISMATCH_COPY), 'the card cleared with the switch');
  assert.equal(submitButton().disabled, false, 'login is usable on the right portal');
  assert.ok(
    dom.window.location.search.includes('role=employer') && dom.window.location.search.includes('email=owner%40glowsalon.com'),
    `url mirrors the switch: ${dom.window.location.search}`,
  );
});

await check('the switch button flips the tab and clears the block', async () => {
  await renderLogin({ onResolvePortalRole: async () => 'employer' });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
  });
  await settle();
  assert.equal(activeTab(), 'Job Seeker');

  await act(async () => {
    switchButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();

  assert.equal(activeTab(), 'Employer');
  assert.equal(submitButton().disabled, false);
});

await check('a seeker email on the employer tab is flagged the other way round', async () => {
  await renderLogin({ onResolvePortalRole: async () => 'seeker' });
  await act(async () => {
    // Land on the Employer tab first.
    [...container.querySelectorAll('button')]
      .find((button) => (button.textContent ?? '').trim() === 'Employer')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await act(async () => {
    typeInto('#email', 'stylist@glowsalon.com');
  });
  await settle();

  assert.ok(
    text().includes('This email is already registered as a Job Seeker. Please sign in through the Job Seeker portal.'),
    text().slice(0, 400),
  );
  assert.equal(switchButton()?.textContent?.trim(), 'Switch to Job Seeker Portal');
  assert.equal(submitButton().disabled, true);
});

await check('an unflagged email leaves the form usable', async () => {
  await renderLogin({ onResolvePortalRole: async () => null });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
  });
  await settle();

  assert.equal(switchButton(), undefined, 'no card for an unknown address');
  assert.equal(submitButton().disabled, false);
});

// ---------------------------------------------------------------------------
// 2. A mismatch returned by the sign-in call is caught explicitly
// ---------------------------------------------------------------------------

await check('a coded mismatch response renders inline, not as a generic error', async () => {
  let submitted = 0;
  await renderLogin({
    onResolvePortalRole: async () => null, // lookup unavailable: only the API knows
    onLoginSuccess: async () => {
      submitted += 1;
      throw { code: '42501', message: 'PORTAL_ROLE_MISMATCH:employer' };
    },
  });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
    typeInto('#password', 'hunter2hunter2');
  });
  await settle();
  assert.equal(submitButton().disabled, false, 'nothing was flagged before submit');

  await act(async () => {
    submitButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();

  assert.equal(submitted, 1, 'the sign-in was attempted');
  assert.ok(text().includes(MISMATCH_COPY), `inline copy, got: ${text().slice(0, 400)}`);
  assert.ok(!text().includes('PORTAL_ROLE_MISMATCH'), 'raw code never reaches the user');
  assert.ok(!text().includes('Unable to sign in. Please try again.'), 'no generic fallback copy');
  assert.equal(switchButton()?.textContent?.trim(), 'Switch to Employer Portal');
  assert.equal(submitButton().disabled, true, 'blocked until the user switches');
});

await check('a prose "already registered as" error also renders the switch action', async () => {
  await renderLogin({
    onResolvePortalRole: async () => null,
    onLoginSuccess: async () => {
      throw new Error(MISMATCH_COPY);
    },
  });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
    typeInto('#password', 'hunter2hunter2');
  });
  await settle();
  await act(async () => {
    submitButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();

  assert.ok(text().includes(MISMATCH_COPY), text().slice(0, 400));
  assert.equal(switchButton()?.textContent?.trim(), 'Switch to Employer Portal', 'action, not a dead sentence');
});

await check('a structured mismatch from the app keeps the same inline card', async () => {
  await renderLogin({
    onResolvePortalRole: async () => null,
    onLoginSuccess: async () => {
      throw new PortalRoleMismatchError({
        email: EMPLOYER_EMAIL,
        requestedRole: 'seeker',
        existingRole: 'employer',
      });
    },
  });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
    typeInto('#password', 'hunter2hunter2');
  });
  await settle();
  await act(async () => {
    submitButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();

  assert.ok(text().includes(MISMATCH_COPY), text().slice(0, 400));
  assert.equal(switchButton()?.textContent?.trim(), 'Switch to Employer Portal');
});

await check('an unrelated failure still shows the ordinary error text', async () => {
  await renderLogin({
    onResolvePortalRole: async () => null,
    onLoginSuccess: async () => {
      throw new Error('Network unreachable.');
    },
  });
  await act(async () => {
    typeInto('#email', EMPLOYER_EMAIL);
    typeInto('#password', 'hunter2hunter2');
  });
  await settle();
  await act(async () => {
    submitButton().dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  });
  await settle();

  assert.ok(text().includes('Network unreachable.'), text().slice(0, 400));
  assert.equal(switchButton(), undefined, 'no portal switch for a non-mismatch');
  assert.equal(submitButton().disabled, false, 'the user can retry');
});

if (root) {
  const last = root;
  await act(async () => {
    last.unmount();
  });
}

console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
