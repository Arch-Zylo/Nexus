export class Id3 {
  static id3Text(u8, enc) {
    try {
      let d;
      if (enc === 1) d = (u8[0] === 0xFE && u8[1] === 0xFF) ? new TextDecoder('utf-16be').decode(u8.slice(2)) : new TextDecoder('utf-16le').decode(u8[0] === 0xFF && u8[1] === 0xFE ? u8.slice(2) : u8);
      else if (enc === 2) d = new TextDecoder('utf-16be').decode(u8);
      else if (enc === 3) d = new TextDecoder('utf-8').decode(u8);
      else d = new TextDecoder('windows-1252').decode(u8);
      return d;
    } catch { return ''; }
  }

  static async id3Read(blob) { // ID3v2.2/2.3/2.4: title, artist, embedded lyrics, album art
    const out = { title: '', artist: '', lyrics: '', cover: null };
    try {
      const h = new Uint8Array(await blob.slice(0, 10).arrayBuffer());
      if (h[0] !== 0x49 || h[1] !== 0x44 || h[2] !== 0x33) return out;
      const ver = h[3], size = ((h[6] & 127) << 21) | ((h[7] & 127) << 14) | ((h[8] & 127) << 7) | (h[9] & 127);
      const buf = new Uint8Array(await blob.slice(10, 10 + Math.min(size, 16 * 1024 * 1024)).arrayBuffer());
      const dv = new DataView(buf.buffer), idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
      let p = 0;
      while (p + hdr < buf.length) {
        const id = String.fromCharCode(...buf.slice(p, p + idLen));
        if (!/^[A-Z0-9]+$/.test(id)) break;
        const fs = ver === 2 ? (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5]
          : ver === 4 ? ((buf[p + 4] & 127) << 21) | ((buf[p + 5] & 127) << 14) | ((buf[p + 6] & 127) << 7) | (buf[p + 7] & 127)
          : dv.getUint32(p + 4);
        const body = p + hdr, endB = Math.min(body + fs, buf.length), enc = buf[body];
        if (fs <= 0) break;
        if ((id === 'TIT2' || id === 'TT2') && !out.title) out.title = Id3.id3Text(buf.slice(body + 1, endB), enc).split('\0').filter(Boolean)[0]?.trim() || '';
        else if ((id === 'TPE1' || id === 'TP1') && !out.artist) out.artist = [...new Set(Id3.id3Text(buf.slice(body + 1, endB), enc).split('\0').map(s => s.trim()).filter(Boolean))].join(', ');
        else if ((id === 'USLT' || id === 'ULT') && !out.lyrics) {
          let q = body + 4; // encoding + 3-byte language
          if (enc === 1 || enc === 2) { while (q + 1 < endB && !(buf[q] === 0 && buf[q + 1] === 0)) q += 2; q += 2; }
          else { while (q < endB && buf[q] !== 0) q++; q++; }
          out.lyrics = Id3.id3Text(buf.slice(q, endB), enc).replace(/\0+$/, '').trim();
        } else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
          let q = body + 1;
          if (id === 'APIC') { while (q < endB && buf[q] !== 0) q++; q++; } else q += 3;
          q++;
          if (enc === 1 || enc === 2) { while (q + 1 < endB && !(buf[q] === 0 && buf[q + 1] === 0)) q += 2; q += 2; }
          else { while (q < endB && buf[q] !== 0) q++; q++; }
          const img = buf.slice(q, endB);
          if (img.length > 100) out.cover = new Blob([img], { type: img[0] === 0x89 ? 'image/png' : 'image/jpeg' });
        }
        p = body + fs;
      }
    } catch {}
    return out;
  }

  static async id3Cover(blob) { return (await Id3.id3Read(blob)).cover; }
}
