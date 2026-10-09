/* ZIP reader for .cbz / .zip / .nexusbackup files. */

export class ZipEntry {
  constructor(file, meta) {
    this.file = file;
    this.name = meta.name;
    this.method = meta.method;
    this.compSize = meta.compSize;
    this.size = meta.size;
    this.localOffset = meta.localOffset;
    this.isDirectory = meta.name.endsWith('/');
    this.encrypted = !!(meta.flags & 1);
  }

  get supported() {
    return !this.encrypted && (this.method === 0 || this.method === 8);
  }

  /** Extract this entry into a Blob (optionally tagged with a MIME type). */
  async read(type = '') {
    const head = new DataView(await this.file.slice(this.localOffset, this.localOffset + 30).arrayBuffer());
    if (head.byteLength < 30 || head.getUint32(0, true) !== 0x04034b50) {
      throw new Error('Corrupt ZIP entry: ' + this.name);
    }
    const start = this.localOffset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
    const raw = this.file.slice(start, start + this.compSize);
    if (this.method === 0) return new Blob([raw], { type });
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress ZIP files (DecompressionStream is missing).');
    }
    const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const out = await new Response(stream).blob();
    return out.slice(0, out.size, type);
  }
}

export class ZipArchive {
  /** Open a File/Blob and parse its central directory. */
  static async open(file) {
    const size = file.size;
    if (size < 22) throw new Error('Not a valid ZIP archive.');

    // 1. Locate the "end of central directory" record in the last 64 KB.
    const tailLen = Math.min(size, 22 + 65535);
    const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('Not a valid ZIP archive (end record not found).');

    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOffset = tail.getUint32(eocd + 16, true);

    // 2. ZIP64: real values live in the ZIP64 end record.
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc < 0 || tail.getUint32(loc, true) !== 0x07064b50) throw new Error('Unsupported ZIP64 archive.');
      const z64Offset = Number(tail.getBigUint64(loc + 8, true));
      const z64 = new DataView(await file.slice(z64Offset, z64Offset + 56).arrayBuffer());
      if (z64.byteLength < 56 || z64.getUint32(0, true) !== 0x06064b50) throw new Error('Corrupt ZIP64 archive.');
      count = Number(z64.getBigUint64(32, true));
      cdSize = Number(z64.getBigUint64(40, true));
      cdOffset = Number(z64.getBigUint64(48, true));
    }

    // 3. Parse the central directory.
    const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const decoder = new TextDecoder('utf-8');
    const entries = [];
    let p = 0;
    for (let n = 0; n < count && p + 46 <= cd.byteLength; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) break;
      const flags = cd.getUint16(p + 8, true);
      const method = cd.getUint16(p + 10, true);
      let compSize = cd.getUint32(p + 20, true);
      let usize = cd.getUint32(p + 24, true);
      const nameLen = cd.getUint16(p + 28, true);
      const extraLen = cd.getUint16(p + 30, true);
      const commentLen = cd.getUint16(p + 32, true);
      let localOffset = cd.getUint32(p + 42, true);
      const name = decoder.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));

      if (usize === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
        let q = p + 46 + nameLen;
        const end = q + extraLen;
        while (q + 4 <= end) {
          const id = cd.getUint16(q, true);
          const len = cd.getUint16(q + 2, true);
          if (id === 0x0001) {
            let r = q + 4;
            if (usize === 0xffffffff) { usize = Number(cd.getBigUint64(r, true)); r += 8; }
            if (compSize === 0xffffffff) { compSize = Number(cd.getBigUint64(r, true)); r += 8; }
            if (localOffset === 0xffffffff) { localOffset = Number(cd.getBigUint64(r, true)); r += 8; }
            break;
          }
          q += 4 + len;
        }
      }
      entries.push(new ZipEntry(file, { name, flags, method, compSize, size: usize, localOffset }));
      p += 46 + nameLen + extraLen + commentLen;
    }
    return new ZipArchive(entries);
  }

  constructor(entries) { this.entries = entries; }
}
