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
    this.busTypeName,
    this.customerName,
    this.operationalNotes,
    this.kmStartBetrieb,
    this.kmStartCustomer,
    this.kmEndCustomer,
    this.kmEndBetrieb,
    this.timeReturnCustomer,
    this.timeReturnBetrieb,
  });

  final String id;
  final String name;
  final DateTime date;
  final String status;
  final String busNumber;
  final String driverName;
  final int capacity;
  final List<RouteStop> stops;
  final String? busTypeName;
  final String? customerName;
  final String? operationalNotes;
  final String? kmStartBetrieb;
  final String? kmStartCustomer;
  final String? kmEndCustomer;
  final String? kmEndBetrieb;
  final String? timeReturnCustomer;
  final String? timeReturnBetrieb;

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
    final rawBusType = map['busflow_bus_types'];
    final rawStops = (map['busflow_stops'] as List<dynamic>? ?? const <dynamic>[])
        .map((value) => RouteStop.fromMap(Map<String, dynamic>.from(value as Map)))
        .toList()
      ..sort((a, b) => a.sequenceOrder.compareTo(b.sequenceOrder));

    return DriverRoute(
      id: map['id']?.toString() ?? '',
      name: rawName.trim().isNotEmpty ? rawName : 'Unbenannter Ablaufplan',
      date: parsedDate ?? DateTime.now(),
      status: map['status']?.toString() ?? 'Entwurf',
      busNumber: map['bus_number']?.toString() ?? '',
      driverName: map['driver_name']?.toString() ?? '',
      capacity: map['capacity'] is num
          ? (map['capacity'] as num).toInt()
          : int.tryParse(map['capacity']?.toString() ?? '') ?? 0,
      stops: rawStops,
      busTypeName: rawBusType is Map
          ? rawBusType['name']?.toString()
          : (rawBusType is List && rawBusType.isNotEmpty && rawBusType.first is Map)
              ? (rawBusType.first as Map)['name']?.toString()
              : null,
      customerName: (map['busflow_customers'] is Map)
          ? (map['busflow_customers'] as Map)['name']?.toString()
          : null,
      operationalNotes: map['operational_notes']?.toString(),
      kmStartBetrieb: map['km_start_betrieb']?.toString(),
      kmStartCustomer: map['km_start_customer']?.toString(),
      kmEndCustomer: map['km_end_customer']?.toString(),
      kmEndBetrieb: map['km_end_betrieb']?.toString(),
      timeReturnCustomer: map['time_return_customer']?.toString(),
      timeReturnBetrieb: map['time_return_betrieb']?.toString(),
    );
  }
}
