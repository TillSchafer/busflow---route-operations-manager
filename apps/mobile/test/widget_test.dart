import 'package:flutter_test/flutter_test.dart';
import 'package:dizpo_mobile/src/app.dart';

void main() {
  testWidgets('shows missing config without dart-define envs', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const DizpoMobileApp());

    expect(find.text('Konfiguration fehlt'), findsOneWidget);
    expect(find.text('Dizpo Mobile'), findsOneWidget);
  });
}
