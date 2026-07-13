import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';
import '../providers/settings_provider.dart';

class VolumeSlider extends ConsumerWidget {
  final bool vertical;

  const VolumeSlider({super.key, this.vertical = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final playerService = ref.watch(playerServiceProvider);
    final volume = ref.watch(volumeStateProvider).value ?? 100.0;
    final settingsNotifier = ref.read(settingsProvider.notifier);

    final isMuted = volume == 0.0;

    IconData getVolumeIcon() {
      if (isMuted) return Icons.volume_off_rounded;
      if (volume < 50.0) return Icons.volume_mute_rounded;
      if (volume <= 100.0) return Icons.volume_down_rounded;
      return Icons.volume_up_rounded; // Above 100% or amplified
    }

    Color getSliderColor() {
      if (volume > 100.0) {
        // Red/Orange warning for amplification
        return Colors.orangeAccent;
      }
      return Theme.of(context).colorScheme.primary;
    }

    Widget buildSlider() {
      return SliderTheme(
        data: SliderTheme.of(context).copyWith(
          activeTrackColor: getSliderColor(),
          thumbColor: volume > 100.0 ? Colors.orange : Colors.white,
          overlayColor: getSliderColor().withValues(alpha: 0.2),
          trackHeight: 4,
          thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
        ),
        child: Slider(
          min: 0.0,
          max: 200.0,
          value: volume,
          onChanged: (val) {
            playerService.setVolume(val);
            settingsNotifier.updateVolume(val);
          },
        ),
      );
    }

    if (vertical) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '${volume.round()}%',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: volume > 100.0 ? Colors.orange : Colors.grey,
            ),
          ),
          const SizedBox(height: 4),
          Expanded(
            child: RotatedBox(
              quarterTurns: 3,
              child: buildSlider(),
            ),
          ),
          const SizedBox(height: 4),
          IconButton(
            icon: Icon(getVolumeIcon()),
            onPressed: () {
              if (isMuted) {
                playerService.setVolume(100.0);
                settingsNotifier.updateVolume(100.0);
              } else {
                playerService.setVolume(0.0);
                settingsNotifier.updateVolume(0.0);
              }
            },
            tooltip: 'Mute/Unmute',
          ),
        ],
      );
    }

    return Row(
      children: [
        IconButton(
          icon: Icon(getVolumeIcon(), color: volume > 100.0 ? Colors.orangeAccent : null),
          onPressed: () {
            if (isMuted) {
              playerService.setVolume(100.0);
              settingsNotifier.updateVolume(100.0);
            } else {
              playerService.setVolume(0.0);
              settingsNotifier.updateVolume(0.0);
            }
          },
          tooltip: 'Mute/Unmute',
        ),
        Expanded(child: buildSlider()),
        const SizedBox(width: 8),
        SizedBox(
          width: 42,
          child: Text(
            '${volume.round()}%',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: volume > 100.0 ? Colors.orange : null,
            ),
          ),
        ),
      ],
    );
  }
}
