import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../config/app_config.dart';
import '../models/user_profile.dart';

/// Fetches the current user's profile and their membership role for the
/// configured account.
class UserRepository {
  UserRepository({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  final SupabaseClient _client;

  String _normalizeRole(String? value) {
    final normalized = value?.trim().toUpperCase();
    if (normalized == 'ADMIN' || normalized == 'DISPATCH' || normalized == 'VIEWER') {
      return normalized!;
    }
    return 'VIEWER';
  }

  int _rolePriority(String role) {
    switch (role) {
      case 'ADMIN':
        return 3;
      case 'DISPATCH':
        return 2;
      default:
        return 1;
    }
  }

  Future<UserProfile> fetchCurrentUserProfile() async {
    final userId = _client.auth.currentUser?.id;
    if (userId == null) throw Exception('Nicht eingeloggt.');

    // Fetch profile
    final profileRow = await _client
        .from('profiles')
        .select('id, email, full_name, global_role')
        .eq('id', userId)
        .single();

    String role = 'VIEWER';
    final globalRole = profileRow['global_role']?.toString() ?? 'USER';
    if (globalRole.trim().toUpperCase() == 'ADMIN') {
      role = 'ADMIN';
    }

    // Prefer role in configured account.
    final accountId = AppConfig.accountId.trim();
    if (role != 'ADMIN' && accountId.isNotEmpty) {
      final membershipRows = await _client
          .from('account_memberships')
          .select('role,status')
          .eq('user_id', userId)
          .eq('account_id', accountId);

      for (final row in membershipRows as List<dynamic>) {
        final map = Map<String, dynamic>.from(row as Map);
        final status = map['status']?.toString().trim().toUpperCase();
        if (status != 'ACTIVE') continue;
        final nextRole = _normalizeRole(map['role']?.toString());
        if (_rolePriority(nextRole) > _rolePriority(role)) {
          role = nextRole;
        }
      }
    }

    // Fallback: if no account-specific role found, evaluate all active memberships.
    if (role == 'VIEWER' && accountId.isEmpty) {
      final membershipRows = await _client
          .from('account_memberships')
          .select('role,status')
          .eq('user_id', userId);

      for (final row in membershipRows as List<dynamic>) {
        final map = Map<String, dynamic>.from(row as Map);
        final status = map['status']?.toString().trim().toUpperCase();
        if (status != 'ACTIVE') continue;
        final nextRole = _normalizeRole(map['role']?.toString());
        if (_rolePriority(nextRole) > _rolePriority(role)) {
          role = nextRole;
        }
      }
    }

    return UserProfile(
      id: profileRow['id']?.toString() ?? userId,
      email: profileRow['email']?.toString() ?? '',
      fullName: profileRow['full_name']?.toString(),
      membershipRole: role,
      globalRole: globalRole,
    );
  }
}
