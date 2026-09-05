import { copyFileSync } from 'node:fs';
// Keep the PDF parser and worker on exactly the same installed version.
copyFileSync(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), new URL('../public/pdf.worker.min.mjs', import.meta.url));
