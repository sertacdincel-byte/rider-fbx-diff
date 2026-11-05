package com.bytelab.fbxdiff;

import com.intellij.openapi.fileEditor.FileEditor;
import com.intellij.openapi.fileEditor.FileEditorPolicy;
import com.intellij.openapi.fileEditor.FileEditorProvider;
import com.intellij.openapi.project.DumbAware;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.util.UserDataHolderBase;
import com.intellij.openapi.vfs.VirtualFile;
import org.jetbrains.annotations.NotNull;

import javax.swing.JComponent;
import java.beans.PropertyChangeListener;
import java.util.List;

public final class FbxFileEditorProvider implements FileEditorProvider, DumbAware {
    @Override
    public boolean accept(@NotNull Project project, @NotNull VirtualFile file) {
        return !file.isDirectory() && FbxFileType.isFbxName(file.getName());
    }

    @Override
    public boolean acceptRequiresReadAction() {
        return false;
    }

    @Override
    public @NotNull FileEditor createEditor(@NotNull Project project, @NotNull VirtualFile file) {
        return new Editor(file);
    }

    @Override
    public @NotNull String getEditorTypeId() {
        return "bytelab-fbx-viewer";
    }

    @Override
    public @NotNull FileEditorPolicy getPolicy() {
        return FileEditorPolicy.HIDE_DEFAULT_EDITOR;
    }

    private static final class Editor extends UserDataHolderBase implements FileEditor {
        private final VirtualFile file;
        private final FbxViewerPanel panel;

        Editor(VirtualFile file) {
            this.file = file;
            panel = new FbxViewerPanel(true, List.of(FbxViewerPanel.Side.of(file.getName(), file)), this);
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
        public @NotNull String getName() {
            return "FBX Viewer";
        }

        @Override
        public void setState(@NotNull com.intellij.openapi.fileEditor.FileEditorState state) {
        }

        @Override
        public boolean isModified() {
            return false;
        }

        @Override
        public boolean isValid() {
            return file.isValid();
        }

        @Override
        public void addPropertyChangeListener(@NotNull PropertyChangeListener listener) {
        }

        @Override
        public void removePropertyChangeListener(@NotNull PropertyChangeListener listener) {
        }

        @Override
        public VirtualFile getFile() {
            return file;
        }

        @Override
        public void dispose() {
        }
    }
}
