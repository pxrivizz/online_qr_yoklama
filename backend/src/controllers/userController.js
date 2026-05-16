const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const getAllUsers = async (req, res) => {
  try {
    const { role, search } = req.query;

    let query = 'SELECT id, name, email, role, student_number, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = $1';
      params.push(role);
    }

    if (search) {
      const searchParam = `%${search}%`;
      if (params.length === 0) {
        query += ` AND (name ILIKE $1 OR email ILIKE $1)`;
        params.push(searchParam);
      } else {
        query += ` AND (name ILIKE $${params.length + 1} OR email ILIKE $${params.length + 1})`;
        params.push(searchParam);
      }
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check authorization: admin can get any user, others can only get themselves
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Forbidden: can only access your own profile' });
    }

    const result = await pool.query(
      'SELECT id, name, email, role, student_number, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Get user by ID error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const createUser = async (req, res) => {
  try {
    const { name, email, password, role, student_number } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const userId = uuidv4();

    const result = await pool.query(
      `INSERT INTO users (id, name, email, password, role, student_number)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, student_number, created_at`,
      [userId, name, email, password, role, student_number || null]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    if (error.code === '23505') {
      // Unique constraint violation (duplicate email)
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, password, email, role, student_number } = req.body;

    // Authorization: admin can update anyone, others can only update themselves
    if (req.user.role !== 'admin' && req.user.id !== id) {
      return res.status(403).json({ error: 'Forbidden: can only update your own profile' });
    }

    // Non-admin users can only update name and password
    if (req.user.role !== 'admin') {
      if (email || role || student_number) {
        return res.status(403).json({ error: 'Forbidden: can only update name and password' });
      }
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userCheck.rows[0];

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount}`);
      values.push(name);
      paramCount++;
    }

    if (password !== undefined) {
      updates.push(`password = $${paramCount}`);
      values.push(password);
      paramCount++;
    }

    if (req.user.role === 'admin') {
      if (email !== undefined) {
        updates.push(`email = $${paramCount}`);
        values.push(email);
        paramCount++;
      }
      if (role !== undefined) {
        updates.push(`role = $${paramCount}`);
        values.push(role);
        paramCount++;
      }
      if (student_number !== undefined) {
        updates.push(`student_number = $${paramCount}`);
        values.push(student_number);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, name, email, role, student_number, created_at`;

    const result = await pool.query(query, values);
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update user error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Cannot delete yourself
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Check if user exists
    const userCheck = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

const bulkCreateStudents = async (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Students array is required and must not be empty' });
    }

    let createdCount = 0;
    let skippedCount = 0;

    const studentsWithData = students.map((student) => {
      const { name, email, password, student_number } = student;

      if (!name || !email || !password) {
        throw new Error('Name, email, and password are required for each student');
      }

      return {
        id: uuidv4(),
        name,
        email,
        password: password,
        role: 'student',
        student_number: student_number || null,
      };
    });

    // Insert all students with ON CONFLICT
    const insertQuery = `
      INSERT INTO users (id, name, email, password, role, student_number)
      VALUES ${studentsWithData.map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`).join(', ')}
      ON CONFLICT (email) DO NOTHING
      RETURNING id
    `;

    const values = studentsWithData.flatMap((s) => [s.id, s.name, s.email, s.password, s.role, s.student_number]);

    const result = await pool.query(insertQuery, values);
    createdCount = result.rows.length;
    skippedCount = students.length - createdCount;

    return res.status(201).json({
      created_count: createdCount,
      skipped_count: skippedCount,
      total_attempted: students.length,
    });
  } catch (error) {
    console.error('Bulk create students error:', error);
    return res.status(500).json({ error: error.message || 'Server error' });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkCreateStudents,
};
