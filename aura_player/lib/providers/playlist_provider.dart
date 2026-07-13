import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/media_item.dart';
import '../models/playlist.dart';
import '../services/storage_service.dart';
import 'settings_provider.dart';

/// State notifier provider for the user's playlist library.
final playlistLibraryProvider =
    StateNotifierProvider<PlaylistLibraryNotifier, List<Playlist>>((ref) {
  final storageService = ref.watch(storageServiceProvider);
  return PlaylistLibraryNotifier(storageService);
});

class PlaylistLibraryNotifier extends StateNotifier<List<Playlist>> {
  final StorageService _storageService;

  PlaylistLibraryNotifier(this._storageService) : super([]) {
    _loadPlaylists();
  }

  void _loadPlaylists() {
    state = _storageService.getAllPlaylists();
  }

  /// Creates a new playlist with the given name.
  Future<Playlist> createPlaylist(String name) async {
    final playlist = Playlist.create(name: name);
    state = [playlist, ...state];
    await _storageService.savePlaylist(playlist);
    return playlist;
  }

  /// Renames an existing playlist.
  Future<void> renamePlaylist(String id, String newName) async {
    state = [
      for (final pl in state)
        if (pl.id == id) pl.copyWith(name: newName) else pl
    ];
    final updated = state.firstWhere((pl) => pl.id == id);
    await _storageService.savePlaylist(updated);
  }

  /// Deletes a playlist.
  Future<void> deletePlaylist(String id) async {
    state = state.where((pl) => pl.id != id).toList();
    await _storageService.deletePlaylist(id);
  }

  /// Adds a track to a playlist.
  Future<void> addTrack(String playlistId, MediaItem item) async {
    state = [
      for (final pl in state)
        if (pl.id == playlistId)
          pl.copyWith(items: [...pl.items, item])
        else
          pl
    ];
    final updated = state.firstWhere((pl) => pl.id == playlistId);
    await _storageService.savePlaylist(updated);
  }

  /// Adds multiple tracks to a playlist.
  Future<void> addTracks(String playlistId, List<MediaItem> items) async {
    state = [
      for (final pl in state)
        if (pl.id == playlistId)
          pl.copyWith(items: [...pl.items, ...items])
        else
          pl
    ];
    final updated = state.firstWhere((pl) => pl.id == playlistId);
    await _storageService.savePlaylist(updated);
  }

  /// Removes a track from a playlist by its index (to handle duplicate files correctly).
  Future<void> removeTrackAt(String playlistId, int index) async {
    state = [
      for (final pl in state)
        if (pl.id == playlistId)
          pl.copyWith(
            items: List<MediaItem>.from(pl.items)..removeAt(index),
          )
        else
          pl
    ];
    final updated = state.firstWhere((pl) => pl.id == playlistId);
    await _storageService.savePlaylist(updated);
  }

  /// Reorders tracks in a playlist.
  Future<void> reorderTracks(String playlistId, int oldIndex, int newIndex) async {
    state = [
      for (final pl in state)
        if (pl.id == playlistId) () {
          final items = List<MediaItem>.from(pl.items);
          var correctedNewIndex = newIndex;
          if (oldIndex < newIndex) {
            correctedNewIndex -= 1;
          }
          final item = items.removeAt(oldIndex);
          items.insert(correctedNewIndex, item);
          return pl.copyWith(items: items);
        }()
        else
          pl
    ];
    final updated = state.firstWhere((pl) => pl.id == playlistId);
    await _storageService.savePlaylist(updated);
  }

  /// Imports a playlist externally (e.g., from M3U/JSON import service).
  Future<void> importPlaylist(Playlist playlist) async {
    // If it exists, append a suffix.
    var finalName = playlist.name;
    var count = 1;
    while (state.any((pl) => pl.name == finalName)) {
      finalName = '${playlist.name} ($count)';
      count++;
    }
    final imported = playlist.copyWith(
      id: DateTime.now().microsecondsSinceEpoch.toString(),
      name: finalName,
    );
    state = [imported, ...state];
    await _storageService.savePlaylist(imported);
  }
}
