class Course {
  final String id;
  final String name;
  final String code;
  final int? studentCount;
  final String? allowedSsid;
  final double? allowedLatitude;
  final double? allowedLongitude;
  final int allowedRadiusMeters;

  const Course({
    required this.id,
    required this.name,
    required this.code,
    this.studentCount,
    this.allowedSsid,
    this.allowedLatitude,
    this.allowedLongitude,
    this.allowedRadiusMeters = 100,
  });

  factory Course.fromJson(Map<String, dynamic> json) {
    return Course(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      code: (json['code'] ?? '').toString(),
      studentCount: _toInt(json['student_count'] ?? json['studentCount']),
      allowedSsid: json['allowed_ssid']?.toString() ?? json['allowedSsid']?.toString(),
      allowedLatitude: _toDouble(json['allowed_latitude'] ?? json['allowedLatitude']),
      allowedLongitude: _toDouble(json['allowed_longitude'] ?? json['allowedLongitude']),
      allowedRadiusMeters: _toInt(json['allowed_radius_meters'] ?? json['allowedRadiusMeters']) ?? 100,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'student_count': studentCount,
      'allowed_ssid': allowedSsid,
      'allowed_latitude': allowedLatitude,
      'allowed_longitude': allowedLongitude,
      'allowed_radius_meters': allowedRadiusMeters,
    };
  }

  static int? _toInt(dynamic value) {
    if (value == null || value == '') return null;
    return int.tryParse(value.toString());
  }

  static double? _toDouble(dynamic value) {
    if (value == null || value == '') return null;
    return double.tryParse(value.toString());
  }
}
