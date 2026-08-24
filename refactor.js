const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.ts'));

// 1. First pass: identify exports
const exportsMap = {}; // { moduleName: ['ExportedClass1', 'ExportedInstance1'] }

// 2. Second pass: replace window.XXX
files.forEach(file => {
  let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  
  // Remove window.XXX = new ...
  // Or replace with export const XXX = new ...
  content = content.replace(/window\.(\w+)\s*=\s*new\s+(\w+)\((.*?)\);?/g, 'export const $1 = new $2($3);');
  content = content.replace(/window\.(\w+)\s*=\s*(.*?);/g, 'export const $1 = $2;');
  
  // Clean up config.js script loading
  content = content.replace(/await window\.loadScript\(.*?\);?/g, '');
  
  fs.writeFileSync(path.join(srcDir, file), content);
});

// 3. Third pass: Inject imports for common services in all files
const globalServices = ['DB', 'Auth', 'RondaConfig', 'RondaServices', 'ClientApp', 'Verification', 'HostConsole', 'RondaEngine', 'NFTUtils'];
const importPaths = {
  DB: './db.js',
  Auth: './auth.js',
  RondaConfig: './firebase-config.js',
  RondaServices: './firebase-config.js',
  ClientApp: './client.js',
  Verification: './verification.js',
  HostConsole: './bar.js',
  RondaEngine: './ronda-core.js',
  NFTUtils: './nft-utils.js'
};

files.forEach(file => {
  if (file === 'firebase-config.ts' || file === 'db.ts' || file === 'auth.ts') {
     // Already manually refactored these to some extent, but let's replace window usages
     let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
     content = content.replace(/window\.DB/g, 'DB');
     content = content.replace(/window\.Auth/g, 'Auth');
     content = content.replace(/window\.RondaConfig/g, 'RondaConfig');
     content = content.replace(/window\.RondaServices/g, 'RondaServices');
     content = content.replace(/window\.firebaseModules\./g, '');
     content = content.replace(/const\s+\{.*\}\s*=\s*window\.firebaseModules;/g, '');
     fs.writeFileSync(path.join(srcDir, file), content);
     return;
  }

  let content = fs.readFileSync(path.join(srcDir, file), 'utf8');
  
  // Replace window usages
  content = content.replace(/window\.([A-Za-z0-9_]+)/g, '$1');

  // Gather required imports
  let importsToAdd = new Set();
  globalServices.forEach(srv => {
    if (content.includes(srv) && !content.includes(`export const ${srv}`) && !content.includes(`export class ${srv}`)) {
      importsToAdd.add(`import { ${srv} } from '${importPaths[srv]}';`);
    }
  });

  if (importsToAdd.size > 0) {
    content = Array.from(importsToAdd).join('\n') + '\n\n' + content;
  }

  // Remove firebaseModules destructuring
  content = content.replace(/const\s+\{.*\}\s*=\s*window\.firebaseModules;/g, '');
  content = content.replace(/const\s+\{.*\}\s*=\s*firebaseModules;/g, '');

  fs.writeFileSync(path.join(srcDir, file), content);
});

console.log("Refactoring complete.");
