/// Core media playback service wrapping media_kit's Player.
///
/// Provides a clean API over media_kit for play, pause, stop, seek,
/// next, previous, rate, pitch, volume, loop modes, shuffle, and
/// playlist management. Exposes reactive streams for UI binding.
library;

import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../models/media_item.dart' as models;
import '../models/app_settings.dart' as settings;

/// Wraps the media_kit [Player] to provide a simplified, app-specific API.
class PlayerService {
  late final Player _player;
  late final VideoController _videoController;

  /// Expose raw player instance for video controllers.
  Player get player => _player;

  /// Whether the video output widget should be displayed.
  bool showVideo = true;

  PlayerService() {
    _player = Player(
      configuration: const PlayerConfiguration(
        // Enable pitch shifting support.
        pitch: true,
        // Buffer size — reasonable for both audio and video.
        bufferSize: 32 * 1024 * 1024, // 32 MB
      ),
    );
  }

  /// Initializes the video controller. Call after construction.
  void initVideoController(VideoController controller) {
    _videoController = controller;
  }

  /// The underlying video controller for the Video widget.
  VideoController get videoController => _videoController;

  // ---------------------------------------------------------------------------
  // Reactive Streams — bind these to your UI via Riverpod
  // ---------------------------------------------------------------------------

  /// Whether media is currently playing.
  Stream<bool> get playingStream => _player.stream.playing;

  /// Whether playback has completed.
  Stream<bool> get completedStream => _player.stream.completed;

  /// Current playback position.
  Stream<Duration> get positionStream => _player.stream.position;

  /// Total duration of the current media.
  Stream<Duration> get durationStream => _player.stream.duration;

  /// Buffered duration.
  Stream<Duration> get bufferStream => _player.stream.buffer;

  /// Current volume (0.0 - 200.0).
  Stream<double> get volumeStream => _player.stream.volume;

  /// Current playback rate.
  Stream<double> get rateStream => _player.stream.rate;

  /// Current pitch value.
  Stream<double> get pitchStream => _player.stream.pitch;

  /// Current playlist and index information.
  Stream<Playlist> get playlistStream => _player.stream.playlist;

  /// Audio tracks available in the current media.
  Stream<List<AudioTrack>> get audioTracksStream =>
      _player.stream.tracks.map((tracks) => tracks.audio);

  /// Video tracks available in the current media.
  Stream<List<VideoTrack>> get videoTracksStream =>
      _player.stream.tracks.map((tracks) => tracks.video);

  // ---------------------------------------------------------------------------
  // Current State (synchronous getters)
  // ---------------------------------------------------------------------------

  bool get isPlaying => _player.state.playing;
  bool get isCompleted => _player.state.completed;
  Duration get position => _player.state.position;
  Duration get duration => _player.state.duration;
  Duration get buffer => _player.state.buffer;
  double get volume => _player.state.volume;
  double get rate => _player.state.rate;
  double get pitch => _player.state.pitch;
  Playlist get playlist => _player.state.playlist;
  int get currentIndex => _player.state.playlist.index;

  // ---------------------------------------------------------------------------
  // Playback Controls
  // ---------------------------------------------------------------------------

  /// Opens a list of media items as a playlist and begins playback.
  Future<void> openPlaylist(
    List<models.MediaItem> items, {
    int startIndex = 0,
    bool autoPlay = true,
  }) async {
    final medias = items
        .map((item) => Media(item.path, extras: {'id': item.id}))
        .toList();

    await _player.open(
      Playlist(medias, index: startIndex),
      play: autoPlay,
    );
  }

  /// Opens a single media item for playback.
  Future<void> openSingle(models.MediaItem item,
      {bool autoPlay = true}) async {
    await _player.open(
      Media(item.path, extras: {'id': item.id}),
      play: autoPlay,
    );
  }

  /// Toggles between play and pause.
  Future<void> playOrPause() async {
    await _player.playOrPause();
  }

  /// Starts playback.
  Future<void> play() async {
    await _player.play();
  }

  /// Pauses playback.
  Future<void> pause() async {
    await _player.pause();
  }

  /// Stops playback and resets position to the beginning.
  Future<void> stop() async {
    await _player.stop();
  }

  /// Seeks to the given position in the current media.
  Future<void> seek(Duration position) async {
    await _player.seek(position);
  }

  /// Skips to the next track in the playlist.
  Future<void> next() async {
    await _player.next();
  }

  /// Skips to the previous track in the playlist.
  Future<void> previous() async {
    await _player.previous();
  }

  /// Jumps to a specific index in the playlist.
  Future<void> jumpTo(int index) async {
    await _player.jump(index);
  }

  // ---------------------------------------------------------------------------
  // Fast-forward & Rewind
  // ---------------------------------------------------------------------------

  /// Fast-forwards by the given duration (default: 10 seconds).
  Future<void> fastForward({Duration amount = const Duration(seconds: 10)}) async {
    final target = position + amount;
    final clamped = target > duration ? duration : target;
    await seek(clamped);
  }

  /// Rewinds by the given duration (default: 10 seconds).
  Future<void> rewind({Duration amount = const Duration(seconds: 10)}) async {
    final target = position - amount;
    final clamped = target < Duration.zero ? Duration.zero : target;
    await seek(clamped);
  }

  // ---------------------------------------------------------------------------
  // Volume, Rate, Pitch
  // ---------------------------------------------------------------------------

  /// Sets the volume level (0.0 to 200.0).
  /// Values above 100.0 use software amplification.
  Future<void> setVolume(double value) async {
    await _player.setVolume(value.clamp(0.0, 200.0));
  }

  /// Sets the playback speed (0.25 to 4.0).
  Future<void> setRate(double value) async {
    await _player.setRate(value.clamp(0.25, 4.0));
  }

  /// Sets the audio pitch independently of speed (0.5 to 2.0).
  Future<void> setPitch(double value) async {
    await _player.setPitch(value.clamp(0.5, 2.0));
  }

  // ---------------------------------------------------------------------------
  // Loop & Shuffle
  // ---------------------------------------------------------------------------

  /// Sets the playlist loop mode.
  Future<void> setPlaylistMode(PlaylistMode mode) async {
    await _player.setPlaylistMode(mode);
  }

  /// Sets loop mode using application level LoopMode enum.
  Future<void> setLoopMode(settings.LoopMode mode) async {
    PlaylistMode mkMode;
    switch (mode) {
      case settings.LoopMode.single:
        mkMode = PlaylistMode.single;
        break;
      case settings.LoopMode.playlist:
        mkMode = PlaylistMode.loop;
        break;
      default:
        mkMode = PlaylistMode.none;
    }
    await setPlaylistMode(mkMode);
  }

  /// Enables or disables shuffle.
  Future<void> setShuffle(bool enabled) async {
    await _player.setShuffle(enabled);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /// Disposes all resources. Call when the app is closing.
  Future<void> dispose() async {
    await _player.dispose();
  }
}
