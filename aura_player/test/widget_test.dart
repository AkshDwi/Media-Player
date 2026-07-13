import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:aura_player/main.dart';
import 'package:aura_player/models/app_settings.dart';
import 'package:aura_player/models/playlist.dart';
import 'package:aura_player/providers/settings_provider.dart';
import 'package:aura_player/services/storage_service.dart';

// Create a functional Mock StorageService that does not access uninitialized boxes
class MockStorageService extends StorageService {
  @override
  Future<void> initialize() async {}

  @override
  AppSettings getSettings() {
    return const AppSettings();
  }

  @override
  List<Playlist> getAllPlaylists() {
    return [];
  }

  @override
  Future<void> saveSettings(AppSettings settings) async {}

  @override
  Future<void> savePlaylist(Playlist playlist) async {}

  @override
  Future<void> deletePlaylist(String id) async {}
}

void main() {
  testWidgets('App mounts correctly smoke test', (WidgetTester tester) async {
    final mockStorage = MockStorageService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          storageServiceProvider.overrideWithValue(mockStorage),
        ],
        child: const AuraPlayerApp(),
      ),
    );

    // Basic assertion that AuraPlayerApp is rendered
    expect(find.byType(AuraPlayerApp), findsOneWidget);
  });
}
