/// Application settings model.
///
/// Stores user preferences that persist across sessions.
/// Serialized to/from Hive via JSON maps.
library;

/// Available loop modes for playback.
enum LoopMode {
  /// No looping — stop after playlist ends.
  off,

  /// Loop the current single track.
  single,

  /// Loop the entire playlist.
  playlist,
}

/// Available audio visualizer display styles.
enum VisualizerStyle {
  /// Vertical bars with gradient fills.
  spectrumBars,

  /// Radial bars arranged in a circle.
  circularSpectrum,

  /// Smooth oscillating waveform.
  waveform,

  /// Floating reactive particles.
  particles,
}

class AppSettings {
  /// Theme mode: 'light', 'dark', or 'system'.
  final String themeMode;

  /// Whether the Cats Mode easter egg is enabled.
  final bool catsMode;

  /// Whether the Cats Mode setting has been unlocked (via tapping version 7 times).
  final bool catsModeUnlocked;

  /// Last used volume level (0.0 - 200.0).
  final double volume;

  /// Last used playback speed (0.25 - 4.0).
  final double playbackSpeed;

  /// Last used pitch value (0.5 - 2.0).
  final double pitch;

  /// Current loop mode.
  final LoopMode loopMode;

  /// Whether shuffle is enabled.
  final bool shuffleEnabled;

  /// Whether audio-only mode is active (hides video).
  final bool audioOnlyMode;

  /// Which visualizer style to display.
  final VisualizerStyle visualizerStyle;

  /// ID of the last played playlist, if any.
  final String? lastPlaylistId;

  /// Index of the last played track in the playlist.
  final int lastTrackIndex;

  const AppSettings({
    this.themeMode = 'system',
    this.catsMode = false,
    this.catsModeUnlocked = false,
    this.volume = 100.0,
    this.playbackSpeed = 1.0,
    this.pitch = 1.0,
    this.loopMode = LoopMode.off,
    this.shuffleEnabled = false,
    this.audioOnlyMode = false,
    this.visualizerStyle = VisualizerStyle.spectrumBars,
    this.lastPlaylistId,
    this.lastTrackIndex = 0,
  });

  /// Creates a copy with the specified fields replaced.
  AppSettings copyWith({
    String? themeMode,
    bool? catsMode,
    bool? catsModeUnlocked,
    double? volume,
    double? playbackSpeed,
    double? pitch,
    LoopMode? loopMode,
    bool? shuffleEnabled,
    bool? audioOnlyMode,
    VisualizerStyle? visualizerStyle,
    String? lastPlaylistId,
    int? lastTrackIndex,
  }) {
    return AppSettings(
      themeMode: themeMode ?? this.themeMode,
      catsMode: catsMode ?? this.catsMode,
      catsModeUnlocked: catsModeUnlocked ?? this.catsModeUnlocked,
      volume: volume ?? this.volume,
      playbackSpeed: playbackSpeed ?? this.playbackSpeed,
      pitch: pitch ?? this.pitch,
      loopMode: loopMode ?? this.loopMode,
      shuffleEnabled: shuffleEnabled ?? this.shuffleEnabled,
      audioOnlyMode: audioOnlyMode ?? this.audioOnlyMode,
      visualizerStyle: visualizerStyle ?? this.visualizerStyle,
      lastPlaylistId: lastPlaylistId ?? this.lastPlaylistId,
      lastTrackIndex: lastTrackIndex ?? this.lastTrackIndex,
    );
  }

  /// Serializes to a JSON-compatible map.
  Map<String, dynamic> toJson() {
    return {
      'themeMode': themeMode,
      'catsMode': catsMode,
      'catsModeUnlocked': catsModeUnlocked,
      'volume': volume,
      'playbackSpeed': playbackSpeed,
      'pitch': pitch,
      'loopMode': loopMode.index,
      'shuffleEnabled': shuffleEnabled,
      'audioOnlyMode': audioOnlyMode,
      'visualizerStyle': visualizerStyle.index,
      'lastPlaylistId': lastPlaylistId,
      'lastTrackIndex': lastTrackIndex,
    };
  }

  /// Deserializes from a JSON-compatible map.
  factory AppSettings.fromJson(Map<String, dynamic> json) {
    return AppSettings(
      themeMode: json['themeMode'] as String? ?? 'system',
      catsMode: json['catsMode'] as bool? ?? false,
      catsModeUnlocked: json['catsModeUnlocked'] as bool? ?? false,
      volume: (json['volume'] as num?)?.toDouble() ?? 100.0,
      playbackSpeed: (json['playbackSpeed'] as num?)?.toDouble() ?? 1.0,
      pitch: (json['pitch'] as num?)?.toDouble() ?? 1.0,
      loopMode: LoopMode.values[json['loopMode'] as int? ?? 0],
      shuffleEnabled: json['shuffleEnabled'] as bool? ?? false,
      audioOnlyMode: json['audioOnlyMode'] as bool? ?? false,
      visualizerStyle:
          VisualizerStyle.values[json['visualizerStyle'] as int? ?? 0],
      lastPlaylistId: json['lastPlaylistId'] as String?,
      lastTrackIndex: json['lastTrackIndex'] as int? ?? 0,
    );
  }
}
