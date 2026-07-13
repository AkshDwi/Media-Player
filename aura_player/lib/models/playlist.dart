/// Data model representing a playlist of media items.
///
/// Playlists are the primary organizational unit in Aura Player.
/// They support CRUD operations, reordering, and import/export.
library;

import 'media_item.dart';

class Playlist {
  /// Unique identifier for this playlist.
  final String id;

  /// User-visible name of the playlist.
  final String name;

  /// Ordered list of media items in this playlist.
  final List<MediaItem> items;

  /// When the playlist was created.
  final DateTime createdAt;

  /// When the playlist was last modified.
  final DateTime updatedAt;

  const Playlist({
    required this.id,
    required this.name,
    this.items = const [],
    required this.createdAt,
    required this.updatedAt,
  });

  /// Creates a copy with the specified fields replaced.
  Playlist copyWith({
    String? id,
    String? name,
    List<MediaItem>? items,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Playlist(
      id: id ?? this.id,
      name: name ?? this.name,
      items: items ?? this.items,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }

  /// Total number of tracks in the playlist.
  int get trackCount => items.length;

  /// Total duration of all tracks in milliseconds.
  int get totalDurationMs =>
      items.fold(0, (sum, item) => sum + item.durationMs);

  /// Formatted total duration string.
  String get formattedTotalDuration {
    final duration = Duration(milliseconds: totalDurationMs);
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);

    if (hours > 0) {
      return '$hours hr $minutes min';
    }
    return '$minutes min';
  }

  /// Creates a new empty playlist with the given name.
  factory Playlist.create({required String name, String? id}) {
    final now = DateTime.now();
    return Playlist(
      id: id ?? now.microsecondsSinceEpoch.toString(),
      name: name,
      items: [],
      createdAt: now,
      updatedAt: now,
    );
  }

  /// Serializes to a JSON-compatible map for Hive storage.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'items': items.map((item) => item.toJson()).toList(),
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  /// Deserializes from a JSON-compatible map.
  factory Playlist.fromJson(Map<String, dynamic> json) {
    return Playlist(
      id: json['id'] as String,
      name: json['name'] as String,
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => MediaItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Playlist && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() =>
      'Playlist(id: $id, name: $name, tracks: $trackCount)';
}
