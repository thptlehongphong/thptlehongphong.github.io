const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const compression = require("compression");
require("dotenv").config();

const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression()); // Compress all responses
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for Base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(__dirname));
app.use("/Kyluat", express.static(__dirname + "/Kyluat"));

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'school_discipline',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helper for database queries
const query = (sql, params) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
};

// --- AUTHENTICATION ---

// Simple login (Will be database-backed in next step)
// Simple login (Database-backed)
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const results = await query("SELECT * FROM admins WHERE username = ? AND password = ?", [username, password]);
    if (results.length > 0) {
      const user = results[0];

      // KIỂM TRA TRẠNG THÁI HỆ THỐNG (Khóa hoặc Hết hạn)
      if (user.role !== 'admin0') {
        const settingsRes = await query("SELECT setting_key, setting_value FROM settings WHERE setting_key IN ('permissions', 'expiry_date')");
        const settings = {};
        settingsRes.forEach(r => settings[r.setting_key] = r.setting_value);
        
        const today = new Date().toISOString().split('T')[0];
        const isExpired = settings.expiry_date && today > settings.expiry_date;
        
        // Kiểm tra quyền cụ thể cho từng Admin
        const perms = JSON.parse(settings.permissions || '{"admin1":true,"admin2":true,"admin3":true,"admin4":true}');
        const isRoleBlocked = perms[user.role] === false;

        if (isExpired || isRoleBlocked) {
          let errorMsg = isRoleBlocked ? "Tài khoản của bạn đã bị tạm khóa quyền truy cập!" : "Hệ thống đã hết hạn sử dụng. Vui lòng gia hạn!";
          return res.status(403).json({ error: errorMsg });
        }
      }

      res.status(200).json({ 
        message: "Login successful", 
        token: "admin-session-token", 
        role: user.role,
        username: user.username 
      });
    } else {
      res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu!" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// --- CLASSES ---

app.get("/api/classes", async (req, res) => {
  try {
    const results = await query("SELECT * FROM classes ORDER BY name ASC");
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch classes" });
  }
});

app.post("/api/classes", async (req, res) => {
  const { name } = req.body;
  try {
    await query("INSERT INTO classes (name) VALUES (?)", [name]);
    res.status(201).json({ message: "Class created" });
  } catch (err) {
    res.status(500).json({ error: "Could not create class" });
  }
});

app.delete("/api/classes/:name", async (req, res) => {
  try {
    await query("DELETE FROM classes WHERE name = ?", [req.params.name]);
    res.status(200).json({ message: "Class deleted" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete class" });
  }
});

// --- STUDENTS ---

// GET /api/students (EXCLUDE photo for performance)
app.get("/api/students", async (req, res) => {
  try {
    const results = await query("SELECT id, name, class_name, stars FROM students ORDER BY stars DESC, name ASC");
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch students" });
  }
});

// GET /api/students/:id/photo (NEW - Fixed to return binary image)
app.get("/api/students/:id/photo", async (req, res) => {
  const studentId = req.params.id;
  try {
    const results = await query("SELECT photo FROM students WHERE id = ?", [studentId]);
    if (results.length > 0 && results[0].photo) {
      let photoStr = results[0].photo.trim();
      
      // Robust detection of data URIs
      const dataUriRegex = /^data:([^;]+);base64,([\s\S]+)$/;
      const matches = photoStr.match(dataUriRegex);

      if (matches && matches.length === 3) {
        const contentType = matches[1];
        const base64Data = matches[2].replace(/\s/g, ''); // Remove any internal whitespace/newlines
        const img = Buffer.from(base64Data, 'base64');
        
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': img.length,
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(img);
        return;
      }
      
      // Fallback for raw strings
      console.warn(`[PhotoAPI] No standard data URI format for ID: ${studentId}. Sending as text.`);
      res.status(200).send(photoStr);
    } else {
      res.status(404).send(""); 
    }
  } catch (err) {
    console.error(`[PhotoAPI] Error serving photo for ID: ${studentId}:`, err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /api/students/:id
app.get("/api/students/:id", async (req, res) => {
  try {
    const results = await query("SELECT * FROM students WHERE id = ?", [req.params.id]);
    if (results.length > 0) {
      res.status(200).json(results[0]);
    } else {
      res.status(404).json({ error: "Student not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Database error" });
  }
});

// POST /api/students (Add or Update)
app.post("/api/students", async (req, res) => {
  const { id, name, class_name, photo, stars, is_update } = req.body;
  if (!id || !name) return res.status(400).json({ error: "Thiếu MSHS hoặc Họ tên!" });

  try {
    // Chỉ kiểm tra trùng ID nếu KHÔNG phải hành động cập nhật (từ Admin 1)
    if (!is_update) {
      const existing = await query("SELECT id FROM students WHERE id = ?", [id]);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Trùng MSHS! Mã số học sinh này đã tồn tại trên hệ thống. Vui lòng nhập ID khác!" });
      }
    }

    const sql = `
      INSERT INTO students (id, name, class_name, photo, stars) 
      VALUES (?, ?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
      name = VALUES(name), 
      class_name = VALUES(class_name), 
      photo = IF(VALUES(photo) IS NOT NULL AND VALUES(photo) != '', VALUES(photo), photo),
      stars = IF(VALUES(stars) IS NOT NULL, VALUES(stars), stars)
    `;
    await query(sql, [id, name, class_name, photo || null, stars !== undefined ? stars : null]);
    io.emit('data_changed'); // Notify clients
    res.status(200).json({ message: "Lưu dữ liệu học sinh thành công" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi cơ sở dữ liệu khi lưu học sinh" });
  }
});

// DELETE /api/students/:id
app.delete("/api/students/:id", async (req, res) => {
  try {
    await query("DELETE FROM students WHERE id = ?", [req.params.id]);
    res.status(200).json({ message: "Student deleted" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete student" });
  }
});

// --- VIOLATIONS & REWARDS ---

// GET /api/history
app.get("/api/history", async (req, res) => {
  try {
    const sql = `
      SELECT h.*, s.name as student_name, s.class_name 
      FROM history h 
      LEFT JOIN students s ON h.student_id = s.id 
      ORDER BY h.timestamp DESC
    `;
    const results = await query(sql);
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch history" });
  }
});

// POST /api/history
app.post("/api/history", async (req, res) => {
  const { student_id, type_name, points_change, is_merit, created_by } = req.body;
  
  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();

    // 1. Insert into history
    const historySql = "INSERT INTO history (student_id, type_name, points_change, is_merit, created_by) VALUES (?, ?, ?, ?, ?)";
    await connection.query(historySql, [student_id, type_name, points_change, is_merit, created_by]);

    // 2. Update student stars
    const updateSql = "UPDATE students SET stars = stars + ? WHERE id = ?";
    await connection.query(updateSql, [points_change, student_id]);

    await connection.commit();
    io.emit('data_changed'); // Notify clients
    res.status(201).json({ message: "History record added and points updated" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Transaction failed" });
  } finally {
    connection.release();
  }
});

// --- SETTINGS ---

app.get("/api/settings", async (req, res) => {
  try {
    const results = await query("SELECT * FROM settings");
    const settings = {};
    results.forEach(row => settings[row.setting_key] = row.setting_value);
    res.status(200).json(settings);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch settings" });
  }
});

// --- ADMIN MANAGEMENT ---

// GET /api/admins
app.get("/api/admins", async (req, res) => {
  try {
    const results = await query("SELECT * FROM admins");
    res.status(200).json(results);
  } catch (err) {
    res.status(500).json({ error: "Could not fetch admins" });
  }
});

// POST /api/admins
app.post("/api/admins", async (req, res) => {
  const { username, password, role } = req.body;
  try {
    await query("INSERT INTO admins (username, password, role) VALUES (?, ?, ?)", [username, password, role]);
    res.status(201).json({ message: "Admin created" });
  } catch (err) {
    res.status(500).json({ error: "Could not create admin" });
  }
});

// DELETE /api/admins/:username
app.delete("/api/admins/:username", async (req, res) => {
  try {
    await query("DELETE FROM admins WHERE username = ?", [req.params.username]);
    res.status(200).json({ message: "Admin deleted" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete admin" });
  }
});

// --- SETTINGS MANAGEMENT ---

// Update a setting
app.put("/api/settings/:key", async (req, res) => {
  const { key } = req.params;
  const value = typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key];
  try {
    await query("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [key, value]);
    res.status(200).json({ message: "Setting updated" });
  } catch (err) {
    res.status(500).json({ error: "Could not update setting" });
  }
});

// POST /api/settings/:type (Add to JSON list settings like ViolationTypes)
app.post("/api/settings/:type", async (req, res) => {
  const { type } = req.params; // violationtypes, rewardtypes
  const { name, points } = req.body;
  try {
    const resSettings = await query("SELECT setting_value FROM settings WHERE setting_key = ?", [type]);
    let current = {};
    if (resSettings.length > 0) current = JSON.parse(resSettings[0].setting_value);
    
    const id = Date.now().toString();
    current[id] = { name, points };
    
    await query("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)", [type, JSON.stringify(current)]);
    res.status(201).json({ message: "Added successfully" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// DELETE /api/settings/:type/:id
app.delete("/api/settings/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  try {
    const resSettings = await query("SELECT setting_value FROM settings WHERE setting_key = ?", [type]);
    if (resSettings.length === 0) return res.status(404).json({ error: "Not found" });
    
    let current = JSON.parse(resSettings[0].setting_value);
    delete current[id];
    
    await query("UPDATE settings SET setting_value = ? WHERE setting_key = ?", [JSON.stringify(current), type]);
    res.status(200).json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// Clean Students Photos (Set to NULL)
app.post("/api/students/clean_photos", async (req, res) => {
  try {
    await query("UPDATE students SET photo = NULL");
    res.status(200).json({ message: "All student photos cleaned" });
  } catch (err) {
    res.status(500).json({ error: "Clean failed" });
  }
});

// --- MASS UPDATES ---

// Reset All History
app.post("/api/history/reset_all", async (req, res) => {
  const { default_stars } = req.body;
  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM history");
    await connection.query("UPDATE students SET stars = ?", [default_stars || 0]);
    await connection.commit();
    res.status(200).json({ message: "System reset successfully" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Reset failed" });
  } finally {
    connection.release();
  }
});

// Recalculate All Student Stars based on History
app.post("/api/students/recalculate_all", async (req, res) => {
  const { default_stars } = req.body;
  const connection = await pool.promise().getConnection();
  try {
    await connection.beginTransaction();
    // 1. Reset everyone to default
    await connection.query("UPDATE students SET stars = ?", [default_stars || 0]);
    // 2. Apply all history changes
    const [history] = await connection.query("SELECT student_id, points_change FROM history");
    for (const h of history) {
      await connection.query("UPDATE students SET stars = stars + ? WHERE id = ?", [h.points_change, h.student_id]);
    }
    await connection.commit();
    res.status(200).json({ message: "Recalculation complete" });
  } catch (err) {
    await connection.rollback();
    res.status(500).json({ error: "Recalculation failed" });
  } finally {
    connection.release();
  }
});

// DELETE History by ID (with points undo)
app.delete("/api/history/:id", async (req, res) => {
    const { id } = req.params;
    const connection = await pool.promise().getConnection();
    try {
        await connection.beginTransaction();
        const [rows] = await connection.query("SELECT student_id, points_change FROM history WHERE id = ?", [id]);
        if (rows.length > 0) {
            const { student_id, points_change } = rows[0];
            await connection.query("UPDATE students SET stars = stars - ? WHERE id = ?", [points_change, student_id]);
            await connection.query("DELETE FROM history WHERE id = ?", [id]);
        }
        await connection.commit();
        io.emit('data_changed'); // Notify clients
        res.status(200).json({ message: "Record deleted and stars updated" });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: "Delete failed" });
    } finally {
        connection.release();
    }
});

// START SERVER
http.listen(port, () => {
  console.log(`Server is running with Socket.io on port ${port}`);
});
