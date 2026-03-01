import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/buspilot_theme.dart';
import '../models/driver_route.dart';
import '../models/stop_edit.dart';
import '../providers/route_providers.dart';
import 'widgets/stop_tile.dart';

class RouteDetailPage extends ConsumerStatefulWidget {
  const RouteDetailPage({super.key, required this.route});

  final DriverRoute route;

  @override
  ConsumerState<RouteDetailPage> createState() => _RouteDetailPageState();
}

class _RouteDetailPageState extends ConsumerState<RouteDetailPage> {
  late String _status;
  final Map<String, StopEdit> _edits = {};
  bool _isSaving = false;
  bool _isUpdatingStatus = false;

  @override
  void initState() {
    super.initState();
    _status = widget.route.status;
  }

  StopEdit _editFor(RouteStop stop) =>
      _edits[stop.id] ?? const StopEdit();

  Future<void> _saveAll() async {
    final repo = ref.read(routeRepositoryProvider);
    final editsToSave = Map.of(_edits)
      ..removeWhere((_, edit) => edit.isEmpty);

    if (editsToSave.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Keine Änderungen vorhanden.')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      for (final entry in editsToSave.entries) {
        final stopId = entry.key;
        final edit = entry.value;
        await repo.updateStopActualData(
          stopId,
          actualArrivalTime: edit.actualArrivalTime,
          actualDepartureTime: edit.actualDepartureTime,
          boarding: edit.boarding,
          leaving: edit.leaving,
          currentTotal: edit.currentTotal,
        );
      }
      if (!mounted) return;
      setState(() => _edits.clear());
      ref.invalidate(routesForDayProvider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Halte-Daten gespeichert.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fehler beim Speichern: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _startRoute() async {
    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      await repo.updateRouteStatus(widget.route.id, 'Aktiv');
      if (!mounted) return;
      setState(() => _status = 'Aktiv');
      ref.invalidate(routesForDayProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fehler: $e')),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  Future<void> _endRoute() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Route beenden?'),
        content: const Text(
          'Die Route wird als Archiviert markiert. Diese Aktion kann nicht rückgängig gemacht werden.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(
              backgroundColor: BusPilotTheme.danger,
            ),
            child: const Text('Beenden'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      await repo.updateRouteStatus(widget.route.id, 'Archiviert');
      if (!mounted) return;
      setState(() => _status = 'Archiviert');
      ref.invalidate(routesForDayProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fehler: $e')),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  bool get _hasUnsavedEdits => _edits.values.any((e) => !e.isEmpty);

  @override
  Widget build(BuildContext context) {
    final route = widget.route;
    final statusStyle = _statusStyleOf(_status);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          route.name,
          style: const TextStyle(fontWeight: FontWeight.w800),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusStyle.background,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              _status,
              style: TextStyle(
                color: statusStyle.foreground,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Route info card
            _RouteInfoCard(route: route),
            const SizedBox(height: 12),
            // Status action
            if (_status == 'Geplant' || _status == 'Entwurf')
              _ActionButton(
                label: 'Route starten',
                icon: Icons.play_arrow_rounded,
                color: BusPilotTheme.success,
                isLoading: _isUpdatingStatus,
                onPressed: _startRoute,
              )
            else if (_status == 'Aktiv')
              _ActionButton(
                label: 'Route beenden',
                icon: Icons.stop_rounded,
                color: BusPilotTheme.danger,
                isLoading: _isUpdatingStatus,
                onPressed: _endRoute,
              ),
            const SizedBox(height: 16),
            // Stop list
            if (route.stops.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Center(
                    child: Text(
                      'Keine Halte für diese Route.',
                      style: TextStyle(color: BusPilotTheme.textMuted),
                    ),
                  ),
                ),
              )
            else ...[
              Text(
                'Halte (${route.stops.length})',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ...route.stops.asMap().entries.map(
                    (entry) => StopTile(
                      stop: entry.value,
                      index: entry.key,
                      edit: _editFor(entry.value),
                      onEditChanged: (edit) {
                        setState(() => _edits[entry.value.id] = edit);
                      },
                    ),
                  ),
            ],
            const SizedBox(height: 80),
          ],
        ),
      ),
      floatingActionButton: _hasUnsavedEdits
          ? FloatingActionButton.extended(
              onPressed: _isSaving ? null : _saveAll,
              icon: _isSaving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.save_outlined),
              label: const Text('Speichern'),
              backgroundColor: BusPilotTheme.primary,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }
}

class _RouteInfoCard extends StatelessWidget {
  const _RouteInfoCard({required this.route});

  final DriverRoute route;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _InfoRow(icon: Icons.directions_bus_outlined, label: 'Bus', value: route.busNumber),
            _InfoRow(icon: Icons.person_outline, label: 'Fahrer', value: route.driverName),
            _InfoRow(
              icon: Icons.event_seat_outlined,
              label: 'Kapazität',
              value: '${route.capacity} Plätze',
            ),
            if (route.customerName != null && route.customerName!.isNotEmpty)
              _InfoRow(
                icon: Icons.business_outlined,
                label: 'Kunde',
                value: route.customerName!,
              ),
            if (route.operationalNotes != null && route.operationalNotes!.isNotEmpty)
              _InfoRow(
                icon: Icons.notes_outlined,
                label: 'Hinweise',
                value: route.operationalNotes!,
                multiLine: true,
              ),
          ],
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.multiLine = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool multiLine;

  @override
  Widget build(BuildContext context) {
    final isEmpty = value.trim().isEmpty;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment:
            multiLine ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 16, color: BusPilotTheme.textMuted),
          const SizedBox(width: 8),
          SizedBox(
            width: 72,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: BusPilotTheme.textMuted),
            ),
          ),
          Expanded(
            child: Text(
              isEmpty ? '–' : value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isEmpty ? BusPilotTheme.textMuted : BusPilotTheme.textPrimary,
              ),
              maxLines: multiLine ? null : 1,
              overflow: multiLine ? null : TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.isLoading,
    required this.onPressed,
  });

  final String label;
  final IconData icon;
  final Color color;
  final bool isLoading;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: isLoading ? null : onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          padding: const EdgeInsets.symmetric(vertical: 14),
        ),
        icon: isLoading
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Icon(icon),
        label: Text(label),
      ),
    );
  }
}

class _StatusStyle {
  const _StatusStyle({required this.background, required this.foreground});
  final Color background;
  final Color foreground;
}

_StatusStyle _statusStyleOf(String status) {
  switch (status) {
    case 'Aktiv':
      return const _StatusStyle(
        background: Color(0xFFDCFCE7),
        foreground: Color(0xFF15803D),
      );
    case 'Geplant':
      return const _StatusStyle(
        background: Color(0xFFDBEAFE),
        foreground: Color(0xFF1D4ED8),
      );
    case 'Archiviert':
      return const _StatusStyle(
        background: Color(0xFFE2E8F0),
        foreground: Color(0xFF334155),
      );
    default:
      return const _StatusStyle(
        background: Color(0xFFF1F5F9),
        foreground: Color(0xFF475569),
      );
  }
}
