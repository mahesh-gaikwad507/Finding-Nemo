-- Finding Nemo: Quiz Adventure — Database Schema
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS finding_nemo_quiz CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE finding_nemo_quiz;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_email (email),
    INDEX idx_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB;

-- ============================================================
-- QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category ENUM('python', 'sql', 'excel') NOT NULL,
    sequence_number INT NOT NULL,
    clue TEXT NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer ENUM('A', 'B', 'C', 'D') NOT NULL,
    explanation TEXT NOT NULL,
    concept VARCHAR(100) NOT NULL,
    prerequisite_concept VARCHAR(100) DEFAULT NULL,
    difficulty ENUM('beginner', 'intermediate', 'advanced') NOT NULL,
    narrative_context TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_category_sequence (category, sequence_number),
    INDEX idx_category (category),
    INDEX idx_difficulty (difficulty)
) ENGINE=InnoDB;

-- ============================================================
-- QUIZ ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    category ENUM('python', 'sql', 'excel') NOT NULL,
    current_question INT NOT NULL DEFAULT 1,
    correct_answers INT NOT NULL DEFAULT 0,
    wrong_answers INT NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    total_time_seconds INT NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_category (category),
    INDEX idx_is_completed (is_completed),
    INDEX idx_score_time (score DESC, total_time_seconds ASC),
    INDEX idx_user_category (user_id, category)
) ENGINE=InnoDB;

-- ============================================================
-- USER ANSWERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS user_answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    attempt_id INT NOT NULL,
    question_id INT NOT NULL,
    selected_answer ENUM('A', 'B', 'C', 'D') NOT NULL,
    is_correct BOOLEAN NOT NULL,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE KEY uk_attempt_question (attempt_id, question_id),
    INDEX idx_attempt_id (attempt_id),
    INDEX idx_question_id (question_id)
) ENGINE=InnoDB;
