import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../theme/buspilot_theme.dart';
import '../routes/providers/route_providers.dart';

class SettingsTab extends ConsumerWidget {
  const SettingsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Einstellungen', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // ── Profile card ──────────────────────────────────────────
            profileAsync.when(
              data: (profile) => _ProfileCard(
                name: profile.displayName,
                email: profile.email,
                role: profile.membershipRole,
                isDispatcher: profile.isDispatcher,
              ),
              loading: () => const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Center(child: CircularProgressIndicator()),
                ),
              ),
              error: (_, __) => const SizedBox.shrink(),
            ),

            const SizedBox(height: 16),

            // ── Actions ───────────────────────────────────────────────
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.logout_rounded, color: BusPilotTheme.danger),
                    title: const Text(
                      'Abmelden',
                      style: TextStyle(
                        color: BusPilotTheme.danger,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    onTap: () => _confirmLogout(context),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // ── App info ──────────────────────────────────────────────
            const Center(
              child: Text(
                'BusPilot Driver · v0.1.0',
                style: TextStyle(
                  color: BusPilotTheme.textMuted,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmLogout(BuildContext context) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Abmelden'),
        content: const Text('Möchtest du dich wirklich abmelden?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Abbrechen'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: FilledButton.styleFrom(backgroundColor: BusPilotTheme.danger),
            child: const Text('Abmelden'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await Supabase.instance.client.auth.signOut();
    }
  }
}

// ── Profile card ──────────────────────────────────────────────────────────────

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.name,
    required this.email,
    required this.role,
    required this.isDispatcher,
  });

  final String name;
  final String email;
  final String role;
  final bool isDispatcher;

  @override
  Widget build(BuildContext context) {
    final initials = _initials(name);
    final roleLabel = isDispatcher ? 'Disponent' : 'Fahrer';
    final roleColor = isDispatcher ? const Color(0xFF1D4ED8) : BusPilotTheme.success;
    final roleBg = isDispatcher ? const Color(0xFFDBEAFE) : const Color(0xFFDCFCE7);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Avatar circle
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: BusPilotTheme.primary,
                borderRadius: BorderRadius.circular(999),
              ),
              alignment: Alignment.center,
              child: Text(
                initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Name + email
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: BusPilotTheme.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    email,
                    style: const TextStyle(
                      fontSize: 13,
                      color: BusPilotTheme.textMuted,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),

            const SizedBox(width: 10),

            // Role badge
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: roleBg,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                roleLabel,
                style: TextStyle(
                  color: roleColor,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[parts.length - 1][0]}'.toUpperCase();
  }
}
