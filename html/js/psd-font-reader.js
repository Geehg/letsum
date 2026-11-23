/* Photoshop PSD v1. Offsets follow Adobe's File Formats Specification, "Layer and Mask Information".
   Read layer records and one text descriptor at a time; skip image resources, layer pixels and composite data. */
async function readPsdFonts(file, recordFont) {
  const blockSize = 64 * 1024;
  const textLimit = 16 * 1024 * 1024;
  let cached = new ArrayBuffer(0), cacheStart = 0;
  const invalid = () => new Error('PSD 레이어 구조를 읽을 수 없습니다. 파일이 온전한지 확인해 주세요.');
  function endOf(start, length, limit) {
    if (start < 0 || length < 0 || start + length > limit) throw invalid();
    return start + length;
  }
  async function viewAt(start, length, limit) {
    const end = endOf(start, length, limit);
    if (start < cacheStart || end > cacheStart + cached.byteLength) {
      cacheStart = start;
      cached = await file.slice(start, Math.min(file.size, start + Math.max(blockSize, length))).arrayBuffer();
    }
    return new DataView(cached, start - cacheStart, length);
  }
  async function section(start, limit) {
    const length = (await viewAt(start, 4, limit)).getUint32(0);
    return {start: start + 4, end: endOf(start + 4, length, limit)};
  }
  function tag(view, offset) {
    return String.fromCharCode(view.getUint8(offset), view.getUint8(offset+1), view.getUint8(offset+2), view.getUint8(offset+3));
  }
  async function* tags(start, end) {
    // Some writers include padding in the advertised size, others pad to 2 or 4 bytes afterwards.
    let pos = start;
    while (pos + 12 <= end) {
      const header = await viewAt(pos, Math.min(16, end - pos), end);
      let padding = 0;
      while (padding < 4 && header.getUint8(padding) === 0) padding++;
      if (padding) {
        if (padding === 4) {
          // Global blocks may have a longer zero-filled tail.
          const chunk = await viewAt(pos, Math.min(blockSize, end - pos), end);
          const bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
          const next = bytes.findIndex(byte => byte !== 0);
          pos += next < 0 ? bytes.length : next;
        } else pos += padding;
        continue;
      }
      const sig = tag(header, 0), key = tag(header, 4);
      if (sig !== '8BIM' && sig !== '8B64') throw invalid();
      let offset = 12, length = header.getUint32(8);
      if (sig === '8B64') {
        if (length !== 0 || header.byteLength < 16) throw invalid();
        offset = 16; length = header.getUint32(12);
      }
      const body = pos + offset;
      pos = endOf(body, length, end);
      yield {key, start:body, end:pos};
    }
  }

  const header = await viewAt(0, 26, file.size);
  if (tag(header, 0) !== '8BPS') throw invalid();
  if (header.getUint16(4) !== 1) throw Error('일반 PSD 형식으로 저장한 파일을 선택해 주세요. PSB는 지원하지 않습니다.');
  const depth = header.getUint16(22);
  if (![1,8,16,32].includes(depth) || !header.getUint32(14) || !header.getUint32(18)) throw invalid();
  const colors = await section(26, file.size);
  const resources = await section(colors.end, file.size);
  const mask = await section(resources.end, file.size);
  if (mask.start === mask.end) return;
  let layers = await section(mask.start, mask.end);
  const maskOffset = layers.end + ((layers.end - layers.start) % 2);
  if (maskOffset < mask.end) {
    const globalMask = await section(maskOffset, mask.end);
    const preferred = depth === 16 ? 'Lr16' : depth === 32 ? 'Lr32' : 'Layr';
    const hasPrimary = layers.end > layers.start && (await viewAt(layers.start, 2, layers.end)).getInt16(0) !== 0;
    let fallback;
    for await (const block of tags(globalMask.end, mask.end)) {
      if (!['Layr','Lr16','Lr32'].includes(block.key) || block.end - block.start < 2) continue;
      if ((await viewAt(block.start, 2, block.end)).getInt16(0) === 0) continue;
      if (block.key === preferred) { fallback = block; break; }
      if (!hasPrimary && !fallback) fallback = block;
    }
    if (fallback) layers = fallback;
  }
  if (layers.start === layers.end) return;
  const count = Math.abs((await viewAt(layers.start, 2, layers.end)).getInt16(0));
  let pos = layers.start + 2, textIndex = 0;
  for (let i = 0; i < count; i++) {
    const channels = (await viewAt(pos, 18, layers.end)).getUint16(16);
    const blend = pos + 18 + channels * 6;
    if (tag(await viewAt(blend, 12, layers.end), 0) !== '8BIM') throw invalid();
    const extra = await section(blend + 12, layers.end);
    pos = extra.end;
    const maskData = await section(extra.start, extra.end);
    const ranges = await section(maskData.end, extra.end);
    const nameSize = (await viewAt(ranges.end, 1, extra.end)).getUint8(0);
    const nameEnd = endOf(ranges.end + 1, nameSize, extra.end);
    // Prefer modern text when a file includes both modern and legacy data on the same layer.
    let text;
    for await (const block of tags(nameEnd, extra.end)) {
      if (block.key === 'TySh' || (block.key === 'tySh' && !text)) text = block;
    }
    if (!text) continue;
    const size = text.end - text.start;
    if (size > textLimit) throw Error('한 문자 레이어의 편집 정보가 16 MB를 넘습니다. 해당 문자 레이어를 나눈 사본으로 다시 시도해 주세요.');
    if (!self.PsdText) importScripts('vendor/extractor/psd-text.min.js');
    const data = PsdText.decode(text.key, await viewAt(text.start, size, text.end));
    const location = '문자 레이어 ' + (++textIndex);
    recordFont(data?.style?.font?.name, location);
    for (const run of data?.styleRuns || []) recordFont(run.style?.font?.name, location);
  }
}

