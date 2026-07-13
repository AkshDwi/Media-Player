/// Data model representing a single media item (audio or video file).
///
/// Each media item stores metadata needed for playback and display.
/// Supports Hive serialization for local persistence.
library;

class MediaItem {
  /// Unique identifier for this media item.
  final String id;

  /// Display title (extracted from filename if metadata unavailable).
  final String title;

  /// Artist name, if available.
  final String artist;

  /// Album name, if available.
  final String album;

  /// Absolute file path or URI to the media file.
  final String path;

  /// Duration in milliseconds (0 if unknown until playback starts).
  final int durationMs;

  /// Whether this is a video file (determined by file extension).
  final bool isVideo;

  /// Timestamp when the item was added to a playlist.
  final DateTime dateAdded;

  const MediaItem({
    required this.id,
    required this.title,
    this.artist = 'Unknown Artist',
    this.album = 'Unknown Album',
    required this.path,
    this.durationMs = 0,
    this.isVideo = false,
    required this.dateAdded,
  });

  /// Creates a copy with the specified fields replaced.
  MediaItem copyWith({
    String? id,
    String? title,
    String? artist,
    String? album,
    String? path,
    int? durationMs,
    bool? isVideo,
    DateTime? dateAdded,
  }) {
    return MediaItem(
      id: id ?? this.id,
      title: title ?? this.title,
      artist: artist ?? this.artist,
      album: album ?? this.album,
      path: path ?? this.path,
      durationMs: durationMs ?? this.durationMs,
      isVideo: isVideo ?? this.isVideo,
      dateAdded: dateAdded ?? this.dateAdded,
    );
  }

  /// Returns a formatted duration string (e.g., "3:45" or "1:02:30").
  String get formattedDuration {
    final duration = Duration(milliseconds: durationMs);
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  /// Common video file extensions used to determine [isVideo].
  static const videoExtensions = {
    'mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'mpeg', 'mpg',
    'm4v', '3gp', 'ts', 'vob', 'ogv',
  };

  /// Common audio file extensions.
  static const audioExtensions = {
    'mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a', 'wma', 'aiff', 'aif',
    'opus', 'alac', 'mid', 'midi', 'ape', 'wv', 'mka', 'dsf', 'dff',
  };

  /// Creates a MediaItem from a file path, inferring metadata from the filename.
  factory MediaItem.fromPath(String path, {String? id}) {
    final fileName = path.split(RegExp(r'[/\\]')).last;
    final extension = fileName.split('.').last.toLowerCase();
    final nameWithoutExt = fileName.contains('.')
        ? fileName.substring(0, fileName.lastIndexOf('.'))
        : fileName;

    return MediaItem(
      id: id ?? DateTime.now().microsecondsSinceEpoch.toString(),
      title: nameWithoutExt,
      path: path,
      isVideo: videoExtensions.contains(extension),
      dateAdded: DateTime.now(),
    );
  }

  /// Serializes to a JSON-compatible map for Hive storage.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'album': album,
      'path': path,
      'durationMs': durationMs,
      'isVideo': isVideo,
      'dateAdded': dateAdded.toIso8601String(),
    };
  }

  /// Deserializes from a JSON-compatible map.
  factory MediaItem.fromJson(Map<String, dynamic> json) {
    return MediaItem(
      id: json['id'] as String,
      title: json['title'] as String,
      artist: json['artist'] as String? ?? 'Unknown Artist',
      album: json['album'] as String? ?? 'Unknown Album',
      path: json['path'] as String,
      durationMs: json['durationMs'] as int? ?? 0,
      isVideo: json['isVideo'] as bool? ?? false,
      dateAdded: DateTime.parse(json['dateAdded'] as String),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MediaItem && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() => 'MediaItem(id: $id, title: $title, path: $path)';
}
