# Phase 9: Role Visibility and Enforcement Finalization - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 finalisiert die rollenbasierte Sichtbarkeit und Autorisierung in bestehenden Kernflows. Ziel ist konsistente Durchsetzung zwischen UI-Routen/Controls und Backend-Enforcement, ohne neue Produktfähigkeiten hinzuzufuegen.

</domain>

<decisions>
## Implementation Decisions

### Routen-Sichtbarkeit
- Standardfluss bleibt Busflow-first statt Admin-first.
- Innerhalb eines Accounts sehen ADMIN/DISPATCH/VIEWER dieselben Routen-Daten (kein Rollenfilter auf Routen-Sichtbarkeit fuer v1.1).
- Wenn ein Nicht-Platform-Admin keinen aktiven Account hat, bleibt der bestehende Aktivierungs-Screen verbindlich.
- Nicht erlaubte direkte Route-Navigation wird auf eine erlaubte Fallback-Route umgeleitet.

### Aktionen und Controls
- Team-Admin-Bereich (`/adminbereich`) ist nur fuer Account-Admins und Platform-Admins zugaenglich.
- Rollenwechsel von Mitgliedern ist nur fuer Account-Admins und Platform-Admins erlaubt.
- User-Hard-Delete wird fuer v1.1 auf Platform-Admins begrenzt.
- Einladungen senden/loeschen/erneut senden bleibt auf Account-Admins und Platform-Admins begrenzt.
- Nicht erlaubte Aktionen werden im UI standardmaessig versteckt statt deaktiviert angezeigt.

### Fehlerverhalten und Rueckmeldung
- Bei verweigerter Route-Navigation: Redirect plus kurzer Hinweis an den Nutzer.
- Bei serverseitig geblockten Aktionen: kurze generische Berechtigungs-Meldung (keine internen Details).
- Auth-Fehler (Session abgelaufen) werden strikt getrennt von Berechtigungsfehlern behandelt.

### Claude's Discretion
- Exakte Fallback-Prioritaet fuer Redirect-Ziele pro Rolle (konkretisierte Reihenfolge im Plan).
- Einheitliches Message-Mapping je Fehlercode in ein kurzes, konsistentes Textset.
- Konkrete Stellenliste, welche Controls versteckt statt disabled gerendert werden.

</decisions>

<specifics>
## Specific Ideas

- "Fuer den Anfang koennen alle Mitglieder einer Firma alle Routen sehen. Da brauchen wir keine Rollen."
- Berechtigungsdurchsetzung soll streng bei administrativen Aktionen sein, nicht bei der reinen Routen-Sicht.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/auth/AuthContext.tsx`: zentrale Ableitung von `user.role`, `activeAccountId`, `canManageTenantUsers`.
- `src/app/router/AppRouter.tsx`: bestehende Route-Guards und Redirect-Patterns fuer `/adminbereich`, `/owner-bereich`, Alias-Routen.
- `src/features/admin/team/pages/TeamAdminPage.tsx`: vorhandene Control-Gates (disabled/visibility) fuer Rollenwechsel, User-Delete, Invitation-Management.
- `src/shared/lib/supabaseFunctions.ts`: einheitlicher Wrapper fuer authed Edge-Function-Aufrufe inklusive Auth-Fehlerbehandlung.
- `src/shared/api/admin/teamAdmin.api.ts`: zentrale API-Fassade fuer Team-Admin-Mutationen.

### Established Patterns
- Guard clauses + Redirect statt komplexer Zwischenzustandsseiten fuer Route-Absicherung.
- Rollen-/Berechtigungsflags werden aus AuthContext in Routen und Header-Interaktionen durchgereicht.
- Security-kritische Mutationen laufen ueber Edge Functions mit serverseitigen Permissions.
- Fehlermeldungen sind kurz und nutzerorientiert (Toast-basiert, keine internen technischen Details).

### Integration Points
- Route-Enforcement in `AppRouter` (insbesondere `/adminbereich`, `/owner-bereich`, Alias-Redirects und no-account flow).
- Sichtbarkeit von Admin/Owner-Navigation in Header/Profile-Menue-Komponenten.
- Aktions-Enforcement in TeamAdmin-UI plus backendseitige Absicherung in `admin-update-membership-role-v1` und `admin-delete-user-v3`.
- Fehlertext-Mapping zwischen Edge-Function-Codes und konsistenten UI-Messages.

</code_context>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 09-role-visibility-and-enforcement-finalization*
*Context gathered: 2026-03-01*
