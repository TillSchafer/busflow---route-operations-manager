import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../config/app_config.dart';
import '../data/route_repository.dart';
import '../data/supabase_route_repository.dart';
import '../data/user_repository.dart';
import '../models/driver_route.dart';
import '../models/user_profile.dart';

final routeRepositoryProvider = Provider<RouteRepository>(
  (ref) => SupabaseRouteRepository(),
);

final userRepositoryProvider = Provider<UserRepository>(
  (ref) => UserRepository(),
);

/// Loads the current user's profile and membership role.
final currentUserProfileProvider = FutureProvider<UserProfile>((ref) async {
  return ref.watch(userRepositoryProvider).fetchCurrentUserProfile();
});

/// null = show all non-archived routes; a date = filter by that day
final selectedDayProvider = StateProvider<DateTime?>(
  (ref) => null,
);

/// Returns routes filtered by role:
/// - DISPATCH / ADMIN → all routes
/// - VIEWER           → only routes assigned to the user id
final routesForDayProvider = FutureProvider.autoDispose<List<DriverRoute>>(
  (ref) async {
    final day = ref.watch(selectedDayProvider);
    final repo = ref.watch(routeRepositoryProvider);
    final profile = await ref.watch(currentUserProfileProvider.future);

    // Dispatchers and admins see all routes; viewers only their own
    final assignedUserId = profile.isDispatcher ? null : profile.id;

    final routes = await repo.fetchRoutes(
      date: day,
      accountId: AppConfig.accountId.isEmpty ? null : AppConfig.accountId,
      assignedUserId: assignedUserId,
    );

    int statusRank(String status) {
      switch (status.trim()) {
        case 'Aktiv':
          return 0;
        case 'Geplant':
          return 1;
        case 'Entwurf':
          return 2;
        case 'Durchgeführt':
        case 'Durchgefuehrt':
          return 3;
        case 'Archiviert':
          return 4;
        default:
          return 5;
      }
    }

    final sorted = [...routes]
      ..sort((a, b) {
        final rankCompare = statusRank(a.status).compareTo(statusRank(b.status));
        if (rankCompare != 0) return rankCompare;

        final dateCompare = a.date.compareTo(b.date);
        if (dateCompare != 0) return dateCompare;

        return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      });

    return sorted;
  },
);
