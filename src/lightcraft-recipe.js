import {importSegments} from './transfers.js';

export const LIGHTCRAFT_RECIPE_FORMAT = 'creative-workspace.lightcraft-recipe';
export const LIGHTCRAFT_ENGINE_VERSION = '0.6.0';
export const LIGHTCRAFT_RECIPE_CONTROLS = Object.freeze([
  'light.exposure','light.contrast','light.highlights','light.shadows','light.whites','light.blacks',
  'color.vibrance','color.saturation','effects.texture','effects.clarity','effects.dehaze','detail.sharpenAmount',
]);

const fail = message => Object.assign(new Error(message), {code:'INVALID_LIGHTCRAFT_RECIPE'});

/** Validate and return a detached, canonical editable recipe. Never resolve a source path here. */
export function validateLightCraftRecipe(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw fail('Recipe must be an object');
  if (value.format !== LIGHTCRAFT_RECIPE_FORMAT || value.version !== 1) throw fail('Unsupported LightCraft recipe format');
  if (value.engine !== 'lightcraft' || value.engineVersion !== LIGHTCRAFT_ENGINE_VERSION) throw fail('Recipe requires a different LightCraft engine version');
  if (typeof value.sourcePath !== 'string' || value.sourcePath.length > 4096) throw fail('Recipe source path is invalid');
  try { importSegments(value.sourcePath); } catch { throw fail('Recipe source path must be relative and confined to the selected source folder'); }
  if (typeof value.originalSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.originalSha256)) throw fail('Recipe originalSha256 must be a lowercase SHA-256 digest');
  if (!value.controls || typeof value.controls !== 'object' || Array.isArray(value.controls)) throw fail('Recipe controls must be an object');
  const allowed = new Set(LIGHTCRAFT_RECIPE_CONTROLS);
  const controls = {};
  for (const [name, amount] of Object.entries(value.controls)) {
    if (!allowed.has(name)) throw fail(`Unsupported LightCraft recipe control: ${name}`);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount) > 100) throw fail(`Invalid numeric value for ${name}`);
    controls[name] = amount;
  }
  return {format:LIGHTCRAFT_RECIPE_FORMAT,version:1,engine:'lightcraft',engineVersion:LIGHTCRAFT_ENGINE_VERSION,sourcePath:value.sourcePath,originalSha256:value.originalSha256,controls};
}
