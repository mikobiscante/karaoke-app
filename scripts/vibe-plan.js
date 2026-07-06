#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PLANS_DIR = path.join(__dirname, '..', '.vibe', 'plan');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function datePrefix() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function timestamp() {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function ensureDir() {
  fs.mkdirSync(PLANS_DIR, { recursive: true });
}

function cmdNew(title) {
  if (!title) {
    console.error('Usage: node scripts/vibe-plan.js new "Plan Title"');
    process.exit(1);
  }

  ensureDir();

  const slug = slugify(title);
  const prefix = datePrefix();
  let filename = `${slug}-${prefix}.md`;
  let filepath = path.join(PLANS_DIR, filename);
  let counter = 1;

  while (fs.existsSync(filepath)) {
    filename = `${slug}-${prefix}-${counter}.md`;
    filepath = path.join(PLANS_DIR, filename);
    counter++;
  }

  const template = `# Plan: ${title}

**Created:** ${timestamp()}
**Status:** Draft

## Objective

What is the goal of this plan?

## Steps

- [ ] Step 1
- [ ] Step 2
- [ ] Step 3

## Files Affected

-

## Notes

-
`;

  fs.writeFileSync(filepath, template, 'utf-8');
  console.log(`Created: ${filepath}`);
}

function cmdList() {
  ensureDir();

  const files = fs.readdirSync(PLANS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('No plans found in .vibe/plan/');
    return;
  }

  console.log('');
  files.forEach(f => {
    const content = fs.readFileSync(path.join(PLANS_DIR, f), 'utf-8');
    const statusMatch = content.match(/^\*\*Status:\*\*\s*(.+)$/m);
    const objMatch = content.match(/^## Objective\n\n(.+)$/m);
    const status = statusMatch ? statusMatch[1].trim() : 'Unknown';
    const obj = objMatch ? objMatch[1].trim() : '';
    console.log(`  ${f}`);
    console.log(`    Status: ${status}`);
    if (obj) console.log(`    ${obj.slice(0, 72)}${obj.length > 72 ? '...' : ''}`);
    console.log('');
  });
}

function cmdShow(search) {
  if (!search) {
    console.error('Usage: node scripts/vibe-plan.js show <name>');
    process.exit(1);
  }

  ensureDir();

  const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md'));

  let match = files.find(f => f === search || f === `${search}.md`);

  if (!match) {
    match = files.find(f => f.includes(search));
  }

  if (!match) {
    console.error(`No plan matching "${search}" found in .vibe/plan/`);
    console.log('Available plans:');
    files.forEach(f => console.log(`  ${f}`));
    process.exit(1);
  }

  const content = fs.readFileSync(path.join(PLANS_DIR, match), 'utf-8');
  console.log(content);
}

function cmdExec(search) {
  cmdShow(search);
}

function main() {
  const cmd = process.argv[2];
  const args = process.argv.slice(3);

  switch (cmd) {
    case 'new':
      cmdNew(args.join(' '));
      break;
    case 'list':
      cmdList();
      break;
    case 'show':
      cmdShow(args[0]);
      break;
    case 'exec':
      cmdExec(args[0]);
      break;
    default:
      console.log(`
Usage:
  node scripts/vibe-plan.js new <title>       Create a new plan
  node scripts/vibe-plan.js list              List all plans
  node scripts/vibe-plan.js show <name>       Show a plan's content
  node scripts/vibe-plan.js exec <name>       Alias for show (for agent execution)
`);
  }
}

main();
