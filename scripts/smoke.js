const { spawn } = require('child_process');
const electron = require('electron');

const child = spawn(electron, ['.', '--no-sandbox'], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_TEST: '1' }
});
let finished = false;
const timer = setTimeout(() => {
  if (!finished) {
    child.kill('SIGTERM');
    console.error('Electron smoke test timed out.');
    process.exit(1);
  }
}, 15000);
child.on('error', (error) => {
  clearTimeout(timer);
  console.error(error.message);
  process.exit(1);
});
child.on('close', (code) => {
  finished = true;
  clearTimeout(timer);
  if (code === 0) {
    console.log('Electron startup smoke test passed.');
    process.exit(0);
  }
  console.error(`Electron exited with code ${code}.`);
  process.exit(1);
});
