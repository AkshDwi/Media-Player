import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';
import '../providers/settings_provider.dart';

class SpeedPitchPanel extends ConsumerWidget {
  const SpeedPitchPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerService = ref.watch(playerServiceProvider);
    final rate = ref.watch(rateStateProvider).value ?? 1.0;
    final pitch = ref.watch(pitchStateProvider).value ?? 1.0;
    final settingsNotifier = ref.read(settingsProvider.notifier);

    return Container(
      padding: const EdgeInsets.all(24.0),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.withValues(alpha: 0.3),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Playback Effects',
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),

          // Speed Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Speed (Tempo)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              TextButton(
                onPressed: () {
                  playerService.setRate(1.0);
                  settingsNotifier.updatePlaybackSpeed(1.0);
                },
                child: const Text('Reset (1.0x)'),
              ),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.slow_motion_video_rounded, size: 20, color: Colors.grey),
              Expanded(
                child: Slider(
                  min: 0.25,
                  max: 4.0,
                  divisions: 15, // steps of 0.25
                  value: rate.clamp(0.25, 4.0),
                  onChanged: (val) {
                    playerService.setRate(val);
                    settingsNotifier.updatePlaybackSpeed(val);
                  },
                ),
              ),
              SizedBox(
                width: 50,
                child: Text(
                  '${rate.toStringAsFixed(2)}x',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Pitch Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Pitch (Frequency)',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
              ),
              TextButton(
                onPressed: () {
                  playerService.setPitch(1.0);
                  settingsNotifier.updatePitch(1.0);
                },
                child: const Text('Reset (1.0x)'),
              ),
            ],
          ),
          Row(
            children: [
              const Icon(Icons.music_note_rounded, size: 20, color: Colors.grey),
              Expanded(
                child: Slider(
                  min: 0.5,
                  max: 2.0,
                  divisions: 15, // steps of 0.1
                  value: pitch.clamp(0.5, 2.0),
                  onChanged: (val) {
                    playerService.setPitch(val);
                    settingsNotifier.updatePitch(val);
                  },
                ),
              ),
              SizedBox(
                width: 50,
                child: Text(
                  '${pitch.toStringAsFixed(2)}x',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                  textAlign: TextAlign.right,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
        ],
      ),
    );
  }
}
