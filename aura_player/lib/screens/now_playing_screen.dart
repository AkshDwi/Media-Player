import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';
import '../providers/settings_provider.dart';
import '../models/app_settings.dart';
import '../widgets/audio_visualizer.dart';
import '../widgets/video_player_widget.dart';
import '../widgets/player_controls.dart';
import '../widgets/seek_bar.dart';
import '../widgets/volume_slider.dart';
import '../widgets/speed_pitch_panel.dart';

class NowPlayingScreen extends ConsumerWidget {
  const NowPlayingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTrack = ref.watch(currentTrackProvider);
    final settings = ref.watch(settingsProvider);
    final settingsNotifier = ref.read(settingsProvider.notifier);
    final playerService = ref.watch(playerServiceProvider);

    if (currentTrack == null) {
      return Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.music_video_rounded,
                    size: 64,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  'No Media Loaded',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  'Choose an audio or video file from your Library to begin playback.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.6),
                      ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    final isVideo = currentTrack.isVideo;
    final isAudioOnly = settings.audioOnlyMode;
    final showVideoPlayer = isVideo && !isAudioOnly;

    return Scaffold(
      body: Stack(
        children: [
          // Background ambient gradient glow
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Theme.of(context).colorScheme.primary.withValues(alpha: 0.08),
                    Theme.of(context).colorScheme.secondary.withValues(alpha: 0.05),
                    Theme.of(context).scaffoldBackgroundColor,
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
          ),

          // Main content
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Column(
                children: [
                  // App Bar / Top Actions
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 28),
                        onPressed: () {
                          // Allow popping back to home tab library if we navigated to full screen
                          if (Navigator.of(context).canPop()) {
                            Navigator.of(context).pop();
                          }
                        },
                      ),
                      Text(
                        isVideo ? 'Video Player' : 'Music Player',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      // Audio-Only toggle (only visible for video tracks)
                      if (isVideo)
                        IconButton(
                          icon: Icon(
                            isAudioOnly ? Icons.audiotrack_rounded : Icons.video_library_rounded,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          onPressed: () {
                            settingsNotifier.toggleAudioOnlyMode();
                          },
                          tooltip: isAudioOnly ? 'Show video' : 'Play audio only',
                        )
                      else
                        const SizedBox(width: 48), // Spacer
                    ],
                  ),

                  // Screen Content: Visualizer or Video View
                  Expanded(
                    flex: 4,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24.0),
                      child: Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(24),
                          color: Colors.black.withValues(alpha: 0.03),
                          border: Border.all(
                            color: Theme.of(context).dividerTheme.color ??
                                Colors.grey.withValues(alpha: 0.1),
                          ),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: showVideoPlayer
                            ? const VideoPlayerWidget()
                            : const AudioVisualizer(),
                      ),
                    ),
                  ),

                  // Track Metadata (Title & Artist)
                  Expanded(
                    flex: 2,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          currentTrack.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                                fontWeight: FontWeight.bold,
                              ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          currentTrack.artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.6),
                              ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),

                  // Seek Bar
                  const SeekBar(),
                  const SizedBox(height: 12),

                  // Controls: Loop / Shuffle, Speed/Pitch, Transport
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      // Shuffle toggle
                      IconButton(
                        icon: Icon(
                          Icons.shuffle_rounded,
                          color: settings.shuffleEnabled
                              ? Theme.of(context).colorScheme.primary
                              : Colors.grey,
                        ),
                        onPressed: () {
                          playerService.setShuffle(!settings.shuffleEnabled);
                          settingsNotifier.toggleShuffle();
                        },
                        tooltip: 'Shuffle',
                      ),
                      // Loop Mode cycle
                      IconButton(
                        icon: Icon(
                          settings.loopMode == LoopMode.single
                              ? Icons.repeat_one_rounded
                              : Icons.repeat_rounded,
                          color: settings.loopMode != LoopMode.off
                              ? Theme.of(context).colorScheme.primary
                              : Colors.grey,
                        ),
                        onPressed: () {
                          final nextMode = LoopMode.values[(settings.loopMode.index + 1) % LoopMode.values.length];
                          settingsNotifier.updateLoopMode(nextMode);
                          playerService.setLoopMode(nextMode);
                        },
                        tooltip: 'Loop Mode',
                      ),
                      // Pitch and Speed panel toggle
                      IconButton(
                        icon: const Icon(Icons.tune_rounded),
                        onPressed: () {
                          showModalBottomSheet(
                            context: context,
                            builder: (context) => const SpeedPitchPanel(),
                          );
                        },
                        tooltip: 'Audio Effects',
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Playback control buttons
                  const PlayerControls(iconSize: 34),
                  const SizedBox(height: 24),

                  // Volume slider at the bottom
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16.0),
                    child: VolumeSlider(),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
