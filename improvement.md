# SquareOne — improvement backlog

**App snapshot:** SquareOne is a **neo-brutalist** expense-sharing app: friends, transactions, settle-up, history, and **Recharts** on the dashboard. Auth and data use **Supabase** (Postgres + realtime). **Guest mode** persists friends/transactions in **localStorage** (`utils/guestStorage.ts`). Stack: **React 19**, **Vite 6**, **TypeScript**, **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind via CDN** in `index.html`, **Lucide**, **react-number-format**.

**Linked docs:** [README.md](./README.md), [docs/architecture.md](./docs/architecture.md), [docs/database.md](./docs/database.md), [CONTRIBUTING.md](./CONTRIBUTING.md), [llms.txt](./llms.txt).

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [x] **1.** Invalid `/friends/:id` and `/settle/:id` must not fall back to another friend’s data  
- [x] **2.** Guest mode: local-only persistence and no Supabase mutations for `user.id === 'guest'`  
- [ ] **3.** Auth redirect URLs must work with **HashRouter** (OAuth **and** email confirmation `emailRedirectTo`)  
- [x] **4.** Transaction amount validation rejects incomplete expressions (e.g. `5+`)  
- [ ] **5.** Supabase friends/transactions **query errors** must not look like an empty ledger (surface retry / message)  
- [x] **6.** `tsc --noEmit` clean and `vite-env.d.ts` for `import.meta.env`  
- [x] **7.** `index.css` linked from `index.html` exists (`public/index.css`)  
- [ ] **8.** Address `npm audit` (react-router-dom / rollup, etc.) with tested upgrades  
- [ ] **9.** Code-split heavy routes (e.g. Recharts `Home`, modals-heavy screens) to shrink initial JS  
- [x] **10.** `package.json` includes `typecheck` (`tsc --noEmit`)  
- [x] **11.** Remove unused `vite.config` `define` for client-injected API keys  
- [ ] **12.** Harden `loadUserProfile` after `Promise.race` timeout (ignore stale results / abort if supported)  
- [ ] **13.** Relax `index.html` viewport (`user-scalable` / `maximum-scale`) for accessibility  
- [ ] **14.** Refresh **llms.txt** guest description (localStorage, not “fallback only”)  
- [ ] **15.** (Optional) Replace Tailwind CDN with PostCSS build for production parity  
- [ ] **16.** (Optional) Enable TypeScript `strict` incrementally  
- [ ] **17.** **NeoModal** accessibility: `role="dialog"`, focus trap, Escape, labelled close  
- [ ] **18.** **Vitest** (or similar) unit tests for `calculator`, `validation`, `calculations`  
- [ ] **19.** (Optional) **ESLint** flat config for React/TS/hooks (enable incrementally)  

---

## Improvement proposals

### 1. HashRouter vs Supabase auth redirects

| Field | Detail |
|--------|--------|
| **What** | `signUp` uses `emailRedirectTo: \`${window.location.origin}/dashboard\``; Google/Apple use `redirectTo` the same. The SPA routes live under `/#/...`. Depending on hosting and Supabase Site URL config, return paths can miss the hash route. |
| **Why** | OAuth and email-confirm users must land in the authenticated app; broken redirects block access and inflate support cost. |
| **How** | Use hashes in allowed redirect URLs, e.g. `window.location.origin + '/#/dashboard'`, and register matching URLs in the Supabase dashboard. Alternatively migrate to `BrowserRouter` with static hosting fallback to `index.html`. |
| **Logic** | Supabase Auth `redirectTo` / `emailRedirectTo` + project URL allowlist. |
| **UI** | Successful landing on dashboard (no new components). |
| **Placement** | `context/AuthContext.tsx` (`signUp`, `signInWithGoogle`, `signInWithApple`). |
| **Conflicts** | Dev (`localhost:3000`) vs production origins—document both in README. |

---

### 2. Silent failure when friends or transactions queries error

| Field | Detail |
|--------|--------|
| **What** | In `loadData`, `friendsError` / `transactionsError` are only `console.warn`’d; the UI shows **empty** friends/transactions, which reads like “no activity” rather than “couldn’t load.” |
| **Why** | Wrong empty state undermines trust for balances and settle-up; users may misconfigure RLS or schema without feedback. |
| **How** | If either query returns an error, set `error` (or a dedicated `loadWarning`) in context, show a **Neo** banner or full-page retry on `Home` / `Friends` / `History` with `refetch`, and avoid overwriting good partial data if one of two queries succeeds (optional follow-up). |
| **Logic** | `AppContext` `loadData`; existing `error` + `refetch` already exposed; `Home` currently `throw error` for some paths—align so recoverable load errors use inline retry instead of only ErrorBoundary. |
| **UI** | Banner with `NeoButton` “Retry” + short copy; optional toast on transient recovery. |
| **Placement** | `context/AppContext.tsx`, `screens/Home.tsx`, possibly `Friends.tsx` / `History.tsx` if they should not depend only on dashboard. |
| **Conflicts** | Today “table may not exist” is swallowed—decide whether dev-only messaging vs user-safe generic error. |

---

### 3. Dependency security upgrades

| Field | Detail |
|--------|--------|
| **What** | `npm audit` reports issues (e.g. `react-router` / `react-router-dom`, `rollup` via Vite). |
| **Why** | Reduces known vulnerability exposure; advisories include CSRF/XSS classes (severity varies for static Hash SPA, but upgrades remain prudent). |
| **How** | `npm audit fix` or targeted minor bumps; run `npm run build`, `npm run typecheck`, smoke-test auth, navigation, settle-up. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `package.json` / lockfile. |
| **Conflicts** | Major bumps may need router API adjustments—prefer patched minors first. |

---

### 4. Route-level code splitting

| Field | Detail |
|--------|--------|
| **What** | `App.tsx` eagerly imports all screens; production chunk stays large (Recharts on `Home`, Framer on multiple views). |
| **Why** | Faster first paint on mobile matches on-the-go expense use. |
| **How** | `React.lazy` for `Home`, `History`, `FriendDetail`, `SettleUp`, `AddTransaction`, `Profile`; wrap routes in `Suspense` with `LoadingSpinner` / skeletons; optional `manualChunks` in `vite.config.ts`. |
| **Logic** | None if split is import-only. |
| **UI** | Loading fallbacks consistent with existing neo styling. |
| **Placement** | `App.tsx`; optionally `vite.config.ts`. |
| **Conflicts** | Ensure `ErrorBoundary` still wraps lazy trees as intended. |

---

### 5. Profile load: timeout and stale completion

| Field | Detail |
|--------|--------|
| **What** | `loadUserProfile` races the Supabase query against a timeout; the query is not cancelled and may resolve after fallback is applied. |
| **Why** | Prevents rare state flicker or duplicate work if the flow grows (e.g. writes keyed off profile). |
| **How** | Pass `AbortSignal` if the Supabase client version supports it, or use a monotonically increasing request id / `mounted` guard and ignore late responses. |
| **Logic** | `context/AuthContext.tsx` profile fetch only. |
| **UI** | None (fallback profile already exists). |
| **Placement** | `context/AuthContext.tsx`. |
| **Conflicts** | Verify `@supabase/supabase-js` API for abort/cancel. |

---

### 6. Viewport accessibility

| Field | Detail |
|--------|--------|
| **What** | `index.html` sets `maximum-scale=1` and `user-scalable=0`. |
| **Why** | Zoom restrictions hurt low-vision users and common a11y expectations. |
| **How** | Use a standard viewport allowing user scaling; verify no layout breaks on small screens. |
| **Logic** | N/A |
| **UI** | Browser zoom behavior only. |
| **Placement** | `index.html`. |
| **Conflicts** | Possible pinch-zoom on fixed layouts—spot-check `Home` / modals. |

---

### 7. llms.txt accuracy (guest mode)

| Field | Detail |
|--------|--------|
| **What** | `llms.txt` still frames guest mode as a loose “fallback” rather than **localStorage-backed** CRUD aligned with `guestStorage` / `AppContext`. |
| **Why** | AI and contributor context should match runtime behavior to avoid wrong edits (e.g. reintroducing Supabase writes for guests). |
| **How** | One short paragraph: guest = no session, data in `squareone_guest_data`, cleared when a real session attaches (`clearGuestLocalData`). |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `llms.txt`. |
| **Conflicts** | None. |

---

### 8. (Optional) Tailwind production pipeline

| Field | Detail |
|--------|--------|
| **What** | Tailwind loads from CDN in `index.html`. |
| **Why** | Build step gives tree-shaking, pinned versions, and predictable offline builds. |
| **How** | Add `tailwindcss` + PostCSS, extract theme extensions from the inline script into `tailwind.config`, remove CDN script after parity check. |
| **Logic** | N/A |
| **UI** | Must preserve neo palette, shadows, `darkMode: 'class'`. |
| **Placement** | `index.html`, new config files, `package.json`. |
| **Conflicts** | Full visual regression pass required. |

---

### 9. (Optional) Stricter TypeScript

| Field | Detail |
|--------|--------|
| **What** | `strict` is not enabled in `tsconfig.json`. |
| **Why** | Stronger guarantees for money-related types over time. |
| **How** | After keeping `tsc` green, enable `strict` or individual flags and fix surfaced errors file by file. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `tsconfig.json`, then call sites across `context/`, `utils/`, `screens/`. |
| **Conflicts** | Can be large—schedule deliberately. |

---

### 10. NeoModal accessibility

| Field | Detail |
|--------|--------|
| **What** | `NeoModal` uses a fixed overlay but no `role="dialog"`, `aria-modal`, `aria-labelledby`, focus trap, or Escape-to-close. |
| **Why** | Modals are used for money-adjacent confirmations and forms; keyboard and screen-reader users need predictable behavior. |
| **How** | Add dialog semantics; trap focus while open and restore on close; listen for `Escape`; ensure close button has accessible name. Prefer a small headless primitive or `react-focus-lock` if you want to avoid hand-rolling. |
| **Logic** | N/A |
| **UI** | `components/NeoModal.tsx` and consumers (`EditFriendModal`, `HowToUseModal`, etc.). |
| **Placement** | `components/NeoModal.tsx`; verify all modal call sites. |
| **Conflicts** | Nested modals (if any)—define stacking or disallow nesting. |

---

### 11. Unit tests for money math

| Field | Detail |
|--------|--------|
| **What** | No test runner in `package.json`; `calculator`, `validation`, and `calculations` are critical and already refined once for expression completeness. |
| **Why** | Prevents regressions in balances, settle-up caps, and amount parsing. |
| **How** | Add **Vitest** + small suites: `isValidAmount` / `evaluateExpression` / `isCompleteNumericExpression`; `calculateFriendBalance`, `calculateNetBalance`, settlement edge cases. Run in CI via `npm test`. |
| **Logic** | Pure functions in `utils/` — easy to test. |
| **UI** | N/A |
| **Placement** | `package.json`, `vitest.config.ts`, `utils/*.test.ts`. |
| **Conflicts** | None; keep tests fast and deterministic. |

---

### 12. (Optional) ESLint

| Field | Detail |
|--------|--------|
| **What** | No ESLint script; only `typecheck` gates types. |
| **Why** | Catches hooks dependency mistakes and inconsistent patterns in growing UI code. |
| **How** | Flat config with `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`; start with warn-only or limited paths. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | New `eslint.config.js`, `package.json` scripts. |
| **Conflicts** | Initial noise—enable incrementally. |

---

## Signals reviewed

| Signal | Finding |
|--------|---------|
| **TODO / FIXME** | None in `*.ts` / `*.tsx`. |
| **Commented-out code** | No large dead blocks; normal JSX section comments and inline notes only. |
| **`npm audit`** | Run `npm audit` before releases; fixes available at time of last check (router/rollup). |
| **Context `error`** | Set on thrown load failures; partial Supabase errors still silent (see proposal **2**). |

---

*Last updated: 2026-03-20 — cross-checked repo: guest storage, friend/settle guards, calculator validation, `public/index.css`, `typecheck`, slim `vite.config`, README structure; merged new items (redirects+email, load errors, modal a11y, tests, llms guest line).*
