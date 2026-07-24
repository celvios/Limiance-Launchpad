# Limiance Admin Backend

The admin API is intentionally isolated under the `/api/admin` namespace and
is backed by the existing domain service in `backend/`. This keeps one Prisma
client and one transaction boundary for users, balances, trades, tokens,
reports, and withdrawals while the admin frontend remains independently
deployable.

## Current modules

- `backend/src/routes/adminAuth.ts`: admin login, bootstrap, session lookup,
  logout, password hashing, and role checks.
- `backend/src/routes/adminData.ts`: dashboard, users, tokens, finance,
  audit-log, and support data endpoints.
- `backend/src/routes/reports.ts` and related routes: moderation and finance
  mutations protected by admin roles and audit logging.
- `backend/src/routes/adminActions.ts`: user suspension, token hide/restore,
  comment removal, withdrawal transitions/refunds, and administrator management.

## Separation rule

`admin-backend` is the ownership boundary for admin functionality. The runtime
process remains the shared `backend` until the API is extracted into a separate
service. Do not create a second Prisma schema or duplicate balance logic.

## First administrator

Set `ADMIN_SECRET` or `ADMIN_SETUP_SECRET` on the backend, then call
`POST /api/admin/auth/bootstrap` with the setup header. Bootstrap is rejected
after the first administrator exists. The production deployment must also set
`ADMIN_JWT_SECRET`; the Render configuration generates this value automatically.

After changing the Prisma schema, deploy the backend so its existing
`prisma db push` startup step adds `User.status` and `WithdrawalRequest.refundedAt`.
