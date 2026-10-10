// AGPL-3.0-only; derived from vedranius/rapidraw-web at 38ddc8af1bc51552fcab8781c4838b17082f97bd.
// Shared browser filesystem agent; only the user-selected directory handle is accessible.
const errText = error => error?.message || String(error);
const emitLocal = event => window.dispatchEvent(new CustomEvent('cw-files-changed',{detail:event}));
async function call(method,params){if(method!=='__rr_share_have')throw new Error('Unsupported provider operation');const response=await fetch('/api/storage/shares/'+params.id+'/have');if(!response.ok)throw new Error('Folder share unavailable');return response.json();}
const segments = (rel        ) => {
  if (!rel) return [];
  const parts = rel.split('/');
  if (parts.some((p) => !p || p === '.' || p === '..')) throw new DOMException(`bad path ${rel}`, 'TypeMismatchError');
  return parts;
};
const errno = (e         ) => {
  const n = (e                )?.name;
  return n === 'NotFoundError' ? 'ENOENT' : n === 'TypeMismatchError' ? 'ENOTDIR' : n === 'InvalidModificationError' ? 'ENOTEMPTY'
    : n === 'NotAllowedError' || n === 'SecurityError' ? 'EACCES' : 'EIO';
};
function frame(q        , head        , data                          ) {
  const h = new TextEncoder().encode(JSON.stringify(head));
  const out = new Uint8Array(8 + h.length + (data?.length ?? 0));
  const v = new DataView(out.buffer);
  v.setUint32(0, q, true);
  v.setUint32(4, h.length, true);
  out.set(h, 8);
  if (data) out.set(data, 8 + h.length);
  return out;
}

export class LocalFolderAgent {
  ws            ;
  stopped = false;
  files = new Map                                    ();
  writers = new Map                                      ();
  progress           ;
  // onGone: the server doesn't know this folder (the relay restarted) → register it again
  constructor(share           , root     , onChange            , onGone             ) { this.share=share; this.root=root; this.onChange=onChange; this.onGone=onGone; }

  connect() {
    if (this.stopped) return;
    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/storage/agent?id=${this.share.id}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => { this.share.online = true; this.onChange(); };
    ws.onmessage = (m) => this.handle(m.data               );
    ws.onclose = (ev) => {
      this.share.online = false;
      this.onChange();
      if (this.stopped) return;
      if (ev.code === 4004 && this.onGone) { this.stopped = true; this.onGone(); return; }
      setTimeout(() => this.connect(), 2000);
    };
    this.ws = ws;
  }

  stop() { this.stopped = true; this.ws?.close(); }

  async dir(rel        , create = false) {
    let d      = this.root;
    for (const s of segments(rel)) d = await d.getDirectoryHandle(s, { create })       ;
    return d;
  }

  async file(rel        ) {
    const c = this.files.get(rel);
    if (c && Date.now() - c.at < 2000) return c.file;
    const parts = segments(rel);
    const fh = await (await this.dir(parts.slice(0, -1).join('/'))).getFileHandle(parts.at(-1) );
    const file = await fh.getFile();
    this.files.set(rel, { file, at: Date.now() });
    return file;
  }

  // Fuji RAF: where the embedded JPEG is (header: its offset and length at 84 and 88, big-endian)
  async rafPreview(rel        ) {
    const f = await this.file(rel);
    const head = new DataView(await f.slice(0, 92).arrayBuffer());
    const magic = head.byteLength >= 92 ? new TextDecoder().decode(new Uint8Array(head.buffer, 0, 15)) : '';
    const off = magic ? head.getUint32(84) : 0;
    const len = magic ? head.getUint32(88) : 0;
    if (magic !== 'FUJIFILMCCD-RAW' || !len || off + len > f.size) throw new DOMException('no embedded preview', 'TypeMismatchError');
    return { f, off, len };
  }

  async op(h                     , data                         )                                              { // eslint-disable-line @typescript-eslint/no-explicit-any
    const parent = (rel        ) => rel.split('/').slice(0, -1).join('/');
    const name = (rel        ) => rel.split('/').at(-1) ;
    switch (h.op) {
      case 'list': {
        const entries = [];
        const files                                   = [];
        for await (const [n, handle] of (await this.dir(h.path)).entries()) {
          if (n.startsWith('.')) continue;
          if (handle.kind === 'directory') entries.push({ name: n, kind: 'dir' });
          else files.push([n, handle                        ]);
        }
        // getFile() one by one is slow on big folders (1330 files ~1 s): 64 in parallel
        for (let i = 0; i < files.length; i += 64) {
          await Promise.all(files.slice(i, i + 64).map(async ([n, handle]) => {
            const f = await handle.getFile().catch(() => null); // deleted meanwhile
            if (f) entries.push({ name: n, kind: 'file', size: f.size, mtime: f.lastModified });
          }));
        }
        return [{ entries }];
      }
      case 'read': {
        try {
          const f = await this.file(h.path);
          return [{}, new Uint8Array(await f.slice(h.off, h.off + h.len).arrayBuffer())];
        } catch { // the cached File is stale (the file changed meanwhile): get a fresh one and try once more
          this.files.delete(h.path);
          const f = await this.file(h.path);
          return [{}, new Uint8Array(await f.slice(h.off, h.off + h.len).arrayBuffer())];
        }
      }
      case 'write': { // pieces of the same file share one writable (otherwise Chrome copies the whole file for each piece)
        let w = this.writers.get(h.path);
        if (!w || h.trunc) {
          await w?.close().catch(() => {});
          const fh = await (await this.dir(parent(h.path), true)).getFileHandle(name(h.path), { create: true });
          w = await fh.createWritable({ keepExistingData: !h.trunc });
          this.writers.set(h.path, w);
        }
        await w.write({ type: 'write', position: h.off, data });
        if (h.done) { await w.close(); this.writers.delete(h.path); }
        this.files.delete(h.path);
        return [{}];
      }
      case 'rafexif': { // Fuji RAF: only the EXIF header of the embedded JPEG (SOI … APP1 Exif, EOI) for RapidRAW (rrweb/relay/exif.mjs)
        const { f, off, len } = await this.rafPreview(h.path);
        const j = new Uint8Array(await f.slice(off, off + Math.min(len, 1 << 18)).arrayBuffer());
        const v = new DataView(j.buffer);
        for (let i = 2; i + 10 <= j.length && j[i] === 0xff;) {
          const seg = 2 + v.getUint16(i + 2);
          if (j[i + 1] === 0xe1 && new TextDecoder().decode(j.subarray(i + 4, i + 8)) === 'Exif') {
            const out = new Uint8Array(i + seg + 2);
            out.set(j.subarray(0, i + seg));
            out.set([0xff, 0xd9], i + seg);
            return [{}, out];
          }
          i += seg;
        }
        throw new DOMException('no EXIF in the embedded preview', 'TypeMismatchError');
      }
      case 'mkdir': await this.dir(h.path, true); return [{}];
      case 'remove': await (await this.dir(parent(h.path))).removeEntry(name(h.path), { recursive: !!h.recursive }); return [{}];
      case 'rename': {
        const src = await (await this.dir(parent(h.from))).getFileHandle(name(h.from));
        const destDir = await this.dir(parent(h.to), true);
        if ('move' in src) await (src                                                         ).move(destDir, name(h.to));
        else { // older Chromium: copy + delete
          const w = await (await destDir.getFileHandle(name(h.to), { create: true })).createWritable();
          await w.write(await src.getFile());
          await w.close();
          await (await this.dir(parent(h.from))).removeEntry(name(h.from));
        }
        this.files.delete(h.from);
        return [{}];
      }
      default: throw new Error(`unknown op ${h.op}`);
    }
  }

  async handle(buf             ) {
    const v = new DataView(buf);
    const q = v.getUint32(0, true);
    const hlen = v.getUint32(4, true);
    const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hlen)));
    const data = new Uint8Array(buf, 8 + hlen);
    let reply                         ;
    try {
      const [res, payload] = await this.op(head, data);
      reply = frame(q, res, payload);
    } catch (e) {
      reply = frame(q, { err: errno(e), message: errText(e) });
    }
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(reply);
  }

  // transfer: the whole folder (with subfolders) to the server; what is already there is skipped, so it can resume
  async transfer() {
    const have = await call                                                 ('__rr_share_have', { id: this.share.id });
    const list                                = [];
    const walk = async (d     , rel        ) => {
      for await (const [n, h] of d.entries()) {
        if (n.startsWith('.')) continue;
        const r = rel ? `${rel}/${n}` : n;
        if (h.kind === 'directory') await walk(h, r);
        else list.push({ rel: r, file: await h.getFile() });
      }
    };
    await walk(this.root, '');
    list.sort((a, b) => a.rel.localeCompare(b.rel, undefined, { numeric: true }));
    const p           = this.progress = { done: 0, total: list.length, bytes: 0, totalBytes: list.reduce((s, f) => s + f.file.size, 0), started: Date.now() };
    let sinceRefresh = 0;
    for (const { rel, file } of list) {
      if (this.stopped) return;
      const h = have[rel];
      if (!h || h.size !== file.size || Math.abs(h.mtime - file.lastModified) > 2000) {
        p.current = rel;
        this.onChange();
        await this.put(rel, file, (sent) => { p.current = rel; this.onChange(); void sent; });
        sinceRefresh++;
      }
      p.done++;
      p.bytes += file.size;
      this.onChange();
      if (sinceRefresh >= 10) { sinceRefresh = 0; emitLocal('indexing-finished'); } // RapidRAW sees the new photos
    }
    p.finished = true;
    p.current = undefined;
    emitLocal('indexing-finished');
    this.onChange();
  }

  put(rel        , file      , progress                        ) {
    return new Promise      ((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('PUT', `/api/storage/put?id=${this.share.id}&path=${encodeURIComponent(rel)}&mtime=${file.lastModified}`);
      x.setRequestHeader('Content-Type','application/octet-stream');
      x.upload.onprogress = (e) => progress(e.loaded);
      x.onload = () => (x.status < 300 ? resolve() : reject(new Error(`${rel}: ${x.responseText || x.status}`)));
      x.onerror = () => reject(new Error(`${rel}: connection failed`));
      x.send(file);
    });
  }
}
