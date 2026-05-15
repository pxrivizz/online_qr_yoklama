import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/providers/auth_provider.dart';

void main() {
  testWidgets('App builds', (WidgetTester tester) async {
    final authProvider = AuthProvider();
    authProvider.isLoading = false;
    authProvider.isAuthenticated = false;

    await tester.pumpWidget(MyApp(authProvider: authProvider));
    await tester.pump();

    expect(find.text('QR Attendance'), findsOneWidget);
  });
}
