const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');

// Match all elements with class="...modal-overlay..."
const overlayMatches = [...html.matchAll(/<div[^>]*class=["'][^"']*modal-overlay[^"']*["'][^>]*>/g)];

console.log(`Found ${overlayMatches.length} modal-overlay containers in index.html:\n`);

for (const match of overlayMatches) {
  const tag = match[0];
  const idMatch = tag.match(/id=["']([^"']+)["']/);
  const id = idMatch ? idMatch[1] : 'UNKNOWN_ID';
  
  // Find where this container starts in HTML
  const startIdx = match.index;
  // Look at the next 2000 characters to find close buttons
  const slice = html.substring(startIdx, Math.min(html.length, startIdx + 2500));
  
  // Search for close buttons
  const closeBtns = [...slice.matchAll(/id=["'](btn-[^"']*(?:close|cancel)[^"']*)["']|class=["']([^"']*modal-icon-btn[^"']*)["']/g)].map(m => m[1] || m[2]);
  
  console.log(`- Modal ID: #${id}`);
  console.log(`  Initial display style: ${tag.includes('display:none') ? 'display:none' : (tag.includes('display:') ? tag.match(/display:[^;"]+/)[0] : 'css default')}`);
  console.log(`  Close elements found:`, closeBtns.slice(0, 5));
}
