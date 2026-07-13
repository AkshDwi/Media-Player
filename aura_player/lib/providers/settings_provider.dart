import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/app_settings.dart';
import '../services/storage_service.dart';

/// Provider for the [StorageService] instance.
final storageServiceProvider = Provider<StorageService>((ref) {
  // This will be overridden in main.dart after initialization.
  throw UnimplementedError();
});

/// State notifier provider for managing and persisting [AppSettings].
final settingsProvider = StateNotifierProvider<SettingsNotifier, AppSettings>((ref) {
  final storageService = ref.watch(storageServiceProvider);
  return SettingsNotifier(storageService);
});

class SettingsNotifier extends StateNotifier<AppSettings> {
  final StorageService _storageService;

  SettingsNotifier(this._storageService) : super(const AppSettings()) {
    _loadSettings();
  }

  void _loadSettings() {
    state = _storageService.getSettings();
  }

  Future<void> updateThemeMode(String themeMode) async {
    state = state.copyWith(themeMode: themeMode);
    await _storageService.saveSettings(state);
  }

  Future<void> toggleCatsMode() async {
    state = state.copyWith(catsMode: !state.catsMode);
    await _storageService.saveSettings(state);
  }

  Future<void> unlockCatsMode() async {
    state = state.copyWith(catsModeUnlocked: true);
    await _storageService.saveSettings(state);
  }

  Future<void> updateVolume(double volume) async {
    state = state.copyWith(volume: volume);
    await _storageService.saveSettings(state);
  }

  Future<void> updatePlaybackSpeed(double speed) async {
    state = state.copyWith(playbackSpeed: speed);
    await _storageService.saveSettings(state);
  }

  Future<void> updatePitch(double pitch) async {
    state = state.copyWith(pitch: pitch);
    await _storageService.saveSettings(state);
  }

  Future<void> updateLoopMode(LoopMode loopMode) async {
    state = state.copyWith(loopMode: loopMode);
    await _storageService.saveSettings(state);
  }

  Future<void> toggleShuffle() async {
    state = state.copyWith(shuffleEnabled: !state.shuffleEnabled);
    await _storageService.saveSettings(state);
  }

  Future<void> toggleAudioOnlyMode() async {
    state = state.copyWith(audioOnlyMode: !state.audioOnlyMode);
    await _storageService.saveSettings(state);
  }

  Future<void> updateVisualizerStyle(VisualizerStyle style) async {
    state = state.copyWith(visualizerStyle: style);
    await _storageService.saveSettings(state);
  }

  Future<void> saveLastPlaybackState({String? playlistId, int? trackIndex}) async {
    state = state.copyWith(
      lastPlaylistId: playlistId,
      lastTrackIndex: trackIndex,
    );
    await _storageService.saveSettings(state);
  }
}
