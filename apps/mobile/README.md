# BusPilot Mobile (Flutter)

Mobile Fahrer-App fuer Android und iOS mit:
- Supabase Login (gleiche Accounts wie Web-App)
- Tages-Routenliste aus `busflow_routes`
- Kartenansicht je Route inkl. Stopps
- GPS-Position des Mitarbeiters

## Warum eigener Ordner im selben Repo?
- gleiche Backend-Basis (Supabase, Tabellen, RLS)
- konsistentes Design zur bestehenden Web-App
- Web und Mobile bleiben trotzdem klar getrennt

## Voraussetzungen
- Flutter SDK installiert (`flutter --version`)
- Xcode fuer iOS-Builds (macOS)
- Android Studio / Android SDK fuer Android-Builds

## Native Plattformordner erzeugen
Im Ordner `apps/mobile`:

```bash
../../.tooling/flutter/bin/flutter create --platforms=android,ios .
../../.tooling/flutter/bin/flutter pub get
```

## Starten
Aus `apps/mobile`:

```bash
../../.tooling/flutter/bin/flutter run \
  --dart-define=SUPABASE_URL=<deine_supabase_url> \
  --dart-define=SUPABASE_ANON_KEY=<dein_anon_key> \
  --dart-define=BUSPILOT_ACCOUNT_ID=<optional_account_id>
```

Optional:
- Android gezielt: `../../.tooling/flutter/bin/flutter run -d android ...`
- iOS gezielt: `../../.tooling/flutter/bin/flutter run -d ios ...`

Kurzbefehl im Projekt:
- `./flutterw run ...`
- `./flutterw analyze`
- `./flutterw test`

## Hinweis zu GPS-Rechten
Nach dem Generieren der nativen Projekte muessen Plattformrechte gesetzt werden:
- iOS: `ios/Runner/Info.plist` (Location Usage Description)
- Android: `android/app/src/main/AndroidManifest.xml` (Location Permissions)

Ohne diese Rechte liefert die App keine aktuelle Position.
