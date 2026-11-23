// Shared local ZIP/XML reader. Only requested parts are decompressed; media and embedded fonts are skipped.
'use strict';

async function withFontArchive(file, keep, scan, partLimit = 24 * 1024 * 1024, totalLimit = 96 * 1024 * 1024) {
  if (!self.zip) importScripts(vendor + 'zip-native.min.js');
  if (!self.ExtractorXML) importScripts(vendor + 'saxes.min.js');
  class LocalReader extends zip.BlobReader {
    readUint8Array(offset, length) {
      if (length > 16 * 1024 * 1024) throw Error('문서의 ZIP 파일 목록이 분석 한도를 넘었습니다.');
      return super.readUint8Array(offset, length);
    }
  }
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (signature[0] === 0xd0 && signature[1] === 0xcf)
    throw Error('암호가 설정되었거나 이전 바이너리 형식입니다. 암호를 해제한 사본을 지원 형식으로 저장해 주세요.');
  const reader = new zip.ZipReader(new LocalReader(file), {useWebWorkers:false});
  const entries = new Map();
  let remaining = totalLimit;
  async function parse(path, events, xmlns = true) {
    const entry = entries.get(path);
    if (!entry) throw Error('문서가 참조하는 내부 XML을 찾을 수 없습니다.');
    if (entry.encrypted) throw Error('암호를 해제한 사본으로 다시 시도해 주세요.');
    const size = entry.uncompressedSize;
    if (!Number.isSafeInteger(size) || size < 0 || size > partLimit || size > remaining || entry.compressedSize > partLimit + 1024 * 1024)
      throw Error('문서 내부 XML이 분석 한도를 넘었습니다.');
    remaining -= size;
    const parser = new ExtractorXML.SaxesParser({xmlns});
    parser.on('doctype', () => { throw Error('DTD를 포함한 XML은 분석할 수 없습니다.'); });
    for (const [type, handler] of Object.entries(events)) parser.on(type, handler);
    let read = 0, decoder;
    // A split first chunk can contain half a UTF-16 byte order mark.
    let prefix = new Uint8Array(0);
    function decode(bytes, final) {
      if (!decoder) {
        if (prefix.length) {
          const joined = new Uint8Array(prefix.length + bytes.length);
          joined.set(prefix); joined.set(bytes, prefix.length); bytes = joined;
        }
        if (!final && bytes.length < 4) { prefix = bytes.slice(); return; }
        const little = (bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 60 && bytes[1] === 0);
        const big = (bytes[0] === 254 && bytes[1] === 255) || (bytes[0] === 0 && bytes[1] === 60);
        decoder = new TextDecoder(little ? 'utf-16le' : big ? 'utf-16be' : 'utf-8', {fatal:true});
      }
      parser.write(decoder.decode(bytes, {stream:!final}));
    }
    let partError;
    const sink = new WritableStream({write(bytes) {
      try {
        read += bytes.length;
        if (read > size) throw Error('문서 내부 XML 크기가 올바르지 않습니다.');
        decode(bytes, false);
      } catch (error) {
        partError = error;
        throw error;
      }
    }});
    try {
      await entry.getData(sink, {checkSignature:true});
    } catch (error) {
      throw partError || error;
    }
    if (read !== size) throw Error('문서 내부 XML 크기가 올바르지 않습니다.');
    decode(new Uint8Array(0), true);
    parser.close();
  }
  try {
    let count = 0;
    for await (const entry of reader.getEntriesGenerator()) {
      if (++count > 50000) throw Error('문서 내부 파일 수가 분석 한도를 넘었습니다.');
      if (!entry.directory && keep(entry.filename)) {
        if (entries.has(entry.filename)) throw Error('문서에 같은 경로의 파일이 중복되어 있습니다.');
        entries.set(entry.filename, entry);
      }
    }
    await scan({entries, parse});
  } finally { await reader.close(); }
}
