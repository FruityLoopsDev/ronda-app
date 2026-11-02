const fs = require('fs');

const checks = [
  { file: 'src/icebreakers.ts', modal: 'modal-icebreakers' },
  { file: 'src/satisfaction.ts', modal: 'modal-satisfaction' },
  { file: 'src/views/profile-modal.ts', modal: 'modal-profile' },
  { file: 'src/dialog.ts', modal: 'modal-ronda-dialog' },
  { file: 'src/views/auth-view.ts', modal: 'modal-pin-access' },
  { file: 'src/client.ts', modal: 'modal-manage-reservations' },
  { file: 'src/profile.ts', modal: 'modal-settings' },
  { file: 'src/profile.ts', modal: 'modal-edit-profile' },
  { file: 'src/client.ts', modal: 'modal-event-detail' },
  { file: 'src/client.ts', modal: 'modal-temporal-chat' },
  { file: 'src/profile.ts', modal: 'modal-select-cocktail' },
  { file: 'src/profile.ts', modal: 'modal-select-zone' },
  { file: 'src/profile.ts', modal: 'modal-full-qr' },
  { file: 'src/profile.ts', modal: 'modal-ronda-services' },
  { file: 'src/profile.ts', modal: 'modal-delete-account' },
  { file: 'invest.html', modal: 'invest-modals' }
];

for (const { file, modal } of checks) {
  if (!fs.existsSync(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  console.log(`\n=== ${file} (${modal}) ===`);
  
  // Search for lines mentioning the modal or close
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes(modal) || (l.includes('close') && (l.includes('btn') || l.includes('Modal') || l.includes('addEventListener')))) {
      console.log(`  L${idx+1}: ${l.trim().substring(0, 100)}`);
    }
  });
}
