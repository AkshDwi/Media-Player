import 'dart:async';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/settings_provider.dart';

class CatsOverlay extends ConsumerStatefulWidget {
  final Widget child;

  const CatsOverlay({super.key, required this.child});

  @override
  ConsumerState<CatsOverlay> createState() => _CatsOverlayState();
}

class _CatsOverlayState extends ConsumerState<CatsOverlay> {
  final List<_ActiveCat> _cats = [];
  Timer? _timer;
  final Random _random = Random();

  final List<String> _catEmojis = ['🐱', '😸', '😹', '😻', '😼', '😽', '😾', '😿', '🙀', '🐈', '🐈‍⬛', '🦁', '🐯', '🐾'];

  @override
  void initState() {
    super.initState();
    _startSpawner();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startSpawner() {
    // Spawns a cat every 15 to 45 seconds if Cats Mode is enabled.
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final settings = ref.read(settingsProvider);
      if (!settings.catsMode) {
        if (_cats.isNotEmpty) {
          setState(() {
            _cats.clear();
          });
        }
        return;
      }

      // 3% chance every second to spawn a cat.
      if (_random.nextDouble() < 0.03 && _cats.length < 5) {
        _spawnCat();
      }
    });
  }

  void _spawnCat() {
    final id = DateTime.now().microsecondsSinceEpoch;
    final emoji = _catEmojis[_random.nextInt(_catEmojis.length)];
    
    // Choose behavior: peek from bottom, slide from left/right, or float up.
    final behavior = _random.nextInt(3); 
    final scale = 0.8 + _random.nextDouble() * 0.8;
    
    double startX = 0;
    double startY = 0;
    double endX = 0;
    double endY = 0;

    final mediaQuery = MediaQuery.of(context);
    final width = mediaQuery.size.width;
    final height = mediaQuery.size.height;

    switch (behavior) {
      case 0: // Peek from bottom
        startX = _random.nextDouble() * (width - 60);
        startY = height;
        endX = startX;
        endY = height - 80 - _random.nextDouble() * 40;
        break;
      case 1: // Slide from side
        final fromLeft = _random.nextBool();
        startX = fromLeft ? -60 : width;
        startY = 100 + _random.nextDouble() * (height - 250);
        endX = fromLeft ? 40 + _random.nextDouble() * 40 : width - 100 - _random.nextDouble() * 40;
        endY = startY;
        break;
      case 2: // Float across screen diagonally
        startX = _random.nextDouble() * width;
        startY = height + 50;
        endX = startX + (_random.nextBool() ? 100 : -100);
        endY = -50;
        break;
    }

    final cat = _ActiveCat(
      id: id,
      emoji: emoji,
      startX: startX,
      startY: startY,
      endX: endX,
      endY: endY,
      duration: Duration(milliseconds: 3000 + _random.nextInt(3000)),
      scale: scale,
      shouldDisappear: behavior != 0, // Float diagonally or slide in/out disappears
    );

    setState(() {
      _cats.add(cat);
    });

    // Animate out or remove after duration
    Future.delayed(cat.duration, () {
      if (!mounted) return;
      if (behavior == 0) {
        // If peeking, slide back down
        setState(() {
          final index = _cats.indexWhere((c) => c.id == id);
          if (index != -1) {
            _cats[index] = _cats[index].copyWith(
              startX: _cats[index].endX,
              startY: _cats[index].endY,
              endX: _cats[index].startX,
              endY: _cats[index].startY,
              duration: const Duration(milliseconds: 1000),
            );
          }
        });
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (!mounted) return;
          setState(() {
            _cats.removeWhere((c) => c.id == id);
          });
        });
      } else {
        setState(() {
          _cats.removeWhere((c) => c.id == id);
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        ..._cats.map((cat) => _CatWidget(key: ValueKey(cat.id), cat: cat)),
      ],
    );
  }
}

class _ActiveCat {
  final int id;
  final String emoji;
  final double startX;
  final double startY;
  final double endX;
  final double endY;
  final Duration duration;
  final double scale;
  final bool shouldDisappear;

  const _ActiveCat({
    required this.id,
    required this.emoji,
    required this.startX,
    required this.startY,
    required this.endX,
    required this.endY,
    required this.duration,
    required this.scale,
    required this.shouldDisappear,
  });

  _ActiveCat copyWith({
    double? startX,
    double? startY,
    double? endX,
    double? endY,
    Duration? duration,
  }) {
    return _ActiveCat(
      id: id,
      emoji: emoji,
      startX: startX ?? this.startX,
      startY: startY ?? this.startY,
      endX: endX ?? this.endX,
      endY: endY ?? this.endY,
      duration: duration ?? this.duration,
      scale: scale,
      shouldDisappear: shouldDisappear,
    );
  }
}

class _CatWidget extends StatefulWidget {
  final _ActiveCat cat;

  const _CatWidget({super.key, required this.cat});

  @override
  State<_CatWidget> createState() => _CatWidgetState();
}

class _CatWidgetState extends State<_CatWidget> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.cat.duration,
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(covariant _CatWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.cat.startX != widget.cat.startX || oldWidget.cat.startY != widget.cat.startY) {
      _controller.reset();
      _controller.duration = widget.cat.duration;
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final x = lerpDouble(widget.cat.startX, widget.cat.endX, _animation.value);
        final y = lerpDouble(widget.cat.startY, widget.cat.endY, _animation.value);
        
        double opacity = 1.0;
        if (widget.cat.shouldDisappear) {
          if (_animation.value > 0.8) {
            opacity = (1.0 - _animation.value) / 0.2;
          } else if (_animation.value < 0.2) {
            opacity = _animation.value / 0.2;
          }
        } else {
          // Slide in/out fade
          if (_animation.value < 0.1) {
            opacity = _animation.value / 0.1;
          }
        }

        return Positioned(
          left: x,
          top: y,
          child: IgnorePointer(
            child: Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: widget.cat.scale,
                child: Text(
                  widget.cat.emoji,
                  style: const TextStyle(fontSize: 48, decoration: TextDecoration.none),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  double lerpDouble(double a, double b, double t) => a + (b - a) * t;
}
