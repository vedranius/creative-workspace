// Original existing-tool configuration with the reviewed write/readback ACK patches.
(globalThis as any).rapidRawPresetCreation=true;
(globalThis as any).rapidRawPresetRename=true;
await import('./preset-apply-main');
export {};
