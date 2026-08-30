#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '../package.json'), 'utf-8'),
);
const { version } = packageJson;

const args = process.argv.slice(2);
const platformFlag = args.find(
  a => a === '--ios-only' || a === '--android-only',
);
const tagPrefix = args.find(a => !a.startsWith('--'));

if (!tagPrefix) {
  console.error('❌ Error: Tag prefix is required');
  console.error(
    'Usage: node scripts/create-tag.mjs <prefix> [--ios-only | --android-only]',
  );
  console.error('');
  console.error('Examples:');
  console.error(
    '  node scripts/create-tag.mjs prod              # Both iOS and Android',
  );
  console.error('  node scripts/create-tag.mjs prod --ios-only   # iOS only');
  console.error(
    '  node scripts/create-tag.mjs stg --android-only # Android only',
  );
  process.exit(1);
}

// Android tag: {prefix}-v{version}; iOS tag: ios-v{version}, prod only —
// iOS has no dev or stg builds. So `prod` with no flag tags both, `dev`/`stg`
// tag Android alone, `playstore` is always Android, and the two platform flags
// narrow to one side.
const isPlaystore = tagPrefix === 'playstore';
const iosProdOnly = tagPrefix === 'prod';

const buildAndroid = platformFlag !== '--ios-only' || isPlaystore;
const buildIos =
  !isPlaystore &&
  (platformFlag === '--ios-only' || (iosProdOnly && !platformFlag));

const tags = [];
if (buildAndroid) tags.push(`${tagPrefix}-v${version}`);
if (buildIos) tags.push(`ios-v${version}`);

if (tags.length === 0) {
  console.error('❌ No tags to create');
  process.exit(1);
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve =>
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    }),
  );
}

const platforms = [buildAndroid && 'Android', buildIos && 'iOS']
  .filter(Boolean)
  .join(' + ');
console.log(`📦 Creating ${platforms} tags for: ${tagPrefix}`);
console.log(`📝 Version: ${version}`);
console.log(`🏷️  Tags: ${tags.join(', ')}`);
console.log('');

function checkTagExists(tag) {
  let local = false;
  let remote = false;

  try {
    execSync(`git rev-parse ${tag}`, { stdio: 'pipe' });
    local = true;
  } catch {
    // Tag doesn't exist locally
  }

  try {
    const remoteCheck = execSync(`git ls-remote --tags origin ${tag}`, {
      stdio: 'pipe',
    })
      .toString()
      .trim();
    if (remoteCheck) remote = true;
  } catch {
    // Tag doesn't exist on remote
  }

  return { local, remote };
}

function deleteTag(tag, { local, remote }) {
  if (local) {
    console.log(`🗑️  Deleting local tag ${tag}...`);
    execSync(`git tag -d ${tag}`, { stdio: 'inherit' });
  }
  if (remote) {
    console.log(`🗑️  Deleting remote tag ${tag}...`);
    execSync(`git push origin :refs/tags/${tag}`, { stdio: 'inherit' });
  }
}

try {
  const existingTags = [];
  for (const tag of tags) {
    const exists = checkTagExists(tag);
    if (exists.local || exists.remote) {
      existingTags.push({ tag, ...exists });
    }
  }

  if (existingTags.length > 0) {
    console.log('⚠️  The following tags already exist:');
    for (const { tag, local, remote } of existingTags) {
      const where = [local && 'local', remote && 'remote']
        .filter(Boolean)
        .join(', ');
      console.log(`   - ${tag} (${where})`);
    }
    console.log('');

    const answer = await askQuestion(
      'Do you want to delete and recreate these tags? (y/N): ',
    );

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Aborted. Tags were not modified.');
      process.exit(0);
    }

    console.log('');

    for (const { tag, local, remote } of existingTags) {
      deleteTag(tag, { local, remote });
    }
    console.log('');
  }

  for (const tag of tags) {
    const platform = tag.startsWith('ios-') ? 'iOS' : 'Android';
    const message = `${platform} ${tagPrefix} release ${tag}`;

    console.log(`🏷️  Creating tag ${tag}...`);
    execSync(`git tag -a ${tag} -m "${message}"`, { stdio: 'inherit' });
    console.log(`✅ Created: ${tag}`);
  }

  console.log('');
  console.log('⬆️  Pushing tags to remote...');
  execSync(`git push origin ${tags.join(' ')}`, { stdio: 'inherit' });
  console.log('');

  console.log(`🎉 Done! ${tags.length} tag(s) created and pushed:`);
  for (const tag of tags) {
    const icon = tag.startsWith('ios-') ? '🍎' : '🤖';
    console.log(`   ${icon} ${tag}`);
  }
} catch (error) {
  console.error('');
  console.error('❌ Failed to create/push tags');
  console.error('');

  if (error.message.includes('not a git repository')) {
    console.error('Error: Not in a git repository');
  } else if (error.message.includes('remote: Permission')) {
    console.error(
      'Error: Permission denied. Check your git credentials and repository access.',
    );
  } else if (error.message.includes('Could not resolve host')) {
    console.error(
      'Error: Network connection failed. Check your internet connection.',
    );
  } else if (error.message.includes('ssh')) {
    console.error('Error: SSH authentication failed.');
    console.error('Try running: ssh-add ~/.ssh/id_rsa');
  } else {
    console.error(`Error: ${error.message}`);
  }

  console.error('');
  process.exit(1);
}
