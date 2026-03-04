class UserProfile {
  const UserProfile({
    required this.id,
    required this.email,
    this.fullName,
    this.membershipRole = 'VIEWER',
    this.globalRole = 'USER',
    this.accountId,
  });

  final String id;
  final String email;
  final String? fullName;

  /// The account_id this user is active in (used for location tracking).
  final String? accountId;

  /// account_memberships.role: ADMIN | DISPATCH | VIEWER
  final String membershipRole;
  final String globalRole;

  String get _normalizedMembershipRole => membershipRole.trim().toUpperCase();
  String get _normalizedGlobalRole => globalRole.trim().toUpperCase();

  /// Dispatchers (ADMIN or DISPATCH) see all routes.
  /// Viewers (VIEWER) see only their own routes.
  bool get isDispatcher =>
      _normalizedGlobalRole == 'ADMIN' ||
      _normalizedMembershipRole == 'ADMIN' ||
      _normalizedMembershipRole == 'DISPATCH';

  /// Best display name: full_name if set, otherwise email.
  String get displayName =>
      fullName != null && fullName!.trim().isNotEmpty ? fullName!.trim() : email;
}
