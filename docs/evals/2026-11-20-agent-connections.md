# Agent connection verification

Tested November 20, 2026, using an isolated Supabase project, two synthetic accounts, the Node CLI, and Chromium. No production traffic or data was used.

| Case | Observed result |
| --- | --- |
| Invalid connection request or device credential | Rejected |
| CLI discovery, browser sign-in, and approval | CLI connected to the signed-in demo account with the approved scopes |
| Connection credential storage | Owner-only file permissions. Secrets omitted from CLI output |
| One-time approval and account isolation | Reuse, cross-account permission edits, and direct Data API access rejected |
| Concurrent automatic renewal | Both commands succeeded after one credential rotation. The old refresh credential failed |
| Friend and category commands | Add, edit where supported, list, and delete worked. Cross-account edits failed |
| Expense and balance commands | Add, list, edit, move, delete, and balances worked. An identical retry wrote one expense |
| Private notes | Expense lists omitted notes. Direct note access required its own permission |
| Settlements | Recording adjusted the balance. Overpayment failed |
| Profile | Read and update worked. Arbitrary avatar URLs were rejected |
| Permission changes | Scope changes applied to the next command. The browser showed them immediately |
| Full history export | No history returned before owner approval. Approved JSON and CSV exports worked |
| Friend deletion | Approval was bound to the friend and could not be reused for another |
| Clearing history | Decline preserved history. Approval cleared the approving account only |
| Audit, manual access, and disconnect | Writes and exports appeared in the audit. Manual tokens worked. Disconnect blocked the next request |

Type checking, lint with existing warnings, all 74 Vitest tests, and the build passed. Hosted Google and Apple redirects still need verification in staging.
