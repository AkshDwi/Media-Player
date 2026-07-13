import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/player_provider.dart';
import '../providers/settings_provider.dart';
import '../models/app_settings.dart';
import 'library_screen.dart';
import 'now_playing_screen.dart';
import 'settings_screen.dart';
import '../widgets/mini_player.dart';
import '../widgets/cats_overlay.dart';

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  int _selectedIndex = 0;

  final List<Widget> _screens = [
    const NowPlayingScreen(),
    const LibraryScreen(),
    const SettingsScreen(),
  ];

  final FocusNode _keyboardFocusNode = FocusNode();

  @override
  void dispose() {
    _keyboardFocusNode.dispose();
    super.dispose();
  }

  void _handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return;

    final playerService = ref.read(playerServiceProvider);
    final volume = ref.read(volumeStateProvider).value ?? 100.0;
    final settings = ref.read(settingsProvider);
    final settingsNotifier = ref.read(settingsProvider.notifier);

    final key = event.logicalKey;

    if (key == LogicalKeyboardKey.space) {
      playerService.playOrPause();
    } else if (key == LogicalKeyboardKey.arrowLeft) {
      playerService.rewind();
    } else if (key == LogicalKeyboardKey.arrowRight) {
      playerService.fastForward();
    } else if (key == LogicalKeyboardKey.arrowUp) {
      final newVol = (volume + 5.0).clamp(0.0, 200.0);
      playerService.setVolume(newVol);
      settingsNotifier.updateVolume(newVol);
    } else if (key == LogicalKeyboardKey.arrowDown) {
      final newVol = (volume - 5.0).clamp(0.0, 200.0);
      playerService.setVolume(newVol);
      settingsNotifier.updateVolume(newVol);
    } else if (key == LogicalKeyboardKey.keyN) {
      playerService.next();
    } else if (key == LogicalKeyboardKey.keyP) {
      playerService.previous();
    } else if (key == LogicalKeyboardKey.keyS) {
      playerService.setShuffle(!settings.shuffleEnabled);
      settingsNotifier.toggleShuffle();
    } else if (key == LogicalKeyboardKey.keyL) {
      final nextMode = LoopMode.values[(settings.loopMode.index + 1) % LoopMode.values.length];
      settingsNotifier.updateLoopMode(nextMode);
      playerService.setLoopMode(nextMode);
    } else if (key == LogicalKeyboardKey.keyM) {
      if (volume == 0.0) {
        playerService.setVolume(100.0);
        settingsNotifier.updateVolume(100.0);
      } else {
        playerService.setVolume(0.0);
        settingsNotifier.updateVolume(0.0);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Request focus so keyboard events are received.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _keyboardFocusNode.requestFocus();
    });

    final currentTrack = ref.watch(currentTrackProvider);
    final width = MediaQuery.of(context).size.width;
    final isDesktop = width > 700;

    Widget mainContent;

    if (isDesktop) {
      // Responsive layout with NavigationRail for desktop
      mainContent = Scaffold(
        body: Row(
          children: [
            NavigationRail(
              selectedIndex: _selectedIndex,
              onDestinationSelected: (index) {
                setState(() {
                  _selectedIndex = index;
                });
              },
              labelType: NavigationRailLabelType.all,
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.play_circle_fill_rounded),
                  label: Text('Now Playing'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.library_music_rounded),
                  label: Text('Library'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.settings_rounded),
                  label: Text('Settings'),
                ),
              ],
            ),
            const VerticalDivider(width: 1, thickness: 1),
            Expanded(
              child: Column(
                children: [
                  Expanded(
                    child: IndexedStack(
                      index: _selectedIndex,
                      children: _screens,
                    ),
                  ),
                  if (currentTrack != null && _selectedIndex != 0)
                    const MiniPlayer(),
                ],
              ),
            ),
          ],
        ),
      );
    } else {
      // Responsive layout with BottomNavigationBar for mobile
      mainContent = Scaffold(
        body: Column(
          children: [
            Expanded(
              child: IndexedStack(
                index: _selectedIndex,
                children: _screens,
              ),
            ),
            if (currentTrack != null && _selectedIndex != 0)
              const MiniPlayer(),
          ],
        ),
        bottomNavigationBar: BottomNavigationBar(
          currentIndex: _selectedIndex,
          onTap: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(Icons.play_circle_fill_rounded),
              label: 'Now Playing',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.library_music_rounded),
              label: 'Library',
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.settings_rounded),
              label: 'Settings',
            ),
          ],
        ),
      );
    }

    return KeyboardListener(
      focusNode: _keyboardFocusNode,
      onKeyEvent: _handleKeyEvent,
      child: CatsOverlay(
        child: mainContent,
      ),
    );
  }
}
