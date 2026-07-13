/// Curated color palette for Aura Player.
///
/// Uses HSL-tuned colors for a premium, cohesive look.
/// The accent gradient (electric purple → cyan) gives the app
/// its signature "aura" visual identity.
library;

import 'package:flutter/material.dart';

class AppColors {
  AppColors._();

  // ---------------------------------------------------------------------------
  // Brand / Accent Colors
  // ---------------------------------------------------------------------------

  /// Primary accent — electric purple.
  static const Color accent = Color(0xFF8B5CF6);

  /// Secondary accent — cyan/teal.
  static const Color accentSecondary = Color(0xFF06B6D4);

  /// Accent gradient used for key UI elements.
  static const LinearGradient accentGradient = LinearGradient(
    colors: [accent, accentSecondary],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  /// Softer version of the accent gradient for backgrounds.
  static const LinearGradient accentGradientSoft = LinearGradient(
    colors: [Color(0x338B5CF6), Color(0x3306B6D4)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ---------------------------------------------------------------------------
  // Dark Theme Colors
  // ---------------------------------------------------------------------------

  /// Deep charcoal background.
  static const Color darkBg = Color(0xFF0D0D12);

  /// Slightly lighter surface for cards/panels.
  static const Color darkSurface = Color(0xFF16161F);

  /// Elevated surface (for modals, dialogs).
  static const Color darkSurfaceElevated = Color(0xFF1E1E2A);

  /// Border color for dark theme.
  static const Color darkBorder = Color(0xFF2A2A3A);

  /// Primary text color — off-white for comfortable reading.
  static const Color darkTextPrimary = Color(0xFFF1F1F4);

  /// Secondary text color — muted gray.
  static const Color darkTextSecondary = Color(0xFF8B8B9E);

  /// Tertiary text — very subtle hints.
  static const Color darkTextTertiary = Color(0xFF5A5A6E);

  // ---------------------------------------------------------------------------
  // Light Theme Colors
  // ---------------------------------------------------------------------------

  /// Clean white background.
  static const Color lightBg = Color(0xFFF8F9FC);

  /// Light card surface.
  static const Color lightSurface = Color(0xFFFFFFFF);

  /// Elevated surface for light theme.
  static const Color lightSurfaceElevated = Color(0xFFF0F1F5);

  /// Border color for light theme.
  static const Color lightBorder = Color(0xFFE2E4EA);

  /// Primary text — near black.
  static const Color lightTextPrimary = Color(0xFF111118);

  /// Secondary text — medium gray.
  static const Color lightTextSecondary = Color(0xFF6B6B80);

  /// Tertiary text.
  static const Color lightTextTertiary = Color(0xFF9B9BAE);

  // ---------------------------------------------------------------------------
  // Semantic Colors
  // ---------------------------------------------------------------------------

  /// Success / positive state.
  static const Color success = Color(0xFF22C55E);

  /// Warning state.
  static const Color warning = Color(0xFFF59E0B);

  /// Error / destructive state.
  static const Color error = Color(0xFFEF4444);

  /// Info state.
  static const Color info = Color(0xFF3B82F6);

  // ---------------------------------------------------------------------------
  // Visualizer Colors
  // ---------------------------------------------------------------------------

  /// Colors used in audio visualizer gradients.
  static const List<Color> visualizerColors = [
    Color(0xFF8B5CF6), // Purple
    Color(0xFFA855F7), // Lighter purple
    Color(0xFF06B6D4), // Cyan
    Color(0xFF22D3EE), // Light cyan
    Color(0xFF10B981), // Emerald
  ];

  /// Glassmorphism overlay color (used for frosted glass effects).
  static Color glassOverlay(bool isDark) =>
      isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white.withValues(alpha: 0.7);

  /// Glassmorphism border color.
  static Color glassBorder(bool isDark) =>
      isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.05);
}
