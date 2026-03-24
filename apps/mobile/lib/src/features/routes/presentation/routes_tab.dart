import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/dizpo_theme.dart';
import '../providers/route_providers.dart';
import 'route_detail_page.dart';
import 'widgets/route_card.dart';

class RoutesTab extends ConsumerStatefulWidget {
  const RoutesTab({super.key});

  @override
  ConsumerState<RoutesTab> createState() => _RoutesTabState();
}

class _RoutesTabState extends ConsumerState<RoutesTab> {
  Future<void> _pickDay() async {
    final selectedDay = ref.read(selectedDayProvider);
    final chosen = await showDatePicker(
      context: context,
      locale: const Locale('de', 'DE'),
      initialDate: selectedDay ?? DateTime.now(),
      firstDate: DateTime(2020),
      lastDate: DateTime(2100),
    );
    if (chosen == null) return;
    ref.read(selectedDayProvider.notifier).state = chosen;
  }

  @override
  Widget build(BuildContext context) {
    final routesAsync = ref.watch(routesForDayProvider);
    final isDispatcher =
        ref.watch(currentUserProfileProvider).valueOrNull?.isDispatcher ?? true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ablaufpläne', style: TextStyle(fontWeight: FontWeight.w800)),
        actions: [
          IconButton(
            onPressed: _pickDay,
            tooltip: 'Tag auswählen',
            icon: const Icon(Icons.event_outlined),
          ),
          IconButton(
            onPressed: () {
              ref.invalidate(routesForDayProvider);
              ref.invalidate(currentUserProfileProvider);
            },
            tooltip: 'Neu laden',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(routesForDayProvider);
            ref.invalidate(currentUserProfileProvider);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              routesAsync.when(
                loading: () => const Card(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Center(child: CircularProgressIndicator()),
                  ),
                ),
                error: (err, _) => Card(
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Ablaufpläne konnten nicht geladen werden',
                          style: TextStyle(
                            color: DizpoTheme.danger,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(err.toString(), style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ),
                  ),
                ),
                data: (routes) {
                  if (routes.isEmpty) {
                    final message = !isDispatcher
                        ? 'Keine dir zugewiesenen Ablaufpläne für diesen Zeitraum.'
                        : 'Kein Ablaufplan für den ausgewählten Tag vorhanden.';
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(18),
                        child: Column(
                          children: [
                            const Icon(
                              Icons.inbox_outlined,
                              size: 28,
                              color: DizpoTheme.textMuted,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              message,
                              style: Theme.of(context).textTheme.bodyMedium,
                              textAlign: TextAlign.center,
                            ),
                          ],
                        ),
                      ),
                    );
                  }
                  return Column(
                    children: routes
                        .map(
                          (route) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: RouteCard(
                              route: route,
                              onTap: () async {
                                final changed = await Navigator.of(context).push<bool>(
                                  MaterialPageRoute(
                                    builder: (_) => RouteDetailPage(route: route),
                                  ),
                                );
                                if (changed == true) ref.invalidate(routesForDayProvider);
                              },
                            ),
                          ),
                        )
                        .toList(),
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
