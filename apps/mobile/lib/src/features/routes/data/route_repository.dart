import '../models/driver_route.dart';

abstract class RouteRepository {
  /// Fetches routes. If [date] is null, all non-archived routes are returned.
  Future<List<DriverRoute>> fetchRoutes({
    DateTime? date,
    String? accountId,
  });

  Future<void> updateRouteStatus(String routeId, String status);

  Future<void> updateStopActualData(
    String stopId, {
    String? actualArrivalTime,
    String? actualDepartureTime,
    int? boarding,
    int? leaving,
    int? currentTotal,
  });
}
