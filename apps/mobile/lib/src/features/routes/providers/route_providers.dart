import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/app_config.dart';
import '../data/route_repository.dart';
import '../data/supabase_route_repository.dart';
import '../models/driver_route.dart';

final routeRepositoryProvider = Provider<RouteRepository>(
  (ref) => SupabaseRouteRepository(),
);

/// null = show all non-archived routes; a date = filter by that day
final selectedDayProvider = StateProvider<DateTime?>(
  (ref) => null,
);

final routesForDayProvider = FutureProvider.autoDispose<List<DriverRoute>>(
  (ref) async {
    final day = ref.watch(selectedDayProvider);
    final repo = ref.watch(routeRepositoryProvider);
    return repo.fetchRoutes(
      date: day,
      accountId: AppConfig.accountId.isEmpty ? null : AppConfig.accountId,
    );
  },
);
