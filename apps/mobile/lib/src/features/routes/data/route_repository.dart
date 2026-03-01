import '../models/driver_route.dart';

abstract class RouteRepository {
  Future<List<DriverRoute>> fetchRoutesForDay(
    DateTime day, {
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
