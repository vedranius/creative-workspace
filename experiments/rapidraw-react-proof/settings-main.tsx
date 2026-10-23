// Settings-only host addition to the existing original React export QA composition.
import {createBrowserSettings,createSettingsDatabase} from '/engine/settings-storage.js';
const backend=createSettingsDatabase();
(globalThis as any).rapidRawSettingsHost=createBrowserSettings({backend:(globalThis as any).settingsQa?.wrapBackend?.(backend)??backend});
await import('./export-main');
