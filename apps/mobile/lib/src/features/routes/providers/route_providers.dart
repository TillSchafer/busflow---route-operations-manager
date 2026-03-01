import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/app_config.dart';
import '../data/route_repository.dart';
import '../data/supabase_route_repository.dart';
import '../models/driver_route.dart';

final routeRepositoryProvider = Provider<RouteRepository>(
  (ref) => SupabaseRouteRepository(),
);

final selectedDayProvider = StateProvider<DateTime>(
  (ref) => DateTime.now(),
);

final routesForDayProvider = FutureProvider.autoDispose<List<DriverRoute>>(
  (ref) async {
    final day = ref.watch(selectedDayProvider);
    final repo = ref.watch(routeRepositoryProvider);
    return repo.fetchRoutesForDay(
      day,
      accountId: AppConfig.accountId.isEmpty ? null : AppConfig.accountId,
    );
  },
);
