import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/attendance.dart';
import '../services/auth_service.dart';

class AttendanceScreen extends StatefulWidget {
  final String? courseId;

  const AttendanceScreen({super.key, this.courseId});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Future<List<Attendance>> _future;

  @override
  void initState() {
    super.initState();
    _future = AuthService.instance.getMyAttendance();
  }

  Future<void> _refresh() async {
    setState(() {
      _future = AuthService.instance.getMyAttendance();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Yoklamalar'),
        backgroundColor: const Color(0xFF1E3A5F),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: () => context.go('/dashboard'),
            icon: const Icon(Icons.home_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Attendance>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final items = snapshot.data ?? <Attendance>[];
            final filteredItems = widget.courseId == null
                ? items
                : items.where((item) => item.courseId == widget.courseId).toList();

            if (filteredItems.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Icon(Icons.fact_check_outlined, size: 72, color: Color(0xFFCBD5E1)),
                  SizedBox(height: 16),
                  Text(
                    'Yoklama kaydı bulunamadı',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Ders bazlı kayıtlar burada listelenecek.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF6B7280)),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: filteredItems.length,
              separatorBuilder: (context, index) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                final attendance = filteredItems[index];
                final ratio = (attendance.attendancePercentage.clamp(0, 100)) / 100;
                return Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        attendance.courseName,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        attendance.courseCode,
                        style: const TextStyle(color: Color(0xFF6B7280)),
                      ),
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: ratio,
                        backgroundColor: const Color(0xFFE5E7EB),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          attendance.attendancePercentage >= 70
                              ? const Color(0xFF10B981)
                              : attendance.attendancePercentage >= 60
                                  ? const Color(0xFFF59E0B)
                                  : const Color(0xFFEF4444),
                        ),
                        minHeight: 10,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Katıldığı: ${attendance.attended}/${attendance.totalSessions}'),
                          Text('%${attendance.attendancePercentage}',
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
