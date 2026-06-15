// GROUNDCHECK build — concatenates src/ modules into a single runnable HTML file.
// Usage:  node build.mjs v39        ->  dist/GROUNDCHECK_429SQN_v39.html
//         node build.mjs            ->  defaults to v38 (used to prove parity with the original)
//
// Deliberately dumb: plain text concatenation, no bundler, no transforms. The JS modules
// are already global-scope; gluing them in filename order reproduces the original <script>.
// CRLF line endings and the no-trailing-newline convention are preserved byte-for-byte.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const version = (process.argv[2] || 'v38').replace(/^v?/, 'v');   // tolerate "39" or "v39"
const SRC = 'src';
const JS_DIR = join(SRC, 'js');
const EOL = '\r\n';

const read = (p) => readFileSync(p, 'utf8');

// Modules load in filename order — the NN- numeric prefixes encode that order explicitly.
// 99-* (none yet) would always come last; init/listeners must stay in the highest-numbered file.
const jsFiles = readdirSync(JS_DIR).filter((f) => f.endsWith('.js')).sort();
const jsBody = jsFiles.map((f) => read(join(JS_DIR, f))).join(EOL);

const css   = read(join(SRC, 'styles.css'));
const crest = read(join(SRC, 'assets', 'crest.webp.b64'));
const shell = read(join(SRC, 'shell.html'));

// Function replacers so $-sequences in the payloads aren't treated as replacement patterns.
const out = shell
  .replace('__STYLES__',    () => css)
  .replace('__SCRIPT__',    () => jsBody)
  .replace('__CREST_B64__', () => crest)
  .replace('__VERSION__',   () => version);

if (out.includes('__STYLES__') || out.includes('__SCRIPT__') ||
    out.includes('__CREST_B64__') || out.includes('__VERSION__')) {
  console.error('ERROR: a marker was not substituted — check src/shell.html');
  process.exit(1);
}

mkdirSync('dist', { recursive: true });
const outPath = join('dist', `GROUNDCHECK_429SQN_${version}.html`);
writeFileSync(outPath, out);   // utf8, no trailing newline added
console.log(`Built ${outPath}  (${jsFiles.length} JS modules, ${out.length} bytes)`);
