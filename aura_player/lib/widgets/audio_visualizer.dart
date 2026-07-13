import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/app_settings.dart';
import '../providers/player_provider.dart';
import '../providers/settings_provider.dart';

class AudioVisualizer extends ConsumerStatefulWidget {
  const AudioVisualizer({super.key});

  @override
  ConsumerState<AudioVisualizer> createState() => _AudioVisualizerState();
}

class _AudioVisualizerState extends ConsumerState<AudioVisualizer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animationController;
  final Random _random = Random();
  final List<double> _frequencies = List.generate(40, (_) => 0.0);
  final List<_Particle> _particles = List.generate(30, (_) => _Particle());

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _updateFrequencies(bool isPlaying, double volume) {
    if (!isPlaying || volume == 0) {
      for (int i = 0; i < _frequencies.length; i++) {
        _frequencies[i] = _frequencies[i] * 0.9; // decay to 0
      }
      return;
    }

    final ampMultiplier = (volume / 100.0).clamp(0.1, 2.0);

    for (int i = 0; i < _frequencies.length; i++) {
      // Create some organic wave movements
      final wave = sin(i * 0.5 + _animationController.value * pi * 4) * 0.3 + 0.7;
      final target = (_random.nextDouble() * 0.5 + 0.5) * wave * ampMultiplier;
      // Smooth interpolation (lerp)
      _frequencies[i] = _frequencies[i] * 0.7 + target * 0.3;
    }
  }

  void _updateParticles(bool isPlaying, double volume) {
    final speedMultiplier = isPlaying ? (volume / 100.0).clamp(0.2, 2.0) : 0.1;

    for (final p in _particles) {
      p.y -= p.speed * speedMultiplier;
      p.x += sin(p.y * 0.05 + p.offset) * 0.5;

      // Reset when floating off top
      if (p.y < 0) {
        p.reset(_random);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPlaying = ref.watch(playingStateProvider).value ?? false;
    final volume = ref.watch(volumeStateProvider).value ?? 100.0;
    final settings = ref.watch(settingsProvider);

    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        _updateFrequencies(isPlaying, volume);
        _updateParticles(isPlaying, volume);

        return ClipRect(
          child: CustomPaint(
            painter: _VisualizerPainter(
              style: settings.visualizerStyle,
              frequencies: _frequencies,
              particles: _particles,
              animationValue: _animationController.value,
              theme: Theme.of(context),
            ),
            child: const SizedBox.expand(),
          ),
        );
      },
    );
  }
}

class _Particle {
  late double x;
  late double y;
  late double size;
  late double speed;
  late double offset;
  late Color color;

  _Particle() {
    final rand = Random();
    reset(rand, initial: true);
  }

  void reset(Random rand, {bool initial = false}) {
    x = rand.nextDouble() * 400; // Will be scaled in painter
    y = initial ? rand.nextDouble() * 400 : 400;
    size = 2.0 + rand.nextDouble() * 6.0;
    speed = 0.5 + rand.nextDouble() * 1.5;
    offset = rand.nextDouble() * pi * 2;

    final colors = [
      const Color(0xFF8B5CF6),
      const Color(0xFF06B6D4),
      const Color(0xFFA855F7),
      Colors.cyanAccent,
    ];
    color = colors[rand.nextInt(colors.length)].withValues(alpha: 0.3 + rand.nextDouble() * 0.5);
  }
}

class _VisualizerPainter extends CustomPainter {
  final VisualizerStyle style;
  final List<double> frequencies;
  final List<_Particle> particles;
  final double animationValue;
  final ThemeData theme;

  _VisualizerPainter({
    required this.style,
    required this.frequencies,
    required this.particles,
    required this.animationValue,
    required this.theme,
  });

  @override
  void paint(Canvas canvas, Size size) {
    switch (style) {
      case VisualizerStyle.spectrumBars:
        _paintSpectrumBars(canvas, size);
        break;
      case VisualizerStyle.circularSpectrum:
        _paintCircularSpectrum(canvas, size);
        break;
      case VisualizerStyle.waveform:
        _paintWaveform(canvas, size);
        break;
      case VisualizerStyle.particles:
        _paintParticles(canvas, size);
        break;
    }
  }

  void _paintSpectrumBars(Canvas canvas, Size size) {
    final barCount = frequencies.length;
    final width = size.width;
    final height = size.height;
    final barWidth = (width / barCount) * 0.7;
    final spacing = (width / barCount) * 0.3;

    final paint = Paint()
      ..shader = LinearGradient(
        colors: [theme.colorScheme.primary, theme.colorScheme.secondary],
        begin: Alignment.bottomCenter,
        end: Alignment.topCenter,
      ).createShader(Rect.fromLTWH(0, 0, width, height));

    for (int i = 0; i < barCount; i++) {
      final barHeight = frequencies[i] * height * 0.8;
      final x = i * (barWidth + spacing) + spacing / 2;
      final y = height - barHeight;

      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, barWidth, barHeight),
        const Radius.circular(4),
      );
      canvas.drawRRect(rect, paint);
    }
  }

  void _paintCircularSpectrum(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) * 0.25;
    final barCount = frequencies.length;
    final angleStep = (2 * pi) / barCount;

    final paint = Paint()
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        colors: [
          theme.colorScheme.primary,
          theme.colorScheme.secondary,
          theme.colorScheme.primary,
        ],
      ).createShader(Rect.fromCircle(center: center, radius: radius * 2));

    // Outer circle
    for (int i = 0; i < barCount; i++) {
      final angle = i * angleStep + (animationValue * pi * 0.2);
      final amplitude = frequencies[i] * radius * 0.8;

      final startPoint = Offset(
        center.dx + radius * cos(angle),
        center.dy + radius * sin(angle),
      );
      final endPoint = Offset(
        center.dx + (radius + amplitude) * cos(angle),
        center.dy + (radius + amplitude) * sin(angle),
      );

      canvas.drawLine(startPoint, endPoint, paint);
    }

    // Inner glowing ring
    final ringPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..color = theme.colorScheme.primary.withValues(alpha: 0.3);
    canvas.drawCircle(center, radius, ringPaint);
  }

  void _paintWaveform(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;
    final midY = height / 2;

    final path = Path();
    path.moveTo(0, midY);

    for (double x = 0; x < width; x += 2) {
      // Multiple sine waves for complexity
      final idx = ((x / width) * frequencies.length).floor().clamp(0, frequencies.length - 1);
      final amp = frequencies[idx] * height * 0.35;
      
      final y = midY +
          sin(x * 0.02 + animationValue * pi * 4) * amp +
          cos(x * 0.01 - animationValue * pi * 2) * (amp * 0.3);

      path.lineTo(x, y);
    }

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round
      ..shader = LinearGradient(
        colors: [theme.colorScheme.primary, theme.colorScheme.secondary],
      ).createShader(Rect.fromLTWH(0, 0, width, height));

    canvas.drawPath(path, paint);

    // Mirror path with lower opacity
    final shadowPath = Path();
    shadowPath.moveTo(0, midY);
    for (double x = 0; x < width; x += 2) {
      final idx = ((x / width) * frequencies.length).floor().clamp(0, frequencies.length - 1);
      final amp = frequencies[idx] * height * 0.35;
      final y = midY -
          sin(x * 0.02 + animationValue * pi * 4) * amp +
          cos(x * 0.01 - animationValue * pi * 2) * (amp * 0.3);
      shadowPath.lineTo(x, y);
    }

    final shadowPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..shader = LinearGradient(
        colors: [
          theme.colorScheme.primary.withValues(alpha: 0.4),
          theme.colorScheme.secondary.withValues(alpha: 0.4),
        ],
      ).createShader(Rect.fromLTWH(0, 0, width, height));

    canvas.drawPath(shadowPath, shadowPaint);
  }

  void _paintParticles(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // Draw lines/glows connecting close particles
    final linePaint = Paint()..strokeWidth = 0.5;

    for (int i = 0; i < particles.length; i++) {
      final p1 = particles[i];
      final px1 = (p1.x / 400) * width;
      final py1 = (p1.y / 400) * height;

      for (int j = i + 1; j < particles.length; j++) {
        final p2 = particles[j];
        final px2 = (p2.x / 400) * width;
        final py2 = (p2.y / 400) * height;

        final dist = sqrt(pow(px1 - px2, 2) + pow(py1 - py2, 2));
        if (dist < 80) {
          final opacity = (1.0 - (dist / 80.0)) * 0.25;
          linePaint.color = theme.colorScheme.primary.withValues(alpha: opacity);
          canvas.drawLine(Offset(px1, py1), Offset(px2, py2), linePaint);
        }
      }
    }

    // Draw individual particles
    final paint = Paint()..style = PaintingStyle.fill;
    for (final p in particles) {
      final px = (p.x / 400) * width;
      final py = (p.y / 400) * height;

      paint.color = p.color;
      canvas.drawCircle(Offset(px, py), p.size, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
