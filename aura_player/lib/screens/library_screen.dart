import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/playlist_provider.dart';
import '../services/playlist_io_service.dart';
import '../widgets/playlist_tile.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  void _showCreatePlaylistDialog(BuildContext context, WidgetRef ref) {
    final controller = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('New Playlist'),
          content: TextField(
            controller: controller,
            autofocus: true,
            decoration: const InputDecoration(
              hintText: 'Enter playlist name',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: () {
                final name = controller.text.trim();
                if (name.isNotEmpty) {
                  ref.read(playlistLibraryProvider.notifier).createPlaylist(name);
                  Navigator.of(context).pop();
                }
              },
              child: const Text('Create'),
            ),
          ],
        );
      },
    );
  }

  Future<void> _importPlaylist(BuildContext context, WidgetRef ref) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['m3u', 'm3u8', 'json'],
      );

      if (result != null && result.files.single.path != null) {
        final path = result.files.single.path!;
        final ioService = PlaylistIOService();
        final playlist = await ioService.importFromFile(path);

        await ref
            .read(playlistLibraryProvider.notifier)
            .importPlaylist(playlist);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Successfully imported playlist "${playlist.name}"'),
              backgroundColor: Theme.of(context).colorScheme.primary,
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to import playlist: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  Future<void> _exportPlaylist(
      BuildContext context, WidgetRef ref, dynamic playlist) async {
    try {
      // Find export directory
      String? outputFile = await FilePicker.platform.saveFile(
        dialogTitle: 'Export Playlist',
        fileName: '${playlist.name}.m3u',
        type: FileType.custom,
        allowedExtensions: ['m3u'],
      );

      if (outputFile != null) {
        final ioService = PlaylistIOService();
        await ioService.exportToM3UFile(playlist, outputFile);

        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Successfully exported playlist to "$outputFile"'),
              backgroundColor: Theme.of(context).colorScheme.primary,
            ),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to export playlist: $e'),
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playlists = ref.watch(playlistLibraryProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Playlists'),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded),
            onPressed: () => _importPlaylist(context, ref),
            tooltip: 'Import Playlist (M3U / JSON)',
          ),
          IconButton(
            icon: const Icon(Icons.add_rounded),
            onPressed: () => _showCreatePlaylistDialog(context, ref),
            tooltip: 'New Playlist',
          ),
        ],
      ),
      body: playlists.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.library_music_rounded,
                    size: 64,
                    color: Colors.grey.withValues(alpha: 0.5),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Playlists Found',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Create a new playlist or import one from storage.',
                    style: TextStyle(color: Colors.grey),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => _showCreatePlaylistDialog(context, ref),
                    icon: const Icon(Icons.add_rounded),
                    label: const Text('Create Playlist'),
                  ),
                ],
              ),
            )
          : ListView.builder(
              itemCount: playlists.length,
              padding: const EdgeInsets.only(top: 8, bottom: 24),
              itemBuilder: (context, index) {
                final playlist = playlists[index];
                return PlaylistTile(
                  playlist: playlist,
                  onExport: () => _exportPlaylist(context, ref, playlist),
                );
              },
            ),
    );
  }
}
