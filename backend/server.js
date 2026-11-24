require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');

const { initSchema } = require('./database/db');

// Route modules
const authRoutes = require('./routes/authRoutes');
const examRoutes = require('./routes/examRoutes');
const resultRoutes = require('./routes/resultRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy in production (Render, Railway, Vercel)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Enable CORS if requested
app.use(
  cors({
    origin: true,
    credentials: true
  })
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session management
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'online-exam-portal-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    }
  })
);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Clean URL page rewrites for frontend navigation
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(frontendPath, 'dashboard.html'));
});

app.get('/exam', (req, res) => {
  res.sendFile(path.join(frontendPath, 'exam.html'));
});

app.get('/result', (req, res) => {
  res.sendFile(path.join(frontendPath, 'result.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendPath, 'admin.html'));
});

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// Fallback to index.html for root or other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred'
  });
});

// Start server
async function startServer() {
  try {
    // Ensure database tables exist
    await initSchema();

    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`Online Examination System Server running on:`);
      console.log(`http://localhost:${PORT}`);
      console.log(`Serving frontend from: ${frontendPath}`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
