-- Schema for Online Examination System

PRAGMA foreign_keys = ON;

-- 1. Students Table
CREATE TABLE IF NOT EXISTS Students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    enrollment_no TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    department TEXT NOT NULL,
    course TEXT NOT NULL,
    semester INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS Admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Exams Table
CREATE TABLE IF NOT EXISTS Exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    exam_code TEXT UNIQUE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    max_marks REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS Questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
    marks REAL NOT NULL DEFAULT 1.0,
    topic TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES Exams(id) ON DELETE CASCADE
);

-- 5. Exam_Assignments Table
CREATE TABLE IF NOT EXISTS Exam_Assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES Exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    UNIQUE(exam_id, student_id)
);

-- 6. Exam_Attempts Table
CREATE TABLE IF NOT EXISTS Exam_Attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'timed_out')),
    total_score REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES Exams(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE
);

-- 7. Student_Answers Table
CREATE TABLE IF NOT EXISTS Student_Answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected_option TEXT CHECK(selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D')),
    is_correct INTEGER DEFAULT 0,
    marks_awarded REAL DEFAULT 0,
    is_marked_for_review INTEGER DEFAULT 0,
    FOREIGN KEY (attempt_id) REFERENCES Exam_Attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES Questions(id) ON DELETE CASCADE,
    UNIQUE(attempt_id, question_id)
);

-- 8. Results Table
CREATE TABLE IF NOT EXISTS Results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    attempt_id INTEGER UNIQUE NOT NULL,
    student_id INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    attempted_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    unanswered_questions INTEGER NOT NULL,
    total_marks_obtained REAL NOT NULL,
    max_marks REAL NOT NULL,
    percentage REAL NOT NULL,
    accuracy REAL NOT NULL,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES Exam_Attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES Students(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES Exams(id) ON DELETE CASCADE
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_questions_exam ON Questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON Exam_Assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_exam ON Exam_Attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON Student_Answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_results_student ON Results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_exam ON Results(exam_id);
