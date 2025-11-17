#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
const { version } = packageJson;

// Get tag prefix from command line argument (e.g., 'playstore', 'prod', 'dev')
const tagPrefix = process.argv[2];

if (!tagPrefix) {
  console.error('❌ Error: Tag prefix is required');
  console.error('Usage: node scripts/create-tag.js <prefix>');
  console.error('Example: node scripts/create-tag.js playstore');
  process.exit(1);
}

const tag = `${tagPrefix}-v${version}`;
const message = `${tagPrefix.charAt(0).toUpperCase() + tagPrefix.slice(1)} release ${tag}`;

// Helper function to prompt user for yes/no confirmation
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, answer => {
    rl.close();
    resolve(answer);
  }));
}

console.log(`📦 Creating tag: ${tag}`);
console.log(`📝 Version: ${version}`);
console.log('');

try {
  let tagExistsLocally = false;
  let tagExistsRemotely = false;

  // Check if tag exists locally
  try {
    execSync(`git rev-parse ${tag}`, { stdio: 'pipe' });
    tagExistsLocally = true;
  } catch (error) {
    // Tag doesn't exist locally
  }

  // Check if tag exists on remote
  try {
    const remoteCheck = execSync(`git ls-remote --tags origin ${tag}`, { stdio: 'pipe' }).toString().trim();
    if (remoteCheck) {
      tagExistsRemotely = true;
    }
  } catch (error) {
    // Tag doesn't exist on remote
  }

  // If tag exists, ask user for confirmation
  if (tagExistsLocally || tagExistsRemotely) {
    console.log(`⚠️  Tag ${tag} already exists:`);
    if (tagExistsLocally) console.log('   - Exists locally');
    if (tagExistsRemotely) console.log('   - Exists on remote');
    console.log('');

    const answer = await askQuestion('Do you want to delete and recreate this tag? (y/N): ');

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      console.log('❌ Aborted. Tag was not modified.');
      process.exit(0);
    }

    console.log('');

    // Delete local tag if exists
    if (tagExistsLocally) {
      console.log(`🗑️  Deleting local tag ${tag}...`);
      execSync(`git tag -d ${tag}`, { stdio: 'inherit' });
    }

    // Delete remote tag if exists
    if (tagExistsRemotely) {
      console.log(`🗑️  Deleting remote tag ${tag}...`);
      execSync(`git push origin :refs/tags/${tag}`, { stdio: 'inherit' });
      console.log('');
    }
  }

  // Create the tag
  console.log(`🏷️  Creating tag ${tag}...`);
  execSync(`git tag -a ${tag} -m "${message}"`, { stdio: 'inherit' });
  console.log(`✅ Successfully created tag: ${tag}`);
  console.log('');

  // Push the tag
  console.log(`⬆️  Pushing tag to remote...`);
  execSync(`git push origin ${tag}`, { stdio: 'inherit' });
  console.log('');
  console.log(`✅ Successfully pushed tag: ${tag}`);
  console.log('');
  console.log(`🎉 Done! Tag ${tag} has been created and pushed.`);

} catch (error) {
  console.error('');
  console.error(`❌ Failed to create/push tag: ${tag}`);
  console.error('');

  if (error.message.includes('not a git repository')) {
    console.error('Error: Not in a git repository');
  } else if (error.message.includes('remote: Permission')) {
    console.error('Error: Permission denied. Check your git credentials and repository access.');
  } else if (error.message.includes('Could not resolve host')) {
    console.error('Error: Network connection failed. Check your internet connection.');
  } else if (error.message.includes('ssh')) {
    console.error('Error: SSH authentication failed.');
    console.error('Try running: ssh-add ~/.ssh/id_rsa');
  } else {
    console.error(`Error: ${error.message}`);
  }

  console.error('');
  process.exit(1);
}
