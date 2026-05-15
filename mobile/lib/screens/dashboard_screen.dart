import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../models/course.dart';
import '../services/auth_service.dart';
import '../widgets/course_card.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<List<Course>> _coursesFuture;

  @override
  void initState() {
    super.initState();
    _coursesFuture = AuthService.instance.getCourses();
  }

  Future<void> _refresh() async {
    setState(() {
      _coursesFuture = AuthService.instance.getCourses();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dashboard'),
        backgroundColor: const Color(0xFF1E3A5F),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: () => context.go('/attendance'),
            icon: const Icon(Icons.list_alt_rounded),
            tooltip: 'Yoklamalar',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: FutureBuilder<List<Course>>(
          future: _coursesFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final courses = snapshot.data ?? <Course>[];

            if (courses.isEmpty) {
              return ListView(
                padding: const EdgeInsets.all(24),
                children: const [
                  SizedBox(height: 80),
                  Icon(Icons.school_outlined, size: 72, color: Color(0xFFCBD5E1)),
                  SizedBox(height: 16),
                  Text(
                    'Henüz ders bulunamadı',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Dersler oluşturulduğunda burada görünecek.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF6B7280)),
                  ),
                ],
              );
            }

            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const Text(
                  'Dersler',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: Color(0xFF111827)),
                ),
                const SizedBox(height: 6),
                const Text(
                  'QR okutma ve yoklama akışını başlatın.',
                  style: TextStyle(color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 16),
                ...courses.map(
                  (course) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: CourseCard(
                      course: course,
                      onScanPressed: () => context.go('/scanner?courseId=${course.id}'),
                      onAttendancePressed: () => context.go('/attendance?courseId=${course.id}'),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
