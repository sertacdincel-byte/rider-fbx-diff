// Feeds testdata/*.fbx into the viewer through the same calls the plugin makes.
(async () => {
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'diff';
  const files = mode === 'single' ? [params.get('b') || 'new.fbx'] : [params.get('a') || 'old.fbx', params.get('b') || 'new.fbx'];
  FbxDiff.init({ mode, dark: params.get('dark') !== '0', titles: files.map((f) => 'testdata/' + f) });
  const CHUNK = 512 * 1024;
  for (let i = 0; i < files.length; i++) {
    if (files[i] === 'none') { FbxDiff.empty(i, 'File does not exist in this revision'); continue; }
    const res = await fetch('/testdata/' + files[i]);
    if (!res.ok) { FbxDiff.error(i, 'HTTP ' + res.status); continue; }
    const bytes = new Uint8Array(await res.arrayBuffer());
    FbxDiff.begin(i, bytes.length);
    for (let off = 0; off < bytes.length; off += CHUNK) {
      const part = bytes.subarray(off, off + CHUNK);
      let bin = '';
      for (let k = 0; k < part.length; k += 0x8000) bin += String.fromCharCode.apply(null, part.subarray(k, k + 0x8000));
      FbxDiff.chunk(i, btoa(bin));
    }
    FbxDiff.end(i);
  }
})();
