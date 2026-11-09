import path from 'node:path';
import { CATALOG_SCHEMA, SOURCES_SCHEMA, TAXONOMY_SCHEMA, REVIEW_PATCH_SCHEMA } from '../src/core.js';
import { PROJECT_ROOT, writeJson, isMain, reportFailure } from './lib.mjs';
export async function writeSchemas(root = PROJECT_ROOT) {
  const schemas = { catalog: CATALOG_SCHEMA, sources: SOURCES_SCHEMA, taxonomy: TAXONOMY_SCHEMA, 'review-patch': REVIEW_PATCH_SCHEMA };
  for (const [name, schema] of Object.entries(schemas)) await writeJson(path.join(root, 'schemas', `${name}.schema.json`), schema);
  return Object.keys(schemas);
}
if (isMain(import.meta.url)) writeSchemas().then(names => console.log(`Wrote schemas: ${names.join(', ')}`)).catch(reportFailure);
