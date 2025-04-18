/**
 * Backup Script for Dark Patterns Detector
 * 
 * This script creates a ZIP backup of the current extension version.
 * Requires Node.js and the archiver package.
 * 
 * Installation:
 *   npm install archiver
 * 
 * Usage:
 *   node create-backup.js [custom-name]
 */

const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Function to create a zip file
async function createBackup(customName = '') {
  try {
    // Read the manifest to get the current version
    const manifestPath = path.join(__dirname, 'manifest.json');
    const manifestContent = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    const version = manifest.version;
    
    // Create a timestamp for the filename
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
    
    // Determine the output filename
    const namePart = customName ? `-${customName}` : '';
    const outputFilename = `DarkPatternsDetector-v${version}${namePart}-${timestamp}.zip`;
    const output = fs.createWriteStream(path.join(__dirname, outputFilename));
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    // Listen for archive events
    output.on('close', () => {
      console.log(`✅ Backup created successfully: ${outputFilename}`);
      console.log(`📦 Total size: ${(archive.pointer() / (1024 * 1024)).toFixed(2)} MB`);
    });
    
    archive.on('error', (err) => {
      throw err;
    });
    
    // Pipe archive data to the file
    archive.pipe(output);
    
    // Files to include
    const filesToInclude = [
      'manifest.json',
      'popup.html',
      'popup.css',
      'popup.js',
      'background.js',
      'content.js',
      'styles.css',
      'README.md',
      'CHANGELOG.md'
    ];
    
    // Directories to include
    const dirsToInclude = ['icons'];
    
    // Files to exclude
    const filesToExclude = [
      'version-bump.js',
      'create-backup.js',
      '.git',
      '.gitignore',
      'node_modules'
    ];
    
    // Add individual files
    for (const file of filesToInclude) {
      if (fs.existsSync(path.join(__dirname, file))) {
        archive.file(path.join(__dirname, file), { name: file });
      }
    }
    
    // Add directories
    for (const dir of dirsToInclude) {
      if (fs.existsSync(path.join(__dirname, dir))) {
        archive.directory(path.join(__dirname, dir), dir);
      }
    }
    
    // Finalize the archive
    await archive.finalize();
    
    console.log('');
    console.log('This backup can be used to restore the extension if needed.');
    console.log('To restore: Unzip the file and load the unpacked extension in Chrome/Firefox developer mode.');
    
  } catch (error) {
    console.error(`Error creating backup: ${error.message}`);
    process.exit(1);
  }
}

// Get custom name from command line arguments (if provided)
const customName = process.argv[2] || '';

// Check if archiver is installed
try {
  require.resolve('archiver');
  createBackup(customName);
} catch (e) {
  console.error('Error: The "archiver" package is required but not installed.');
  console.log('');
  console.log('Please install it using npm:');
  console.log('npm install archiver');
  process.exit(1);
} 