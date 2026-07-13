import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../theme/app_theme.dart';
import 'settings_provider.dart';

/// Provider that exposes the current [ThemeData] based on [AppSettings.themeMode].
final themeDataProvider = Provider<ThemeData>((ref) {
  final settings = ref.watch(settingsProvider);
  final isDark = _isDarkMode(settings.themeMode);
  return isDark ? AppTheme.darkTheme : AppTheme.lightTheme;
});

/// Provider that exposes whether the application is currently in dark mode.
final isDarkThemeProvider = Provider<bool>((ref) {
  final settings = ref.watch(settingsProvider);
  return _isDarkMode(settings.themeMode);
});

bool _isDarkMode(String themeMode) {
  if (themeMode == 'system') {
    final window = WidgetsBinding.instance.platformDispatcher;
    return window.platformBrightness == Brightness.dark;
  }
  return themeMode == 'dark';
}
