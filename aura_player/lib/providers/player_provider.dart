import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit/media_kit.dart' as mk;
import '../models/media_item.dart';
import '../services/player_service.dart';

/// Provider for the [PlayerService] singleton.
final playerServiceProvider = Provider<PlayerService>((ref) {
  final playerService = PlayerService();
  ref.onDispose(() {
    playerService.dispose();
  });
  return playerService;
});

/// StreamProvider for the playing state (true = playing, false = paused/stopped).
final playingStateProvider = StreamProvider<bool>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.playingStream;
});

/// StreamProvider for the current position.
final positionStateProvider = StreamProvider<Duration>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.positionStream;
});

/// StreamProvider for the total duration.
final durationStateProvider = StreamProvider<Duration>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.durationStream;
});

/// StreamProvider for the buffer position.
final bufferStateProvider = StreamProvider<Duration>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.bufferStream;
});

/// StreamProvider for volume.
final volumeStateProvider = StreamProvider<double>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.volumeStream;
});

/// StreamProvider for rate.
final rateStateProvider = StreamProvider<double>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.rateStream;
});

/// StreamProvider for pitch.
final pitchStateProvider = StreamProvider<double>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.pitchStream;
});

/// StreamProvider for media_kit's playlist state.
final playerPlaylistStateProvider = StreamProvider<mk.Playlist>((ref) {
  final playerService = ref.watch(playerServiceProvider);
  return playerService.playlistStream;
});

/// Derived provider for current index in playlist.
final currentTrackIndexProvider = Provider<int>((ref) {
  final playlistState = ref.watch(playerPlaylistStateProvider).value;
  return playlistState?.index ?? -1;
});

/// Derived provider for current track metadata.
final currentTrackProvider = Provider<MediaItem?>((ref) {
  final playlistState = ref.watch(playerPlaylistStateProvider).value;
  if (playlistState == null ||
      playlistState.index < 0 ||
      playlistState.index >= playlistState.medias.length) {
    return null;
  }
  final media = playlistState.medias[playlistState.index];
  // Map back from media path.
  // In practice, we put metadata in extras or can infer from path.
  final id = media.extras?['id'] as String?;
  return MediaItem.fromPath(media.uri, id: id);
});
