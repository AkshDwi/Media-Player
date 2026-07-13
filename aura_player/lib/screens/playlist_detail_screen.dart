import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/media_item.dart';
import '../providers/player_provider.dart';
import '../providers/playlist_provider.dart';
import '../widgets/track_tile.dart';

class PlaylistDetailScreen extends ConsumerWidget {
  final String playlistId;

  const PlaylistDetailScreen({super.key, required this.playlistId});

  Future<void> _addFiles(BuildContext context, WidgetRef ref) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        allowMultiple: true,
        type: FileType.custom,
        allowedExtensions: [
          ...MediaItem.audioExtensions,
          ...MediaItem.videoExtensions,
        ],
      );

      if (result != null && result.files.isNotEmpty) {
        final newItems = result.files
            .where((file) => file.path != null)
            .map((file) => MediaItem.fromPath(file.path!))
            .toList();

        await ref
            .read(playlistLibraryProvider.notifier)
            .addTracks(playlistId, newItems);
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to pick files: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  void _playPlaylist(WidgetRef ref, List<MediaItem> items, {int startIndex = 0}) {
    if (items.isEmpty) return;
    ref.read(playerServiceProvider).openPlaylist(
          items,
          startIndex: startIndex,
        );
  }

  void _playPlaylistShuffled(WidgetRef ref, List<MediaItem> items) {
    if (items.isEmpty) return;
    // Set shuffle state first
    ref.read(playerServiceProvider).setShuffle(true);
    ref.read(playerServiceProvider).openPlaylist(
          items,
          startIndex: 0,
        );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playlists = ref.watch(playlistLibraryProvider);
    final currentTrack = ref.watch(currentTrackProvider);

    // Find the current playlist in the library
    final playlist = playlists.firstWhere(
      (pl) => pl.id == playlistId,
      orElse: () => throw Exception('Playlist not found'),
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(playlist.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _addFiles(context, ref),
            tooltip: 'Add Audio/Video Files',
          ),
        ],
      ),
      body: playlist.items.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.audio_file_rounded,
                    size: 64,
                    color: Colors.grey.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Tracks in Playlist',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Add audio or video files from your device to begin.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => _addFiles(context, ref),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Add Files'),
                  ),
                ],
              ),
            )
          : Column(
              children: [
                // Top control buttons (Play & Shuffle)
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () => _playPlaylist(ref, playlist.items),
                          icon: const Icon(Icons.play_arrow_rounded),
                          label: const Text('Play All'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _playPlaylistShuffled(ref, playlist.items),
                          icon: const Icon(Icons.shuffle_rounded),
                          label: const Text('Shuffle'),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(),
                // Reorderable list of tracks
                Expanded(
                  child: ReorderableListView.builder(
                    itemCount: playlist.items.length,
                    onReorder: (oldIdx, newIdx) {
                      ref
                          .read(playlistLibraryProvider.notifier)
                          .reorderTracks(playlistId, oldIdx, newIdx);
                    },
                    padding: const EdgeInsets.only(bottom: 24),
                    itemBuilder: (context, index) {
                      final track = playlist.items[index];
                      // Track index comparison for active styling
                      final isCurrent = currentTrack != null &&
                          currentTrack.path == track.path;

                      return TrackTile(
                        key: ValueKey('${track.id}_$index'),
                        track: track,
                        index: index,
                        isCurrent: isCurrent,
                        onTap: () => _playPlaylist(ref, playlist.items, startIndex: index),
                        onRemove: () {
                          ref
                              .read(playlistLibraryProvider.notifier)
                              .removeTrackAt(playlistId, index);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
