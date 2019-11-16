// This script changes the app version with proper configuration
const fs = require('fs');
const path = require('path');
const package = require('./package.json');
const lock = require('./package-lock.json');
const target = process.argv[2];

if ( ! target || ! target.trim().length ) return console.log('Example: npm run version -- 0.0.0');

// Update package.json and package-lock.json
package.version = target.trim();
lock.version = target.trim();

fs.writeFileSync(path.resolve(__dirname, 'package.json'), JSON.stringify(package, null, 2), { encoding: 'utf8' });
fs.writeFileSync(path.resolve(__dirname, 'package-lock.json'), JSON.stringify(lock, null, 2), { encoding: 'utf8' });

// Update/generate ./src/environments/version.ts
const content = `// This file has been generated automatically, do not change it manually!\nexport const version: string = '${target.trim()}';`;

fs.writeFileSync(path.resolve(__dirname, './src/environments/version.ts'), content, { encoding: 'utf8' });
