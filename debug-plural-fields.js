const fs = require('fs');
const content = fs.readFileSync('node_modules/.prisma/client/index.d.ts', 'utf8');
const match = content.match(/export type conversationsOrderByWithRelationInput = {([\s\S]*?)}/);
if (match) {
  const fields = match[1].split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  fields.forEach(f => console.log(f));
} else {
  console.log('Not found');
}
