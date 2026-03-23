import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';

import '../../../theme/buspilot_theme.dart';
import '../providers/location_providers.dart';
import '../providers/route_providers.dart';
import 'route_detail_page.dart';
import 'widgets/route_card.dart';

class HomeTab extends ConsumerWidget {
  const HomeTab({super.key});

  static String _greeting() {
    final hour = DateTime.now().hour;
    if (hour >= 5 && hour < 12) return 'Guten Morgen';
    if (hour >= 12 && hour < 18) return 'Guten Mittag';
    return 'Guten Abend';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentUserProfileProvider);
    final todayRoutesAsync = ref.watch(todayRoutesProvider);
    final topPadding = MediaQuery.of(context).padding.top;

    final name = profileAsync.when(
      data: (p) => p.displayName,
      loading: () => '',
      error: (_, __) => '',
    );

    final todayLabel = DateFormat('EEE, d. MMM', 'de_DE').format(DateTime.now());
    final routeCount = todayRoutesAsync.valueOrNull?.length;

    final permissionStatus = ref.watch(locationPermissionStatusProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(todayRoutesProvider);
        ref.invalidate(currentUserProfileProvider);
      },
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // ── Location permission banner ────────────────────────────────
          if (permissionStatus == LocationPermissionStatus.deniedForever ||
              permissionStatus == LocationPermissionStatus.denied)
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF3CD),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFFCA28)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.location_off_rounded,
                        color: Color(0xFFF59E0B), size: 20),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        permissionStatus == LocationPermissionStatus.deniedForever
                            ? 'Standortzugriff verweigert. Bitte in den Einstellungen aktivieren.'
                            : 'Standortzugriff wird benötigt für das GPS-Tracking.',
                        style: const TextStyle(
                          fontSize: 13,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    TextButton(
                      onPressed: () => Geolocator.openAppSettings(),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 6),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text(
                        'Einstellungen',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFFF59E0B),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          // ── Gradient welcome header ──────────────────────────────────
          SliverToBoxAdapter(
            child: _WelcomeHeader(
              topPadding: topPadding,
              greeting: _greeting(),
              name: name,
              todayLabel: todayLabel,
              routeCount: routeCount,
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 20)),

          // ── Section title ────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Meine Umläufe heute',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 10)),

          // ── Route list ───────────────────────────────────────────────
          todayRoutesAsync.when(
            loading: () => const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (err, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Text(
                      'Fehler beim Laden: ${err.toString()}',
                      style: const TextStyle(color: BusPilotTheme.danger),
                    ),
                  ),
                ),
              ),
            ),
            data: (routes) => routes.isEmpty
                ? SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            children: [
                              const Icon(
                                Icons.inbox_outlined,
                                size: 32,
                                color: BusPilotTheme.textMuted,
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Keine Umläufe für heute.',
                                style: Theme.of(context).textTheme.bodyMedium,
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  )
                : SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (ctx, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: RouteCard(
                            route: routes[i],
                            onTap: () async {
                              final changed = await Navigator.of(ctx).push<bool>(
                                MaterialPageRoute(
                                  builder: (_) => RouteDetailPage(route: routes[i]),
                                ),
                              );
                              if (changed == true) ref.invalidate(todayRoutesProvider);
                            },
                          ),
                        ),
                        childCount: routes.length,
                      ),
                    ),
                  ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

// ── Welcome header ────────────────────────────────────────────────────────────

class _WelcomeHeader extends StatelessWidget {
  const _WelcomeHeader({
    required this.topPadding,
    required this.greeting,
    required this.name,
    required this.todayLabel,
    this.routeCount,
  });

  final double topPadding;
  final String greeting;
  final String name;
  final String todayLabel;
  final int? routeCount;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1648C8), Color(0xFF2663EB), Color(0xFF4080FF)],
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(28),
          bottomRight: Radius.circular(28),
        ),
      ),
      padding: EdgeInsets.fromLTRB(20, topPadding + 20, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            greeting,
            style: const TextStyle(
              color: Color(0xCCFFFFFF),
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          if (name.isNotEmpty)
            Text(
              name,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 26,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            )
          else
            const SizedBox(height: 30),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _Chip(icon: Icons.calendar_today_rounded, label: todayLabel),
              _Chip(
                icon: Icons.directions_bus_rounded,
                label: routeCount == null
                    ? '...'
                    : '$routeCount Umlauf${routeCount == 1 ? '' : 'e'} heute',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: const Color(0x2EFFFFFF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: Colors.white),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
