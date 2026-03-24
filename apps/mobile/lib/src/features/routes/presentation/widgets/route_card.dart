import 'package:flutter/material.dart';

import '../../../../theme/dizpo_theme.dart';
import '../../models/driver_route.dart';

class RouteCard extends StatelessWidget {
  const RouteCard({super.key, required this.route, required this.onTap});

  final DriverRoute route;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final style = routeStatusStyle(route.status);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: DizpoTheme.border),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        route.name,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: DizpoTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: style.background,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        route.status,
                        style: TextStyle(
                          color: style.foreground,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Fahrer: ${route.driverName.isNotEmpty ? route.driverName : '-'}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        _infoText(route),
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ),
                    const Icon(Icons.chevron_right, size: 18, color: DizpoTheme.textMuted),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  static String _infoText(DriverRoute r) {
    final parts = <String>[];
    if (r.busTypeName != null && r.busTypeName!.trim().isNotEmpty) {
      parts.add(r.busTypeName!);
    }
    if (r.busNumber.isNotEmpty) parts.add('Bus-Nr.: ${r.busNumber}');
    parts.add('${r.stops.length} Halte');
    parts.add('${r.capacity} Plätze');
    return parts.join('  ·  ');
  }
}

class RouteStatusStyle {
  const RouteStatusStyle({required this.background, required this.foreground});
  final Color background;
  final Color foreground;
}

RouteStatusStyle routeStatusStyle(String status) {
  switch (status) {
    case 'Aktiv':
      return const RouteStatusStyle(
        background: Color(0xFFDCFCE7),
        foreground: Color(0xFF15803D),
      );
    case 'Geplant':
      return const RouteStatusStyle(
        background: Color(0xFFDBEAFE),
        foreground: Color(0xFF1D4ED8),
      );
    case 'Archiviert':
      return const RouteStatusStyle(
        background: Color(0xFFE2E8F0),
        foreground: Color(0xFF334155),
      );
    case 'Durchgeführt':
    case 'Durchgefuehrt':
      return const RouteStatusStyle(
        background: Color(0xFFE0E7FF),
        foreground: Color(0xFF3730A3),
      );
    default:
      return const RouteStatusStyle(
        background: Color(0xFFF1F5F9),
        foreground: Color(0xFF475569),
      );
  }
}
