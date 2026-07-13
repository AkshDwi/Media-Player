/// Import/export service for playlists.
///
/// Supports M3U (widely compatible) and JSON (lossless metadata) formats.
/// Used for sharing playlists between devices or backing up data.
library;

import 'dart:convert';
import 'dart:io';
import '../models/media_item.dart';
import '../models/playlist.dart';

class PlaylistIOService {
  // ---------------------------------------------------------------------------
  // M3U Export
  // ---------------------------------------------------------------------------

  /// Exports a playlist to M3U format string.
  ///
  /// M3U is a simple text format supported by most media players:
  /// ```
  /// #EXTM3U
  /// #EXTINF:duration,title
  /// /path/to/file.mp3
  /// ```
  String exportToM3U(Playlist playlist) {
    final buffer = StringBuffer();
    buffer.writeln('#EXTM3U');
    buffer.writeln('#PLAYLIST:${playlist.name}');

    for (final item in playlist.items) {
      final durationSec = (item.durationMs / 1000).round();
      buffer.writeln('#EXTINF:$durationSec,${item.artist} - ${item.title}');
      buffer.writeln(item.path);
    }

    return buffer.toString();
  }

  /// Writes an M3U playlist to a file.
  Future<void> exportToM3UFile(Playlist playlist, String filePath) async {
    final content = exportToM3U(playlist);
    await File(filePath).writeAsString(content);
  }

  // ---------------------------------------------------------------------------
  // M3U Import
  // ---------------------------------------------------------------------------

  /// Imports a playlist from an M3U format string.
  ///
  /// Parses #EXTINF lines for metadata and file paths for media items.
  Playlist importFromM3U(String content, {String? name}) {
    final lines = content.split('\n').map((l) => l.trim()).toList();
    final items = <MediaItem>[];

    String playlistName = name ?? 'Imported Playlist';
    String? pendingTitle;
    String? pendingArtist;
    int pendingDuration = 0;

    for (final line in lines) {
      if (line.isEmpty || line == '#EXTM3U') continue;

      // Extract playlist name from #PLAYLIST directive.
      if (line.startsWith('#PLAYLIST:')) {
        playlistName = name ?? line.substring('#PLAYLIST:'.length).trim();
        continue;
      }

      // Parse extended info: #EXTINF:duration,artist - title
      if (line.startsWith('#EXTINF:')) {
        final info = line.substring('#EXTINF:'.length);
        final commaIdx = info.indexOf(',');
        if (commaIdx >= 0) {
          pendingDuration =
              (int.tryParse(info.substring(0, commaIdx).trim()) ?? 0) * 1000;
          final displayName = info.substring(commaIdx + 1).trim();

          // Try to split "Artist - Title".
          final dashIdx = displayName.indexOf(' - ');
          if (dashIdx >= 0) {
            pendingArtist = displayName.substring(0, dashIdx).trim();
            pendingTitle = displayName.substring(dashIdx + 3).trim();
          } else {
            pendingTitle = displayName;
            pendingArtist = null;
          }
        }
        continue;
      }

      // Skip other comments/directives.
      if (line.startsWith('#')) continue;

      // This line is a file path.
      final item = MediaItem.fromPath(line).copyWith(
        title: pendingTitle,
        artist: pendingArtist ?? 'Unknown Artist',
        durationMs: pendingDuration,
      );
      items.add(item);

      // Reset pending metadata.
      pendingTitle = null;
      pendingArtist = null;
      pendingDuration = 0;
    }

    return Playlist.create(name: playlistName).copyWith(items: items);
  }

  /// Reads and imports an M3U playlist from a file.
  Future<Playlist> importFromM3UFile(String filePath, {String? name}) async {
    final content = await File(filePath).readAsString();
    return importFromM3U(content, name: name);
  }

  // ---------------------------------------------------------------------------
  // JSON Export
  // ---------------------------------------------------------------------------

  /// Exports a playlist to a JSON string (lossless — preserves all metadata).
  String exportToJSON(Playlist playlist) {
    return const JsonEncoder.withIndent('  ').convert(playlist.toJson());
  }

  /// Writes a JSON playlist to a file.
  Future<void> exportToJSONFile(Playlist playlist, String filePath) async {
    final content = exportToJSON(playlist);
    await File(filePath).writeAsString(content);
  }

  // ---------------------------------------------------------------------------
  // JSON Import
  // ---------------------------------------------------------------------------

  /// Imports a playlist from a JSON string.
  Playlist importFromJSON(String content) {
    final map = jsonDecode(content) as Map<String, dynamic>;
    return Playlist.fromJson(map);
  }

  /// Reads and imports a JSON playlist from a file.
  Future<Playlist> importFromJSONFile(String filePath) async {
    final content = await File(filePath).readAsString();
    return importFromJSON(content);
  }

  // ---------------------------------------------------------------------------
  // Auto-detect Format
  // ---------------------------------------------------------------------------

  /// Imports a playlist from a file, auto-detecting the format by extension.
  Future<Playlist> importFromFile(String filePath) async {
    final extension = filePath.split('.').last.toLowerCase();
    switch (extension) {
      case 'json':
        return importFromJSONFile(filePath);
      case 'm3u':
      case 'm3u8':
        return importFromM3UFile(filePath);
      default:
        throw FormatException('Unsupported playlist format: .$extension');
    }
  }
}
