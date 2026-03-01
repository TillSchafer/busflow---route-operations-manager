import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../../../theme/buspilot_theme.dart';
import '../../models/driver_route.dart';

class RouteMapCard extends StatelessWidget {
  const RouteMapCard({
    super.key,
    required this.route,
    required this.currentLocation,
    required this.isLoadingLocation,
  });

  final DriverRoute route;
  final LatLng? currentLocation;
  final bool isLoadingLocation;

  @override
  Widget build(BuildContext context) {
    final points = route.geoPoints;
    final initialCenter = points.isNotEmpty
        ? points.first
        : (currentLocation ?? const LatLng(51.1657, 10.4515));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Route auf Karte',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            Text(
              route.name,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: SizedBox(
                height: 300,
                child: FlutterMap(
                  key: ValueKey('${route.id}-${points.length}'),
                  options: MapOptions(
                    initialCenter: initialCenter,
                    initialZoom: points.length > 1 ? 11 : 13,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.buspilot.mobile',
                    ),
                    if (points.length > 1)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: points,
                            color: BusPilotTheme.primary,
                            strokeWidth: 4,
                          ),
                        ],
                      ),
                    if (points.isNotEmpty)
                      MarkerLayer(
                        markers: [
                          for (var i = 0; i < points.length; i++)
                            Marker(
                              point: points[i],
                              width: 34,
                              height: 34,
                              child: Container(
                                decoration: const BoxDecoration(
                                  color: BusPilotTheme.primary,
                                  shape: BoxShape.circle,
                                ),
                                alignment: Alignment.center,
                                child: Text(
                                  '${i + 1}',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    if (currentLocation != null)
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: currentLocation!,
                            width: 24,
                            height: 24,
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.blue.shade400,
                                border: Border.all(color: Colors.white, width: 2),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(
                  Icons.my_location_outlined,
                  size: 16,
                  color: isLoadingLocation
                      ? BusPilotTheme.textMuted
                      : (currentLocation == null
                          ? BusPilotTheme.warning
                          : BusPilotTheme.success),
                ),
                const SizedBox(width: 6),
                Text(
                  isLoadingLocation
                      ? 'GPS wird geladen'
                      : currentLocation == null
                          ? 'Aktuelle Position nicht verfügbar'
                          : 'Aktuelle Position aktiv',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'Stopps',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            if (route.stops.isEmpty)
              Text(
                'Für diese Route sind keine Stopps hinterlegt.',
                style: Theme.of(context).textTheme.bodyMedium,
              )
            else
              ...route.stops.asMap().entries.map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        '${entry.key + 1}. ${entry.value.location} '
                        '(${_formatTime(entry.value.arrivalTime)} - ${_formatTime(entry.value.departureTime)})',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                  ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String input) {
    if (input.trim().isEmpty) return '--:--';
    if (input.length >= 5) return input.substring(0, 5);
    return input;
  }
}
