import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../theme/buspilot_theme.dart';
import '../../models/driver_route.dart';
import '../../models/stop_edit.dart';

class StopTile extends StatelessWidget {
  const StopTile({
    super.key,
    required this.stop,
    required this.index,
    required this.edit,
    required this.onEditChanged,
  });

  final RouteStop stop;
  final int index;
  final StopEdit edit;
  final ValueChanged<StopEdit> onEditChanged;

  String get _displayArrival =>
      edit.actualArrivalTime ?? stop.actualArrivalTime ?? '—';
  String get _displayDeparture =>
      edit.actualDepartureTime ?? stop.actualDepartureTime ?? '—';

  int get _displayBoarding => edit.boarding ?? stop.boarding;
  int get _displayLeaving => edit.leaving ?? stop.leaving;
  int get _displayTotal => edit.currentTotal ?? stop.currentTotal;

  Future<void> _openMaps(BuildContext context) async {
    final Uri uri;
    if (stop.lat != null && stop.lon != null) {
      uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lon}',
      );
    } else {
      uri = Uri.parse(
        'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(stop.location)}',
      );
    }
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Google Maps konnte nicht geöffnet werden.')),
        );
      }
    }
  }

  Future<void> _pickTime(
    BuildContext context, {
    required bool isArrival,
  }) async {
    final current = isArrival
        ? (edit.actualArrivalTime ?? stop.actualArrivalTime)
        : (edit.actualDepartureTime ?? stop.actualDepartureTime);

    TimeOfDay initial = TimeOfDay.now();
    if (current != null && current.length >= 5) {
      final parts = current.split(':');
      if (parts.length >= 2) {
        final h = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        if (h != null && m != null) initial = TimeOfDay(hour: h, minute: m);
      }
    }

    final picked = await showTimePicker(
      context: context,
      initialTime: initial,
    );
    if (picked == null) return;

    final formatted =
        '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    if (isArrival) {
      onEditChanged(edit.copyWith(actualArrivalTime: formatted));
    } else {
      onEditChanged(edit.copyWith(actualDepartureTime: formatted));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row: sequence + location + maps button
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: BusPilotTheme.primary,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${index + 1}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    stop.location,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: BusPilotTheme.textPrimary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                IconButton(
                  onPressed: () => _openMaps(context),
                  icon: const Icon(Icons.map_outlined, size: 20),
                  color: BusPilotTheme.primary,
                  tooltip: 'In Maps öffnen',
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // Planned times row
            Row(
              children: [
                _TimeLabel(
                  label: 'Geplante Ankunft',
                  time: stop.arrivalTime,
                  muted: true,
                ),
                const SizedBox(width: 16),
                _TimeLabel(
                  label: 'Geplante Abfahrt',
                  time: stop.departureTime,
                  muted: true,
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Actual times row (tappable)
            Row(
              children: [
                _ActualTimeButton(
                  label: 'Ist-Ankunft',
                  time: _displayArrival,
                  onTap: () => _pickTime(context, isArrival: true),
                ),
                const SizedBox(width: 10),
                _ActualTimeButton(
                  label: 'Ist-Abfahrt',
                  time: _displayDeparture,
                  onTap: () => _pickTime(context, isArrival: false),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Divider(height: 1),
            const SizedBox(height: 10),
            // Passenger counts
            Row(
              children: [
                Expanded(
                  child: _CounterField(
                    label: 'Einstieg',
                    value: _displayBoarding,
                    onChanged: (v) => onEditChanged(edit.copyWith(boarding: v)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _CounterField(
                    label: 'Ausstieg',
                    value: _displayLeaving,
                    onChanged: (v) => onEditChanged(edit.copyWith(leaving: v)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _CounterField(
                    label: 'Gesamt',
                    value: _displayTotal,
                    onChanged: (v) => onEditChanged(edit.copyWith(currentTotal: v)),
                  ),
                ),
              ],
            ),
            if (stop.notes != null && stop.notes!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.info_outline,
                    size: 14,
                    color: BusPilotTheme.textMuted,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      stop.notes!,
                      style: const TextStyle(
                        fontSize: 12,
                        color: BusPilotTheme.textMuted,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _TimeLabel extends StatelessWidget {
  const _TimeLabel({
    required this.label,
    required this.time,
    this.muted = false,
  });

  final String label;
  final String time;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: BusPilotTheme.textMuted),
        ),
        const SizedBox(height: 2),
        Text(
          time.isNotEmpty ? time : '—',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: muted ? BusPilotTheme.textMuted : BusPilotTheme.textPrimary,
          ),
        ),
      ],
    );
  }
}

class _ActualTimeButton extends StatelessWidget {
  const _ActualTimeButton({
    required this.label,
    required this.time,
    required this.onTap,
  });

  final String label;
  final String time;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final hasValue = time != '—';
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          decoration: BoxDecoration(
            color: hasValue
                ? const Color(0xFFEFF6FF)
                : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: hasValue ? BusPilotTheme.primary : BusPilotTheme.border,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  color: hasValue ? BusPilotTheme.primary : BusPilotTheme.textMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      time,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: hasValue
                            ? BusPilotTheme.primary
                            : BusPilotTheme.textMuted,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.access_time,
                    size: 14,
                    color: hasValue ? BusPilotTheme.primary : BusPilotTheme.textMuted,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CounterField extends StatelessWidget {
  const _CounterField({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: BusPilotTheme.textMuted),
        ),
        const SizedBox(height: 4),
        Row(
          children: [
            _CounterButton(
              icon: Icons.remove,
              onTap: value > 0 ? () => onChanged(value - 1) : null,
            ),
            Expanded(
              child: Center(
                child: Text(
                  '$value',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: BusPilotTheme.textPrimary,
                  ),
                ),
              ),
            ),
            _CounterButton(
              icon: Icons.add,
              onTap: () => onChanged(value + 1),
            ),
          ],
        ),
      ],
    );
  }
}

class _CounterButton extends StatelessWidget {
  const _CounterButton({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: onTap != null
              ? const Color(0xFFEFF6FF)
              : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: onTap != null ? BusPilotTheme.primary : BusPilotTheme.border,
          ),
        ),
        child: Icon(
          icon,
          size: 16,
          color: onTap != null ? BusPilotTheme.primary : BusPilotTheme.textMuted,
        ),
      ),
    );
  }
}
