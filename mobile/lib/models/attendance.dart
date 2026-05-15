class Attendance {
  final String courseId;
  final String courseName;
  final String courseCode;
  final int totalSessions;
  final int attended;
  final int attendancePercentage;

  const Attendance({
    required this.courseId,
    required this.courseName,
    required this.courseCode,
    required this.totalSessions,
    required this.attended,
    required this.attendancePercentage,
  });

  factory Attendance.fromJson(Map<String, dynamic> json) {
    return Attendance(
      courseId: (json['course_id'] ?? json['courseId'] ?? '').toString(),
      courseName: (json['course_name'] ?? json['courseName'] ?? '').toString(),
      courseCode: (json['course_code'] ?? json['courseCode'] ?? '').toString(),
      totalSessions: int.tryParse((json['total_sessions'] ?? json['totalSessions'] ?? 0).toString()) ?? 0,
      attended: int.tryParse((json['attended'] ?? 0).toString()) ?? 0,
      attendancePercentage: int.tryParse((json['attendance_percentage'] ?? json['attendancePercentage'] ?? 0).toString()) ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'course_id': courseId,
      'course_name': courseName,
      'course_code': courseCode,
      'total_sessions': totalSessions,
      'attended': attended,
      'attendance_percentage': attendancePercentage,
    };
  }
}
