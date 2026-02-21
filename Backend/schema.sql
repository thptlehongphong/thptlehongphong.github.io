-- Create database if not exists
CREATE DATABASE IF NOT EXISTS school_discipline;
USE school_discipline;

-- Admin accounts table
CREATE TABLE IF NOT EXISTS admins (
    username VARCHAR(50) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin0', 'admin1', 'admin2', 'admin3', 'admin4') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Classes table
CREATE TABLE IF NOT EXISTS classes (
    name VARCHAR(20) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    class_name VARCHAR(20),
    photo LONGTEXT, -- Stores Base64 image data
    stars INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (class_name) REFERENCES classes(name) ON DELETE SET NULL
);

-- Point categories (Violations & Rewards)
CREATE TABLE IF NOT EXISTS point_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    points INT NOT NULL,
    type ENUM('violation', 'reward') NOT NULL
);

-- History of violations and rewards
CREATE TABLE IF NOT EXISTS history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20) NOT NULL,
    type_name VARCHAR(255) NOT NULL, -- The specific reason
    points_change INT NOT NULL,
    is_merit BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(50), -- Admin username
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admins(username) ON DELETE SET NULL
);

-- System settings
CREATE TABLE IF NOT EXISTS settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value TEXT
);

-- Initial Data for settings (Example)
INSERT INTO settings (setting_key, setting_value) VALUES 
('system_status', 'active'),
('expiry_date', '2026-12-31'),
('system_message', 'Hệ thống hoạt động bình thường');

-- Default Admin 0
INSERT INTO admins (username, password, role) VALUES ('ADMIN', 'tranhuyhoang', 'admin0');
