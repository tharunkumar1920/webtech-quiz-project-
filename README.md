# University Online Examination System

> A full-stack web application for online examinations featuring instant server-side evaluation, automated timed submissions, role-based dashboards, and performance analytics with interactive Chart.js visualizations.

---

## 🏛️ System Architecture & Technology Stack

The platform is designed following a clean modular architecture:

- **Frontend**: Pure HTML5, CSS3, and Vanilla JavaScript (ES6+).
  - Clean, professional university portal design (Warm white `#F7F7F5`, clean borders `#E5E5E5`, zero gradients).
  - Responsive layout for desktop and tablet screens.
  - Dedicated print stylesheets (`@media print`) for offline academic reports.
  - Interactive data visualization powered by **Chart.js**.
- **Backend**: **Node.js** with **Express.js**.
  - RESTful API design with route modularization (`/api/auth`, `/api/exams`, `/api/results`, `/api/admin`).
  - Session-based authentication via `express-session` with HTTP-only cookies and bcrypt password hashing.
  - Role-based authorization middleware (`requireStudent`, `requireAdmin`, `requireAuth`).
- **Database**: **SQLite3** relational database with foreign key enforcement (`PRAGMA foreign_keys = ON;`).
  - Promise-based helper abstraction (`backend/database/db.js`).
  - Comprehensive schema migration (`backend/database/schema.sql`) and seeding script (`backend/database/seed.js`).

---

## ✨ Key Features

### 1. Student Examination Journey
- **Authentication**: Secure student login using institutional Enrollment Number and password.
- **Academic Dashboard**:
  - Student profile banner displaying Enrollment Number, Department, Course, and Semester.
  - Examination cards displaying Subject, Duration, Total Questions, Max Marks, and Status (`Scheduled`, `In Progress`, `Completed`).
  - Exam access code modal validation before starting.
  - Historical exam results table with direct links to performance reports.
- **Live Exam Interface**:
  - Sticky top bar with real-time countdown timer, student enrollment number, and exam details.
  - Single question display with clean radio selection styling.
  - **Question Palette**: Grid indicator with color coding:
    - 🟩 **Green**: Answered
    - ⬜ **White/Grey**: Unanswered
    - 🟪 **Purple**: Marked for Review
    - ⬛ **Black border**: Current Question
  - **Autosave & Persistence**: Answers automatically synced to backend database and localStorage on selection.
  - Previous, Save & Next, Mark for Review, and Clear Response buttons.
  - **Submission Guard**: Confirmation modal displaying answered, unanswered, and marked counts before submitting.
  - **Automatic Submission**: Triggered automatically if the live timer expires.
- **Instant Results & Diagnostic Analytics**:
  - 8 Performance Metric Cards: Total Questions, Attempted, Correct, Incorrect, Unanswered, Marks Scored / Max Marks, Percentage, and Accuracy Rate.
  - **4 Chart.js Charts**:
    1. **Response Breakdown** (Doughnut Chart): Correct vs. Incorrect vs. Unanswered.
    2. **Topic Performance** (Bar Chart): % score obtained across evaluated topics.
    3. **Historical Trajectory** (Line Chart): Performance evolution across all past attempts.
    4. **Topic Accuracy** (Horizontal Bar Chart): % accuracy within each topic.
  - **Automated Diagnostic Analysis**:
    - Qualitative assessment statement.
    - Identification of Strongest Topic.
    - Identification of Weakest Topic.
    - Topics requiring immediate revision.
    - Targeted study recommendations.
  - Detailed Question-by-Question review breakdown table.
  - **Print Report Button**: One-click generation of print-optimized academic transcripts.

### 2. Administrator Management Console
- **Role-based Authentication**: Secure admin login.
- **Student Management**:
  - View all registered candidates with enrollment details and completed exam counts.
  - Register new candidates with department, course, and semester assignments.
  - Edit existing student details.
- **Exam Management**:
  - Create new examinations with title, subject, access passcode, duration, and question quotas.
  - One-click Activate / Deactivate status toggle.
  - Assign examinations to all students or selected candidates.
- **Question Bank Management**:
  - Filter questions by examination.
  - Add Multiple Choice Questions (MCQs) with 4 options, topic tagging, marks, and correct answer key.
  - Edit and delete existing questions with automatic question/mark count synchronization.
- **Results & Data Export**:
  - View all student examination submissions in real-time.
  - One-click **CSV Export** (`GET /api/admin/results/export`) for gradebook integration and archival.

### 3. Security & Integrity Guarantees
- **No Client Leaks**: Correct answers are strictly omitted from `/api/exams/start` and exam payloads.
- **Server-side Evaluation**: Score and percentage calculations are computed securely on the backend against authoritative question keys.
- **Resubmission Prevention**: Once an attempt is marked completed, re-submitting or re-taking is rejected.
- **Session Protection**: Protected API endpoints enforce authenticated student or admin sessions with 401/403 status codes.

---

## 🗄️ Relational Database Schema

The database consists of 8 interconnected tables:

```
[Students] (id, enrollment_no, name, email, password_hash, department, course, semester, created_at)
    │
    ├──< [Exam_Assignments] >── [Exams] (id, title, subject, exam_code, duration_minutes, total_questions, max_marks, is_active, created_at)
    │                               │
    ├──< [Exam_Attempts] <──────────┘
    │        │
    │        ├──< [Student_Answers] >── [Questions] (id, exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks, topic)
    │        │
    │        └─── [Results] (id, attempt_id, student_id, exam_id, total_questions, attempted_questions, correct_answers, incorrect_answers, unanswered_questions, total_marks_obtained, max_marks, percentage, accuracy, completed_at)
    │
[Admins] (id, username, password_hash, name, role, created_at)
```

---

## 🚀 Quickstart & Setup Instructions

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended, tested on Node.js v18 & v20+)
- npm (comes bundled with Node.js)

### 1. Installation
Clone or navigate into the project directory:
```bash
cd "final project web"
npm install
```

### 2. Configure Environment (Optional)
A default `.env.example` file is provided:
```bash
cp .env.example .env
```
Default configuration:
- `PORT`: `3000`
- `NODE_ENV`: `development`
- `SESSION_SECRET`: `university-examination-portal-session-secret-2026`

### 3. Seed Database
Initialize the database tables and populate sample students, administrator, questions, and tests:
```bash
npm run seed
```

### 4. Start the Application & Open in Browser

You can launch the server and automatically open the website in your default browser using any of the following options:

#### Option A: One-Click Windows Launcher (Recommended)
Simply **double-click** the `start.bat` file in Windows Explorer, or run:
```cmd
start.bat
```

#### Option B: PowerShell
```powershell
.\start.ps1
```

#### Option C: npm / Node
```bash
npm run launch
```
*(or standard `npm start` for console-only output)*

The server will start at:
👉 **`http://localhost:3000`** and automatically open in your default browser.

---

## 🔑 Sample Login Credentials

| Role | Username / Identifier | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Student** | `STU2023001` | `student123` | Tharun Kumar (Assigned active exam + past diagnostic exam) |
| **Student** | `STU2023002` | `student123` | Priya Sharma |
| **Student** | `STU2023003` | `student123` | Rahul Varma |
| **Administrator** | `admin` | `admin123` | System Administrator |

### Examination Passcodes for Testing
1. **Web Technologies & Database Systems**
   - **Exam Access Code**: `WTDB2026`
   - **Duration**: 30 Minutes
   - **Questions**: 12 MCQs across JavaScript, HTML/CSS, SQL, and Web Architecture.

2. **Mobile Programming & Responsive Web (Demo)**
   - **Exam Access Code**: `DEMO2026`
   - **Duration**: 15 Minutes
   - **Questions**: 6 MCQs across Android Architecture, Lifecycle, UI Layouts, Responsive CSS, PWA, and REST APIs.

---

## 📡 API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/student/login` | Authenticate student via enrollment number and password |
| `POST` | `/api/auth/admin/login` | Authenticate administrator via username and password |
| `GET` | `/api/auth/me` | Retrieve current authenticated user session |
| `POST` | `/api/auth/logout` | Destroy session and clear cookies |

### Student Examination (`/api/exams`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/exams/my-exams` | Get assigned examinations for logged-in student |
| `POST` | `/api/exams/verify-code` | Validate exam access passcode |
| `POST` | `/api/exams/start` | Initialize or resume attempt, returns sanitized questions |
| `POST` | `/api/exams/save-answer` | Autosave student response and review status |
| `POST` | `/api/exams/submit` | Finalize attempt, evaluate scores server-side, record result |

### Results & Performance (`/api/results`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/results/my-results` | List historical completed examinations for student |
| `GET` | `/api/results/:attemptId` | Comprehensive performance details, topic breakdown, charts data |

### Administrator Console (`/api/admin`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/admin/students` | List all registered candidates |
| `POST` | `/api/admin/students` | Register a new student |
| `PUT` | `/api/admin/students/:id` | Update student profile |
| `GET` | `/api/admin/exams` | List all examinations |
| `POST` | `/api/admin/exams` | Create a new examination |
| `PUT` | `/api/admin/exams/:id/toggle` | Toggle examination active/inactive status |
| `POST` | `/api/admin/exams/:id/assign` | Assign examination to student IDs |
| `GET` | `/api/admin/exams/:examId/questions` | List questions for an examination |
| `POST` | `/api/admin/questions` | Create a question with 4 options and topic |
| `PUT` | `/api/admin/questions/:id` | Update question details |
| `DELETE` | `/api/admin/questions/:id` | Delete question from question bank |
| `GET` | `/api/admin/results` | View all candidate submissions |
| `GET` | `/api/admin/results/export` | Download complete results spreadsheet in CSV format |

---

## 🧪 Automated Testing

Two comprehensive test suites are included:

1. **End-to-End System & Edge Case Suite** (32 tests covering complete student journey, admin CRUD, and security guards):
   ```bash
   node backend/test_e2e_verification.js
   ```

2. **Backend API Integration Suite** (16 tests verifying all endpoints and payload shapes):
   ```bash
   node backend/test_backend.js
   ```

Both test suites execute in-process using isolated database instances to ensure zero side-effects on production data.

---

## 📄 License
Educational Project for Web Technologies & Mobile Programming.
