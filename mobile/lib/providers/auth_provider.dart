import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider();

  final AuthService _authService = AuthService.instance;

  User? user;
  String? token;
  bool isLoading = true;
  bool isAuthenticated = false;

  Future<void> loadUser() async {
    isLoading = true;
    notifyListeners();

    try {
      final storedToken = await StorageService.instance.getToken();
      final storedUser = await StorageService.instance.getUser();

      if (storedToken == null || storedToken.isEmpty) {
        user = null;
        token = null;
        isAuthenticated = false;
        return;
      }

      token = storedToken;
      isAuthenticated = true;

      if (storedUser != null && storedUser.isNotEmpty) {
        user = User.fromJson(jsonDecode(storedUser) as Map<String, dynamic>);
      } else {
        user = await _authService.me();
        await StorageService.instance.saveUser(jsonEncode(user!.toJson()));
      }
    } catch (_) {
      await logout();
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    isLoading = true;
    notifyListeners();

    try {
      final response = await _authService.login(email, password);
      token = response['token']?.toString();
      final userJson = response['user'];
      user = User.fromJson(Map<String, dynamic>.from(userJson as Map));
      isAuthenticated = true;

      if (token != null) {
        await StorageService.instance.saveToken(token!);
      }
      await StorageService.instance.saveUser(jsonEncode(user!.toJson()));
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    await StorageService.instance.deleteAll();
    user = null;
    token = null;
    isAuthenticated = false;
    isLoading = false;
    notifyListeners();
  }

  Future<void> markAttendance({
    required String qrToken,
    required double latitude,
    required double longitude,
    String? ssid,
  }) {
    return _authService.markAttendance(
      qrToken: qrToken,
      latitude: latitude,
      longitude: longitude,
      ssid: ssid,
    );
  }
}
