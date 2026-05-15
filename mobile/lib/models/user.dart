class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? studentNumber;

  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.studentNumber,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      role: (json['role'] ?? '').toString(),
      studentNumber: json['student_number']?.toString() ?? json['studentNumber']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      if (studentNumber != null) 'student_number': studentNumber,
    };
  }
}
