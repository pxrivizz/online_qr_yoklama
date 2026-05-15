import 'package:geolocator/geolocator.dart';
import 'package:network_info_plus/network_info_plus.dart';
import 'package:permission_handler/permission_handler.dart';

class LocationService {
  Future<bool> ensurePermissions() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return false;
    }

    final status = await Permission.locationWhenInUse.request();
    return status.isGranted || status.isLimited;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await ensurePermissions();
    if (!hasPermission) return null;

    return Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
  }

  Future<String?> getWifiSsid() async {
    try {
      return await NetworkInfo().getWifiName();
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>> getAttendanceContext() async {
    final position = await getCurrentPosition();
    final ssid = await getWifiSsid();

    return {
      'latitude': position?.latitude,
      'longitude': position?.longitude,
      'ssid': ssid,
    };
  }
}
