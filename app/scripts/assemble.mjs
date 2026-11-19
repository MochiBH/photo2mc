// Wraps the Vite output as an artifact page: CSS inline, app.js and data/*.js alongside.
import { readFileSync, writeFileSync } from 'node:fs';
const css = readFileSync(new URL('../dist/app.css', import.meta.url), 'utf8');
const page = `<title>Jungle Coach</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="data/bank.js"></script>
<script src="data/leaks.js"></script>
<script src="data/lessons.js"></script>
<script src="data/positional.js"></script>
<script src="data/builds.js"></script>
<script src="app.js"></script>
`;
writeFileSync(new URL('../dist/index.html', import.meta.url), page);
console.log('dist/index.html', (page.length / 1024).toFixed(0) + ' KB');
