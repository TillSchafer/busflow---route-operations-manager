# Requirements: BusPilot Route Operations Manager

**Defined:** 2026-03-01
**Core Value:** Echte Nutzer koennen den bestehenden BusPilot-Kernfluss zuverlaessig testen, weil Performance, Datenkonsistenz und Rollen-/Berechtigungslogik in MVP 1.0 robust finalisiert sind.

## v1 Requirements

Requirements for milestone v1.1. Each requirement maps to exactly one roadmap phase.

### Performance

- [ ] **PERF-01**: Baseline- und Nachher-Messwerte fuer Route-List, Route-Detail und Kern-Mutationen sind dokumentiert.
- [ ] **PERF-02**: Nutzer koennen Route-List und Route-Detail ohne unnoetige Doppel-Requests nutzen.
- [ ] **PERF-03**: Kritische Mutationen zeigen konsistente Ladezustaende ohne haengenbleibende Loader.

### Route-Validierung

- [ ] **RVAL-01**: Nutzer koennen Route nicht speichern, wenn Pflichtfelder fehlen, und sehen feldgenaue Fehler.
- [ ] **RVAL-02**: Nutzer koennen Route nicht speichern, wenn fachliche Regeln verletzt sind, und sehen verstaendliche Fehlermeldungen.
- [ ] **RVAL-03**: Der Server erzwingt dieselben Validierungsregeln wie der Client.

### User-Settings

- [ ] **SETT-01**: Nutzer koennen Profil-Einstellungen speichern und nach Reload korrekt wiedersehen.
- [ ] **SETT-02**: Nutzer koennen sicherheitsrelevante Settings-Aktionen mit klarer Bestaetigung und Fehlerbehandlung durchfuehren.
- [ ] **SETT-03**: Nutzer koennen keine Settings ausserhalb ihrer Berechtigung aendern.

### Loesch-/Archivierungskonzept

- [ ] **LIFE-01**: Berechtigte Nutzer koennen Routen archivieren, ohne sie dauerhaft zu loeschen.
- [ ] **LIFE-02**: Berechtigte Nutzer koennen archivierte Routen gemaess Richtlinie wiederherstellen.
- [ ] **LIFE-03**: Hard-Delete ist rollenbasiert eingeschraenkt, nachvollziehbar und idempotent.
- [ ] **LIFE-04**: Archivierte Datensaetze erscheinen nicht in aktiven Standardansichten.

### Rollenmanagement / Sichtbarkeit

- [ ] **ROLE-01**: Nutzer sehen nur Seiten, Daten und Aktionen, die ihrer Rolle entsprechen.
- [ ] **ROLE-02**: Unerlaubte Aktionen werden serverseitig geblockt, auch bei manipuliertem Client.
- [ ] **ROLE-03**: Rollen-zu-Aktion-Matrix fuer Kernflows ist dokumentiert und verifiziert.

### Datenbankstruktur

- [ ] **DATA-01**: Das Schema erzwingt notwendige Constraints (FK, Eindeutigkeit, Pflichtfelder) fuer Kernobjekte.
- [ ] **DATA-02**: Migrationen sind von einer sauberen DB reproduzierbar und in Staging validiert.
- [ ] **DATA-03**: Kernabfragen nutzen passende Indizes fuer dominante Filter- und Sortierpfade.
- [ ] **DATA-04**: Das Datenmodell unterstuetzt den Archiv-Lifecycle ohne verwaiste Referenzen.

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Operations & Scale

- **OBS-01**: Performance-Telemetrie-Dashboard fuer Kernflows mit Alert-Schwellen ist verfuegbar.
- **LIFE-05**: Bulk-Archivieren/Wiederherstellen fuer operative Bereinigungen ist verfuegbar.
- **ROLE-04**: Mandantenkonfigurierbare Rollen-Templates sind verfuegbar.
- **AUTO-01**: Erweiterte Automatisierungen und breitere Realtime-Aktualisierungen sind verfuegbar.

## Out of Scope

Explizit ausgeschlossen, um Scope Creep zu vermeiden.

| Feature | Reason |
|---------|--------|
| Genereller Neuaufbau der Anwendung | Bestehende Architektur und Produktkonzept bleiben erhalten |
| Grundprinzipien von Anmeldung und Registrierung aendern | Auth-Basis ist gesetzt; Fokus liegt auf Finalisierung statt Neudefinition |
| Kernfunktion Routen erstellen/loeschen/bearbeiten ersetzen | Soll verbessert und finalisiert werden, nicht neu erfunden |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | TBA | Pending |
| PERF-02 | TBA | Pending |
| PERF-03 | TBA | Pending |
| RVAL-01 | TBA | Pending |
| RVAL-02 | TBA | Pending |
| RVAL-03 | TBA | Pending |
| SETT-01 | TBA | Pending |
| SETT-02 | TBA | Pending |
| SETT-03 | TBA | Pending |
| LIFE-01 | TBA | Pending |
| LIFE-02 | TBA | Pending |
| LIFE-03 | TBA | Pending |
| LIFE-04 | TBA | Pending |
| ROLE-01 | TBA | Pending |
| ROLE-02 | TBA | Pending |
| ROLE-03 | TBA | Pending |
| DATA-01 | TBA | Pending |
| DATA-02 | TBA | Pending |
| DATA-03 | TBA | Pending |
| DATA-04 | TBA | Pending |

**Coverage:**
- v1 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 ⚠

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after milestone v1.1 scope confirmation*
