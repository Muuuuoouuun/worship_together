import { copyFileSync, cpSync } from 'node:fs';
// Keep the PDF parser and worker on exactly the same installed version and build.
// Both use the legacy build so PDF import works on browsers older than Chrome 145 / Safari 26.2.
copyFileSync(new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), new URL('../public/pdf.worker.min.mjs', import.meta.url));
// Data PDF.js fetches on demand, served from /pdfjs/: CMaps for CJK text (Korean titles and lyrics),
// the standard PDF fonts, WASM decoders for JBIG2 / JPEG 2000 images common in scanned sheets, and ICC profiles.
for (const dir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
    cpSync(new URL(`../node_modules/pdfjs-dist/${dir}/`, import.meta.url), new URL(`../public/pdfjs/${dir}/`, import.meta.url), { recursive: true });
}
