const mysql = require("mysql2/promise");
require("dotenv").config();

// We need to extract STATIC_STUDENTS from student_data.js
// Since it's a JS file with 'const STATIC_STUDENTS = [...]', we can require it if it exports, 
// but it doesn't. We'll use a hack or just read/parse it.
const fs = require('fs');

async function migrate() {
  const content = fs.readFileSync('./student_data.js', 'utf8');
  // Simple extract using regex or eval (careful)
  const jsonStr = content.match(/const STATIC_STUDENTS = (\[[\s\S]*?\]);/)[1];
  const students = JSON.parse(jsonStr);

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'school_discipline',
  });

  console.log(`Starting migration of ${students.length} students...`);

  try {
    // 1. Get unique classes
    const classes = [...new Set(students.map(s => s.class).filter(Boolean))];
    for (const cls of classes) {
      await connection.execute("INSERT IGNORE INTO classes (name) VALUES (?)", [cls]);
    }
    console.log(`Populated ${classes.length} classes.`);

    // 2. Insert students
    let count = 0;
    for (const s of students) {
      await connection.execute(
        "INSERT INTO students (id, name, class_name, photo, stars) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), class_name=VALUES(class_name), photo=VALUES(photo), stars=VALUES(stars)",
        [s.id, s.name, s.class || null, s.photo || null, s.stars || 0]
      );
      count++;
    }
    console.log(`Migrated ${count} students successfully.`);

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await connection.end();
  }
}

migrate();
