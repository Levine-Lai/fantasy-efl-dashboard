import { mkdir, copyFile } from 'node:fs/promises';

// Publish only the static page and its assets, excluding collection tools and raw exports.
const source = new URL('../league-standings/', import.meta.url);
const destination = new URL('../pages-dist/grand-prix-standing/', import.meta.url);
const files = ['index.html', 'app.js', 'data.js', 'rules.js', 'fastest.js', 'poster.js',
  'f1.css', 'tokens.css', 'fonts/Formula1-Bold.woff2', 'fonts/Formula1-Regular.woff2'];
await mkdir(new URL('fonts/', destination), { recursive: true });
for (const file of files) await copyFile(new URL(file, source), new URL(file, destination));
console.log('Grand Prix page packaged at /grand-prix-standing/');
