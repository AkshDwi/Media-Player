/// Hive-backed persistence service for playlists and app settings.
///
/// Uses Hive CE as a fast, pure-Dart NoSQL store. Data is stored as
/// JSON-serialized maps for easy debugging and migration.
library;

import 'dart:convert';
import 'package:hive_ce_flutter/hive_ce_flutter.dart';
import '../models/app_settings.dart';
import '../models/playlist.dart';

class StorageService {
  static const String _playlistsBoxName = 'playlists';
  static const String _settingsBoxName = 'settings';
  static const String _settingsKey = 'app_settings';

  late Box<String> _playlistsBox;
  late Box<String> _settingsBox;

  /// Initializes Hive and opens the required boxes.
  /// Must be called before any other method.
  Future<void> initialize() async {
    await Hive.initFlutter();
    _playlistsBox = await Hive.openBox<String>(_playlistsBoxName);
    _settingsBox = await Hive.openBox<String>(_settingsBoxName);
  }

  // ---------------------------------------------------------------------------
  // Playlist Operations
  // ---------------------------------------------------------------------------

  /// Returns all saved playlists, sorted by creation date (newest first).
  List<Playlist> getAllPlaylists() {
    final playlists = <Playlist>[];
    for (final key in _playlistsBox.keys) {
      final jsonStr = _playlistsBox.get(key);
      if (jsonStr != null) {
        try {
          final map = jsonDecode(jsonStr) as Map<String, dynamic>;
          playlists.add(Playlist.fromJson(map));
        } catch (_) {
          // Skip corrupted entries silently.
        }
      }
    }
    playlists.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return playlists;
  }

  /// Retrieves a single playlist by ID, or null if not found.
  Playlist? getPlaylist(String id) {
    final jsonStr = _playlistsBox.get(id);
    if (jsonStr == null) return null;
    try {
      return Playlist.fromJson(jsonDecode(jsonStr) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Saves (creates or updates) a playlist.
  Future<void> savePlaylist(Playlist playlist) async {
    await _playlistsBox.put(playlist.id, jsonEncode(playlist.toJson()));
  }

  /// Deletes a playlist by ID.
  Future<void> deletePlaylist(String id) async {
    await _playlistsBox.delete(id);
  }

  // ---------------------------------------------------------------------------
  // Settings Operations
  // ---------------------------------------------------------------------------

  /// Loads app settings, returning defaults if none are saved.
  AppSettings getSettings() {
    final jsonStr = _settingsBox.get(_settingsKey);
    if (jsonStr == null) return const AppSettings();
    try {
      return AppSettings.fromJson(
        jsonDecode(jsonStr) as Map<String, dynamic>,
      );
    } catch (_) {
      return const AppSettings();
    }
  }

  /// Persists app settings.
  Future<void> saveSettings(AppSettings settings) async {
    await _settingsBox.put(_settingsKey, jsonEncode(settings.toJson()));
  }

  /// Clears all stored data (for debugging or reset).
  Future<void> clearAll() async {
    await _playlistsBox.clear();
    await _settingsBox.clear();
  }
}
