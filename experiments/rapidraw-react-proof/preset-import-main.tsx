// Optional development library host for the unpatched original import callback.
import {createPresetLibrary,createPresetLibraryDatabase} from '/engine/preset-library.js';
const qa=(globalThis as any).presetQa,backend=createPresetLibraryDatabase();
(globalThis as any).rapidRawPresetLibrary=createPresetLibrary({backend:qa?.wrapLibrary?.(backend)??backend,pickFiles:o=>qa?.pickInputs?.(o)??globalThis.showOpenFilePicker(o)});
await import('./presets-main');
