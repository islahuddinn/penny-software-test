# Implementation Notes

## 1. What I changed

**Backend**
- Tightened `assertTransition` in `cr-state-machine.ts` to reject any transition not listed in `LEGAL_TRANSITIONS`, not only moves out of terminal states.
- Implemented `approve` in `cr-service.ts`: approver policy required, legal `PENDING_APPROVAL → APPROVED`, records approval entry and audit.
- Implemented `apply` in `cr-service.ts`: applier policy required, requires `APPROVED`, recomputes totals, rejects when a positive delta exceeds budget balance, updates budget, sets `APPLIED`, audits.

**Frontend**
- `canApprove` / `canReject` now require both `PENDING_APPROVAL` status and approver policy (`permissions.ts`).
- `approve` / `reject` call `CrApiClient`, manage `submitting` and `actionError`, and refresh the loaded CR on success.
- Reject remains blocked until a non-empty reason is entered (template + guard in `reject()`).

**Integration (BFF seam)**
- Added `cr-view.types.ts` with `CrDetailView` — the detail UI consumes this shape, not backend `ChangeRequest`.
- `CrApiClient` maps backend entities to `CrDetailView` via `toDetailView()` and translates `BusinessError` to plain messages.

**Tests**
- Added `cr-service.spec.ts` (approve, apply, budget rejection, permission/transition guards).
- Added `cr-api-client.spec.ts` (approve end-to-end, error translation, `failNext`, latency).
- Extended `cr-detail.component.spec.ts` (read-only gating, approver enabled, non-pending status, approve/reject flows, reject reason, network error).

## 2. Model of the flow (UI ↔ client ↔ service)

A reviewer opens a CR on the detail page. `ngOnInit` calls `load()`, which sets loading state and invokes `CrApiClient.get(user, id)`. The client wraps the in-process `CrService.get` in an async `settle()` (latency + error simulation), returning a `ChangeRequest` or a translated error message.

When the user clicks Approve, the component checks `canApprove` (status + policy), sets `submitting`, and calls `CrApiClient.approve`. The client calls `CrService.approve`, which validates policy, runs `assertTransition`, updates status/approvals/audit, and persists via `CrRepo`. The updated CR flows back into `state.data` and the template re-renders the new status and timeline.

Reject follows the same path with a required reason string passed through to `CrService.reject`.

## 3. Invariants I keep

| Invariant | How / where |
|---|---|
| Only legal state transitions | `assertTransition` / `canTransition` in backend; service actions call `transition()` |
| Terminal states immutable | `isTerminal` check in `assertTransition` |
| Approve/reject require approver policy | `CrService.isApprover` + UI `canApprovePolicy` / `canRejectPolicy` |
| Apply requires applier policy + APPROVED status | `CrService.isApplier` + transition guard |
| Budget never over-spent on apply | `CrService.apply` compares `delta` to `budget.balance` before deducting |
| Every successful action audited | `transition()` appends to `cr.audit` |
| UI never bypasses the client | Component depends only on `CrApiClient` + `SessionService` |
| Action offered in UI only when allowed | Component gates on status **and** policy before enabling buttons |

## 4. Testing strategy

- **Unit (backend):** state machine illegal transition; service approve/apply happy paths, forbidden policies, insufficient budget.
- **Integration (client):** full approve through `CrApiClient`; business-error and network-error translation.
- **Component (DOM):** disabled/hidden buttons for read-only and wrong status; approve updates rendered status; reject reason gating; action error banner on `failNext`.
- **Skipped:** full apply UI flow (no apply button in scope), cross-org isolation beyond existing list smoke test, negative-delta apply (no budget change needed), migrating `cr-list` to view DTOs (provided component still uses backend list shape).

## 5. Assumptions

- Reject uses the same approver policies as approve (`cr_a_*`), matching backend `isApprover`.
- Idempotent returns when already in target status (`APPROVED`, `APPLIED`, `REJECTED`) — consistent with existing `reject` / `sendForApproval` patterns.
- On apply with positive delta, `budget.balance` decreases and `budget.booked` increases by `delta`; zero or negative delta does not touch the budget.
- UI shows Approve disabled (not hidden) for unauthorized users so read-only viewers still see the action exists but cannot use it; reject block is hidden when `canReject` is false.

## 6. Where I used AI

- Used AI (Cursor) to scaffold implementations, tests, and this document from the candidate brief and existing code patterns.

## 7. What I'd improve with more time

- Add an Apply action to the UI with the same permission/status gating pattern.
- Introduce a UI-facing DTO for the list page as well (detail now uses `CrDetailView`).
- Richer error mapping (codes → user-friendly copy) and retry for transient network failures.
