-- Schema for EduQuest Platform (PostgreSQL Production)

-- 1. Students Table
CREATE TABLE IF NOT EXISTS Students (
    id SERIAL PRIMARY KEY,
    enrollment_no VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL,
    semester INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS Admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Exams Table
CREATE TABLE IF NOT EXISTS Exams (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    exam_code VARCHAR(100) UNIQUE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    max_marks REAL NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Questions Table
CREATE TABLE IF NOT EXISTS Questions (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(10) NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
    marks REAL NOT NULL DEFAULT 1.0,
    topic VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Exam_Assignments Table
CREATE TABLE IF NOT EXISTS Exam_Assignments (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_id, student_id)
);

-- 6. Exam_Attempts Table
CREATE TABLE IF NOT EXISTS Exam_Attempts (
    id SERIAL PRIMARY KEY,
    exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress', 'completed', 'timed_out')),
    total_score REAL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Student_Answers Table
CREATE TABLE IF NOT EXISTS Student_Answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES Exam_Attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES Questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(10) CHECK(selected_option IS NULL OR selected_option IN ('A', 'B', 'C', 'D')),
    is_correct INTEGER DEFAULT 0,
    marks_awarded REAL DEFAULT 0,
    is_marked_for_review INTEGER DEFAULT 0,
    UNIQUE(attempt_id, question_id)
);

-- 8. Results Table
CREATE TABLE IF NOT EXISTS Results (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER UNIQUE NOT NULL REFERENCES Exam_Attempts(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES Students(id) ON DELETE CASCADE,
    exam_id INTEGER NOT NULL REFERENCES Exams(id) ON DELETE CASCADE,
    total_questions INTEGER NOT NULL,
    attempted_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    incorrect_answers INTEGER NOT NULL,
    unanswered_questions INTEGER NOT NULL,
    total_marks_obtained REAL NOT NULL,
    max_marks REAL NOT NULL,
    percentage REAL NOT NULL,
    accuracy REAL NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_pg_questions_exam ON Questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_pg_assignments_student ON Exam_Assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_attempts_student_exam ON Exam_Attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_pg_answers_attempt ON Student_Answers(attempt_id);
CREATE INDEX IF NOT EXISTS idx_pg_results_student ON Results(student_id);
CREATE INDEX IF NOT EXISTS idx_pg_results_exam ON Results(exam_id);
