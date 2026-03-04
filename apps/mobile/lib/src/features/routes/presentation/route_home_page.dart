import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/settings/settings_tab.dart';
import '../providers/location_providers.dart';
import '../providers/route_providers.dart';
import 'home_tab.dart';
import 'routes_tab.dart';

class RouteHomePage extends ConsumerStatefulWidget {
  const RouteHomePage({super.key});

  @override
  ConsumerState<RouteHomePage> createState() => _RouteHomePageState();
}

class _RouteHomePageState extends ConsumerState<RouteHomePage>
    with WidgetsBindingObserver {
  int _currentIndex = 0;

  static const _tabs = [
    HomeTab(),
    RoutesTab(),
    SettingsTab(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startTracking();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ref.read(locationTrackingProvider.notifier).stop();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      ref.read(locationTrackingProvider.notifier).pause();
    } else if (state == AppLifecycleState.resumed) {
      _startTracking();
    }
  }

  void _startTracking() {
    ref.read(currentUserProfileProvider.future).then((profile) {
      if (!mounted) return;
      ref.read(locationTrackingProvider.notifier).start(profile);
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _tabs,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.directions_bus_outlined),
            selectedIcon: Icon(Icons.directions_bus_rounded),
            label: 'Ablaufpläne',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings_rounded),
            label: 'Einstellungen',
          ),
        ],
      ),
    );
  }
}
