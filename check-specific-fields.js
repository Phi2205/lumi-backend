const fs = require('fs');
const content = fs.readFileSync('node_modules/.prisma/client/index.d.ts', 'utf8');
const match = content.match(/export type conversationsOrderByWithRelationInput = {([\s\S]*?)}/);
if (match) {
  const text = match[1];
  console.log('updated_at exists:', text.includes('updated_at'));
  console.log('created_at exists:', text.includes('created_at'));
}
