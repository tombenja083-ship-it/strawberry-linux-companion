const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { parseSkill, saveSkill, listSkills, getSkill } = require('../src/skills');

const projectRoot = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
assert.equal(packageJson.main, 'src/main.js');
assert.equal(packageJson.build.linux.target.includes('AppImage'), true);
assert.equal(packageJson.build.linux.target.includes('deb'), true);
for (const file of ['src/main.js', 'src/preload.js', 'src/renderer.js', 'src/google.js', 'src/skills.js', 'src/index.html', 'src/styles.css']) {
  assert.equal(fs.existsSync(path.join(projectRoot, file)), true, `Missing ${file}`);
}
assert.deepEqual(parseSkill('---\nname: daily-report\ndescription: Prepare a daily report\n---\n\nDo the work.'), {
  name: 'daily-report',
  description: 'Prepare a daily report',
  body: 'Do the work.'
});
assert.throws(() => parseSkill('not a skill'), /frontmatter/);
assert.equal(typeof require('../src/google').connectGoogle, 'function');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'strawberry-skill-check-'));
const fakeApp = { getPath: () => tempRoot };
const saved = saveSkill(fakeApp, {
  content: '---\nname: test-skill\ndescription: A test skill\n---\n\n1. Read the input.\n2. Validate the result.',
  sourceUrl: 'https://example.invalid/guide'
});
assert.equal(saved.name, 'test-skill');
assert.equal(listSkills(fakeApp).length, 1);
assert.match(getSkill(fakeApp, 'test-skill').content, /Learned from/);
fs.rmSync(tempRoot, { recursive: true, force: true });
console.log('Project checks passed.');
