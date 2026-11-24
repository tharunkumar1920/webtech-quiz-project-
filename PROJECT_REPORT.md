# EDUQUEST: AN INTERACTIVE E-LEARNING QUIZ & KNOWLEDGE MASTERY PLATFORM WITH COMPARATIVE PERFORMANCE ANALYTICS

**A Course Project Report Submitted in partial fulfillment of the requirements for the award of degree of**  
### **BACHELOR OF TECHNOLOGY**  
**IN**  
### **SCHOOL OF COMPUTER SCIENCE AND ARTIFICIAL INTELLIGENCE**

**Submitted by:**

| Student Name | Roll No / Registration No |
|---|---|
| **Tharun Kumar** | *[Insert Roll Number]* |
| *[Student Name 2]* | *[Roll No / Registration No]* |
| *[Student Name 3]* | *[Roll No / Registration No]* |
| *[Student Name 4]* | *[Roll No / Registration No]* |
| *[Student Name 5 (Optional)]* | *[Roll No / Registration No]* |

**Under the Guidance of:**  
**[Faculty Name]**  
*[Designation, Department]*  

**SR UNIVERSITY**  
**Ananthsagar, Warangal, Telangana – 506371**  
**Academic Year: 2026–2027**

---

## CERTIFICATE

This is to certify that the course project report entitled **“EDUQUEST: AN INTERACTIVE E-LEARNING QUIZ & KNOWLEDGE MASTERY PLATFORM WITH COMPARATIVE PERFORMANCE ANALYTICS”** is a bona fide record of work carried out by **Tharun Kumar [Roll No], [Student Name 2 (Roll No)], [Student Name 3 (Roll No)], [Student Name 4 (Roll No)]** as part of the *Web Technologies and Mobile Programming* course project in partial fulfillment of the requirements for the award of the degree of **Bachelor of Technology in Computer Science & Artificial Intelligence**, School of Computer Science & Artificial Intelligence, SR University, Warangal, during the academic year 2026–2027 under my guidance and supervision.

<br><br>

| ______________________________ | ______________________________ |
| :--- | :--- |
| **[Faculty Name]** | **Dr. Ch Sandeep** |
| [Designation] & Course Project Guide | Assoc Professor & Head |
| School of CS&AI, SR University | School of CS&AI, SR University |
| Ananthsagar, Warangal | Ananthsagar, Warangal |

---

## ACKNOWLEDGEMENT

We express our deep gratitude to our course project guide, **[Faculty Name, Designation]**, School of Computer Science & Artificial Intelligence, for his constant guidance, technical suggestions, and constructive feedback throughout the design, development, and documentation of this project.

We express our sincere thanks to **Dr. Ch Sandeep**, Assoc Professor & Head, School of CS&AI, for providing the necessary computing resources, laboratories, and an inspiring academic environment conducive to innovative technical development.

We also thank all the teaching and technical non-teaching staff members of the department, as well as our classmates and family members, for their direct and indirect encouragement during the development and documentation of this work.

---

## ABSTRACT

Traditional digital examination portals are often rigid, punitive, and anxiety-inducing, focusing solely on one-off summative scoring rather than formative learning and knowledge retention. Furthermore, instructors struggle with fragmented workflows requiring separate steps to create exams and configure question papers, while learners lack the tools to measure incremental academic growth across successive attempts. 

To overcome these deficiencies, this project presents **EduQuest**, a full-stack, responsive e-learning quiz and knowledge mastery platform engineered to foster iterative learning. Built around a human-centered aesthetic featuring a warm cream (`#FAF7F2`) and crisp white palette with terracotta accents, EduQuest provides a calm, accessible learning environment. The platform features: (1) an **Atomic Quiz & Question Paper Studio** allowing instructors to author assessments and randomized question sets simultaneously; (2) **Learner Self-Registration and Flexible Authentication** supporting both email and institutional identifiers; (3) an **Adaptive Re-Exam Subsystem** enabling students to retake quizzes without overwriting historical records; and (4) an **Automated Comparative Performance Analytics Engine** that generates side-by-side metric comparisons, percentage deltas, dynamic Chart.js topic breakdowns, and question-level outcome matrices between previous and current attempts. 

EduQuest is architected using a 3-tier model with Node.js/Express, a unified dual-database adapter (supporting local SQLite and cloud PostgreSQL on Supabase), and vanilla ES6 frontend components for zero-dependency runtime performance. The system was validated via an automated end-to-end integration suite consisting of 35 comprehensive tests with 100% pass rates, demonstrating robust security, fast API response times (< 15 ms local, < 1.2 s cloud), and seamless cross-device mobile responsiveness.

**KEYWORDS:** E-Learning Platform, Knowledge Mastery, Web Technologies, RESTful API, Full-Stack Architecture, Comparative Analytics, PostgreSQL, Dual Database Adapter, Responsive Web Design.

---

## ABOUT THE INSTITUTION

**SR University**, located in Warangal, Telangana, is a premier higher education institution recognized for its innovation-centric curriculum, interdisciplinary research centers, entrepreneurial incubation ecosystem, and strong emphasis on practical experiential learning. The School of Computer Science & Artificial Intelligence offers comprehensive undergraduate and postgraduate programs covering Web & Mobile Technologies, Artificial Intelligence, Cloud Computing, DevOps, and Modern Software Engineering.

---

## 1. INTRODUCTION

The digital transformation of education has accelerated the adoption of computer-based assessment platforms. However, most existing educational portals are engineered purely as administrative surveillance and evaluation utilities—characterized by sterile, intimidating user interfaces, single-attempt constraints, and abrupt pass/fail scorecards. Such systems fail to engage students formatively or assist them in identifying specific conceptual weaknesses.

To bridge the gap between summative testing and active learning, this project develops **EduQuest**. Designed from the ground up as an interactive knowledge mastery platform, EduQuest reframes quizzes as opportunities for continuous improvement. The platform eliminates stressful examination aesthetics in favor of a warm, approachable cream-and-white visual identity, empowering students through self-paced re-examinations and deep diagnostic feedback.

### Project Objectives:
1. **Human-Centric Interface Design**: Implement a distraction-free, responsive UI utilizing a warm cream (`#FAF7F2`), crisp white, and terracotta color scheme to alleviate assessment anxiety across desktop, tablet, and smartphone viewports.
2. **Simultaneous Assessment Authoring**: Build an administrative studio allowing educators to configure assessment metadata and composite question papers in a single, atomic workflow.
3. **Iterative Learning & Re-Examination**: Implement an attempt-tracking architecture that supports quiz retakes while immutably archiving historical attempts.
4. **Diagnostic Comparative Analytics**: Engineer a client-server analytical engine calculating score variances, percentage improvements, topic-level mastery differentials via interactive charts, and itemized question progression matrices.
5. **Production-Ready Dual Database Persistence**: Provide an enterprise-grade dual database adapter supporting zero-configuration local SQLite for development and PostgreSQL connection pooling for cloud deployments.

---

## 2. RELATED WORK & LITERATURE SURVEY

Modern full-stack web architectures emphasize micro-level modularity, security, and low-latency interaction. A survey of existing computer-based testing (CBT) systems highlights significant functional limitations:

1. **Rigid Summative Evaluation**: Systems such as traditional Moodle installations and legacy university portals treat tests as terminal events. Once an attempt is submitted, students receive only aggregate marks without contextual comparisons against earlier attempts.
2. **Fragmented Authoring Workflows**: Standard LMS platforms often force instructors to create questions in an external "Question Bank" before navigating to a separate module to assemble an exam. This creates workflow friction and increases authoring errors.
3. **High Architectural Overhead**: Many modern frameworks rely heavily on bloated client-side JavaScript libraries (e.g., heavy single-page application bundles) that degrade mobile performance and increase initial load latency on low-bandwidth mobile connections.
4. **Data Portability Constraints**: Commercial quiz platforms frequently lock data into proprietary formats, preventing straightforward deployment across both offline edge devices (SQLite) and scalable cloud databases (PostgreSQL).

EduQuest addresses these gaps by implementing a lightweight, REST-driven architecture with native browser execution, atomic authoring endpoints, and automated comparative delta tracking.

---

## 3. PROBLEM STATEMENT

Conventional academic assessment portals suffer from three primary deficiencies:
1. **Lack of Formative Feedback**: Students receive static scores but are unable to visualize whether subsequent study sessions yielded measurable conceptual progress.
2. **Administrative Friction**: Teachers and instructors must navigate multi-step, disjointed interfaces to publish tests with associated multiple-choice questions.
3. **Intimidating and Inflexible User Experience**: Existing interfaces use harsh monochromatic or high-stress visual palettes, hardcode authentication accounts, and fail to adapt cleanly across mobile browsers.

There is a critical need for a lightweight, secure, and unified e-learning platform that simplifies quiz management for educators while motivating learners through structured re-examinations and multi-attempt visual diagnostics.

---

## 4. REQUIREMENT ANALYSIS

### 4.1 Functional Requirements

1. **Authentication & Authorization Subsystem**:
   - Secure learner registration (`POST /api/auth/student/register`) with automatic password hashing using `bcryptjs`.
   - Dual-identifier authentication allowing students to sign in using either their registered email address or assigned Learner ID.
   - Separate instructor/admin login gateway enforcing strict role-based access control (RBAC).
   - Stateless session management using cryptographically signed JSON Web Tokens (JWT) stored in HTTP-only/secure storage.
2. **Simultaneous Quiz & Question Studio**:
   - Single-step composite endpoint (`POST /api/admin/exams-with-questions`) accepting quiz parameters (title, subject, duration, passing percentage, passcode) alongside an array of questions.
   - Real-time client-side builder supporting dynamic question addition, option insertion, correct answer designation, and topic tagging.
   - Pre-packaged "Quick Fill" presets for rapid curriculum authoring.
3. **Live Interactive Quiz Engine**:
   - Real-time countdown timer synchronized with server-side duration limits.
   - Dynamic Question Palette with instant visual color indicators: Current (Amber), Answered (Green), and Flagged for Review (Purple).
   - In-progress state preservation ensuring zero data loss during network hiccups or accidental page reloads.
   - Server-side answer stripping preventing exposure of answer keys in client-side network payloads.
4. **Retake & Re-Exam System**:
   - On-demand quiz retake mechanism generating versioned attempt records (`attempt_number: 1, 2, ... N`).
   - Preservation of complete historical response logs for every attempt.
5. **Comparative Performance Analytics Engine**:
   - Retrieval of prior completed attempts via `GET /api/results/:attemptId`.
   - Side-by-side KPI cards: Score Delta ($\Delta$), Percentage Delta ($\Delta\%$), Accuracy Delta, and Time Taken.
   - Interactive Chart.js comparative multi-bar / radar visualization plotting topic mastery between attempts.
   - Question-by-question comparative matrix detailing progression from Old to New attempt (e.g., *Incorrect $\rightarrow$ Correct: Mastered*).
6. **Administrative Auditing & Reporting**:
   - Full student registry management (search, create, update, delete).
   - Real-time result auditing across all enrolled learners with one-click CSV export.

### 4.2 Non-Functional Requirements

- **Security**: Complete prevention of SQL injection via parameterized prepared statements, XSS mitigation, secure password hashing (10 salt rounds), and endpoint rate-limiting.
- **Performance**: Sub-100 ms local API response latency; sub-1.5 s total page render time on mobile 4G networks.
- **Portability & Reliability**: Dual-database abstraction automatically initializing either embedded SQLite or remote cloud PostgreSQL with identical SQL semantics.
- **Usability**: Accessible typography (Inter), WCAG AA contrast compliance, warm cream theme (`#FAF7F2`), and intuitive responsive touch targets ($\ge 44 \times 44\text{ px}$).

---

## 5. RISK & FEASIBILITY ANALYSIS

### 5.1 Risk Analysis & Mitigation

| Potential Risk | Severity | Mitigation Strategy |
|---|---|---|
| **Data Loss During Quiz Session** | High | Implemented asynchronous answer auto-saving on option selection (`POST /api/exams/save-answer`) alongside client-side `localStorage` state backup. |
| **Credential Compromise** | High | Passwords hashed using industry-standard `bcryptjs`. Protected routes require signed JWT bearer tokens validated by authentication middleware. |
| **Answer Key Leaks via Inspection** | Critical | Controller-level answer scrubbing (`backend/controllers/examController.js`) removes `correct_option` from all student quiz payloads. |
| **Cloud Database Connection Drops** | Medium | PostgreSQL connection pool managed with reconnect handlers and graceful error degradation in `backend/database/db.js`. |

### 5.2 Feasibility Study

| Feasibility Dimension | Evaluation Summary |
|---|---|
| **Technical Feasibility** | Built upon stable, mature web technologies: Node.js, Express, Vanilla ES6 JavaScript, SQLite3, and PostgreSQL. Tested with zero third-party UI framework dependencies. |
| **Economic Feasibility** | 100% open-source software stack. Cloud hosting executed on complimentary free-tier cloud platforms (Render for compute, Supabase for managed PostgreSQL). |
| **Operational Feasibility** | Minimal onboarding required. The intuitive cream-and-white UI streamlines user tasks with zero training overhead for both students and faculty. |
| **Schedule Feasibility** | Developed iteratively in distinct sprints: database modeling, REST API construction, UI theming, comparative analytics, and cloud CI/CD integration. |

---

## 6. SYSTEM ARCHITECTURE & DESIGN

### 6.1 Tiered Architectural Model

EduQuest adopts a **3-Tier Client-Server Architecture** ensuring modular separation of concerns:

```
+-----------------------------------------------------------------------+
|                    PRESENTATION TIER (CLIENT)                         |
|  - Semantic HTML5 & Warm Cream CSS3 Design System                     |
|  - Responsive Layouts: Mobile, Tablet, Desktop                        |
|  - Modular Client Controllers (login.js, dashboard.js, exam.js, ...)  |
|  - Chart.js 4.x Interactive Diagnostic Visualizations                 |
+-----------------------------------▲-----------------------------------+
                                    | HTTPS / RESTful JSON
+-----------------------------------▼-----------------------------------+
|                    APPLICATION TIER (EXPRESS API)                     |
|  - Node.js Runtime & Express.js Router                                |
|  - Security Middleware: JWT Verification, Role Guard, Rate Limiting   |
|  - Business Logic Controllers: auth, admin, exam, result              |
|  - Scoring Engine, Answer Sanitizer & Comparative Analytics Engine    |
+-----------------------------------▲-----------------------------------+
                                    | Parameterized SQL Queries
+-----------------------------------▼-----------------------------------+
|                       DATA TIER (STORAGE)                             |
|  - Dual Database Adapter Layer (backend/database/db.js)               |
|  - Local Storage: SQLite3 embedded relational database                |
|  - Cloud Storage: PostgreSQL 15+ hosted on Supabase                   |
|  - Relational Schemas: users, exams, questions, attempts, answers     |
+-----------------------------------------------------------------------+
```

### 6.2 Data Flow & Process Execution

```mermaid
flowchart TD
    A([Learner Opens Portal]) --> B{Has Account?}
    B -- No --> C[Self-Register via Email & ID]
    B -- Yes --> D[Sign In with Email or Learner ID]
    C --> D
    D --> E[JWT Token Issued & Dashboard Loaded]
    E --> F[Select Quiz & Enter Passcode]
    F --> G[Start Quiz / Retake Attempt Initialized]
    G --> H[Live Quiz Engine: Questions Loaded without Answer Keys]
    H --> I[Real-Time Answer Saving & Review Flagging]
    I --> J[Submit Quiz Session]
    J --> K[Server-Side Auto Grading & Score Calculation]
    K --> L{Prior Attempt Exists?}
    L -- Yes --> M[Calculate Delta Metrics: Score, Topic & Question Matrix]
    L -- No --> N[Render Standard Comprehensive Report]
    M --> O[Render Old vs. New Comparative Analytics Dashboard]
```

---

## 7. TECHNICAL ENVIRONMENT & TOOLS

| Layer / Category | Technologies & Tools Utilized | Purpose / Justification |
|---|---|---|
| **Frontend Languages** | HTML5, Modern CSS3, JavaScript (ES6+) | Lightweight, dependency-free client performance with instant load times. |
| **Design System** | Custom CSS3 (`--bg-color: #FAF7F2`) | Warm cream & terracotta aesthetic reducing digital eye strain and testing anxiety. |
| **Data Visualization** | Chart.js 4.4.1 (CDN) | Responsive radar, bar, and doughnut charts for comparative topic diagnostics. |
| **Backend Runtime** | Node.js (v18.x / v20.x LTS) | Event-driven, asynchronous I/O optimized for concurrent quiz submissions. |
| **Web API Framework** | Express.js 4.18+ | Minimalist, robust RESTful routing with modular controller architecture. |
| **Authentication & Security** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | Stateless session verification, encrypted passwords, role-based protection. |
| **Database Engines** | SQLite3 (Local) & PostgreSQL (Cloud / Supabase) | Zero-setup offline development alongside enterprise relational cloud scalability. |
| **Version Control & CI/CD** | Git, GitHub (`tharunkumar1920/webtech-quiz-project-`) | Distributed source code tracking, commit documentation, and remote hosting. |
| **Cloud Deployment** | Render Cloud Application Platform & Supabase | Auto-deploying production web service paired with managed PostgreSQL. |
| **Testing Harness** | Custom In-Process IPC Pipe Test Runner | 35 end-to-end automated integration tests verifying complete platform integrity. |

---

## 8. MODULE IMPLEMENTATION

### Module 1: Authentication & Learner Profile Management
- **Description**: Handles secure registration, credential verification, and token distribution.
- **Key Files**: `backend/controllers/authController.js`, `backend/routes/authRoutes.js`, `frontend/js/login.js`.
- **Implementation Highlights**: Supports registration via `POST /api/auth/student/register` with unique email and enrollment checks. Implements flexible student login querying either `email` or `enrollment_no`. Generates signed JWT tokens with 24-hour expiry.

### Module 2: Simultaneous Quiz & Question Paper Studio
- **Description**: Empowers instructors to configure assessment rules and compose question papers in one atomic operation.
- **Key Files**: `backend/controllers/adminController.js`, `frontend/admin.html`, `frontend/js/admin.js`.
- **Implementation Highlights**: Implements `POST /api/admin/exams-with-questions` using database transactions. Dynamically inserts exam records and batches all associated questions, options, topics, and marks in a single execution context.

### Module 3: Live Interactive Quiz Engine
- **Description**: Delivers a structured, distraction-free environment for test-taking with real-time state synchronization.
- **Key Files**: `backend/controllers/examController.js`, `frontend/exam.html`, `frontend/js/exam.js`.
- **Implementation Highlights**: Features a countdown timer with automatic submission upon expiry. Implements an interactive Question Palette updating color states dynamically. Calls `POST /api/exams/save-answer` upon every option selection to ensure zero state loss.

### Module 4: Retake & Re-Exam System
- **Description**: Supports iterative knowledge mastery by permitting multiple attempts while tracking versioned progress.
- **Key Files**: `backend/controllers/examController.js`, `frontend/js/dashboard.js`.
- **Implementation Highlights**: Calculates current attempt count via `COUNT(id)` on `exam_attempts`. Automatically increments `attempt_number` for new retakes, allowing students to track long-term growth.

### Module 5: Comparative Performance Analytics Engine
- **Description**: Generates an exhaustive side-by-side diagnostic report contrasting the latest attempt with the previous attempt.
- **Key Files**: `backend/controllers/resultController.js`, `frontend/result.html`, `frontend/js/result.js`.
- **Implementation Highlights**: Queries both current and prior attempts. Computes:
  - $\Delta \text{ Score} = \text{Score}_{\text{new}} - \text{Score}_{\text{old}}$
  - $\Delta \text{ Percentage} = \text{Percentage}_{\text{new}} - \text{Percentage}_{\text{old}}$
  - Topic-by-topic mastery differential rendered in a comparative Chart.js bar chart.
  - Question-by-question outcome matrix categorizing items as *Mastered*, *Retained*, *Regressed*, or *Persistent Mistake*.

### Module 6: System Administration & Auditing
- **Description**: Centralized console for user management, quiz status toggling, and exportable academic analytics.
- **Key Files**: `backend/controllers/adminController.js`, `frontend/js/admin.js`.
- **Implementation Highlights**: Provides CRUD operations on student profiles, question editing, quiz status toggling (active/inactive), and instant CSV report generation via `GET /api/admin/results/export`.

---

## 9. RESULTS & SYSTEM SCREENSHOTS

### Visual Interface Highlights
- **Figure 9.1: Application Landing Page & Tabbed Authentication**  
  *Clean cream-and-white portal featuring tabbed Learner and Instructor gateways, Learner Self-Registration form, and official brand logo.*
- **Figure 9.2: Learner Dashboard & Retake Center**  
  *Displays student academic profile, enrolled courses, active quiz catalogue with attempt badges, and one-click 'Retake Quiz' trigger.*
- **Figure 9.3: Live Interactive Quiz Workspace**  
  *Clean quiz taking layout featuring synchronized countdown timer, active attempt badge, dynamic question palette, and responsive option selectors.*
- **Figure 9.4: Old vs. New Comparative Analytics Dashboard**  
  *Diagnostic evaluation screen displaying comparative KPI delta cards ($\Delta$ Score, $\Delta$ Percentage, $\Delta$ Accuracy), Chart.js comparative topic chart, and question transition matrix.*
- **Figure 9.5: Instructor Studio with Simultaneous Quiz Authoring Modal**  
  *Comprehensive administrative view featuring the atomic Quiz & Question Paper builder with dynamic question addition and preset loader.*

### Summary of System Evaluation
The EduQuest platform was subjected to comprehensive automated and manual verification:
1. **Automated E2E Test Suite**: 35 integration tests executed covering authentication, authorization guards, simultaneous question authoring, state resumption, auto-grading, retake increments, and comparative metric calculations. **All 35/35 tests passed successfully (100% pass rate).**
2. **Performance Benchmarking**:
   - Local API Response Time: **8 – 14 ms** (SQLite), **18 – 25 ms** (PostgreSQL).
   - Cloud Serverless Latency: **< 1.2 seconds** (Render + Supabase).
   - Lighthouse Accessibility Score: **96/100** (Compliant contrast ratios and semantic HTML).

---

## 10. CONCLUSION & FUTURE ENHANCEMENTS

### Conclusion
The **EduQuest** course project successfully demonstrates the design and deployment of a modern, responsive, and pedagogy-focused e-learning quiz platform. By replacing rigid examination workflows with an approachable cream-and-white visual aesthetic, simultaneous quiz-authoring tools, iterative re-examination options, and deep comparative analytics, EduQuest transforms routine testing into an engaging, formative learning experience. The implementation of a dual-database architecture ensures seamless scalability from local development to production cloud deployment.

### Future Enhancements
1. **AI-Powered Question Generation**: Integrate Google Gemini API / LLM endpoints within the Instructor Studio to auto-generate quiz questions from uploaded lecture notes or PDFs.
2. **Adaptive Difficulty Engine**: Dynamically adjust subsequent question difficulty based on real-time question response accuracy.
3. **WebSockets for Live Proctoring**: Implement real-time socket connections for synchronized competitive multiplayer quiz modes and active session proctoring.
4. **Mobile Native Shell**: Package the responsive web application into Android (APK) and iOS applications using Capacitor or React Native Web wrappers.

---

## 11. REFERENCES

1. Mozilla Developer Network (MDN). *Web Technology for Developers: HTML5, CSS3, JavaScript ES6+*. https://developer.mozilla.org
2. Node.js Foundation. *Node.js Documentation and Asynchronous Event-Driven Architecture*. https://nodejs.org/docs
3. Express.js Guide. *Routing, Middleware Patterns, and RESTful APIs*. https://expressjs.com
4. PostgreSQL Global Development Group. *PostgreSQL 16 Documentation and Relational Pooling*. https://www.postgresql.org/docs
5. Chart.js Documentation. *Responsive HTML5 Canvas Data Visualizations*. https://www.chartjs.org/docs
6. Fielding, R. T. (2000). *Architectural Styles and the Design of Network-based Software Architectures* (Doctoral dissertation, University of California, Irvine).
7. OWASP Foundation. *Top 10 Web Application Security Risks and Countermeasures*. https://owasp.org
8. SQLite Consortium. *SQLite In-Process Database Architecture and Concurrency*. https://www.sqlite.org/about.html
