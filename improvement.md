# SquareOne — improvement backlog

**App snapshot:** SquareOne is a neo-brutalist expense-sharing app: friends, transactions, settle-up, and history with Recharts on the dashboard, backed by **Supabase** (auth + Postgres + realtime). Stack: **React 19**, **Vite 6**, **TypeScript**, **React Router 7** (`HashRouter`), **Framer Motion**, **Tailwind via CDN** in `index.html`.

This file merges a fresh codebase review with the prior audit. **Recently resolved in code:** checklist items **1** (friend/settle routes), **2** (guest localStorage + no Supabase mutations for guest), and **4** (incomplete amount expressions). See **Status** rows under proposals 1, 2, and 4 below.

---

## Priority checklist

Ranked by **user-facing impact → implementation effort → regression risk** (highest priority first).

- [x] **1.** Invalid `/friends/:id` and `/settle/:id` must not fall back to another friend’s data  
- [x] **2.** Guest mode: either real local-only data + writes, or remove/hide the flow  
- [ ] **3.** OAuth return URLs must work with `HashRouter` (Google / Apple sign-in)  
- [x] **4.** Transaction amount validation must reject incomplete expressions (e.g. `5+`)  
- [x] **5.** Fix all `tsc --noEmit` errors and add `vite-env.d.ts` for `import.meta.env`  
- [x] **6.** Fix missing `/index.css` (add file or remove the `<link>`)  
- [ ] **7.** Address `npm audit` (react-router / react-router-dom, rollup) with tested upgrades  
- [ ] **8.** Code-split heavy routes (Recharts, large screens) to shrink the main bundle  
- [x] **9.** Add npm scripts for `typecheck` (and optionally ESLint) for repeatable quality gates  
- [x] **10.** Remove or document `vite.config.ts` `define` for `GEMINI_API_KEY` / `API_KEY` (unused = footgun)  
- [ ] **11.** Harden `loadUserProfile` timeout (AbortController or ignore stale results)  
- [ ] **12.** Relax `index.html` viewport (`user-scalable`) for accessibility  
- [x] **13.** Align **README** / **llms.txt** with actual paths (no `src/`) and dev server port (3000 vs 5173)  
- [ ] **14.** (Optional) Replace Tailwind CDN with a built Tailwind/PostCSS pipeline for production  
- [ ] **15.** (Optional) Enable `strict` TypeScript incrementally after the above fixes  

---

## Improvement proposals

### 1. Invalid friend / settle routes show the wrong person

| Field | Detail |
|--------|--------|
| **What** | `FriendDetail` and `SettleUp` resolve the friend with `getFriendById(id) \|\| friends[0]`, so a bad or missing `:id` shows the **first** friend’s balance and transactions. |
| **Why** | Shared expenses require trust; showing another friend’s ledger or settlement is a serious data-privacy and UX failure relative to the app’s purpose. |
| **How** | If `!id` or `!getFriendById(id)`, render a dedicated “Friend not found” screen with `NeoButton` back to `/friends`; do **not** fall back to `friends[0]`. Optionally `Navigate` replace. |
| **Logic** | Friend resolution from `useParams().id` vs `friends[]` / `getFriendById`. |
| **UI** | Full-screen or card message consistent with Neo styling; primary action: return to friends list. |
| **Placement** | `screens/FriendDetail.tsx`, `screens/SettleUp.tsx` (top-level friend resolution). |
| **Conflicts** | Any code assuming `friend` is always defined after the first friend exists; adjust guards before `useMemo` that depend on `friend`. |
| **Status** | **Resolved** — `friend` is `getFriendById(id)` only (no `friends[0]`); not-found card with `NeoButton` → `/friends` (`replace`). |

---

### 2. Guest mode: finish local-first behavior or remove it

| Field | Detail |
|--------|--------|
| **What** | `loadData` skips Supabase and clears data for `user.id === 'guest'`; realtime is disabled. **`addTransaction`, `addFriend`, `updateFriend`, `deleteFriend`, `deleteTransaction` still call Supabase** with `user_id: 'guest'`, which is invalid UUID-wise and contradicts README’s “try without an account.” |
| **Why** | Guest mode is advertised but leaves users on an empty app or failed writes—undermines onboarding and support burden. |
| **How** | **Option A:** Guard all mutations: if `user.id === 'guest'`, persist `friends` / `transactions` in `localStorage` (namespaced key), merge in context, skip Supabase. **Option B:** Remove guest CTA from `screens/Login.tsx` and drop `signInAsGuest` until A exists. |
| **Logic** | Same domain models as today; branch on `user.id === 'guest'` in `context/AppContext.tsx` for all CRUD + initial hydrate from storage. |
| **UI** | Optional banner on dashboard: “Guest — data saved on this device only.” |
| **Placement** | `context/AppContext.tsx`, `context/AuthContext.tsx`, `screens/Login.tsx`. |
| **Conflicts** | Realtime and RLS assumptions; guest must never open Supabase channels or inserts. |
| **Status** | **Resolved (Option A)** — `utils/guestStorage.ts` (`squareone_guest_data`); guest `loadData` + all CRUD branches in `AppContext.tsx`; `clearGuestLocalData()` when a real Supabase session attaches (`AuthContext.tsx`); guest banner on `screens/Home.tsx`. |

---

### 3. OAuth redirect URLs vs HashRouter

| Field | Detail |
|--------|--------|
| **What** | `signUp` / OAuth use `redirectTo: \`${window.location.origin}/dashboard\`` and similar. With `HashRouter`, the app lives under `/#/...`; returning to `/dashboard` may land outside the SPA route depending on host/static setup. |
| **Why** | Google/Apple sign-in must return users into the authenticated app; broken redirects block core access for OAuth-first users. |
| **How** | Use redirect URLs that match deployment: e.g. `window.location.origin + '/#/dashboard'` (or switch to `BrowserRouter` + server fallback config). Register the exact URL in Supabase dashboard. |
| **Logic** | Supabase Auth `redirectTo` + site URL allowlist. |
| **UI** | None beyond successful landing on dashboard. |
| **Placement** | `context/AuthContext.tsx` (`signUp`, `signInWithGoogle`, `signInWithApple`). |
| **Conflicts** | Production vs dev origins; document both in README. |

---

### 4. Incomplete calculator expressions accepted as valid amounts

| Field | Detail |
|--------|--------|
| **What** | `evaluateExpression` can return strings ending with an operator (e.g. `"5+"`). `parseFloat("5+")` is `5`, so `isValidAmount` treats incomplete input as valid. |
| **Why** | Wrong transaction amounts break balances and settle-up—the core product promise. |
| **How** | In `isValidAmount` (or `evaluateExpression` contract), treat trailing-operator results as invalid; optionally strip and re-evaluate only when the expression is complete. Align `AddTransaction` / `AmountInput` submit validation. |
| **Logic** | `utils/calculator.ts`, `utils/validation.ts`, callers in add-transaction flow. |
| **UI** | Inline error on amount field; disable submit until valid. |
| **Placement** | `utils/validation.ts`, `utils/calculator.ts`, `components/AddTransaction/AmountInput.tsx`, `screens/SettleUp.tsx` if it parses amounts without shared validation. |
| **Conflicts** | Any UX that relied on forgiving parsing—intentionally stricter behavior. |
| **Status** | **Resolved** — `isCompleteNumericExpression()` in `calculator.ts`; `isValidAmount` uses it; `AddTransaction` shows `errors.amount`; `SettleUp` uses `isValidAmount` + `evaluateExpression` and a text amount field. |

---

### 5. TypeScript: green `tsc` and Vite env typings

| Field | Detail |
|--------|--------|
| **What** | `npx tsc --noEmit` fails: `ErrorBoundary` `this.props` (class fields + React 19 types), `React` namespace in `hooks/useForm.tsx` / `types/components.ts`, `ImportMeta.env` without `vite-env.d.ts`, `History.tsx` `Object.entries` value type as `unknown`. |
| **Why** | CI/type gates catch regressions; matches a TS-first codebase and docs. |
| **How** | Add `vite-env.d.ts` with `/// <reference types="vite/client" />`. Import `type { FormEvent } from 'react'` or `import type React from 'react'`. Type `groupedTransactions` as `Record<string, Transaction[]>` and cast entries or iterate with a typed helper. For `ErrorBoundary`: align tsconfig (`useDefineForClassFields: true` + declare `props`/`state`) or use `declare` / base class pattern per React 19 typings. |
| **Logic** | Mostly typing only; no business rule changes. |
| **UI** | N/A |
| **Placement** | New `vite-env.d.ts`, `components/ErrorBoundary.tsx`, `hooks/useForm.tsx`, `types/components.ts`, `screens/History.tsx`, optionally `tsconfig.json`. |
| **Conflicts** | `experimentalDecorators` / `useDefineForClassFields` interplay—pick one consistent class pattern. |

---

### 6. Missing `index.css`

| Field | Detail |
|--------|--------|
| **What** | `index.html` links `/index.css`; file is absent. Vite warns: unchanged at build, resolved at runtime → likely 404. |
| **Why** | Avoids broken asset requests and confusing build output. |
| **How** | Add minimal `index.css` (e.g. base resets complementing inline styles) **or** remove the `<link>` if global styles live entirely in `index.html` / Tailwind CDN. |
| **Logic** | N/A |
| **UI** | Global styles only if new rules added. |
| **Placement** | `index.html`, new `index.css` at project root (Vite default public path). |
| **Conflicts** | None. |

---

### 7. Dependency security upgrades

| Field | Detail |
|--------|--------|
| **What** | `npm audit` reports high-severity issues in `react-router` / `react-router-dom` and `rollup` (via Vite). |
| **Why** | Reduces known vulnerability exposure; Router advisories include CSRF/XSS classes (exposure varies for static `HashRouter` clients but upgrades are still prudent). |
| **How** | Run `npm audit fix` or bump to patched minors; run `build`, smoke-test routes, auth, and history. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `package.json` / lockfile. |
| **Conflicts** | Possible breaking changes across major bumps—test thoroughly. |

---

### 8. Bundle size / code splitting

| Field | Detail |
|--------|--------|
| **What** | Production build ~950 kB JS (gzip ~284 kB); Vite warns on chunk size. |
| **Why** | Faster load on mobile aligns with a social, on-the-go expense app. |
| **How** | `React.lazy` + `Suspense` for `History`, `FriendDetail`, `SettleUp`, `AddTransaction`, and/or Recharts-heavy `Home`; optional `manualChunks` in `vite.config.ts`. |
| **Logic** | None if split is route-only. |
| **UI** | Loading fallback using existing `LoadingSpinner` / skeletons. |
| **Placement** | `App.tsx` imports; `vite.config.ts`. |
| **Conflicts** | Error boundaries should wrap lazy routes if desired. |

---

### 9. npm scripts: typecheck and lint

| Field | Detail |
|--------|--------|
| **What** | No `lint` or `test` scripts; type errors are invisible until manual `tsc`. |
| **Why** | Keeps quality aligned with CONTRIBUTING and prevents drift. |
| **How** | Add `"typecheck": "tsc --noEmit"`. Optionally add ESLint (flat config) for React/TS hooks rules. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `package.json`, new eslint config if added. |
| **Conflicts** | ESLint may surface many existing issues—enable incrementally. |

---

### 10. Vite `define` for unused API keys

| Field | Detail |
|--------|--------|
| **What** | `vite.config.ts` injects `process.env.GEMINI_API_KEY` / `API_KEY` into the client bundle if referenced; no references found in app TS/TSX. |
| **Why** | Accidental future use could leak secrets into the browser bundle. |
| **How** | Remove `define` block unless a client feature needs it; if needed, use `VITE_*` only for public vars. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `vite.config.ts`. |
| **Conflicts** | None if unused. |

---

### 11. Profile load: timeout race cleanup

| Field | Detail |
|--------|--------|
| **What** | `loadUserProfile` uses `Promise.race` with a timeout; the Supabase query is not aborted and may complete later. |
| **Why** | Avoids wasted network work and rare race conditions if logic grows. |
| **How** | Use `AbortSignal` if the client supports it, or ignore results when a generation counter / `mounted` flag no longer matches. |
| **Logic** | `context/AuthContext.tsx` profile fetch. |
| **UI** | N/A (fallback profile already exists). |
| **Placement** | `context/AuthContext.tsx`. |
| **Conflicts** | Supabase JS abort support—verify version APIs. |

---

### 12. Viewport accessibility

| Field | Detail |
|--------|--------|
| **What** | `index.html` sets `maximum-scale=1` and `user-scalable=0`. |
| **Why** | Zoom restrictions hurt low-vision users and fail common a11y expectations. |
| **How** | Use a standard viewport meta allowing user scaling (remove `user-scalable=0` / `maximum-scale=1` or set inclusive values per your design policy). |
| **Logic** | N/A |
| **UI** | Browser zoom behavior only. |
| **Placement** | `index.html`. |
| **Conflicts** | Slight change to mobile pinch-zoom on fixed layouts—verify no layout breakage. |

---

### 13. Documentation accuracy (README / llms.txt)

| Field | Detail |
|--------|--------|
| **What** | README lists `src/components`, etc.; repo uses root-level `components/`, `screens/`, `context/`. README says dev on 5173; `vite.config.ts` sets `server.port: 3000`. **llms.txt** calls the app “Neumorphic” while the rest of the project describes **neo-brutalist**. |
| **Why** | Onboarding and AI-assisted edits rely on accurate structure and terminology. |
| **How** | Update paths and port; align visual description with README. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `README.md`, `llms.txt`. |
| **Conflicts** | None. |

---

### 14. (Optional) Tailwind production build

| Field | Detail |
|--------|--------|
| **What** | Tailwind is loaded from CDN in `index.html`. |
| **Why** | Build step gives tree-shaking, pinned versions, and offline-friendly builds. |
| **How** | Add `tailwindcss` + PostCSS, move config from inline script to `tailwind.config`, replace CDN script. |
| **Logic** | N/A |
| **UI** | Should match current tokens (`neo` colors, shadows). |
| **Placement** | `index.html`, new config files, `package.json`. |
| **Conflicts** | Regression risk on class coverage—visual QA required. |

---

### 15. (Optional) Stricter TypeScript

| Field | Detail |
|--------|--------|
| **What** | `strict` is off; hidden unsound typings possible. |
| **Why** | Long-term maintainability for shared money logic. |
| **How** | After `tsc` is green, enable `strict` or individual flags file-by-file. |
| **Logic** | N/A |
| **UI** | N/A |
| **Placement** | `tsconfig.json`, then fix surfaced errors. |
| **Conflicts** | Can be large—schedule after baseline fixes. |

---

## Signals reviewed (no TODO markers in source)

- **TODO/FIXME grep:** none in `*.ts` / `*.tsx`.
- **Commented-out code:** only structural JSX comments and normal inline comments; no large dead blocks flagged.
- **Incomplete features:** OAuth redirects vs `HashRouter` (item 3), bundle/security/docs items still open; guest mode and invalid routes are addressed.

---

*Last updated: 2026-03-20 — items 1, 2, 4 marked resolved after implementation; checklist and proposal **Status** rows updated.*
