import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../theme/buspilot_theme.dart';
import '../data/location_service.dart';
import '../models/driver_route.dart';
import '../providers/route_providers.dart';
import 'route_detail_page.dart';

class RouteHomePage extends ConsumerStatefulWidget {
  const RouteHomePage({super.key});

  @override
  ConsumerState<RouteHomePage> createState() => _RouteHomePageState();
}

class _RouteHomePageState extends ConsumerState<RouteHomePage> {
  final LocationService _locationService = LocationService();

  bool _loadingLocation = true;
  LatLng? _currentLocation;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  Future<void> _loadLocation() async {
    setState(() => _loadingLocation = true);
    try {
      final location = await _locationService.getCurrentLocation();
      if (!mounted) return;
      setState(() => _currentLocation = location);
    } catch (_) {
      if (!mounted) return;
      setState(() => _currentLocation = null);
    } finally {
      if (mounted) setState(() => _loadingLocation = false);
    }
  }

  Future<void> _pickDay() async {
    final selectedDay = ref.read(selectedDayProvider);
    final chosen = await showDatePicker(
      context: context,
      locale: const Locale('de', 'DE'),
      initialDate: selectedDay,
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (chosen == null) return;
    ref.read(selectedDayProvider.notifier).state = chosen;
  }

  Future<void> _logout() async {
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final selectedDay = ref.watch(selectedDayProvider);
    final routesAsync = ref.watch(routesForDayProvider);
    final selectedDayLabel = DateFormat('dd.MM.yyyy').format(selectedDay);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'BusPilot Fahrer-App',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            onPressed: _pickDay,
            tooltip: 'Tag auswählen',
            icon: const Icon(Icons.event_outlined),
          ),
          IconButton(
            onPressed: () => ref.invalidate(routesForDayProvider),
            tooltip: 'Neu laden',
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            onPressed: _logout,
            tooltip: 'Abmelden',
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(routesForDayProvider);
            await _loadLocation();
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      _SummaryChip(
                        icon: Icons.event_outlined,
                        label: selectedDayLabel,
                      ),
                      _SummaryChip(
                        icon: Icons.alt_route,
                        label: routesAsync.when(
                          data: (routes) =>
                              '${routes.length} Route${routes.length == 1 ? '' : 'n'}',
                          loading: () => '...',
                          error: (_, __) => '-',
                        ),
                      ),
                      _SummaryChip(
                        icon: Icons.my_location_outlined,
                        label: _loadingLocation
                            ? 'GPS wird geladen'
                            : _currentLocation == null
                                ? 'GPS nicht verfügbar'
                                : 'GPS aktiv',
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 12),
              routesAsync.when(
                loading: () => const _LoadingCard(),
                error: (err, _) => _ErrorCard(message: err.toString()),
                data: (routes) {
                  if (routes.isEmpty) return const _EmptyStateCard();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Routen',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      ...routes.map(
                        (route) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _RouteCard(
                            route: route,
                            onTap: () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => RouteDetailPage(route: route),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: BusPilotTheme.primary),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: BusPilotTheme.primary,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard();

  @override
  Widget build(BuildContext context) {
    return const Card(
      child: Padding(
        padding: EdgeInsets.all(20),
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Routen konnten nicht geladen werden',
              style: TextStyle(
                color: BusPilotTheme.danger,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(message, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class _EmptyStateCard extends StatelessWidget {
  const _EmptyStateCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: [
            const Icon(Icons.inbox_outlined, size: 28, color: BusPilotTheme.textMuted),
            const SizedBox(height: 8),
            Text(
              'Keine Route für den ausgewählten Tag vorhanden.',
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteCard extends StatelessWidget {
  const _RouteCard({
    required this.route,
    required this.onTap,
  });

  final DriverRoute route;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final statusStyle = _statusStyle(route.status);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        route.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: BusPilotTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: statusStyle.background,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        route.status,
                        style: TextStyle(
                          color: statusStyle.foreground,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Fahrer: ${route.driverName.isNotEmpty ? route.driverName : '-'}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Bus: ${route.busNumber.isNotEmpty ? route.busNumber : '-'}'
                        '  ·  ${route.stops.length} Halte'
                        '  ·  ${route.capacity} Plätze',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: BusPilotTheme.textMuted,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusStyle {
  const _StatusStyle({required this.background, required this.foreground});
  final Color background;
  final Color foreground;
}

_StatusStyle _statusStyle(String status) {
  switch (status) {
    case 'Aktiv':
      return const _StatusStyle(
        background: Color(0xFFDCFCE7),
        foreground: Color(0xFF15803D),
      );
    case 'Geplant':
      return const _StatusStyle(
        background: Color(0xFFDBEAFE),
        foreground: Color(0xFF1D4ED8),
      );
    case 'Archiviert':
      return const _StatusStyle(
        background: Color(0xFFE2E8F0),
        foreground: Color(0xFF334155),
      );
    default:
      return const _StatusStyle(
        background: Color(0xFFF1F5F9),
        foreground: Color(0xFF475569),
      );
  }
}
