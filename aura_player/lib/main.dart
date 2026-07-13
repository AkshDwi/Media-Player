import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart';
import 'providers/settings_provider.dart';
import 'providers/theme_provider.dart';
import 'screens/home_screen.dart';
import 'services/storage_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize media_kit engine (libmpv wrapper)
  MediaKit.ensureInitialized();

  // Initialize storage persistence box (Hive NoSQL)
  final storageService = StorageService();
  await storageService.initialize();

  runApp(
    ProviderScope(
      overrides: [
        // Inject the initialized storage service singleton
        storageServiceProvider.overrideWithValue(storageService),
      ],
      child: const AuraPlayerApp(),
    ),
  );
}

class AuraPlayerApp extends ConsumerWidget {
  const AuraPlayerApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeData = ref.watch(themeDataProvider);
    final settings = ref.watch(settingsProvider);

    ThemeMode resolvedThemeMode;
    switch (settings.themeMode) {
      case 'light':
        resolvedThemeMode = ThemeMode.light;
        break;
      case 'dark':
        resolvedThemeMode = ThemeMode.dark;
        break;
      default:
        resolvedThemeMode = ThemeMode.system;
    }

    return MaterialApp(
      title: 'Aura Player',
      debugShowCheckedModeBanner: false,
      theme: themeData,
      themeMode: resolvedThemeMode,
      home: const HomeScreen(),
    );
  }
}
