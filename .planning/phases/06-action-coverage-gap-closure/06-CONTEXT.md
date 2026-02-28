# Phase 6: Action Coverage Gap Closure - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 schließt die Audit-Blocker für Action-Loading-Coverage (FLOW-03/FLOW-04/QUAL-03).  
Fokus ist die konsistente Einbindung bestehender kritischer Mutationsflows (Profile/Admin/Owner/BusFlow) in das vorhandene globale Loading-System sowie der verbindliche Nachweis über ein Async-Flow-Inventar.

Kein Scope-Upgrade: Es werden keine neuen Produktfähigkeiten eingeführt, nur Lücken im bestehenden Zielbild geschlossen.

</domain>

<decisions>
## Implementation Decisions

### Wrapper-Policy
- Für Phase 6 ist ein zentraler, verpflichtender Action-Loading-Wrapper festzulegen und als Standard zu nutzen.
- Der Wrapper gilt für alle kritischen Mutationsflows (Profile, TeamAdmin, PlatformAdmin, BusFlow), nicht nur für Teilmengen.
- Rollout erfolgt horizontal über alle betroffenen Domains in Phase 6 (kein reines Risk-first oder Layer-first Splitting).
- Bei unbekanntem/fehlendem Message-Key: User-Fallback bleibt aktiv (`Lade...`), zusätzlich verpflichtende Dev-Warnung.

### Message-Policy
- Action-Messages werden domain-spezifisch ausgebaut (nicht bei nur generischen `action.save/delete/import` bleiben).
- Sprachstil bleibt kurze deutsche Verb-Form.
- Invite- und Security-Flows erhalten explizite, auf die Aktion bezogene Loading-Messages.
- Beim Wiring einer neuen Action ist das Nachziehen der Message-Registry im selben Change verpflichtend.

### Concurrency- und Progress-Verhalten
- Bei parallelen Actions bleibt die aktuellste Action-Meldung führend.
- Full-Page-Loader bleibt für Action-Flows standardmäßig blockierend.
- Für lange Jobs (insb. Import/Delete) müssen Full-Page-Loader und ProgressViewport gleichzeitig sichtbar bleiben.
- Wenn eine parallele Action fehlschlägt, bleibt globales Loading aktiv, bis alle laufenden Actions beendet sind; Fehlerkommunikation erfolgt separat.

### Inventory-Governance
- Pflicht-Artefakt: `.planning/phases/06-action-coverage-gap-closure/06-ASYNC-FLOW-INVENTORY.md`.
- Ein Inventory-Eintrag entspricht einem user-triggered Action-Flow (nicht nur Modul/Endpoint).
- Statusmodell: `Not covered` / `Covered` / `Verified`.
- Inventory-Update inkl. Evidenz ist im selben Change wie das jeweilige Action-Wiring verpflichtend.

### Claude's Discretion
- Konkreter API-Name und Dateiort des Wrappers, solange der zentrale Pflichtcharakter erfüllt ist.
- Feingranulare Benennung der neuen Action-Keys innerhalb der festgelegten Message-Policy.
- Konkrete Spaltenstruktur des Inventory-Dokuments, solange Flow-Granularität und Statusmodell eingehalten werden.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/shared/loading/LoadingProvider.tsx`: bestehende `runWithLoading`/`start`/`stop`/`update` APIs als Basis.
- `src/shared/loading/loading-messages.ts`: zentrale Message-Registry + Fallback-Logik.
- `src/shared/loading/loading-engine.ts`: Token-basierte Concurrency-Logik (activeCount, newest-operation display).
- `src/shared/components/ProgressProvider.tsx` + `src/shared/components/ProgressViewport.tsx`: bestehender Progress-Kanal für lange Jobs.
- `src/shared/components/ToastProvider.tsx`: vorhandene Nutzerfeedback-Schicht für Fehler/Erfolg.

### Established Patterns
- Action-Handler arbeiten bereits mit lokalen Busy-Flags und Toasts; diese bleiben als lokale UX-Signale relevant.
- Route/Auth-Loading ist bereits zentral integriert (`AppLoadingBridge`, `RouteLoadingFallback`), Action-Layer ist die offene Lücke.
- API-Aufrufe sind pro Domain gekapselt (`ProfileSecurityApi`, `TeamAdminApi`, `PlatformAdminApi`, `BusFlowApi`).

### Integration Points
- `src/app/router/AppRouter.tsx`: Profil-Mutationen (Avatar, E-Mail-Änderung, Passwort-Reset).
- `src/pages/TeamAdmin.tsx`: Invite, Role-Update, User/Invitation-Delete, Resend.
- `src/pages/PlatformAdmin.tsx`: Create/Save/Archive/Reactivate/Trial/Delete Flows.
- `src/apps/busflow/BusflowApp.tsx`: Route- und Settings-Mutationen, Import/Bulk-Delete-Flows.
- `src/apps/busflow/components/settings/CustomerManagementPanel.tsx`: langlaufende Import/Delete-Flows mit Progress-Callbacks.

</code_context>

<specifics>
## Specific Ideas

- Phase 6 soll audit-blockierende Action-Coverage-Lücken vollständig schließen, nicht nur vorbereiten.
- Message-Governance und Inventory-Governance sind Teil des Definition-of-Done jeder Action-Wiring-Änderung.
- Koexistenz von globalem Loader und ProgressViewport ist explizit als Akzeptanzkriterium festzuhalten.

</specifics>

<deferred>
## Deferred Ideas

None — Diskussion blieb im Phase-6-Scope.

</deferred>

---

*Phase: 06-action-coverage-gap-closure*
*Context gathered: 2026-02-28*
