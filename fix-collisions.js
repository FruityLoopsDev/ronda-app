const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function replaceInFile(file, search, replace) {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content);
  }
}

replaceInFile('client.ts', /class ClientApp/g, 'class ClientAppService');
replaceInFile('client.ts', /new ClientApp\(\)/g, 'new ClientAppService()');

replaceInFile('bar.ts', /class HostConsole/g, 'class HostConsoleService');
replaceInFile('bar.ts', /new HostConsole\(\)/g, 'new HostConsoleService()');

replaceInFile('ronda-core.ts', /class RondaEngine/g, 'class RondaEngineService');
replaceInFile('ronda-core.ts', /new RondaEngine\(\)/g, 'new RondaEngineService()');

replaceInFile('nft-utils.ts', /class NFTUtils/g, 'class NFTUtilsService');
replaceInFile('nft-utils.ts', /new NFTUtils\(\)/g, 'new NFTUtilsService()');

// Also update package.json type to module as requested by Vite
const pkgPath = path.join(__dirname, 'package.json');
let pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.type = "module";
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

console.log("Fixed collisions.");
