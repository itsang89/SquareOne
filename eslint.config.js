import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Global ignores
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React rules applied to all TS/TSX source files
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // ── Core hooks rules (stable, always enforced) ────────────────────────
      // Using hooks conditionally or in non-component contexts breaks React.
      'react-hooks/rules-of-hooks': 'error',
      // Missing effect/memo dependencies cause stale-closure bugs — warn to
      // surface them without blocking CI during incremental adoption.
      'react-hooks/exhaustive-deps': 'warn',

      // ── Newer React Compiler rules — warn-only for incremental adoption ───
      // These catch real issues but flag patterns (like resetting state in an
      // effect) that the codebase uses intentionally today. Promote to 'error'
      // file-by-file once the team is ready.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/component-hook-factories': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
      'react-hooks/globals': 'off',
      'react-hooks/error-boundaries': 'off',
      'react-hooks/unsupported-syntax': 'off',
      'react-hooks/config': 'off',
      'react-hooks/gating': 'off',

      // ── Fast Refresh ──────────────────────────────────────────────────────
      // Context files export hooks alongside the provider — allow that.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // ── TypeScript ────────────────────────────────────────────────────────
      // Explicit `any` is sometimes necessary (Supabase error types, etc.).
      '@typescript-eslint/no-explicit-any': 'warn',
      // Unused variables are noise — warn so they're visible but not blocking.
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
