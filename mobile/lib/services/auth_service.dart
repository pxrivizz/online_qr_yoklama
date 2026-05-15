import 'dart:convert';

import '../config/api_config.dart';
import '../models/attendance.dart';
import '../models/course.dart';
import '../models/session.dart';
import '../models/user.dart';
import 'api_service.dart';

class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  Future<Map<String, dynamic>> login(String email, String password) async {
    final response = await ApiService.instance.post(
      ApiConfig.loginEndpoint,
      {'email': email, 'password': password},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<User> me() async {
    final response = await ApiService.instance.get(ApiConfig.meEndpoint);
    return User.fromJson(Map<String, dynamic>.from(response.data as Map));
  }

  Future<List<Course>> getCourses() async {
    final response = await ApiService.instance.get(ApiConfig.coursesEndpoint);
    final data = response.data;
    if (data is List) {
      return data.map((item) => Course.fromJson(Map<String, dynamic>.from(item as Map))).toList();
    }
    if (data is Map && data['courses'] is List) {
      return (data['courses'] as List)
          .map((item) => Course.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }
    return <Course>[];
  }

  Future<List<Session>> getActiveSessions() async {
    final response = await ApiService.instance.get(ApiConfig.sessionsEndpoint, queryParameters: {'active': true});
    final data = response.data;
    if (data is List) {
      return data.map((item) => Session.fromJson(Map<String, dynamic>.from(item as Map))).toList();
    }
    if (data is Map && data['sessions'] is List) {
      return (data['sessions'] as List)
          .map((item) => Session.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }
    return <Session>[];
  }

  Future<List<Attendance>> getMyAttendance() async {
    final response = await ApiService.instance.get('${ApiConfig.attendanceEndpoint}/my');
    final data = response.data;
    if (data is List) {
      return data.map((item) => Attendance.fromJson(Map<String, dynamic>.from(item as Map))).toList();
    }
    return <Attendance>[];
  }

  Future<Map<String, dynamic>> markAttendance({
    required String qrToken,
    required double latitude,
    required double longitude,
    String? ssid,
  }) async {
    final payload = <String, dynamic>{
      'qr_token': qrToken,
      'latitude': latitude,
      'longitude': longitude,
      ...(
        ssid != null ? {'ssid': ssid} : const <String, dynamic>{}
      ),
    };

    final response = await ApiService.instance.post('${ApiConfig.attendanceEndpoint}/mark', payload);
    return Map<String, dynamic>.from(response.data as Map);
  }

  Future<Map<String, dynamic>> restoreUserFromJson(String userJson) async {
    return Map<String, dynamic>.from(jsonDecode(userJson) as Map);
  }
}
