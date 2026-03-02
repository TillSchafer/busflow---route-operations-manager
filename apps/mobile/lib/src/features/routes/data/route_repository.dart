import '../models/driver_route.dart';

abstract class RouteRepository {
  /// Fetches routes. If [date] is null, all non-archived routes are returned.
  /// If [assignedUserId] is set, only routes assigned to that user are returned.
  Future<List<DriverRoute>> fetchRoutes({
    DateTime? date,
    String? accountId,
    String? assignedUserId,
  });

  Future<void> updateRouteStatus(String routeId, String status);

  Future<void> updateRouteLifecycle(
    String routeId, {
    required String status,
    String? kmStartBetrieb,
    String? kmStartCustomer,
    String? kmEndCustomer,
    String? kmEndBetrieb,
    String? timeReturnCustomer,
    String? timeReturnBetrieb,
    String? operationalNotes,
  });

  Future<void> deleteRoute(String routeId);

  Future<void> updateStopActualData(
    String stopId, {
    String? actualArrivalTime,
    String? actualDepartureTime,
    int? boarding,
    int? leaving,
    int? currentTotal,
  });
}
