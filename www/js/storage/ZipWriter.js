export class ZipWriter {
  static async crc(blob) {
    let c = 0xFFFFFFFF; const CH = 4 * 1024 * 1024;
    for (let o = 0; o < blob.size; o += CH) { const u = new Uint8Array(await blob.slice(o, o + CH).arrayBuffer()); for (let i = 0; i < u.length; i++) c = ZipWriter.table[(c ^ u[i]) & 255] ^ (c >>> 8); }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  static async build(entries, onProg) {
    const enc = new TextEncoder(), parts = [], cd = []; let off = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i], nameB = enc.encode(e.name), size = e.blob.size;
      if (size > 0xFFFFFFF0 || off > 0xFFFFFFF0) throw new Error('This backup is over 4 GB — too large for one file. Remove some media and try again.');
      const crc = await ZipWriter.crc(e.blob);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, nameB.length, true);
      parts.push(lh.buffer, nameB, e.blob);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, nameB.length, true); ch.setUint32(42, off, true);
      cd.push(ch.buffer, nameB);
      off += 30 + nameB.length + size;
      onProg?.(i + 1, entries.length);
    }
    const cdSize = cd.reduce((n, b) => n + b.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cd, end.buffer], { type: 'application/zip' });
  }
}

ZipWriter.table = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
