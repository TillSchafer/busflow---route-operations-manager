import 'package:flutter_test/flutter_test.dart';
import 'package:buspilot_mobile/src/app.dart';

void main() {
  testWidgets('shows missing config without dart-define envs', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const BusPilotMobileApp());

    expect(find.text('Konfiguration fehlt'), findsOneWidget);
    expect(find.text('BusPilot Mobile'), findsOneWidget);
  });
}
