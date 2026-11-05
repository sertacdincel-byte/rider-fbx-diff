# FBX Diff Viewer

**English** · [Türkçe](README.tr.md)

A Rider plugin that shows `.fbx` files in 3D and compares two revisions side by side, with per-mesh statistics.

Without it, a Git diff of an FBX file shows *"Cannot show diff for an unknown file type"*. With it:

- **Diff** (Git log → Show Diff, Commit / Local Changes, Compare with Branch…, Compare Files): two synchronized 3D panes and a statistics table with deltas.
- **Open** an `.fbx` file in the editor: the same viewer for a single file.

| Feature | Details |
|---|---|
| 3D view | Clay / Original / Normals shading, wireframe, skeleton, grid, rotation fix, synchronized cameras, frame (`F`), animation clip playback |
| Mesh table | Triangles, vertices (≈ Unity), unique positions, bones, blend shapes, UV sets, materials: old → new with delta and %; sorting, filtering, "only changed" |
| LOD | `_LOD<n>` suffixes are detected; LOD filter in the toolbar; per-LOD totals (meshes without a suffix count as LOD0) |
| Other tables | Animation clips (duration, tracks), material usage, file size, FBX version, exporter |
| Interaction | Click a mesh row to highlight it in both panes; click a LOD row to show only that level; drag the divider; layout toggle (3D + stats / 3D only / stats only) |

Everything runs locally in the IDE's embedded browser. No data leaves the machine.

---

## Install

### From the plugin repository (recommended)

Updates arrive automatically through the IDE.

1. Rider → **Settings → Plugins → ⚙ → Manage Plugin Repositories… → +**, add:
   ```
   https://github.com/sertacdincel-byte/rider-fbx-diff/releases/latest/download/updatePlugins.xml
   ```
2. Search for *FBX Diff Viewer* in the **Marketplace** tab → **Install** → restart Rider.
3. Check: select an FBX commit in the Git log → right-click the file → **Show Diff**. Two models should open side by side.

The URL always points to the newest GitHub release, whose `updatePlugins.xml` names that release's zip. New versions show up as normal plugin updates.

### From disk

Download `FbxDiff-<version>.zip` from [Releases](https://github.com/sertacdincel-byte/rider-fbx-diff/releases) (do not unzip) → **Settings → Plugins → ⚙ → Install Plugin from Disk…** → pick the zip → restart. Updates do not arrive automatically this way.

### Uninstall

**Settings → Plugins → Installed → FBX Diff Viewer → Uninstall**, then restart Rider.

### Compatibility

| | |
|---|---|
| IDE | Rider 2026.2 (build 262) and later. Built and used on Rider 2026.2.3.1. Other IntelliJ-based IDEs of the same build should work but are untested. |
| OS | Developed on Windows 11. No OS-specific code; macOS and Linux are untested. |
| FBX | 7.x binary and ASCII (the range of the three.js `FBXLoader`). Older files show a parse error in that pane. |
| File size | Up to 256 MB per file. |

No `until-build` is set, so the plugin stays enabled after Rider updates. If a future Rider breaks it, rebuild against that Rider (see *Build*) and release a new version.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| The diff still says "Cannot show diff for an unknown file type" | The plugin is not active. Check **Settings → Plugins → Installed** and restart. Another plugin may claim `.fbx`: under **Settings → Editor → File Types**, `*.fbx` must belong to **FBX**. |
| A plain binary diff opens instead of 3D | Pick **FBX model viewer** in the viewer selector of the diff toolbar. |
| "3D preview unavailable: …" | WebGL could not start in the embedded browser; statistics still work. Open **Help → Find Action → Registry…**, make sure `ide.browser.jcef.gpu.disable` is off, and restart. Remote desktop sessions and outdated GPU drivers can also cause this. |
| "FBX preview needs the embedded browser (JCEF)…" | The IDE runs on a runtime without JCEF. Switch back to the bundled one: **Help → Find Action → Choose Boot Java Runtime for the IDE**. |
| A pane stays at "Receiving…" or "Parsing FBX…" | Very large or unusual file. Check the log (below). |
| "Could not read FBX: …" | The loader does not support this file (for example FBX 6.x or a broken export). |
| The model lies on its side | Use **Rotate** in the toolbar. |
| *FBX Diff Viewer* does not appear in the Marketplace tab | Check the repository URL under **Manage Plugin Repositories…** and that the machine can reach github.com. |

**Logs**: **Help → Show Log in Explorer** → `idea.log`, search for `com.bytelab.fbxdiff` or `FbxViewerPanel`.

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

Output: `build/distributions/FbxDiff-<version>.zip`, plus `updatePlugins.xml` with `-RepositoryUrl`. The script prints the zip's SHA-256.

The Java code compiles against the Rider installation's `lib/*` and `plugins/jcef-plugin/lib/modules/*` jars, so it always matches the IDE it is built with.

### Release

1. Bump `<version>` in `src/main/resources/META-INF/plugin.xml` and add a `<change-notes>` entry.
2. Add a `## <version> — <date>` section to `CHANGELOG.md`.
3. If the viewer changed, run `./build.ps1` so `viewer.html` is regenerated.
4. Install `build/distributions/FbxDiff-<version>.zip` from disk once and check a real FBX diff.
5. Commit, then run `./release.ps1` (add `-Draft` to review the release on GitHub before publishing).

`release.ps1` stops on a dirty working tree, an existing tag or a missing CHANGELOG section. It builds with the committed `viewer.html`, pushes `HEAD`, and creates the GitHub release `v<version>` with the zip and an `updatePlugins.xml` that points at it. Users on the plugin repository URL get the update without changing anything.

### Layout

| Path | Contents |
|---|---|
| `src/main/java/com/bytelab/fbxdiff/` | File type, diff tool, binary-tool substitutor, file editor, JCEF panel |
| `src/main/resources/META-INF/plugin.xml` | Descriptor; depends on the JCEF modules `intellij.libraries.jcef` and `intellij.platform.ui.jcef` |
| `src/main/resources/META-INF/THIRD_PARTY_NOTICES.txt` | Licenses of the bundled three.js and fflate; update it when upgrading three.js |
| `src/main/resources/fbxdiff/viewer.html` | Generated single-file viewer with three.js inlined. Do not edit; run the web build |
| `web/src/` | Viewer source (`viewer.js` and the `viewer.html` template), bundled by `web/build.mjs` (esbuild) |
| `web/test/` | Browser test harness (below) |

### How it plugs in

- `FbxFileType` registers `*.fbx` as a binary type, so diff contents arrive as binary `FileContent`s instead of an unknown type.
- `FbxDiffTool` (`com.intellij.diff.DiffTool`) accepts two-sided requests whose sides are FBX files or empty (added or deleted file).
- `FbxDiffToolSubstitutor` (`com.intellij.diff.impl.DiffToolSubstitutor`) replaces the built-in binary viewer with `FbxDiffTool` for FBX requests, so a saved diff-tool order cannot hide it.
- `FbxFileEditorProvider` opens `.fbx` files in the single-file viewer.
- `FbxViewerPanel` loads `viewer.html` into a `JBCefBrowser` and streams the file bytes as base64 chunks through the page API `FbxDiff.init / begin / chunk / end / empty / error`.

### Testing the viewer without the IDE

Put two FBX files into `testdata/` (git-ignored), for example with Git Bash:

```bash
git -C <repo> show <rev>:<path/to/model.fbx> > testdata/old.fbx
```

Then run `node web/test/serve.mjs` and open `http://127.0.0.1:47911/`. Query options: `?a=old.fbx&b=new.fbx`, `?a=none` (added file), `?mode=single&b=x.fbx`, `?dark=0`. The harness feeds the files through the same page API the plugin uses.

### Known limits

- Textures are not loaded (they sit next to the FBX, not inside it), so *Original* shading shows material colors only.
- "Vertices (≈Unity)" merges identical position + normal + UV + color tuples from the loader's triangle list. It approximates Unity's imported count; import settings such as weld vertices or normal recalculation can change Unity's number.
- A three-way merge of an FBX is not handled; the IDE's normal merge dialog is used.
- The build does not run the JetBrains Plugin Verifier. To run it by hand:
  `java -jar verifier-cli-<ver>-all.jar check-plugin build/distributions/FbxDiff-<ver>.zip "<Rider home>"`
  ([verifier-cli releases](https://github.com/JetBrains/intellij-plugin-verifier/releases)).

---

Bundled third-party licenses: [`THIRD_PARTY_NOTICES.txt`](src/main/resources/META-INF/THIRD_PARTY_NOTICES.txt).
