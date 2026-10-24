// Isolated reviewed ACK patch on original create-preset controls.
(globalThis as any).rapidRawPresetCreation=true;
await import('./preset-apply-main');
export {};
