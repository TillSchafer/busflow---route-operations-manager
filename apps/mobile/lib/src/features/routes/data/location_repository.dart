import 'package:supabase_flutter/supabase_flutter.dart';

/// Handles all Supabase interactions for the driver_locations table.
class LocationRepository {
  LocationRepository({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  /// Upserts the current position for this driver.
  Future<void> upsertLocation({
    required String userId,
    required String accountId,
    required String fullName,
    required double lat,
    required double lon,
    double? heading,
    double? accuracy,
  }) async {
    await _client.from('driver_locations').upsert({
      'user_id': userId,
      'account_id': accountId,
      'full_name': fullName,
      'lat': lat,
      'lon': lon,
      'heading': heading,
      'accuracy': accuracy,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
      'is_active': true,
    });
  }

  /// Marks the driver as inactive (app backgrounded or closed).
  Future<void> deactivate(String userId) async {
    await _client.from('driver_locations').update({
      'is_active': false,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }).eq('user_id', userId);
  }
}
