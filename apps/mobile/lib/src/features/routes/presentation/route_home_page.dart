import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/settings/settings_tab.dart';
import 'home_tab.dart';
import 'routes_tab.dart';

class RouteHomePage extends ConsumerStatefulWidget {
  const RouteHomePage({super.key});

  @override
  ConsumerState<RouteHomePage> createState() => _RouteHomePageState();
}

class _RouteHomePageState extends ConsumerState<RouteHomePage> {
  int _currentIndex = 0;

  static const _tabs = [
    HomeTab(),
    RoutesTab(),
    SettingsTab(),
  ];

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
