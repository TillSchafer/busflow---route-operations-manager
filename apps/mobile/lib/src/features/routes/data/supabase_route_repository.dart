import 'package:intl/intl.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/driver_route.dart';
import 'route_repository.dart';

class SupabaseRouteRepository implements RouteRepository {
  SupabaseRouteRepository({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  @override
  Future<List<DriverRoute>> fetchRoutes({
    DateTime? date,
    String? accountId,
  }) async {
    dynamic query = _client
        .from('busflow_routes')
        .select(
          'id,name,date,status,bus_number,driver_name,capacity,'
          'operational_notes,'
          'busflow_customers!busflow_routes_customer_id_fkey(name),'
          'busflow_stops(id,location,arrival_time,departure_time,'
          'actual_arrival_time,actual_departure_time,'
          'lat,lon,sequence_order,boarding,leaving,current_total,notes)',
        );

    if (date != null) {
      final dayKey = DateFormat('yyyy-MM-dd').format(date);
      query = query.eq('date', dayKey);
    } else {
      // Show only active/planned routes when no date is selected
      query = query.neq('status', 'Archiviert');
    }

    if (accountId != null && accountId.trim().isNotEmpty) {
      query = query.eq('account_id', accountId.trim());
    }

    final rows = await query.order('date').order('name');
    return (rows as List<dynamic>)
        .map(
          (row) => DriverRoute.fromMap(
            Map<String, dynamic>.from(row as Map<dynamic, dynamic>),
          ),
        )
        .toList();
  }

  @override
  Future<void> updateRouteStatus(String routeId, String status) async {
    final response = await _client
        .from('busflow_routes')
        .update({'status': status})
        .eq('id', routeId)
        .select('id')
        .maybeSingle();

    if (response == null) {
      throw Exception('Route nicht gefunden oder keine Berechtigung.');
    }
  }

  @override
  Future<void> updateStopActualData(
    String stopId, {
    String? actualArrivalTime,
    String? actualDepartureTime,
    int? boarding,
    int? leaving,
    int? currentTotal,
  }) async {
    final updates = <String, dynamic>{};
    if (actualArrivalTime != null) updates['actual_arrival_time'] = actualArrivalTime;
    if (actualDepartureTime != null) updates['actual_departure_time'] = actualDepartureTime;
    if (boarding != null) updates['boarding'] = boarding;
    if (leaving != null) updates['leaving'] = leaving;
    if (currentTotal != null) updates['current_total'] = currentTotal;

    if (updates.isEmpty) return;
    await _client.from('busflow_stops').update(updates).eq('id', stopId);
  }
}
