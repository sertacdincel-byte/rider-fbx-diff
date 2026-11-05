package com.bytelab.fbxdiff;

import com.intellij.diff.DiffContext;
import com.intellij.diff.DiffTool;
import com.intellij.diff.impl.DiffToolSubstitutor;
import com.intellij.diff.requests.DiffRequest;
import com.intellij.diff.tools.binary.BinaryDiffTool;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/** The user's saved tool order can put the binary viewer ahead of ours; swap it out for FBX requests. */
public final class FbxDiffToolSubstitutor implements DiffToolSubstitutor {
    @Override
    public @Nullable DiffTool getReplacement(@NotNull DiffTool tool, @NotNull DiffContext context, @NotNull DiffRequest request) {
        if (!(tool instanceof BinaryDiffTool)) return null;
        FbxDiffTool fbx = DiffTool.EP_NAME.findExtension(FbxDiffTool.class);
        return fbx != null && fbx.canShow(context, request) ? fbx : null;
    }
}
