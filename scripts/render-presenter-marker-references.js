import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRESENTER_MARKER_CATALOG } from '../chat/presenter-marker-geometry.js';
import {
  PRESENTER_MARKER_REFERENCE_SEEDS,
  PRESENTER_MARKER_REFERENCE_TARGETS,
  renderPresenterMarkerContactSheet,
  renderPresenterMarkerReferenceSheet,
} from '../demo/presenter-marker-reference.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(repositoryRoot, 'artifacts', 'presenter-markers');

await mkdir(outputDirectory, { recursive: true });

const files = [];

async function emit(name, contents, dimensions, kind) {
  let destination = path.join(outputDirectory, name);
  let normalizedContents = contents.replace(/[ \t]+$/gm, '');
  await writeFile(destination, normalizedContents, 'utf8');
  files.push({
    name,
    path: path.relative(repositoryRoot, destination),
    kind,
    dimensions,
  });
}

await emit(
  'contact-sheet.svg',
  renderPresenterMarkerContactSheet(),
  { width: 1600, height: 1120 },
  'contact-sheet',
);

for (let marker of PRESENTER_MARKER_CATALOG) {
  await emit(
    `gesture-${marker.name}.svg`,
    renderPresenterMarkerReferenceSheet(marker.name),
    { width: 1920, height: 700 },
    'per-gesture-reference-sheet',
  );
}

let manifest = {
  version: 'symbiote-presenter-marker-references-v1',
  generatedBy: 'npm run references:presenter-markers',
  productionGeometryModule: 'chat/presenter-marker-geometry.js',
  targets: PRESENTER_MARKER_REFERENCE_TARGETS.map(({ id, label, rect }) => ({ id, label, rect })),
  seeds: [...PRESENTER_MARKER_REFERENCE_SEEDS],
  files,
};

await writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

process.stdout.write(`${JSON.stringify({ outputDirectory, files: files.length + 1 }, null, 2)}\n`);
