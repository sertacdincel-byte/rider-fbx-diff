package com.bytelab.fbxdiff;

import com.intellij.icons.AllIcons;
import com.intellij.openapi.fileTypes.FileType;
import org.jetbrains.annotations.NotNull;

import javax.swing.Icon;

public final class FbxFileType implements FileType {
    public static final FbxFileType INSTANCE = new FbxFileType();

    private FbxFileType() {
    }

    @Override
    public @NotNull String getName() {
        return "FBX";
    }

    @Override
    public @NotNull String getDescription() {
        return "FBX 3D model";
    }

    @Override
    public @NotNull String getDefaultExtension() {
        return "fbx";
    }

    @Override
    public Icon getIcon() {
        return AllIcons.FileTypes.Any_type;
    }

    @Override
    public boolean isBinary() {
        return true;
    }

    @Override
    public boolean isReadOnly() {
        return true;
    }

    static boolean isFbxName(String name) {
        return name != null && name.toLowerCase(java.util.Locale.ROOT).endsWith(".fbx");
    }
}
