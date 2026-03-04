#!/bin/bash
set -e

SUPABASE_URL="https://jgydzxdiwpldgrqkfbfk.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpneWR6eGRpd3BsZGdycWtmYmZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTQ0MjUsImV4cCI6MjA4NjY3MDQyNX0.8dK9ht5Zux_TfVSUwuBgamijjqHMs-WNxXzYlbiqHaA"

echo "🔨 Baue Flutter IPA..."
flutter build ipa --no-codesign \
  --dart-define=SUPABASE_URL="$SUPABASE_URL" \
  --dart-define=SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY"

echo "📦 Packe IPA..."
ARCHIVE="build/ios/archive/Runner.xcarchive/Products/Applications"
mkdir -p build/ios/ipa
mkdir -p "$ARCHIVE/Payload"
cp -r "$ARCHIVE/Runner.app" "$ARCHIVE/Payload/"
zip -r build/ios/ipa/buspilot_mobile.ipa "$ARCHIVE/Payload/" -q
rm -rf "$ARCHIVE/Payload"

echo "✅ Fertig: build/ios/ipa/buspilot_mobile.ipa"
open build/ios/ipa/
