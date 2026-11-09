import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outputDir = path.resolve('.output/chrome-mv3');
const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
const fail = (message) => { console.error(`Manifest audit failed: ${message}`); process.exit(1); };

if (manifest.manifest_version !== 3) fail('Manifest V3 is required.');
if (JSON.stringify(manifest.permissions) !== JSON.stringify(['storage'])) fail(`Expected exactly ["storage"], got ${JSON.stringify(manifest.permissions)}.`);
if (manifest.host_permissions?.length) fail('Unexpected host_permissions; YouTube access must stay scoped to the content script match.');
if (manifest.optional_permissions?.length) fail('Unexpected optional permissions.');
if (!manifest.content_scripts?.length) fail('No content scripts were emitted.');
if (manifest.options_ui?.open_in_tab !== true) fail('The Options page must open in its own tab.');
for (const asset of Object.values(manifest.icons ?? {})) await access(path.join(outputDir, asset));
for (const asset of Object.values(manifest.action?.default_icon ?? {})) await access(path.join(outputDir, asset));

for (const script of manifest.content_scripts) {
  if (JSON.stringify(script.matches) !== JSON.stringify(['https://www.youtube.com/*'])) fail(`Unexpected content-script match: ${JSON.stringify(script.matches)}.`);
  for (const asset of [...(script.js ?? []), ...(script.css ?? [])]) {
    if (asset.includes('://') || asset.startsWith('//')) fail(`Remote content-script asset: ${asset}`);
    await access(path.join(outputDir, asset));
  }
}

for (const resourceSet of manifest.web_accessible_resources ?? []) {
  if (JSON.stringify(resourceSet.matches) !== JSON.stringify(['https://www.youtube.com/*'])) fail('Web-accessible resources must be restricted to YouTube pages.');
  for (const asset of resourceSet.resources ?? []) {
    if (asset.includes('://') || asset.startsWith('//')) fail(`Remote web-accessible resource: ${asset}`);
    await access(path.join(outputDir, asset));
  }
}

for (const htmlFile of ['popup.html', 'options.html']) {
  const html = await readFile(path.join(outputDir, htmlFile), 'utf8');
  if (/<script\b[^>]*\bsrc=["']https?:/i.test(html)) fail(`Remote script URL found in ${htmlFile}.`);
}

console.log('Manifest audit passed: MV3, one storage permission, YouTube-only matches, and local bundled assets.');
