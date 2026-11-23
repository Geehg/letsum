/* MS-CFB sectors and MS-PPT FontEntityAtom. Image/OLE payloads are skipped by their offsets. */
function readPptFonts(file, recordFont) {
  const invalid = () => Error('PPT 문서 구조를 읽을 수 없습니다. PowerPoint에서 다시 저장해 주세요.');
  const end = 0xfffffffe, free = 0xffffffff;
  const reader = new FileReaderSync();
  // Separate FAT, directory and document reads frequently alternate. Keep a small shared page cache.
  const blockSize = 32768, blocks = new Map();
  function viewAt(pos, size) {
    if (pos < 0 || pos + size > file.size) throw invalid();
    const block = Math.floor(pos / blockSize) * blockSize;
    if (pos + size > block + blockSize)
      return new DataView(reader.readAsArrayBuffer(file.slice(pos, pos + size)));
    let cached = blocks.get(block);
    if (!cached) {
      cached = reader.readAsArrayBuffer(file.slice(block, block + blockSize));
      if (blocks.size >= 16) blocks.delete(blocks.keys().next().value);
      blocks.set(block, cached);
    }
    return new DataView(cached, pos - block, size);
  }
  const h = viewAt(0, 512);
  if (h.getUint32(0) !== 0xd0cf11e0 || h.getUint32(4) !== 0xa1b11ae1 || h.getUint16(28, true) !== 0xfffe) throw invalid();
  const version = h.getUint16(26, true), sectorSize = 2 ** h.getUint16(30, true);
  if (!((version === 3 && sectorSize === 512) || (version === 4 && sectorSize === 4096)) ||
      h.getUint16(32, true) !== 6 || h.getUint32(56, true) !== 4096) throw invalid();
  const count = Math.floor(file.size / sectorSize) - 1, perFat = sectorSize / 4;
  function checkSector(id) { if (!Number.isInteger(id) || id < 0 || id >= count) throw invalid(); }
  function physical(id) { checkSector(id); return (id + 1) * sectorSize; }
  const fatCount = h.getUint32(44, true), fat = [];
  if (!fatCount || fatCount > count) throw invalid();
  function addFat(id) {
    if (fat.length === fatCount || id === free) return;
    checkSector(id);
    fat.push(id);
  }
  for (let i = 0; i < 109; i++) addFat(h.getUint32(76 + 4*i, true));
  let dif = h.getUint32(68, true);
  const difSeen = new Set();
  while (fat.length < fatCount) {
    if (difSeen.has(dif) || difSeen.size >= h.getUint32(72, true)) throw invalid();
    difSeen.add(dif);
    const table = viewAt(physical(dif), sectorSize);
    for (let i = 0; i < perFat - 1; i++) addFat(table.getUint32(4*i, true));
    dif = table.getUint32(sectorSize - 4, true);
  }
  function next(id) {
    checkSector(id);
    return viewAt(physical(fat[Math.floor(id / perFat)]) + (id % perFat)*4, 4).getUint32(0, true);
  }
  function chain(start, size, unit, max, advance) {
    const n = Math.ceil(size / unit);
    if (n > max || size > file.size) throw invalid();
    const ids = new Uint32Array(n);
    const used = new Uint8Array(Math.ceil(max / 8));
    let id = start;
    for (let i = 0; i < n; i++) {
      if (id >= max || used[id >>> 3] & (1 << (id & 7))) throw invalid();
      used[id >>> 3] |= 1 << (id & 7);
      ids[i] = id;
      id = advance(id);
    }
    if (n && id !== end) throw invalid();
    return ids;
  }
  const regular = (entry) => chain(entry.start, entry.size, sectorSize, count, next);
  const decoder = new TextDecoder('utf-16le');
  let directory = h.getUint32(48, true), root, doc;
  const directorySeen = new Set();
  while (directory !== end) {
    if (directorySeen.has(directory) || directorySeen.size * sectorSize >= 32 * 1024 * 1024) throw invalid();
    directorySeen.add(directory);
    const v = viewAt(physical(directory), sectorSize);
    for (let i = 0; i < sectorSize; i += 128) {
      const type = v.getUint8(i+66);
      if (type !== 2 && type !== 5) continue;
      const nameLength = v.getUint16(i+64, true);
      if (nameLength < 2 || nameLength > 64 || nameLength % 2) throw invalid();
      const name = decoder.decode(new Uint8Array(v.buffer, v.byteOffset+i, nameLength-2));
      if (/^(EncryptedSummary|EncryptedPackage)$/i.test(name))
        throw Error('암호를 해제한 사본으로 다시 시도해 주세요.');
      const entry = {start: v.getUint32(i+116,true), size: v.getUint32(i+120,true)};
      if (type === 5) root = entry;
      if (type === 2 && name === 'PowerPoint Document') doc = entry;
    }
    directory = next(directory);
  }
  if (!root || !doc) throw Error('PowerPoint 문서 스트림을 찾을 수 없습니다. PPTX로 저장한 뒤 시도해 주세요.');
  let unit = sectorSize, ids, address = physical;
  if (doc.size < 4096) {
    unit = 64;
    const rootBlocks = regular(root);
    const miniFat = regular({start:h.getUint32(60,true), size:h.getUint32(64,true)*sectorSize});
    const miniCount = Math.floor(root.size / unit);
    ids = chain(doc.start, doc.size, unit, miniCount, id =>
      viewAt(physical(miniFat[Math.floor(id / perFat)]) + (id % perFat)*4, 4).getUint32(0, true));
    address = id => physical(rootBlocks[Math.floor(id*unit / sectorSize)]) + id*unit % sectorSize;
  } else ids = regular(doc);
  function read(pos, size) {
    const block = Math.floor(pos / unit), offset = pos % unit;
    if (offset + size <= unit) return viewAt(address(ids[block]) + offset, size);
    const data = new Uint8Array(size);
    let written = 0;
    while (written < size) {
      const at = pos + written, part = Math.min(size-written, unit-at%unit);
      const v = viewAt(address(ids[Math.floor(at/unit)]) + at%unit, part);
      data.set(new Uint8Array(v.buffer, v.byteOffset, part), written);
      written += part;
    }
    return new DataView(data.buffer);
  }
  let records = 0;
  function walk(pos, limit, depth) {
    if (depth > 80) throw invalid();
    while (pos + 8 <= limit) {
      if (++records > 2000000) throw Error('PPT 내부 기록 수가 분석 한도를 넘었습니다.');
      const header = read(pos, 8);
      const length = header.getUint32(4, true);
      const after = pos + 8 + length;
      if (after > limit) throw invalid();
      if (header.getUint16(2,true) === 4023 && length >= 64) {
        const v = read(pos+8, 64);
        recordFont(decoder.decode(new Uint8Array(v.buffer, v.byteOffset, 64)).split('\0')[0], 'PPT 글꼴 표');
      } else if ((header.getUint16(0,true) & 15) === 15) walk(pos+8, after, depth+1);
      pos = after;
    }
  }
  walk(0, doc.size, 0);
}
