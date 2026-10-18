// Exact pinned useImageProcessing.ts reader excerpts; proof only (AGPL-3.0).
export function readInteractive(buffer) {
            const view = new DataView(buffer);
            const patchX = view.getUint32(0, true);
            const patchY = view.getUint32(4, true);
            const patchW = view.getUint32(8, true);
            const patchH = view.getUint32(12, true);
            const fullW = view.getUint32(16, true);
            const fullH = view.getUint32(20, true);

            const imageBuffer = buffer.slice(24);
            const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
  return {blob,url,rect:[patchX,patchY,patchW,patchH,fullW,fullH]};
}
export function readFinal(buffer) {
            const blob = new Blob([buffer], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
  return {blob,url};
}
