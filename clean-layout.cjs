const fs = require('fs');
const pages = [
  'C:\\Conexus\\src\\app\\(company)\\projects\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\new\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\documentation\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\eligibility\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\export\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\gaps\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\knowledge-base\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\readiness\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\review\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\upload\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\projects\\[id]\\validation\\page.tsx',
  'C:\\Conexus\\src\\app\\(company)\\settings\\page.tsx'
];

for (const page of pages) {
  let content = fs.readFileSync(page, 'utf8');
  content = content.replace(/import\s*{\s*AppLayout\s*}\s*from\s*['"]@\/components\/layout\/app-layout['"];?\r?\n?/g, '');
  content = content.replace(/<AppLayout>\s*/g, '<>\n');
  content = content.replace(/<\/AppLayout>\s*/g, '</>\n');
  fs.writeFileSync(page, content);
}
console.log('done');
