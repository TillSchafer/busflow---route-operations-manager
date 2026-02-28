# Phase 06 Async Flow Inventory

## Purpose

This inventory is the Phase 6 baseline for critical user-triggered async flows.
Each row represents one user action path that must be wired to shared action loading coverage.

## Status Model

- `Not covered`: Flow is not yet wired to `useActionLoading` / shared action loading lifecycle.
- `Covered`: Flow is wired and message key usage is in place.
- `Verified`: Flow is covered and verified with test/manual evidence.

## Update Rules

1. Update this file in the same change where a flow is wired.
2. Keep `message key` aligned with `src/shared/loading/loading-messages.ts`.
3. Add concrete proof in `Evidence` (test file, command output, or manual scenario).
4. Do not collapse multiple user-triggered flows into one row.

## Critical Flow Inventory

| Domain | User-triggered flow | Code location | Message key | Status | Evidence |
| --- | --- | --- | --- | --- | --- |
| Profile | Profilbild speichern | `src/app/router/AppRouter.tsx` `handleProfileAvatarSave` | `action.profile.avatar.save` | Not covered | - |
| Profile | E-Mail-Aenderung anfordern | `src/app/router/AppRouter.tsx` `handleProfileEmailChangeRequest` | `action.profile.email.change` | Not covered | - |
| Profile | Passwort-Reset anfordern | `src/app/router/AppRouter.tsx` `handleProfilePasswordResetRequest` | `action.profile.password.reset` | Not covered | - |
| Team Admin | Benutzer einladen | `src/pages/TeamAdmin.tsx` `handleInviteEmployee` | `action.team.invite.send` | Not covered | - |
| Team Admin | Mitgliederrolle aktualisieren | `src/pages/TeamAdmin.tsx` `handleUpdateMembershipRole` | `action.team.membership.update` | Not covered | - |
| Team Admin | Benutzer endgueltig loeschen | `src/pages/TeamAdmin.tsx` `handleDeleteUserHard` | `action.team.user.delete` | Not covered | - |
| Team Admin | Einladung widerrufen | `src/pages/TeamAdmin.tsx` `handleDeleteInvitation` | `action.team.invitation.delete` | Not covered | - |
| Team Admin | Einladung erneut senden | `src/pages/TeamAdmin.tsx` `handleResendInvitation` | `action.team.invitation.resend` | Not covered | - |
| Owner Admin | Firma und ersten Admin anlegen | `src/pages/PlatformAdmin.tsx` `handleCreateAccountAndInviteAdmin` | `action.owner.account.create` | Not covered | - |
| Owner Admin | Firmendaten speichern | `src/pages/PlatformAdmin.tsx` `handleSaveEdit` | `action.owner.account.save` | Not covered | - |
| Owner Admin | Firma archivieren | `src/pages/PlatformAdmin.tsx` `handleArchive` | `action.owner.account.archive` | Not covered | - |
| Owner Admin | Firma reaktivieren | `src/pages/PlatformAdmin.tsx` `handleReactivate` | `action.owner.account.reactivate` | Not covered | - |
| Owner Admin | Testphase aktualisieren | `src/pages/PlatformAdmin.tsx` `handleTrialAction` | `action.owner.trial.update` | Not covered | - |
| Owner Admin | Loeschumfang pruefen (Dry-Run) | `src/pages/PlatformAdmin.tsx` `handleShowDeleteStep` | `action.owner.account.delete.dry_run` | Not covered | - |
| Owner Admin | Firma endgueltig loeschen | `src/pages/PlatformAdmin.tsx` `handleDeleteHard` | `action.owner.account.delete` | Not covered | - |
| BusFlow Routen | Route speichern | `src/apps/busflow/BusflowApp.tsx` `handleSaveRoute` | `action.busflow.route.save` | Not covered | - |
| BusFlow Routen | Route loeschen | `src/apps/busflow/BusflowApp.tsx` `handleConfirmDeleteRoute` | `action.busflow.route.delete` | Not covered | - |
| BusFlow Einstellungen | Bustyp speichern | `src/apps/busflow/BusflowApp.tsx` `handleAddBusType` | `action.busflow.bus_type.save` | Not covered | - |
| BusFlow Einstellungen | Bustyp loeschen | `src/apps/busflow/BusflowApp.tsx` `handleRemoveBusType` | `action.busflow.bus_type.delete` | Not covered | - |
| BusFlow Einstellungen | Mitarbeiter speichern | `src/apps/busflow/BusflowApp.tsx` `handleAddWorker` | `action.busflow.worker.save` | Not covered | - |
| BusFlow Einstellungen | Mitarbeiter loeschen | `src/apps/busflow/BusflowApp.tsx` `handleRemoveWorker` | `action.busflow.worker.delete` | Not covered | - |
| BusFlow Kontakte | Kontakt speichern | `src/apps/busflow/BusflowApp.tsx` `handleAddCustomerContact` / `handleUpdateCustomerContact` | `action.busflow.contact.save` | Not covered | - |
| BusFlow Kontakte | Kontakt loeschen | `src/apps/busflow/BusflowApp.tsx` `handleRemoveCustomerContact` | `action.busflow.contact.delete` | Not covered | - |
| BusFlow Import | Import-Vorschau erstellen | `src/apps/busflow/BusflowApp.tsx` `handlePreviewCustomerImport` | `action.busflow.customer.import.preview` | Not covered | - |
| BusFlow Import | Kundenimport committen | `src/apps/busflow/BusflowApp.tsx` `handleCommitCustomerImport` | `action.busflow.customer.import.commit` | Not covered | - |
| BusFlow Bulk Delete | Mehrere Kontakte loeschen | `src/apps/busflow/BusflowApp.tsx` `handleBulkRemoveCustomerContacts` | `action.busflow.customer.bulk_delete` | Not covered | - |
| BusFlow Einstellungen | Karten-Standard speichern | `src/apps/busflow/BusflowApp.tsx` `handleSaveMapDefaultView` | `action.busflow.map_default.save` | Not covered | - |
