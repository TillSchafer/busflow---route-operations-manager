import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../data/location_repository.dart';
import '../models/user_profile.dart';

/// How often (in seconds) to send a location update to Supabase.
/// The stream fires continuously; we throttle here to avoid excessive writes.
const _maxIdleSeconds = 30;

enum LocationPermissionStatus { unknown, granted, denied, deniedForever }

final locationRepositoryProvider = Provider<LocationRepository>(
  (_) => LocationRepository(),
);

final locationPermissionStatusProvider =
    StateProvider<LocationPermissionStatus>(
  (_) => LocationPermissionStatus.unknown,
);

/// Manages GPS tracking for the currently logged-in driver.
///
/// Call [start] when the app becomes active, [pause] when backgrounded,
/// and [stop] on logout / widget dispose.
class LocationTrackingNotifier extends AsyncNotifier<void> {
  StreamSubscription<Position>? _positionSub;
  DateTime? _lastSentAt;
  UserProfile? _profile;

  @override
  Future<void> build() async {}

  Future<void> start(UserProfile profile) async {
    if (profile.accountId == null) return; // can't track without an account

    _profile = profile;

    // Request permission at runtime.
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.deniedForever) {
      ref.read(locationPermissionStatusProvider.notifier).state =
          LocationPermissionStatus.deniedForever;
      return;
    }

    if (permission == LocationPermission.denied) {
      ref.read(locationPermissionStatusProvider.notifier).state =
          LocationPermissionStatus.denied;
      return;
    }

    ref.read(locationPermissionStatusProvider.notifier).state =
        LocationPermissionStatus.granted;

    await _positionSub?.cancel();
    _lastSentAt = null;

    const settings = LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 0, // throttle in _onPosition instead
    );

    _positionSub = Geolocator.getPositionStream(locationSettings: settings)
        .listen(_onPosition);
  }

  Future<void> pause() async {
    await _positionSub?.cancel();
    _positionSub = null;
    final profile = _profile;
    if (profile != null) {
      await ref
          .read(locationRepositoryProvider)
          .deactivate(profile.id)
          .catchError((_) {});
    }
  }

  Future<void> stop() async {
    await pause();
    _profile = null;
  }

  Future<void> _onPosition(Position pos) async {
    final profile = _profile;
    if (profile == null || profile.accountId == null) return;

    final now = DateTime.now();
    final sinceLastSent = _lastSentAt == null
        ? _maxIdleSeconds + 1
        : now.difference(_lastSentAt!).inSeconds;

    // Send if we moved (stream filter handles distance) OR after idle timeout.
    if (sinceLastSent < _maxIdleSeconds && _lastSentAt != null) return;

    _lastSentAt = now;
    await ref
        .read(locationRepositoryProvider)
        .upsertLocation(
          userId: profile.id,
          accountId: profile.accountId!,
          fullName: profile.displayName,
          lat: pos.latitude,
          lon: pos.longitude,
          heading: pos.heading,
          accuracy: pos.accuracy,
        )
        .catchError((_) {}); // never crash the stream on network error
  }
}

final locationTrackingProvider =
    AsyncNotifierProvider<LocationTrackingNotifier, void>(
  LocationTrackingNotifier.new,
);
