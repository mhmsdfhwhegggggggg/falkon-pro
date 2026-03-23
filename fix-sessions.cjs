const fs = require('fs');
const files = [
  'server/worker.ts',
  'server/routers/bulk-ops.router.ts',
  'server/routers/extraction.router.ts',
  'server/services/channel-management.service.ts',
  'server/services/extract-add-pipeline.service.ts',
  'server/services/startup.service.ts'
];
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  content = content.replace(/account\.sessionString,/g, '(account.sessionString || ""),');
  content = content.replace(/account\.sessionString\n/g, '(account.sessionString || "")\n');
  content = content.replace(/decryptString\(account\.sessionString\)/g, 'decryptString(account.sessionString || "")');
  fs.writeFileSync(f, content);
});
console.log('Fixed session strings');
