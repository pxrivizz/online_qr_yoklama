import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

import '../services/auth_service.dart';
import '../services/location_service.dart';

class ScannerScreen extends StatefulWidget {
  final String? courseId;

  const ScannerScreen({super.key, this.courseId});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  final LocationService _locationService = LocationService();
  bool _isProcessing = false;
  String? _lastResult;

  @override
  void initState() {
    super.initState();
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    await Permission.camera.request();
    await _locationService.ensurePermissions();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _handleScan(String qrToken) async {
    if (_isProcessing || qrToken.isEmpty) return;
    setState(() {
      _isProcessing = true;
      _lastResult = null;
    });

    try {
      final position = await _locationService.getCurrentPosition();
      if (position == null) {
        throw Exception('Konum izni alınamadı');
      }

      final ssid = await _locationService.getWifiSsid();
      final response = await AuthService.instance.markAttendance(
        qrToken: qrToken,
        latitude: position.latitude,
        longitude: position.longitude,
        ssid: ssid,
      );

      if (!mounted) return;
      setState(() {
        _lastResult = response['success'] == true ? 'Yoklama başarıyla gönderildi' : 'İşlem tamamlandı';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_lastResult ?? 'İşlem tamamlandı')),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _lastResult = 'Hata: $error';
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Yoklama alınamadı: $error')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('QR Tarayıcı'),
        backgroundColor: const Color(0xFF1E3A5F),
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: (capture) {
              if (capture.barcodes.isEmpty) return;
              final barcode = capture.barcodes.first;
              final rawValue = barcode.rawValue;
              if (rawValue != null) {
                _handleScan(rawValue);
              }
            },
          ),
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Card(
              color: Colors.white.withValues(alpha: 0.95),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.courseId != null ? 'Ders: ${widget.courseId}' : 'Ders seçilmedi',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isProcessing ? 'QR doğrulanıyor...' : 'Kamerayı QR koduna yöneltin',
                      textAlign: TextAlign.center,
                    ),
                    if (_lastResult != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _lastResult!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Color(0xFF1E3A5F), fontWeight: FontWeight.w600),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _controller.toggleTorch(),
                            child: const Text('Fener'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () => context.go('/dashboard'),
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
                            child: const Text('Dashboard'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
