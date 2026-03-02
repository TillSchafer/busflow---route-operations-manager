import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

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
  late String? _operationalNotes;
  late String? _kmStartBetrieb;
  late String? _kmStartCustomer;
  late String? _kmEndCustomer;
  late String? _kmEndBetrieb;
  late String? _timeReturnCustomer;
  late String? _timeReturnBetrieb;
  final Map<String, StopEdit> _edits = {};
  bool _isSaving = false;
  bool _isUpdatingStatus = false;

  @override
  void initState() {
    super.initState();
    _status = widget.route.status;
    _operationalNotes = widget.route.operationalNotes;
    _kmStartBetrieb = widget.route.kmStartBetrieb;
    _kmStartCustomer = widget.route.kmStartCustomer;
    _kmEndCustomer = widget.route.kmEndCustomer;
    _kmEndBetrieb = widget.route.kmEndBetrieb;
    _timeReturnCustomer = widget.route.timeReturnCustomer;
    _timeReturnBetrieb = widget.route.timeReturnBetrieb;
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
    final startData = await _showStartOverlay();
    if (startData == null) return;

    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      await repo.updateRouteLifecycle(
        widget.route.id,
        status: 'Aktiv',
        kmStartBetrieb: startData.kmStartBetrieb,
        kmStartCustomer: startData.kmStartCustomer,
      );
      if (!mounted) return;
      setState(() {
        _status = 'Aktiv';
        _kmStartBetrieb = startData.kmStartBetrieb;
        _kmStartCustomer = startData.kmStartCustomer;
      });
      ref.invalidate(routesForDayProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  Future<void> _endRoute() async {
    final endData = await _showEndOverlay();
    if (endData == null) return;

    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      final mergedNotes = _mergeOperationalNotes(
        _operationalNotes,
        endData.driverComment,
      );
      await repo.updateRouteLifecycle(
        widget.route.id,
        status: 'Durchgeführt',
        kmEndCustomer: endData.kmEndCustomer,
        kmEndBetrieb: endData.kmEndBetrieb,
        timeReturnCustomer: endData.timeReturnCustomer,
        timeReturnBetrieb: endData.timeReturnBetrieb,
        operationalNotes: mergedNotes,
      );
      if (!mounted) return;
      setState(() {
        _status = 'Durchgeführt';
        _kmEndCustomer = endData.kmEndCustomer;
        _kmEndBetrieb = endData.kmEndBetrieb;
        _timeReturnCustomer = endData.timeReturnCustomer;
        _timeReturnBetrieb = endData.timeReturnBetrieb;
        if (mergedNotes != null) {
          _operationalNotes = mergedNotes;
        }
      });
      ref.invalidate(routesForDayProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  String? _mergeOperationalNotes(String? currentNotes, String driverComment) {
    final comment = driverComment.trim();
    if (comment.isEmpty) return null;
    final base = currentNotes?.trim() ?? '';
    if (base.isEmpty) return 'Fahrerkommentar: $comment';
    return '$base\n\nFahrerkommentar: $comment';
  }

  String _normalizeKmInput(String value) => value.trim().replaceAll(',', '.');

  double? _parseKm(String value) {
    final normalized = _normalizeKmInput(value);
    if (normalized.isEmpty) return null;
    return double.tryParse(normalized);
  }

  String _formatKm(double value) {
    if (value % 1 == 0) return value.toStringAsFixed(0);
    final fixed = value.toStringAsFixed(2);
    return fixed
        .replaceFirst(RegExp(r'0+$'), '')
        .replaceFirst(RegExp(r'\.$'), '');
  }

  String? _normalizeTimeInput(String value) {
    final raw = value.trim();
    if (raw.isEmpty) return null;
    final cleaned = raw
        .replaceAll('.', ':')
        .replaceAll(',', ':')
        .replaceAll(';', ':')
        .replaceAll(' ', '');
    final match = RegExp(r'^(\d{1,2}):(\d{1,2})$').firstMatch(cleaned);
    if (match == null) return null;
    final hours = int.tryParse(match.group(1)!);
    final minutes = int.tryParse(match.group(2)!);
    if (hours == null || minutes == null) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}';
  }

  String _friendlyErrorMessage(Object error) {
    final text = error.toString();
    if (text.contains('busflow_routes_status_check')) {
      return 'Status "Durchgeführt" ist in der Datenbank noch nicht aktiviert. Bitte Migration ausführen.';
    }
    return 'Fehler: $error';
  }

  Future<_StartOverlayData?> _showStartOverlay() async {
    final kmStartBetriebCtrl = TextEditingController(
      text: _kmStartBetrieb ?? '',
    );
    final kmStartCustomerCtrl = TextEditingController(
      text: _kmStartCustomer ?? '',
    );

    final result = await showDialog<_StartOverlayData>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        String? errorText;
        return StatefulBuilder(
          builder: (ctx, setModalState) => AlertDialog(
            scrollable: true,
            title: const Text('Ablaufplan starten'),
            content: SizedBox(
              width: 460,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: kmStartBetriebCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'KM Anfang Betrieb *',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: kmStartCustomerCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                    ],
                    decoration: const InputDecoration(
                      labelText: 'KM Anfang Kunde *',
                    ),
                  ),
                  if (errorText != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      errorText!,
                      style: const TextStyle(
                        color: BusPilotTheme.danger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Abbrechen'),
              ),
              FilledButton(
                onPressed: () {
                  final kmStartBetriebRaw = _normalizeKmInput(
                    kmStartBetriebCtrl.text,
                  );
                  final kmStartCustomerRaw = _normalizeKmInput(
                    kmStartCustomerCtrl.text,
                  );
                  if (kmStartBetriebRaw.isEmpty || kmStartCustomerRaw.isEmpty) {
                    setModalState(() {
                      errorText = 'Bitte beide Pflichtfelder ausfüllen.';
                    });
                    return;
                  }
                  final kmStartBetrieb = _parseKm(kmStartBetriebRaw);
                  final kmStartCustomer = _parseKm(kmStartCustomerRaw);
                  if (kmStartBetrieb == null || kmStartCustomer == null) {
                    setModalState(() {
                      errorText = 'KM-Felder müssen gültige Zahlen sein.';
                    });
                    return;
                  }
                  if (kmStartBetrieb < 0 || kmStartCustomer < 0) {
                    setModalState(() {
                      errorText = 'KM-Felder dürfen nicht negativ sein.';
                    });
                    return;
                  }
                  if (kmStartCustomer < kmStartBetrieb) {
                    setModalState(() {
                      errorText =
                          'KM Anfang Kunde muss größer/gleich KM Anfang Betrieb sein.';
                    });
                    return;
                  }
                  Navigator.of(ctx).pop(
                    _StartOverlayData(
                      kmStartBetrieb: _formatKm(kmStartBetrieb),
                      kmStartCustomer: _formatKm(kmStartCustomer),
                    ),
                  );
                },
                child: const Text('Starten'),
              ),
            ],
          ),
        );
      },
    );
    return result;
  }

  Future<_EndOverlayData?> _showEndOverlay() async {
    final kmEndCustomerCtrl = TextEditingController(
      text: _kmEndCustomer ?? '',
    );
    final kmEndBetriebCtrl = TextEditingController(
      text: _kmEndBetrieb ?? '',
    );
    final timeReturnCustomerCtrl = TextEditingController(
      text: _timeReturnCustomer ?? '',
    );
    final timeReturnBetriebCtrl = TextEditingController(
      text: _timeReturnBetrieb ?? '',
    );
    final commentCtrl = TextEditingController();

    Future<void> pickTime(
      BuildContext dialogContext,
      TextEditingController controller,
    ) async {
      TimeOfDay initial = TimeOfDay.now();
      final currentValue = _normalizeTimeInput(controller.text);
      if (currentValue != null) {
        final parts = currentValue.split(':');
        final h = int.tryParse(parts[0]);
        final m = int.tryParse(parts[1]);
        if (h != null && m != null) {
          initial = TimeOfDay(hour: h, minute: m);
        }
      }
      final picked = await showTimePicker(
        context: dialogContext,
        initialTime: initial,
      );
      if (picked == null) return;
      controller.text =
          '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
    }

    final result = await showDialog<_EndOverlayData>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        int step = 0;
        String? errorText;

        return StatefulBuilder(
          builder: (ctx, setModalState) => AlertDialog(
            scrollable: true,
            title: Text(step == 0 ? 'Ablaufplan beenden (1/2)' : 'Kommentar (2/2)'),
            content: SizedBox(
              width: 500,
              child: step == 0
                  ? Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: kmEndCustomerCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'KM Ende Kunde *',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: kmEndBetriebCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'KM Ende Betrieb *',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: timeReturnCustomerCtrl,
                          keyboardType: TextInputType.datetime,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'[0-9:.,;]')),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Uhr Rückkehr Kunde * (HH:MM)',
                            hintText: 'z. B. 14:35',
                            suffixIcon: Icon(Icons.access_time),
                          ),
                          onTapOutside: (_) => FocusScope.of(ctx).unfocus(),
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: () => pickTime(ctx, timeReturnCustomerCtrl),
                            icon: const Icon(Icons.schedule, size: 16),
                            label: const Text('Uhrzeit wählen'),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: timeReturnBetriebCtrl,
                          keyboardType: TextInputType.datetime,
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(RegExp(r'[0-9:.,;]')),
                          ],
                          decoration: const InputDecoration(
                            labelText: 'Uhr Rückkehr Betrieb * (HH:MM)',
                            hintText: 'z. B. 15:10',
                            suffixIcon: Icon(Icons.access_time),
                          ),
                          onTapOutside: (_) => FocusScope.of(ctx).unfocus(),
                        ),
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton.icon(
                            onPressed: () => pickTime(ctx, timeReturnBetriebCtrl),
                            icon: const Icon(Icons.schedule, size: 16),
                            label: const Text('Uhrzeit wählen'),
                          ),
                        ),
                        if (errorText != null) ...[
                          const SizedBox(height: 10),
                          Text(
                            errorText!,
                            style: const TextStyle(
                              color: BusPilotTheme.danger,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    )
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextField(
                          controller: commentCtrl,
                          minLines: 4,
                          maxLines: 6,
                          decoration: const InputDecoration(
                            labelText: 'Kommentar für Disposition (optional)',
                            alignLabelWithHint: true,
                          ),
                        ),
                      ],
                    ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Abbrechen'),
              ),
              if (step == 1)
                TextButton(
                  onPressed: () => setModalState(() => step = 0),
                  child: const Text('Zurück'),
                ),
              FilledButton(
                onPressed: () {
                  if (step == 0) {
                    final kmEndCustomerRaw = _normalizeKmInput(
                      kmEndCustomerCtrl.text,
                    );
                    final kmEndBetriebRaw = _normalizeKmInput(
                      kmEndBetriebCtrl.text,
                    );
                    final timeReturnCustomerRaw = timeReturnCustomerCtrl.text.trim();
                    final timeReturnBetriebRaw = timeReturnBetriebCtrl.text.trim();
                    if (kmEndCustomerRaw.isEmpty ||
                        kmEndBetriebRaw.isEmpty ||
                        timeReturnCustomerRaw.isEmpty ||
                        timeReturnBetriebRaw.isEmpty) {
                      setModalState(() {
                        errorText = 'Bitte alle Pflichtfelder ausfüllen.';
                      });
                      return;
                    }
                    final kmEndCustomer = _parseKm(kmEndCustomerRaw);
                    final kmEndBetrieb = _parseKm(kmEndBetriebRaw);
                    if (kmEndCustomer == null || kmEndBetrieb == null) {
                      setModalState(() {
                        errorText = 'KM-Felder müssen gültige Zahlen sein.';
                      });
                      return;
                    }
                    if (kmEndCustomer < 0 || kmEndBetrieb < 0) {
                      setModalState(() {
                        errorText = 'KM-Felder dürfen nicht negativ sein.';
                      });
                      return;
                    }
                    final startCustomer = _parseKm(_kmStartCustomer ?? '');
                    if (startCustomer != null && kmEndCustomer < startCustomer) {
                      setModalState(() {
                        errorText =
                            'KM Ende Kunde darf nicht kleiner als KM Anfang Kunde sein.';
                      });
                      return;
                    }
                    final startBetrieb = _parseKm(_kmStartBetrieb ?? '');
                    if (startBetrieb != null && kmEndBetrieb < startBetrieb) {
                      setModalState(() {
                        errorText =
                            'KM Ende Betrieb darf nicht kleiner als KM Anfang Betrieb sein.';
                      });
                      return;
                    }
                    if (kmEndBetrieb < kmEndCustomer) {
                      setModalState(() {
                        errorText =
                            'KM Ende Betrieb muss größer/gleich KM Ende Kunde sein.';
                      });
                      return;
                    }
                    final normalizedReturnCustomer =
                        _normalizeTimeInput(timeReturnCustomerRaw);
                    final normalizedReturnBetrieb =
                        _normalizeTimeInput(timeReturnBetriebRaw);
                    if (normalizedReturnCustomer == null ||
                        normalizedReturnBetrieb == null) {
                      setModalState(() {
                        errorText = 'Bitte gültige Uhrzeiten im Format HH:MM wählen.';
                      });
                      return;
                    }
                    setModalState(() {
                      errorText = null;
                      kmEndCustomerCtrl.text = _formatKm(kmEndCustomer);
                      kmEndBetriebCtrl.text = _formatKm(kmEndBetrieb);
                      timeReturnCustomerCtrl.text = normalizedReturnCustomer;
                      timeReturnBetriebCtrl.text = normalizedReturnBetrieb;
                      step = 1;
                    });
                    return;
                  }

                  Navigator.of(ctx).pop(
                      _EndOverlayData(
                        kmEndCustomer: kmEndCustomerCtrl.text.trim(),
                        kmEndBetrieb: kmEndBetriebCtrl.text.trim(),
                      timeReturnCustomer: timeReturnCustomerCtrl.text.trim(),
                      timeReturnBetrieb: timeReturnBetriebCtrl.text.trim(),
                      driverComment: commentCtrl.text.trim(),
                    ),
                  );
                },
                child: Text(step == 0 ? 'Weiter' : 'Abschluss speichern'),
              ),
            ],
          ),
        );
      },
    );
    return result;
  }

  Future<void> _changeStatus() async {
    const statuses = ['Entwurf', 'Geplant', 'Aktiv', 'Durchgeführt', 'Archiviert'];
    final chosen = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Status ändern'),
        children: [
          for (final s in statuses)
            SimpleDialogOption(
              onPressed: () => Navigator.of(ctx).pop(s),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  children: [
                    Icon(
                      _status == s ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                      size: 20,
                      color: _status == s ? BusPilotTheme.primary : BusPilotTheme.textMuted,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      s,
                      style: TextStyle(
                        fontWeight: _status == s ? FontWeight.w700 : FontWeight.normal,
                        color: _status == s ? BusPilotTheme.primary : BusPilotTheme.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
    if (chosen == null || chosen == _status) return;

    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      await repo.updateRouteStatus(widget.route.id, chosen);
      if (!mounted) return;
      setState(() => _status = chosen);
      ref.invalidate(routesForDayProvider);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_friendlyErrorMessage(e))),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  Future<void> _deleteRoute() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Ablaufplan löschen?'),
        content: const Text(
          'Der Ablaufplan wird dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
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
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _isUpdatingStatus = true);
    try {
      final repo = ref.read(routeRepositoryProvider);
      await repo.deleteRoute(widget.route.id);
      if (!mounted) return;
      ref.invalidate(routesForDayProvider);
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Fehler beim Löschen: $e')),
      );
    } finally {
      if (mounted) setState(() => _isUpdatingStatus = false);
    }
  }

  bool get _hasUnsavedEdits => _edits.values.any((e) => !e.isEmpty);

  Future<void> _openFullNavigation() async {
    final stops = widget.route.stops;
    if (stops.isEmpty) return;

    // Build a stop entry — prefer lat/lon, fall back to encoded location name
    String stopEntry(RouteStop s) {
      if (s.lat != null && s.lon != null) return '${s.lat},${s.lon}';
      return Uri.encodeComponent(s.location);
    }

    final Uri uri;
    if (stops.length == 1) {
      final s = stops.first;
      if (s.lat != null && s.lon != null) {
        uri = Uri.parse(
          'https://www.google.com/maps/dir/?api=1'
          '&destination=${s.lat},${s.lon}&travelmode=driving',
        );
      } else {
        uri = Uri.parse(
          'https://www.google.com/maps/search/?api=1'
          '&query=${Uri.encodeComponent(s.location)}',
        );
      }
    } else {
      final origin = stopEntry(stops.first);
      final destination = stopEntry(stops.last);
      final middle = stops.sublist(1, stops.length - 1);
      final waypointsRaw = middle.map(stopEntry).join('|');

      final buffer = StringBuffer(
        'https://www.google.com/maps/dir/?api=1'
        '&origin=$origin'
        '&destination=$destination',
      );
      if (waypointsRaw.isNotEmpty) {
        buffer.write('&waypoints=${Uri.encodeComponent(waypointsRaw)}');
      }
      buffer.write('&travelmode=driving');
      uri = Uri.parse(buffer.toString());
    }

    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Navigation konnte nicht geöffnet werden.'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final route = widget.route;
    final operationalNotes = _operationalNotes ?? route.operationalNotes;
    final statusStyle = _statusStyleOf(_status);
    final profileAsync = ref.watch(currentUserProfileProvider);
    final canManageAllRoutes = profileAsync.valueOrNull?.isDispatcher ?? false;

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
          if (canManageAllRoutes) ...[
            IconButton(
              onPressed: _isUpdatingStatus ? null : _changeStatus,
              tooltip: 'Status ändern',
              icon: const Icon(Icons.edit_outlined),
            ),
            IconButton(
              onPressed: _isUpdatingStatus ? null : _deleteRoute,
              tooltip: 'Ablaufplan löschen',
              icon: const Icon(Icons.delete_outline),
            ),
          ],
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Route info card
            _RouteInfoCard(route: route, operationalNotes: operationalNotes),
            const SizedBox(height: 12),
            // Status action
            if (_status == 'Geplant')
              _ActionButton(
                label: 'Ablaufplan starten',
                icon: Icons.play_arrow_rounded,
                color: BusPilotTheme.success,
                isLoading: _isUpdatingStatus,
                onPressed: _startRoute,
              )
            else if (_status == 'Aktiv')
              _ActionButton(
                label: 'Ablaufplan beenden',
                icon: Icons.stop_rounded,
                color: BusPilotTheme.danger,
                isLoading: _isUpdatingStatus,
                onPressed: _endRoute,
              ),
            // Navigation button — always shown when there are stops
            if (route.stops.isNotEmpty) ...[
              const SizedBox(height: 10),
              _NavigationButton(
                stopCount: route.stops.length,
                onPressed: _openFullNavigation,
              ),
            ],
            const SizedBox(height: 16),
            // Stop list
            if (route.stops.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(18),
                  child: Center(
                    child: Text(
                      'Keine Halte für diesen Ablaufplan.',
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
  const _RouteInfoCard({
    required this.route,
    required this.operationalNotes,
  });

  final DriverRoute route;
  final String? operationalNotes;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _InfoRow(
              icon: Icons.directions_bus_outlined,
              label: 'Bustyp',
              value: route.busTypeName ?? '',
            ),
            _InfoRow(icon: Icons.pin_outlined, label: 'Bus-Nr.', value: route.busNumber),
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
            if (operationalNotes != null && operationalNotes!.isNotEmpty)
              _InfoRow(
                icon: Icons.notes_outlined,
                label: 'Hinweise',
                value: operationalNotes!,
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

class _StartOverlayData {
  const _StartOverlayData({
    required this.kmStartBetrieb,
    required this.kmStartCustomer,
  });

  final String kmStartBetrieb;
  final String kmStartCustomer;
}

class _EndOverlayData {
  const _EndOverlayData({
    required this.kmEndCustomer,
    required this.kmEndBetrieb,
    required this.timeReturnCustomer,
    required this.timeReturnBetrieb,
    required this.driverComment,
  });

  final String kmEndCustomer;
  final String kmEndBetrieb;
  final String timeReturnCustomer;
  final String timeReturnBetrieb;
  final String driverComment;
}

class _StatusStyle {
  const _StatusStyle({required this.background, required this.foreground});
  final Color background;
  final Color foreground;
}

class _NavigationButton extends StatelessWidget {
  const _NavigationButton({
    required this.stopCount,
    required this.onPressed,
  });

  final int stopCount;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: BusPilotTheme.primary,
          side: const BorderSide(color: BusPilotTheme.primary, width: 1.5),
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        icon: const Icon(Icons.navigation_outlined, size: 20),
        label: Text(
          'Navigation starten ($stopCount Halte)',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
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
    case 'Durchgeführt':
    case 'Durchgefuehrt':
      return const _StatusStyle(
        background: Color(0xFFE0E7FF),
        foreground: Color(0xFF3730A3),
      );
    default:
      return const _StatusStyle(
        background: Color(0xFFF1F5F9),
        foreground: Color(0xFF475569),
      );
  }
}
