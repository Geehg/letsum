// Browser worker adapter for ag-psd 34.2.3. Bundle with esbuild --bundle --minify
// --format=iife --global-name=PsdText --outfile=html/js/vendor/extractor/psd-text.min.js
import { createReader } from 'ag-psd/dist/psdReader.js';
import { infoHandlersMap } from 'ag-psd/dist/additionalInfo.js';

export function decode(key, view) {
  const reader = createReader(view.buffer, view.byteOffset, view.byteLength);
  const layer = {};
  infoHandlersMap[key].read(reader, layer, () => view.byteLength - reader.offset, {}, {});
  return layer.text;
}
