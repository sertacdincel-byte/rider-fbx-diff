package com.bytelab.fbxdiff;

import com.intellij.openapi.Disposable;
import com.intellij.openapi.application.ApplicationManager;
import com.intellij.openapi.diagnostic.Logger;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.util.ThrowableComputable;
import com.intellij.openapi.vfs.VirtualFile;
import com.intellij.ui.JBColor;
import com.intellij.ui.components.JBLabel;
import com.intellij.ui.jcef.JBCefApp;
import com.intellij.ui.jcef.JBCefBrowser;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.handler.CefLoadHandlerAdapter;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import javax.swing.JComponent;
import javax.swing.SwingConstants;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

final class FbxViewerPanel implements Disposable {
    private static final Logger LOG = Logger.getInstance(FbxViewerPanel.class);
    // JCEF may run out of process; keep each executeJavaScript payload small.
    private static final int CHUNK = 128 * 1024;
    // The page holds the file plus its parsed geometry; beyond this the embedded browser runs out of memory.
    private static final long MAX_BYTES = 256L * 1024 * 1024;
    private static volatile String viewerHtml;

    /** One side of the view. A side without a loader is shown as empty with {@code emptyText}. */
    record Side(@NotNull String title, long length, @Nullable ThrowableComputable<byte[], IOException> loader, @Nullable String emptyText) {
        static Side of(@NotNull String title, @NotNull VirtualFile file) {
            return new Side(title, file.getLength(), file::contentsToByteArray, null);
        }

        static Side empty(@NotNull String title, @NotNull String text) {
            return new Side(title, 0, null, text);
        }
    }

    private final JComponent component;
    private final @Nullable JBCefBrowser browser;
    private final AtomicBoolean started = new AtomicBoolean();
    private volatile boolean disposed;

    FbxViewerPanel(boolean single, @NotNull List<Side> sides, @NotNull Disposable parent) {
        Disposer.register(parent, this);
        if (!JBCefApp.isSupported()) {
            browser = null;
            component = new JBLabel("FBX preview needs the embedded browser (JCEF), which is not available in this IDE.", SwingConstants.CENTER);
            return;
        }
        String html;
        try {
            html = loadViewerHtml();
        } catch (IOException e) {
            LOG.warn(e);
            browser = null;
            component = new JBLabel("FBX preview could not load its viewer page: " + e.getMessage(), SwingConstants.CENTER);
            return;
        }

        boolean dark = !JBColor.isBright();
        JBCefBrowser b = new JBCefBrowser();
        Disposer.register(this, b);
        browser = b;
        b.getJBCefClient().addLoadHandler(new CefLoadHandlerAdapter() {
            @Override
            public void onLoadEnd(CefBrowser cefBrowser, CefFrame frame, int httpStatusCode) {
                String url = frame.getURL();
                if (url == null || url.isEmpty() || url.startsWith("about:")) return;
                if (frame.isMain() && started.compareAndSet(false, true)) {
                    ApplicationManager.getApplication().executeOnPooledThread(() -> push(single, dark, sides));
                }
            }
        }, b.getCefBrowser());
        b.loadHTML(html);
        component = b.getComponent();
    }

    @NotNull JComponent getComponent() {
        return component;
    }

    private void push(boolean single, boolean dark, List<Side> sides) {
        StringBuilder titles = new StringBuilder();
        for (Side s : sides) {
            if (titles.length() > 0) titles.append(',');
            titles.append(jsString(s.title()));
        }
        js("FbxDiff.init({mode:" + jsString(single ? "single" : "diff") + ",dark:" + dark + ",titles:[" + titles + "]})");

        Base64.Encoder encoder = Base64.getEncoder();
        for (int i = 0; i < sides.size() && !disposed; i++) {
            Side s = sides.get(i);
            if (s.loader() == null) {
                js("FbxDiff.empty(" + i + "," + jsString(s.emptyText() != null ? s.emptyText() : "No file") + ")");
                continue;
            }
            if (s.length() > MAX_BYTES) {
                js("FbxDiff.error(" + i + "," + jsString("File is too large to preview (" + (s.length() >> 20) + " MB, limit " + (MAX_BYTES >> 20) + " MB)") + ")");
                continue;
            }
            byte[] bytes;
            try {
                bytes = s.loader().compute();
            } catch (Throwable t) {
                LOG.info("Cannot read FBX content for " + s.title(), t);
                js("FbxDiff.error(" + i + "," + jsString("Could not read the file: " + t.getMessage()) + ")");
                continue;
            }
            js("FbxDiff.begin(" + i + "," + bytes.length + ")");
            for (int off = 0; off < bytes.length && !disposed; off += CHUNK) {
                byte[] part = Arrays.copyOfRange(bytes, off, Math.min(bytes.length, off + CHUNK));
                js("FbxDiff.chunk(" + i + ",'" + encoder.encodeToString(part) + "')");
            }
            js("FbxDiff.end(" + i + ")");
        }
    }

    private void js(String code) {
        JBCefBrowser b = browser;
        if (disposed || b == null) return;
        CefBrowser cef = b.getCefBrowser();
        cef.executeJavaScript(code, cef.getURL(), 0);
    }

    private static String loadViewerHtml() throws IOException {
        String html = viewerHtml;
        if (html != null) return html;
        try (InputStream in = FbxViewerPanel.class.getResourceAsStream("/fbxdiff/viewer.html")) {
            if (in == null) throw new IOException("viewer.html is missing from the plugin jar");
            html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
        viewerHtml = html;
        return html;
    }

    static String jsString(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case ' ' -> sb.append("\\u2028");
                case ' ' -> sb.append("\\u2029");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        return sb.append('"').toString();
    }

    @Override
    public void dispose() {
        disposed = true;
    }
}
