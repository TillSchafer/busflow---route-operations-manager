import 'package:latlong2/latlong.dart';

class RouteStop {
  const RouteStop({
    required this.id,
    required this.location,
    required this.arrivalTime,
    required this.departureTime,
    this.lat,
    this.lon,
    this.sequenceOrder = 0,
    this.boarding = 0,
    this.leaving = 0,
    this.currentTotal = 0,
    this.actualArrivalTime,
    this.actualDepartureTime,
    this.notes,
  });

  final String id;
  final String location;
  final String arrivalTime;
  final String departureTime;
  final double? lat;
  final double? lon;
  final int sequenceOrder;
  final int boarding;
  final int leaving;
  final int currentTotal;
  final String? actualArrivalTime;
  final String? actualDepartureTime;
  final String? notes;

  static double? _parseDouble(dynamic value) {
    if (value == null) return null;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString());
  }

  static int _parseInt(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toInt();
    return int.tryParse(value.toString()) ?? 0;
  }

  factory RouteStop.fromMap(Map<String, dynamic> map) {
    return RouteStop(
      id: map['id']?.toString() ?? '',
      location: map['location']?.toString() ?? '',
      arrivalTime: map['arrival_time']?.toString() ?? '',
      departureTime: map['departure_time']?.toString() ?? '',
      lat: _parseDouble(map['lat']),
      lon: _parseDouble(map['lon']),
      sequenceOrder: _parseInt(map['sequence_order']),
      boarding: _parseInt(map['boarding']),
      leaving: _parseInt(map['leaving']),
      currentTotal: _parseInt(map['current_total']),
      actualArrivalTime: map['actual_arrival_time']?.toString(),
      actualDepartureTime: map['actual_departure_time']?.toString(),
      notes: map['notes']?.toString(),
    );
  }
}

class DriverRoute {
  const DriverRoute({
    required this.id,
    required this.name,
    required this.date,
    required this.status,
    required this.busNumber,
    required this.driverName,
    required this.capacity,
    required this.stops,
    this.customerName,
    this.operationalNotes,
  });

  final String id;
  final String name;
  final DateTime date;
  final String status;
  final String busNumber;
  final String driverName;
  final int capacity;
  final List<RouteStop> stops;
  final String? customerName;
  final String? operationalNotes;

  bool get hasGeoStops => stops.any((stop) => stop.lat != null && stop.lon != null);

  List<LatLng> get geoPoints {
    return stops
        .where((stop) => stop.lat != null && stop.lon != null)
        .map((stop) => LatLng(stop.lat!, stop.lon!))
        .toList(growable: false);
  }

  factory DriverRoute.fromMap(Map<String, dynamic> map) {
    final parsedDate = DateTime.tryParse(map['date']?.toString() ?? '');
    final rawName = map['name']?.toString() ?? '';
    final rawStops = (map['busflow_stops'] as List<dynamic>? ?? const <dynamic>[])
        .map((value) => RouteStop.fromMap(Map<String, dynamic>.from(value as Map)))
        .toList()
      ..sort((a, b) => a.sequenceOrder.compareTo(b.sequenceOrder));

    return DriverRoute(
      id: map['id']?.toString() ?? '',
      name: rawName.trim().isNotEmpty ? rawName : 'Unbenannte Route',
      date: parsedDate ?? DateTime.now(),
      status: map['status']?.toString() ?? 'Entwurf',
      busNumber: map['bus_number']?.toString() ?? '',
      driverName: map['driver_name']?.toString() ?? '',
      capacity: map['capacity'] is num
          ? (map['capacity'] as num).toInt()
          : int.tryParse(map['capacity']?.toString() ?? '') ?? 0,
      stops: rawStops,
      customerName: map['customer_name']?.toString(),
      operationalNotes: map['operational_notes']?.toString(),
    );
  }
}
