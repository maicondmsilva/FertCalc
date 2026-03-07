# Task Checklist

## Permissions & User Module
- [x] Analyze types.ts, UserManager.tsx, Approvals.tsx, History.tsx, PricingDetailModal.tsx, App.tsx
- [/] types.ts: add approvals_canApprove permission
- [/] UserManager.tsx: add approvals_canApprove UI + getDefaultPermissions update  
- [/] Approvals.tsx: replace prompt() with modal + check approvals_canApprove
- [/] PricingDetailModal.tsx: block 'Fechada' without approval + show rejection reason
- [/] History.tsx: block status change to 'Fechada' without approval + fix deletion request bug + add deleted pricings tab
- [/] App.tsx: show notifications to all users (not just managers)

## New Feature: PricingReport.tsx
- [/] Build full pricing report page with stats, filters, table, export

## Bug Fix: Deletion Request Button
- [/] Fix `handleRequestDeletion` in History.tsx - notification userId empty string
