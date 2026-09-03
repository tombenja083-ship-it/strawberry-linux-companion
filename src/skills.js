const fs = require('fs');
const path = require('path');

function skillsRoot(app) {
  return path.join(app.getPath('userData'), 'skills');
}

function normalizeName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
}

function parseSkill(content) {
  const match = String(content || '').match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) throw new Error('A skill must begin with YAML frontmatter between --- lines.');
  const frontmatter = match[1];
  const name = frontmatter.match(/^name:\s*([^\n]+)$/m)?.[1]?.trim();
  const description = frontmatter.match(/^description:\s*([^\n]+)$/m)?.[1]?.trim();
  if (!name || !description) throw new Error('The skill needs name and description fields.');
  if (!/^[a-z0-9-]+$/.test(name) || name.length > 63) throw new Error('Skill name must use lowercase letters, numbers, and hyphens.');
  return { name, description, body: match[2].trim() };
}

function listSkills(app) {
  const root = skillsRoot(app);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const file = path.join(root, entry.name, 'SKILL.md');
      try {
        const content = fs.readFileSync(file, 'utf8');
        const parsed = parseSkill(content);
        return { name: parsed.name, description: parsed.description, folder: entry.name, content };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSkill(app, name) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  const file = path.join(skillsRoot(app), normalized, 'SKILL.md');
  try {
    const content = fs.readFileSync(file, 'utf8');
    const parsed = parseSkill(content);
    return { ...parsed, content };
  } catch {
    return null;
  }
}

function saveSkill(app, { name, content, sourceUrl }) {
  const parsed = parseSkill(content);
  const normalized = normalizeName(name || parsed.name);
  if (!normalized || parsed.name !== normalized) {
    throw new Error(`The skill folder name must match the frontmatter name: ${normalized || parsed.name}`);
  }
  const body = parsed.body.replace(/\r\n/g, '\n');
  const sourceSection = sourceUrl && !/^## Source\s*$/mi.test(body)
    ? `\n\n## Source\n\nLearned from: ${String(sourceUrl).slice(0, 1000)}\n`
    : '\n';
  const finalContent = `---\nname: ${parsed.name}\ndescription: ${parsed.description}\n---\n\n${body}${sourceSection}`;
  const directory = path.join(skillsRoot(app), normalized);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'SKILL.md'), finalContent, 'utf8');
  return { name: parsed.name, description: parsed.description, path: path.join(directory, 'SKILL.md'), content: finalContent };
}

module.exports = { getSkill, listSkills, parseSkill, saveSkill, skillsRoot, normalizeName };
