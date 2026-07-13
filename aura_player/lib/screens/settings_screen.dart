import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/app_settings.dart';
import '../providers/settings_provider.dart';

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  int _versionTapCount = 0;

  void _handleVersionTap() {
    final settings = ref.read(settingsProvider);
    if (settings.catsModeUnlocked) return;

    setState(() {
      _versionTapCount++;
    });

    if (_versionTapCount >= 7) {
      ref.read(settingsProvider.notifier).unlockCatsMode();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('🐱 Cats Mode unlocked in Settings!'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  void _showClearDataConfirm() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Reset All Data?'),
          content: const Text(
            'This will delete all playlists and reset settings to default. This action is permanent.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel'),
            ),
            TextButton(
              style: TextButton.styleFrom(
                foregroundColor: Theme.of(context).colorScheme.error,
              ),
              onPressed: () async {
                final navigator = Navigator.of(context);
                final messenger = ScaffoldMessenger.of(context);
                final storage = ref.read(storageServiceProvider);
                await storage.clearAll();
                navigator.pop();
                messenger.showSnackBar(
                  const SnackBar(content: Text('App data fully reset.')),
                );
                // Refresh settings
                ref.invalidate(settingsProvider);
              },
              child: const Text('Reset'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = ref.watch(settingsProvider);
    final settingsNotifier = ref.read(settingsProvider.notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 8.0),
        children: [
          // Theme Settings
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(left: 16.0, top: 16.0, bottom: 8.0),
                  child: Text(
                    'Appearance',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.palette_rounded),
                  title: const Text('Theme Mode'),
                  subtitle: Text(
                    settings.themeMode[0].toUpperCase() +
                        settings.themeMode.substring(1),
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (val) {
                      settingsNotifier.updateThemeMode(val.toLowerCase());
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(value: 'system', child: Text('System')),
                      const PopupMenuItem(value: 'light', child: Text('Light')),
                      const PopupMenuItem(value: 'dark', child: Text('Dark')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Playback Presets / Preferences
          Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(left: 16.0, top: 16.0, bottom: 8.0),
                  child: Text(
                    'Playback Settings',
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey),
                  ),
                ),
                ListTile(
                  leading: const Icon(Icons.graphic_eq_rounded),
                  title: const Text('Default Audio Visualizer'),
                  subtitle: Text(
                    settings.visualizerStyle == VisualizerStyle.spectrumBars
                        ? 'Spectrum Bars'
                        : settings.visualizerStyle == VisualizerStyle.circularSpectrum
                            ? 'Circular Spectrum'
                            : settings.visualizerStyle == VisualizerStyle.waveform
                                ? 'Waveform'
                                : 'Particles',
                  ),
                  trailing: PopupMenuButton<VisualizerStyle>(
                    onSelected: (style) {
                      settingsNotifier.updateVisualizerStyle(style);
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                          value: VisualizerStyle.spectrumBars,
                          child: Text('Spectrum Bars')),
                      const PopupMenuItem(
                          value: VisualizerStyle.circularSpectrum,
                          child: Text('Circular Spectrum')),
                      const PopupMenuItem(
                          value: VisualizerStyle.waveform, child: Text('Waveform')),
                      const PopupMenuItem(
                          value: VisualizerStyle.particles, child: Text('Particles')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),

          // Hidden Easter Egg (Cats Mode)
          if (settings.catsModeUnlocked)
            Card(
              child: SwitchListTile(
                secondary: const Icon(Icons.pets_rounded),
                title: const Text('Cats Mode'),
                subtitle: const Text('Spawns cute cats across the interface'),
                value: settings.catsMode,
                onChanged: (_) {
                  settingsNotifier.toggleCatsMode();
                },
              ),
            ),
          const SizedBox(height: 8),

          // Reset Data Section
          Card(
            child: ListTile(
              leading: const Icon(Icons.delete_forever_rounded, color: Colors.redAccent),
              title: const Text('Clear App Data'),
              subtitle: const Text('Delete all playlists and settings'),
              onTap: _showClearDataConfirm,
            ),
          ),
          const SizedBox(height: 48),

          // Version / Credits (Tap version to unlock Easter egg)
          Center(
            child: Column(
              children: [
                InkWell(
                  onTap: _handleVersionTap,
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                    child: Text(
                      'Aura Player v1.0.0',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Colors.grey,
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ),
                ),
                Text(
                  'Made with ♥ for music lovers',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.grey.withValues(alpha: 0.8),
                        fontSize: 10,
                      ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
