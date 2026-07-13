import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';

class SeekBar extends ConsumerStatefulWidget {
  const SeekBar({super.key});

  @override
  ConsumerState<SeekBar> createState() => _SeekBarState();
}

class _SeekBarState extends ConsumerState<SeekBar> {
  double? _dragValue;

  String _formatDuration(Duration duration) {
    final hours = duration.inHours;
    final minutes = duration.inMinutes.remainder(60);
    final seconds = duration.inSeconds.remainder(60);

    if (hours > 0) {
      return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    }
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final position = ref.watch(positionStateProvider).value ?? Duration.zero;
    final duration = ref.watch(durationStateProvider).value ?? Duration.zero;
    final buffer = ref.watch(bufferStateProvider).value ?? Duration.zero;
    final playerService = ref.watch(playerServiceProvider);

    final totalMs = duration.inMilliseconds.toDouble();
    final currentMs = position.inMilliseconds.toDouble().clamp(0.0, totalMs);
    final bufferMs = buffer.inMilliseconds.toDouble().clamp(0.0, totalMs);

    final double displayValue = _dragValue ?? currentMs;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            // Buffered track visual indicator
            if (totalMs > 0)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 22.0),
                child: SizedBox(
                  height: 4,
                  width: double.infinity,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(2),
                    child: LinearProgressIndicator(
                      value: bufferMs / totalMs,
                      backgroundColor: Colors.transparent,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Theme.of(context).colorScheme.primary.withValues(alpha: 0.15),
                      ),
                    ),
                  ),
                ),
              ),
            // The active interactive Slider
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 4,
                activeTrackColor: Theme.of(context).colorScheme.primary,
                inactiveTrackColor: Colors.grey.withValues(alpha: 0.2),
                thumbColor: Colors.white,
                overlayColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.2),
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              ),
              child: Slider(
                min: 0.0,
                max: totalMs > 0 ? totalMs : 1.0,
                value: totalMs > 0 ? displayValue.clamp(0.0, totalMs) : 0.0,
                onChanged: (value) {
                  setState(() {
                    _dragValue = value;
                  });
                },
                onChangeEnd: (value) {
                  playerService.seek(Duration(milliseconds: value.toInt()));
                  setState(() {
                    _dragValue = null;
                  });
                },
              ),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _formatDuration(Duration(milliseconds: displayValue.toInt())),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                      fontSize: 12,
                    ),
              ),
              Text(
                _formatDuration(duration),
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                      fontSize: 12,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
