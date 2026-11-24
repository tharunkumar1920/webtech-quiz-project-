/**
 * ExamPortal Cross-Platform Browser & Server Launcher
 * Automatically starts the Express server and opens the default web browser.
 */

const { exec, spawn } = require('child_process');
const http = require('http');

const PORT = process.env.PORT || 3000;
const URL = `http://localhost:${PORT}`;

console.log('======================================================================');
console.log('      EDUQUEST - E-LEARNING QUIZ & KNOWLEDGE STUDIO                   ');
console.log('======================================================================\n');
console.log(`[INFO] Starting EduQuest backend server at ${URL} ...`);

// Launch the backend server as a child process
const serverProcess = spawn('node', ['backend/server.js'], {
  stdio: 'inherit',
  shell: true
});

// Function to open the browser based on platform
function openBrowser(targetUrl) {
  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start "" "${targetUrl}"`;
  } else if (platform === 'darwin') {
    command = `open "${targetUrl}"`;
  } else {
    command = `xdg-open "${targetUrl}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.warn(`[WARN] Could not automatically open browser: ${err.message}`);
      console.log(`Please open your browser manually and visit: ${targetUrl}`);
    } else {
      console.log(`[INFO] Browser launched successfully at: ${targetUrl}`);
    }
  });
}

// Poll server until it is ready, then open browser
let attempts = 0;
const maxAttempts = 30;

const pollInterval = setInterval(() => {
  attempts++;
  const req = http.get(`${URL}/api/health`, (res) => {
    if (res.statusCode === 200) {
      clearInterval(pollInterval);
      openBrowser(URL);
    }
  });

  req.on('error', () => {
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      console.log(`[INFO] Server started. Please open: ${URL}`);
      openBrowser(URL);
    }
  });
}, 500);

// Handle clean shutdown
process.on('SIGINT', () => {
  console.log('\n[INFO] Stopping ExamPortal server...');
  serverProcess.kill('SIGINT');
  process.exit(0);
});
