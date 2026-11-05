# FBX Diff Viewer

A Rider plugin that shows `.fbx` files in 3D and compares two revisions side by side, with per-mesh statistics.

Without it, Git diff on an FBX shows *"Cannot show diff for an unknown file type"*. With it:

- **Diff** (Git log → Show Diff, Commit / Local Changes, Compare with Branch…, Compare Files): two synchronized 3D panes plus a statistics table with deltas.
- **Open** an `.fbx` in the editor: the same viewer for one file.

| Feature | Details |
|---|---|
| 3D view | Clay / Original / Normals shading, wireframe, skeleton, grid, rotation fix, synchronized cameras, frame (`F`), animation clip playback |
| Mesh table | Triangles, vertices (≈ Unity), unique positions, bones, blend shapes, UV sets, materials — old → new with delta and %; sort, filter, "only changed" |
| LOD | `_LOD<n>` suffixes are detected; LOD filter in the toolbar; per-LOD totals (meshes without a suffix count as LOD0) |
| Other tables | Animation clips (duration, tracks), material usage, file size, FBX version, exporter |
| Interaction | Click a mesh row to highlight it in both panes; click a LOD row to show only that level; drag the divider; layout toggle (3D + stats / 3D / stats) |

Everything runs locally in the IDE's embedded browser; no data leaves the machine.

---

## Kurulum (TR)

Önerilen yol, güncellemelerin otomatik gelmesi için eklenti deposunu eklemek:

1. Rider → **Settings → Plugins → ⚙ (dişli) → Manage Plugin Repositories… → +** → şu adresi ekle:
   ```
   https://github.com/sertacdincel-byte/rider-fbx-diff/releases/latest/download/updatePlugins.xml
   ```
2. **Marketplace** sekmesinde *FBX Diff Viewer* ara → **Install** → Rider'ı yeniden başlat.
3. Test: Git log'da bir FBX commit'i seç → dosyaya sağ tık → **Show Diff**. İki model yan yana açılmalı.

Yeni sürümler Rider'ın normal eklenti güncellemesi olarak gelir.

Elle kurulum: [Releases](https://github.com/sertacdincel-byte/rider-fbx-diff/releases) sayfasından `FbxDiff-<sürüm>.zip` indir (açma) → **Settings → Plugins → ⚙ → Install Plugin from Disk…** → zip'i seç → yeniden başlat. Bu yolda güncellemeler otomatik gelmez.

Kaldırma: **Settings → Plugins → Installed → FBX Diff Viewer → Uninstall**, ardından Rider'ı yeniden başlat.

---

## Install

**Plugin repository** (updates arrive through the IDE):

1. Rider → **Settings → Plugins → ⚙ → Manage Plugin Repositories… → +** →
   `https://github.com/sertacdincel-byte/rider-fbx-diff/releases/latest/download/updatePlugins.xml`
2. Install *FBX Diff Viewer* from the **Marketplace** tab and restart. New versions show up as normal plugin updates.

The URL always points to the newest GitHub release, whose `updatePlugins.xml` names that release's zip.

**From disk**: download `FbxDiff-<version>.zip` from [Releases](https://github.com/sertacdincel-byte/rider-fbx-diff/releases) → **Settings → Plugins → ⚙ → Install Plugin from Disk…** (do not unzip) → restart.

### Compatibility

| | |
|---|---|
| IDE | Rider 2026.2 (build 262) and later. Built and used on Rider 2026.2.3.1. Other IntelliJ-based IDEs of the same build should work but are untested. |
| OS | Developed on Windows 11. No OS-specific code; macOS/Linux untested. |
| FBX | 7.x binary and ASCII (the three.js `FBXLoader` range). Older files show a parse error in that pane. |
| File size | Up to 256 MB per file. |

No `until-build` is set, so the plugin stays enabled after Rider updates. If a future Rider breaks it, rebuild against that Rider (see *Build*) and release a new version.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Diff still says "Cannot show diff for an unknown file type" | Plugin not active. Check **Settings → Plugins → Installed** and restart. Another plugin may map `.fbx`: **Settings → Editor → File Types** → `*.fbx` must belong to **FBX**. |
| A plain binary diff opens instead of 3D | Use the viewer selector in the diff toolbar and pick **FBX model viewer**. |
| "3D preview unavailable: …" | WebGL could not start in the embedded browser. Statistics still work. Check **Help → Find Action → Registry…** → `ide.browser.jcef.gpu.disable` is **off**, then restart. Remote desktop sessions or outdated GPU drivers can also cause this. |
| "FBX preview needs the embedded browser (JCEF)…" | The IDE runs without JCEF (e.g. a custom boot runtime). Switch to the bundled runtime: **Help → Find Action → Choose Boot Java Runtime for the IDE**. |
| A pane stays at "Receiving…" or "Parsing FBX…" | Very large or unusual file. Check the log (below). |
| "Could not read FBX: …" | The loader does not support this file (e.g. FBX 6.x or a corrupt export). |
| Model lies on its side | Use **Rotate** in the toolbar. |

**Logs**: **Help → Show Log in Explorer** → `idea.log`, search for `com.bytelab.fbxdiff` or `FbxViewerPanel`.

**Viewer console**: right-click inside the 3D view → **Open DevTools** (if the IDE offers it) to see JavaScript errors.

---

## Development

### Build

Requirements: a local Rider (its bundled JBR provides `javac`) and Node.js 18+. No Gradle.

```powershell
./build.ps1                                   # web bundle + Java + zip
./build.ps1 -SkipWeb                          # reuse the committed viewer.html
./build.ps1 -RiderHome "D:\Apps\Rider"        # non-default Rider location
./build.ps1 -RepositoryUrl https://host/path  # also write updatePlugins.xml
```

Output: `build/distributions/FbxDiff-<version>.zip` (and `updatePlugins.xml` with `-RepositoryUrl`). The script prints the zip's SHA-256.

The Java code compiles against the Rider installation's `lib/*` and `plugins/jcef-plugin/lib/modules/*` jars, so it always matches the IDE it is built with.

### Release

1. Bump `<version>` in `src/main/resources/META-INF/plugin.xml` and add a `<change-notes>` entry.
2. Add a `## <version> — <date>` section to `CHANGELOG.md`.
3. If the viewer changed, run `./build.ps1` so `viewer.html` is regenerated.
4. Install `build/distributions/FbxDiff-<version>.zip` from disk once and check a real FBX diff.
5. Commit, then run `./release.ps1` (`-Draft` to review the release on GitHub before publishing).

`release.ps1` refuses a dirty tree, an existing tag or a missing CHANGELOG section. It builds with the committed `viewer.html`, pushes `HEAD`, and creates the GitHub release `v<version>` with the zip and an `updatePlugins.xml` that points at it. Users on the plugin repository URL get the update; nobody has to re-add anything.

### Layout

| Path | What |
|---|---|
| `src/main/java/com/bytelab/fbxdiff/` | File type, diff tool, binary-tool substitutor, file editor, JCEF panel |
| `src/main/resources/META-INF/plugin.xml` | Descriptor; depends on the JCEF modules `intellij.libraries.jcef` and `intellij.platform.ui.jcef` |
| `src/main/resources/META-INF/THIRD_PARTY_NOTICES.txt` | Licenses of bundled three.js and fflate — update when upgrading three.js |
| `src/main/resources/fbxdiff/viewer.html` | Generated single-file viewer (three.js inlined). Do not edit; run the web build |
| `web/src/` | Viewer source (`viewer.js`, `viewer.html` template), bundled by `web/build.mjs` (esbuild) |
| `web/test/` | Browser test harness (below) |

### How it plugs in

- `FbxFileType` registers `*.fbx` as a binary type, so diff contents arrive as binary `FileContent`s instead of an unknown type.
- `FbxDiffTool` (`com.intellij.diff.DiffTool`) accepts two-sided requests whose sides are FBX files or empty (added/deleted file).
- `FbxDiffToolSubstitutor` (`com.intellij.diff.impl.DiffToolSubstitutor`) swaps the built-in binary viewer for `FbxDiffTool` on FBX requests, so a saved diff-tool order cannot shadow it.
- `FbxFileEditorProvider` opens `.fbx` files in the single-file viewer.
- `FbxViewerPanel` loads `viewer.html` into a `JBCefBrowser` and streams the file bytes as base64 chunks through the page API `FbxDiff.init / begin / chunk / end / empty / error`.

### Testing the viewer without the IDE

```powershell
mkdir testdata
git -C <repo> show <rev>:<path/to/model.fbx> > testdata/old.fbx   # use cmd or Git Bash for binary-safe redirection
node web/test/serve.mjs
```

Open `http://127.0.0.1:47911/`. Query options: `?a=old.fbx&b=new.fbx`, `?a=none` (added file), `?mode=single&b=x.fbx`, `?dark=0`. The harness feeds files through the same page API the plugin uses.

### Known limits

- Textures are not loaded (they sit next to the FBX, not inside it); *Original* shading shows material colors only.
- "Vertices (≈Unity)" merges identical position + normal + UV + color tuples from the loader's triangle list. It approximates Unity's imported count; import settings such as weld vertices or normal recalculation can change Unity's number.
- Three-way merge of an FBX is not handled (the IDE's normal merge dialog is used).
- The plugin is not checked by the JetBrains Plugin Verifier in the build. To run it:
  `java -jar verifier-cli-<ver>-all.jar check-plugin build/distributions/FbxDiff-<ver>.zip "<Rider home>"`
  ([verifier-cli releases](https://github.com/JetBrains/intellij-plugin-verifier/releases)).
