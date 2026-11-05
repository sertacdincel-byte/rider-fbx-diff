package com.bytelab.fbxdiff;

import com.intellij.diff.DiffContext;
import com.intellij.diff.FrameDiffTool;
import com.intellij.diff.contents.DiffContent;
import com.intellij.diff.contents.EmptyContent;
import com.intellij.diff.contents.FileContent;
import com.intellij.diff.requests.ContentDiffRequest;
import com.intellij.diff.requests.DiffRequest;
import com.intellij.openapi.Disposable;
import com.intellij.openapi.util.Disposer;
import com.intellij.openapi.vfs.VirtualFile;
import org.jetbrains.annotations.NotNull;

import javax.swing.JComponent;
import java.util.ArrayList;
import java.util.List;

public final class FbxDiffTool implements FrameDiffTool {
    @Override
    public @NotNull String getName() {
        return "FBX model viewer";
    }

    @Override
    public boolean canShow(@NotNull DiffContext context, @NotNull DiffRequest request) {
        if (!(request instanceof ContentDiffRequest contentRequest)) return false;
        List<DiffContent> contents = contentRequest.getContents();
        if (contents.size() != 2) return false;
        boolean anyFbx = false;
        for (DiffContent content : contents) {
            if (content instanceof EmptyContent) continue;
            if (!isFbx(content)) return false;
            anyFbx = true;
        }
        return anyFbx;
    }

    private static boolean isFbx(DiffContent content) {
        if (!(content instanceof FileContent fileContent)) return false;
        if (content.getContentType() instanceof FbxFileType) return true;
        VirtualFile file = fileContent.getFile();
        return file != null && FbxFileType.isFbxName(file.getName());
    }

    @Override
    public @NotNull DiffViewer createComponent(@NotNull DiffContext context, @NotNull DiffRequest request) {
        return new Viewer((ContentDiffRequest) request);
    }

    private static final class Viewer implements DiffViewer {
        private final Disposable disposable = Disposer.newDisposable("FBX diff viewer");
        private final FbxViewerPanel panel;

        Viewer(ContentDiffRequest request) {
            List<DiffContent> contents = request.getContents();
            List<String> titles = request.getContentTitles();
            List<FbxViewerPanel.Side> sides = new ArrayList<>(2);
            for (int i = 0; i < 2; i++) {
                String title = i < titles.size() && titles.get(i) != null ? titles.get(i) : (i == 0 ? "Before" : "After");
                DiffContent content = contents.get(i);
                if (content instanceof FileContent fileContent && fileContent.getFile() != null) {
                    sides.add(FbxViewerPanel.Side.of(title, fileContent.getFile()));
                } else {
                    sides.add(FbxViewerPanel.Side.empty(title, "File does not exist in this revision"));
                }
            }
            panel = new FbxViewerPanel(false, sides, disposable);
        }

        @Override
        public @NotNull JComponent getComponent() {
            return panel.getComponent();
        }

        @Override
        public JComponent getPreferredFocusedComponent() {
            return panel.getComponent();
        }

        @Override
        public @NotNull ToolbarComponents init() {
            return new ToolbarComponents();
        }

        @Override
        public void dispose() {
            Disposer.dispose(disposable);
        }
    }
}
