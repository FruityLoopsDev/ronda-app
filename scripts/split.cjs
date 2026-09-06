const fs = require('fs');
const lines = fs.readFileSync('index.html', 'utf8').split('\n');

const adminSection = lines.slice(2334, 2706).join('\n');
const networkSection = lines.slice(2706, 2720).join('\n');
const crmSection = lines.slice(2720, 2769).join('\n');
const superadminSection = lines.slice(2769).join('\n');

// Extraer el head y los scripts base de index.html
const headEndIndex = lines.findIndex(line => line.includes('</head>'));
const headSection = lines.slice(0, headEndIndex + 1).join('\n');

const baseHtml = (content, scriptName) => `${headSection}
<body class="dark-theme">
${content}
  <script type="module" src="${scriptName}"></script>
</body>
</html>`;

fs.writeFileSync('admin.html', baseHtml(adminSection, '/src/entry-admin.ts'));
fs.writeFileSync('network.html', baseHtml(networkSection, '/src/entry-network.ts'));
fs.writeFileSync('crm.html', baseHtml(crmSection, '/src/entry-crm.ts'));

const cleanSuperadmin = superadminSection.replace('</body>', '').replace('</html>', '').trim();
fs.writeFileSync('superadmin.html', baseHtml(cleanSuperadmin, '/src/entry-superadmin.ts'));

console.log('HTML files created.');
