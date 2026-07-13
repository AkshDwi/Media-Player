import 'package:flutter/material.dart';
import '../models/media_item.dart';

class TrackTile extends StatelessWidget {
  final MediaItem track;
  final int index;
  final bool isCurrent;
  final VoidCallback onTap;
  final VoidCallback onRemove;

  const TrackTile({
    super.key,
    required this.track,
    required this.index,
    this.isCurrent = false,
    required this.onTap,
    required this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final activeColor = Theme.of(context).colorScheme.primary;

    return Card(
      color: isCurrent ? activeColor.withValues(alpha: 0.1) : null,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isCurrent
              ? activeColor
              : Theme.of(context).cardTheme.shape is RoundedRectangleBorder
                  ? (Theme.of(context).cardTheme.shape as RoundedRectangleBorder)
                      .side
                      .color
                  : Colors.transparent,
          width: isCurrent ? 1.5 : 1.0,
        ),
      ),
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: ListTile(
        onTap: onTap,
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Reorder drag handle
            ReorderableDragStartListener(
              index: index,
              child: const Icon(
                Icons.drag_indicator_rounded,
                color: Colors.grey,
              ),
            ),
            const SizedBox(width: 8),
            // Track icon (video vs audio)
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: isCurrent
                    ? activeColor.withValues(alpha: 0.2)
                    : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                track.isVideo ? Icons.video_library_rounded : Icons.music_note_rounded,
                color: isCurrent ? activeColor : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                size: 20,
              ),
            ),
          ],
        ),
        title: Text(
          track.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
            color: isCurrent ? activeColor : null,
          ),
        ),
        subtitle: Text(
          track.artist,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: isCurrent ? 0.8 : 0.5),
          ),
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              track.formattedDuration,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
              ),
            ),
            const SizedBox(width: 4),
            IconButton(
              icon: const Icon(Icons.remove_circle_outline_rounded, size: 20),
              color: Theme.of(context).colorScheme.error.withValues(alpha: 0.7),
              onPressed: onRemove,
              tooltip: 'Remove from playlist',
            ),
          ],
        ),
      ),
    );
  }
}
