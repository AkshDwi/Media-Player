import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';

class PlayerControls extends ConsumerWidget {
  final double iconSize;
  final bool showStopButton;
  final bool showSkipButtons;

  const PlayerControls({
    super.key,
    this.iconSize = 32.0,
    this.showStopButton = true,
    this.showSkipButtons = true,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerService = ref.watch(playerServiceProvider);
    final isPlaying = ref.watch(playingStateProvider).value ?? false;
    final playlist = ref.watch(playerPlaylistStateProvider).value;

    final hasPlaylist = playlist != null && playlist.medias.isNotEmpty;
    final isFirst = hasPlaylist && playlist.index == 0;
    final isLast = hasPlaylist && playlist.index == playlist.medias.length - 1;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Shuffle & Loop quick states (if skip controls are requested we can place them next to play/pause)
        if (showSkipButtons) ...[
          // Previous Track
          IconButton(
            iconSize: iconSize * 0.8,
            icon: const Icon(Icons.skip_previous_rounded),
            onPressed: hasPlaylist && !isFirst
                ? () => playerService.previous()
                : null,
            tooltip: 'Previous Track',
          ),
          const SizedBox(width: 8),
          // Rewind 10s
          IconButton(
            iconSize: iconSize * 0.8,
            icon: const Icon(Icons.replay_10_rounded),
            onPressed: () => playerService.rewind(),
            tooltip: 'Rewind 10 Seconds',
          ),
          const SizedBox(width: 12),
        ],

        // Play/Pause button (largest)
        Container(
          height: iconSize * 1.8,
          width: iconSize * 1.8,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: const LinearGradient(
              colors: [Color(0xFF8B5CF6), Color(0xFF06B6D4)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                blurRadius: 16,
                spreadRadius: 2,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => playerService.playOrPause(),
              child: Icon(
                isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                size: iconSize * 1.1,
                color: Colors.white,
              ),
            ),
          ),
        ),

        if (showSkipButtons) ...[
          const SizedBox(width: 12),
          // Fast Forward 10s
          IconButton(
            iconSize: iconSize * 0.8,
            icon: const Icon(Icons.forward_10_rounded),
            onPressed: () => playerService.fastForward(),
            tooltip: 'Fast Forward 10 Seconds',
          ),
          const SizedBox(width: 8),
          // Next Track
          IconButton(
            iconSize: iconSize * 0.8,
            icon: const Icon(Icons.skip_next_rounded),
            onPressed: hasPlaylist && !isLast
                ? () => playerService.next()
                : null,
            tooltip: 'Next Track',
          ),
        ],

        if (showStopButton) ...[
          const SizedBox(width: 12),
          // Stop Button
          IconButton(
            iconSize: iconSize * 0.7,
            icon: const Icon(Icons.stop_rounded),
            onPressed: () => playerService.stop(),
            tooltip: 'Stop Playback',
          ),
        ],
      ],
    );
  }
}
