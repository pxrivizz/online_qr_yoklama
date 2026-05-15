class Session {
  final String id;
  final String courseId;
  final String qrToken;
  final DateTime tokenExpiresAt;
  final bool isActive;

  const Session({
    required this.id,
    required this.courseId,
    required this.qrToken,
    required this.tokenExpiresAt,
    required this.isActive,
  });

  factory Session.fromJson(Map<String, dynamic> json) {
    return Session(
      id: (json['id'] ?? '').toString(),
      courseId: (json['course_id'] ?? json['courseId'] ?? '').toString(),
      qrToken: (json['qr_token'] ?? json['qrToken'] ?? '').toString(),
      tokenExpiresAt: DateTime.tryParse((json['token_expires_at'] ?? json['tokenExpiresAt'] ?? '').toString()) ?? DateTime.now(),
      isActive: json['is_active'] == true || json['isActive'] == true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'course_id': courseId,
      'qr_token': qrToken,
      'token_expires_at': tokenExpiresAt.toIso8601String(),
      'is_active': isActive,
    };
  }
}
