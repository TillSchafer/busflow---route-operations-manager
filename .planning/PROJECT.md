# BusPilot Route Operations Manager

## What This Is

BusPilot ist eine bestehende Web-App zur Routenverwaltung mit Anmeldung/Registrierung, rollenbasierten Bereichen und dem Erstellen, Bearbeiten sowie Loeschen von Routen. Der Fokus liegt jetzt auf der Fertigstellung eines produktionsnahen MVP 1.0, das von echten Nutzerinnen und Nutzern getestet werden kann. Bestehende Kernablaeufe bleiben erhalten und werden gezielt stabilisiert, validiert und launch-ready gemacht.

## Core Value

Echte Nutzer koennen den bestehenden BusPilot-Kernfluss zuverlaessig testen, weil Performance, Datenkonsistenz und Rollen-/Berechtigungslogik in MVP 1.0 robust finalisiert sind.

## Current Milestone: v1.1 BusPilot Fertigstellung

**Goal:** MVP 1.0 so weit finalisieren, dass echte User sicher und aussagekraeftig testen koennen.

**Target features:**
- Ladezeiten minimieren
- Route-Erstellung mit klaren Validierungen finalisieren
- User-Settings finalisieren
- Loesch-/Archivierungskonzept finalisieren
- Rollenmanagement und Sichtbarkeiten finalisieren
- Datenbankstruktur launch-ready ueberarbeiten

## Requirements

### Validated

- ✓ Multi-route, role-aware web platform already exists (`/`, `/busflow`, `/profile`, `/adminbereich`, `/owner-bereich`, `/auth/*`) — existing
- ✓ Auth/session hydration and account-context switching already run asynchronously — existing
- ✓ BusFlow and admin modules already execute async data loads and mutations — existing
- ✓ Loading UI is currently inconsistent (`"Lade Ansicht"` vs `"Lade BusFlow"` and mixed action states) — existing

### Active

- [ ] Ladezeiten in zentralen Nutzerfluessen messbar reduzieren (Routing, Listenansichten, mutierende Aktionen).
- [ ] Route-Erstellung mit finalen Validierungen absichern (Pflichtfelder, fachliche Regeln, Fehlerfeedback).
- [ ] User-Settings vervollstaendigen und konsistent machen (Profil, sicherheitsrelevante Einstellungen, UX-Fluss).
- [ ] Loesch- und Archivierungsregeln finalisieren (sichtbares Verhalten, Wiederherstellbarkeit falls vorgesehen, Datenkonsistenz).
- [ ] Rollenmanagement finalisieren (wer sieht/editiert welche Bereiche, Aktionen und Daten).
- [ ] Datenbankstruktur fuer MVP 1.0 ueberarbeiten und auf Launch-Reife ausrichten (Integritaet, Eindeutigkeit, klare Relationen).

### Out of Scope

- Genereller Neuaufbau der Anwendung — bestehende Architektur und Grundkonzept bleiben erhalten.
- Grundprinzipien von Anmeldung und Registrierung — bleiben funktional unveraendert.
- Entfernen der BusPilot-App-Kernfunktionalitaet fuer Routen erstellen/loeschen/bearbeiten — bleibt erhalten, nur Verbesserung/Finalisierung.

## Context

Dies ist ein Brownfield-Milestone auf dem bestehenden BusPilot-Codebestand mit dokumentierter Codebase-Map in `.planning/codebase/`. Die App nutzt React 19 + TypeScript + Vite + React Router + Tailwind + Supabase. Vorhandene Kernfunktionen (Auth + Routen-CRUD) sind gesetzt; jetzt geht es um Performance-Haertung, Validierungsqualitaet, klare Berechtigungsgrenzen und eine tragfaehige Datenstruktur fuer reale MVP-Tests.

## Constraints

- **Tech stack**: Bestehenden Stack und bestehende Architekturmuster beibehalten — keine disruptive Re-Architektur.
- **Produktkontinuitaet**: Anmeldung/Registrierung und Routen-CRUD muessen funktional stabil bleiben — nur verbessern/finalisieren.
- **MVP-Zielbild**: Fokus auf testbare reale Nutzerablaeufe — keine breitflachige Feature-Expansion ohne MVP-Bezug.
- **Launch-Readiness**: Datenmodell, Rollenlogik und Validierungen muessen konsistent zusammenarbeiten — keine isolierten Einzelfixes ohne End-to-End-Koharenz.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Milestone-Fokus auf MVP-Fertigstellung statt Rebuild | Bestehendes System ist nutzbar und soll finalisiert werden | — Pending |
| Kernablaeufe bleiben erhalten (Auth + Routen-CRUD) | Produktkontinuitaet und geringes Risiko fuer reale Tests | — Pending |
| Performance, Rollenlogik, Validierung und Datenstruktur sind Prioritaet | Diese Felder blockieren reale Nutzer-Tests am staerksten | — Pending |
| Loesch-/Archivierungskonzept wird explizit abgeschlossen | Klare Datenlebenszyklus-Regeln sind fuer MVP-Betrieb notwendig | — Pending |

---
*Last updated: 2026-03-01 after starting milestone v1.1 (BusPilot Fertigstellung)*
