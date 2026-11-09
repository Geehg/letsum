import { validateCatalog } from '../src/core.js';
import { loadData, isMain, reportFailure } from './lib.mjs';
export async function validateData() {
  const { catalog, sources, taxonomy } = await loadData();
  return validateCatalog(catalog, sources, taxonomy);
}
if (isMain(import.meta.url)) validateData().then(result => {
  for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
  for (const error of result.errors) console.error(`ERROR: ${error}`);
  console.log(`Validation: ${result.errors.length} errors, ${result.warnings.length} warnings`);
  if (result.errors.length) process.exitCode = 1;
}).catch(reportFailure);
