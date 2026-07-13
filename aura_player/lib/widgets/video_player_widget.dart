import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:media_kit_video/media_kit_video.dart';
import '../providers/player_provider.dart';

class VideoPlayerWidget extends ConsumerStatefulWidget {
  const VideoPlayerWidget({super.key});

  @override
  ConsumerState<VideoPlayerWidget> createState() => _VideoPlayerWidgetState();
}

class _VideoPlayerWidgetState extends ConsumerState<VideoPlayerWidget> {
  VideoController? _controller;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initialized) {
      final playerService = ref.read(playerServiceProvider);
      
      // Construct the VideoController
      final controller = VideoController(playerService.player);
      playerService.initVideoController(controller);
      
      setState(() {
        _controller = controller;
        _initialized = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_controller == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Container(
      color: Colors.black,
      child: Center(
        child: Video(
          controller: _controller!,
          controls: NoVideoControls, // We draw our own custom overlay controls
        ),
      ),
    );
  }
}
