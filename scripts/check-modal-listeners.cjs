const fs = require('fs');

const modalIds = [
  'modal-icebreakers',
  'modal-satisfaction',
  'modal-profile',
  'modal-ronda-dialog',
  'modal-pin-access',
  'modal-manage-reservations',
  'modal-settings',
  'modal-edit-profile',
  'modal-event-detail',
  'modal-temporal-chat',
  'modal-select-cocktail',
  'modal-select-zone',
  'modal-full-qr',
  'modal-ronda-services',
  'modal-legal-terminos',
  'modal-legal-privacidad',
  'modal-delete-account'
];

const tsFiles = ['src/client.ts', 'src/app.ts', 'src/profile.ts', 'src/dialog.ts', 'src/views/profile-modal.ts', 'src/views/auth-view.ts', 'src/icebreakers.ts', 'src/satisfaction.ts', 'src/footer.ts'];

console.log('=== SEARCHING LISTENER WIRING FOR MODALS ===\n');

for (const modalId of modalIds) {
  console.log(`\nChecking ${modalId}:`);
  let foundIn = [];
  for (const f of tsFiles) {
    if (!fs.existsSync(f)) continue;
    const txt = fs.readFileSync(f, 'utf8');
    if (txt.includes(modalId)) {
      foundIn.push(f);
    }
  }
  console.log(`  Referenced in: ${foundIn.length ? foundIn.join(', ') : 'NONE! (Or only in index.html)'}`);
}
