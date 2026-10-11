import test from 'node:test';
import assert from 'node:assert/strict';
import {LIGHTCRAFT_RECIPE_CONTROLS,validateLightCraftRecipe} from '../src/lightcraft-recipe.js';

const recipe = (overrides={}) => ({format:'creative-workspace.lightcraft-recipe',version:1,engine:'lightcraft',engineVersion:'0.6.0',sourcePath:'camera/IMG_0001.dng',originalSha256:'a'.repeat(64),controls:{'light.exposure':0.75,'color.saturation':-2},...overrides});

test('LightCraft recipe accepts only the pinned, relative and numeric editable state',()=>{
  const validated=validateLightCraftRecipe(recipe());
  assert.deepEqual(validated.controls,{'light.exposure':0.75,'color.saturation':-2});
  assert.equal(LIGHTCRAFT_RECIPE_CONTROLS.length,12);
  assert.notEqual(validated.controls,recipe().controls);
});

test('LightCraft recipe rejects unsafe paths, changed engine pins, hashes and unsupported controls',()=>{
  for(const sourcePath of ['/etc/passwd','../outside.dng','camera/../outside.dng','camera\\outside.dng']) assert.throws(()=>validateLightCraftRecipe(recipe({sourcePath})));
  assert.throws(()=>validateLightCraftRecipe(recipe({engineVersion:'0.7.0'})),/different LightCraft engine/);
  assert.throws(()=>validateLightCraftRecipe(recipe({originalSha256:'A'.repeat(64)})),/SHA-256/);
  assert.throws(()=>validateLightCraftRecipe(recipe({controls:{'files.open':1}})),/Unsupported/);
  assert.throws(()=>validateLightCraftRecipe(recipe({controls:{'light.exposure':Infinity}})),/numeric value/);
  assert.throws(()=>validateLightCraftRecipe(recipe({controls:{'light.exposure':101}})),/numeric value/);
});
