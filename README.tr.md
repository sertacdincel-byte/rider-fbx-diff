# FBX Diff Viewer

[English](README.md) · **Türkçe**

`.fbx` dosyalarını 3D gösteren ve iki sürümü yan yana karşılaştıran, mesh bazında istatistik veren bir Rider eklentisi.

Eklenti yokken bir FBX dosyasının Git diff'i *"Cannot show diff for an unknown file type"* hatası verir. Eklentiyle:

- **Diff** (Git log → Show Diff, Commit / Local Changes, Compare with Branch…, Compare Files): kameraları birlikte hareket eden iki 3D panel ve farkları gösteren bir istatistik tablosu açılır.
- Bir `.fbx` dosyasını editörde **açınca** aynı görüntüleyici tek dosya için açılır.

| Özellik | Ayrıntı |
|---|---|
| 3D görünüm | Clay / Original / Normals gölgelendirme, wireframe, iskelet, zemin ızgarası, döndürme düzeltmesi, senkron kameralar, modeli ortalama (`F`), animasyon klibi oynatma |
| Mesh tablosu | Üçgen, vertex (≈ Unity), benzersiz pozisyon, kemik, blend shape, UV set, materyal: eski → yeni, fark ve yüzde ile; sıralama, filtreleme, "sadece değişenler" |
| LOD | `_LOD<n>` ekleri algılanır; araç çubuğunda LOD filtresi; LOD başına toplamlar (eki olmayan mesh'ler LOD0 sayılır) |
| Diğer tablolar | Animasyon klipleri (süre, track sayısı), materyal kullanımı, dosya boyutu, FBX sürümü, export eden araç |
| Etkileşim | Mesh satırına tıklayınca o mesh iki panelde de vurgulanır; LOD satırına tıklayınca sadece o seviye gösterilir; ayırıcı sürüklenebilir; yerleşim değiştirme (3D + istatistik / sadece 3D / sadece istatistik) |

Her şey IDE'nin gömülü tarayıcısında, yerelde çalışır. Hiçbir veri makineden dışarı çıkmaz.

---

## Kurulum

### Eklenti deposundan (önerilen)

Güncellemeler IDE üzerinden otomatik gelir.

1. Rider → **Settings → Plugins → ⚙ → Manage Plugin Repositories… → +** ile şu adresi ekle:
   ```
   https://github.com/sertacdincel-byte/rider-fbx-diff/releases/latest/download/updatePlugins.xml
   ```
2. **Marketplace** sekmesinde *FBX Diff Viewer* ara → **Install** → Rider'ı yeniden başlat.
3. Kontrol: Git log'da bir FBX commit'i seç → dosyaya sağ tıkla → **Show Diff**. İki model yan yana açılmalı.

Bu adres her zaman en yeni GitHub release'ini gösterir; o release'teki `updatePlugins.xml` de aynı release'in zip'ini işaret eder. Yeni sürümler normal eklenti güncellemesi olarak görünür.

### Diskten

[Releases](https://github.com/sertacdincel-byte/rider-fbx-diff/releases) sayfasından `FbxDiff-<sürüm>.zip` dosyasını indir (zip'i açma) → **Settings → Plugins → ⚙ → Install Plugin from Disk…** → zip'i seç → yeniden başlat. Bu yolla güncellemeler otomatik gelmez.

### Kaldırma

**Settings → Plugins → Installed → FBX Diff Viewer → Uninstall**, ardından Rider'ı yeniden başlat.

### Uyumluluk

| | |
|---|---|
| IDE | Rider 2026.2 (build 262) ve sonrası. Rider 2026.2.3.1 ile derlendi ve kullanıldı. Aynı build'deki diğer IntelliJ tabanlı IDE'lerde çalışması beklenir ama denenmedi. |
| İşletim sistemi | Windows 11'de geliştirildi. İşletim sistemine özel kod yok; macOS ve Linux denenmedi. |
| FBX | 7.x binary ve ASCII (three.js `FBXLoader`'ın desteklediği aralık). Daha eski dosyalar o panelde okuma hatası gösterir. |
| Dosya boyutu | Dosya başına en fazla 256 MB. |

`until-build` tanımlı değil, yani Rider güncellenince eklenti devre dışı kalmaz. İleride bir Rider sürümü eklentiyi bozarsa o sürüme karşı yeniden derleyip (bkz. *Derleme*) yeni bir sürüm çıkarmak gerekir.

---

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Diff hâlâ "Cannot show diff for an unknown file type" diyor | Eklenti etkin değil. **Settings → Plugins → Installed** altından kontrol et ve yeniden başlat. Başka bir eklenti `.fbx` uzantısını sahiplenmiş olabilir: **Settings → Editor → File Types** altında `*.fbx` **FBX** türüne ait olmalı. |
| 3D yerine düz binary diff açılıyor | Diff araç çubuğundaki görüntüleyici seçiminden **FBX model viewer**'ı seç. |
| "3D preview unavailable: …" | Gömülü tarayıcıda WebGL başlatılamadı; istatistikler yine çalışır. **Help → Find Action → Registry…** aç, `ide.browser.jcef.gpu.disable` ayarının kapalı olduğundan emin ol ve yeniden başlat. Uzak masaüstü oturumları ve eski ekran kartı sürücüleri de buna yol açabilir. |
| "FBX preview needs the embedded browser (JCEF)…" | IDE, JCEF içermeyen bir Java runtime ile çalışıyor. Paketle gelene geri dön: **Help → Find Action → Choose Boot Java Runtime for the IDE**. |
| Bir panel "Receiving…" ya da "Parsing FBX…" yazısında kalıyor | Dosya çok büyük ya da alışılmadık. Log'a bak (aşağıda). |
| "Could not read FBX: …" | Loader bu dosyayı desteklemiyor (örneğin FBX 6.x ya da bozuk bir export). |
| Model yan yatmış görünüyor | Araç çubuğundaki **Rotate** seçeneğini kullan. |
| *FBX Diff Viewer* Marketplace sekmesinde çıkmıyor | **Manage Plugin Repositories…** altındaki adresi ve makinenin github.com'a erişebildiğini kontrol et. |

**Log'lar**: **Help → Show Log in Explorer** → `idea.log` dosyasında `com.bytelab.fbxdiff` ya da `FbxViewerPanel` ara.

---

## Geliştirme

### Derleme

Gerekenler: bilgisayarda kurulu bir Rider (içindeki JBR `javac` sağlar) ve Node.js 18+. Gradle gerekmez.

```powershell
./build.ps1                                   # web paketi + Java + zip
./build.ps1 -SkipWeb                          # commit'lenmiş viewer.html'i kullan
./build.ps1 -RiderHome "D:\Apps\Rider"        # Rider farklı bir yerde kuruluysa
./build.ps1 -RepositoryUrl https://host/path  # ayrıca updatePlugins.xml üret
```

Çıktı: `build/distributions/FbxDiff-<sürüm>.zip`; `-RepositoryUrl` verilirse ayrıca `updatePlugins.xml`. Script zip'in SHA-256 özetini de yazdırır.

Java kodu, kurulu Rider'ın `lib/*` ve `plugins/jcef-plugin/lib/modules/*` jar'larına karşı derlenir; böylece her zaman derlendiği IDE ile uyumlu olur.

### Sürüm çıkarma

1. `src/main/resources/META-INF/plugin.xml` içindeki `<version>` değerini artır ve `<change-notes>`'a bir giriş ekle.
2. `CHANGELOG.md`'ye `## <sürüm> — <tarih>` başlıklı bir bölüm ekle.
3. Görüntüleyicide değişiklik yaptıysan `viewer.html`'in yeniden üretilmesi için `./build.ps1` çalıştır.
4. `build/distributions/FbxDiff-<sürüm>.zip` dosyasını bir kez diskten kurup gerçek bir FBX diff'i ile dene.
5. Commit'le, sonra `./release.ps1` çalıştır (release'i yayınlamadan önce GitHub'da incelemek için `-Draft` ekle).

`release.ps1` çalışma ağacı temiz değilse, etiket zaten varsa ya da CHANGELOG'da o sürümün bölümü yoksa durur. Commit'lenmiş `viewer.html` ile derler, `HEAD`'i push'lar ve zip ile ona işaret eden `updatePlugins.xml` dosyasını içeren `v<sürüm>` GitHub release'ini oluşturur. Eklenti deposu adresini kullananlar hiçbir şey değiştirmeden güncellemeyi alır.

### Klasör yapısı

| Yol | İçerik |
|---|---|
| `src/main/java/com/bytelab/fbxdiff/` | Dosya türü, diff aracı, binary aracın yerine geçen substitutor, dosya editörü, JCEF paneli |
| `src/main/resources/META-INF/plugin.xml` | Eklenti tanımı; JCEF modülleri `intellij.libraries.jcef` ve `intellij.platform.ui.jcef`'e bağımlı |
| `src/main/resources/META-INF/THIRD_PARTY_NOTICES.txt` | Pakete gömülü three.js ve fflate lisansları; three.js güncellenince bunu da güncelle |
| `src/main/resources/fbxdiff/viewer.html` | three.js gömülü, üretilmiş tek dosyalık görüntüleyici. Elle düzenleme; web derlemesini çalıştır |
| `web/src/` | Görüntüleyici kaynağı (`viewer.js` ve `viewer.html` şablonu); `web/build.mjs` (esbuild) ile paketlenir |
| `web/test/` | Tarayıcı test düzeneği (aşağıda) |

### Rider'a nasıl bağlanıyor

- `FbxFileType`, `*.fbx` uzantısını binary bir tür olarak kaydeder; böylece diff içerikleri bilinmeyen tür yerine binary `FileContent` olarak gelir.
- `FbxDiffTool` (`com.intellij.diff.DiffTool`), iki tarafı FBX dosyası ya da boş (eklenmiş veya silinmiş dosya) olan diff isteklerini kabul eder.
- `FbxDiffToolSubstitutor` (`com.intellij.diff.impl.DiffToolSubstitutor`), FBX isteklerinde Rider'ın binary görüntüleyicisinin yerine `FbxDiffTool`'u koyar; böylece kayıtlı diff aracı sıralaması onu gizleyemez.
- `FbxFileEditorProvider`, `.fbx` dosyalarını tek dosya görüntüleyicide açar.
- `FbxViewerPanel`, `viewer.html`'i bir `JBCefBrowser` içine yükler ve dosyanın byte'larını base64 parçalar halinde `FbxDiff.init / begin / chunk / end / empty / error` sayfa API'si üzerinden gönderir.

### Görüntüleyiciyi IDE olmadan test etme

`testdata/` klasörüne (git'e girmez) iki FBX dosyası koy, örneğin Git Bash ile:

```bash
git -C <repo> show <rev>:<path/to/model.fbx> > testdata/old.fbx
```

Sonra `node web/test/serve.mjs` çalıştırıp `http://127.0.0.1:47911/` adresini aç. Sorgu seçenekleri: `?a=old.fbx&b=new.fbx`, `?a=none` (eklenmiş dosya), `?mode=single&b=x.fbx`, `?dark=0`. Test düzeneği dosyaları eklentinin kullandığı sayfa API'sinin aynısıyla gönderir.

### Bilinen sınırlar

- Texture'lar yüklenmez (FBX'in içinde değil yanında dururlar); bu yüzden *Original* gölgelendirme yalnızca materyal renklerini gösterir.
- "Vertices (≈Unity)", loader'ın üçgen listesindeki aynı pozisyon + normal + UV + renk gruplarını birleştirerek hesaplanır. Unity'nin import sonrası sayısına yakındır ama birebir değildir; vertex birleştirme ya da normal yeniden hesaplama gibi import ayarları Unity'nin sayısını değiştirebilir.
- FBX için üç yönlü merge desteklenmez; IDE'nin normal merge penceresi kullanılır.
- Derleme JetBrains Plugin Verifier'ı çalıştırmaz. Elle çalıştırmak için:
  `java -jar verifier-cli-<sürüm>-all.jar check-plugin build/distributions/FbxDiff-<sürüm>.zip "<Rider klasörü>"`
  ([verifier-cli release'leri](https://github.com/JetBrains/intellij-plugin-verifier/releases)).

---

Pakete gömülü üçüncü taraf lisansları: [`THIRD_PARTY_NOTICES.txt`](src/main/resources/META-INF/THIRD_PARTY_NOTICES.txt).
