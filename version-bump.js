/**
 * Version Bump Script for Dark Patterns Detector
 * 
 * Usage:
 *   node version-bump.js [patch|minor|major]
 * 
 * Examples:
 *   node version-bump.js patch - Increases version from 1.0.0 to 1.0.1
 *   node version-bump.js minor - Increases version from 1.0.0 to 1.1.0
 *   node version-bump.js major - Increases version from 1.0.0 to 2.0.0
 */

const fs = require('fs');
const path = require('path');

// Path to the manifest.json file
const manifestPath = path.join(__dirname, 'manifest.json');

// Get the version type from command line arguments (default to 'patch')
const versionType = process.argv[2] || 'patch';

// Validate version type
if (!['patch', 'minor', 'major'].includes(versionType)) {
  console.error('Error: Version type must be one of: patch, minor, major');
  process.exit(1);
}

try {
  // Read the manifest file
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);
  
  // Get the current version
  const currentVersion = manifest.version;
  console.log(`Current version: ${currentVersion}`);
  
  // Split version into components
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  // Calculate new version based on version type
  let newVersion;
  switch (versionType) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  // Update the version in the manifest
  manifest.version = newVersion;
  
  // Write the updated manifest back to file
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    'utf8'
  );
  
  console.log(`Version bumped from ${currentVersion} to ${newVersion}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Update CHANGELOG.md with your changes');
  console.log('2. Test the extension thoroughly');
  console.log(`3. Create a backup copy of this version (e.g., DarkPatternsDetector-v${newVersion}.zip)`);
  
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
} 