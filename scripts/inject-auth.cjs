const fs = require('fs');

const indexHtml = fs.readFileSync('index.html', 'utf8');
const authStartIndex = indexHtml.indexOf('<section id="view-auth"');
const lobbyStartIndex = indexHtml.indexOf('<section id="view-lobby"');

if (authStartIndex === -1 || lobbyStartIndex === -1) {
  console.log('No auth section found in index.html!');
  process.exit(1);
}

const authSection = indexHtml.slice(authStartIndex, lobbyStartIndex).trim();

function injectAuth(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace('<body class="dark-theme">', '<body class="dark-theme">\n' + authSection + '\n');
  fs.writeFileSync(file, content);
  console.log('Injected auth to ' + file);
}

injectAuth('admin.html');
injectAuth('superadmin.html');
injectAuth('crm.html');
injectAuth('network.html');

console.log('Done!');
