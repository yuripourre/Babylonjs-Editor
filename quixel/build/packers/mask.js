"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaskPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class MaskPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param maskTexture defines the reference to the mask texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, maskTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (maskTexture) {
            const log = await editor.layout.console.progress("Packing mask texture alpha channel.");
            const packedMaskTexturePath = await textureMerger_1.TextureUtils.MergeTextures(maskTexture, maskTexture, rootFolder, (color1) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color1.r,
            }));
            if (packedMaskTexturePath) {
                maskTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(maskTexture.name)));
                }
                catch (e) {
                    // Catch silently.
                }
                const packedMaskTexture = await new Promise((resolve, reject) => {
                    const texture = new babylonjs_1.Texture(packedMaskTexturePath, editor.layout.preview.scene, false, true, undefined, () => {
                        texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                        texture.name = packedMaskTexturePath.replace(projectFolder, "");
                        texture.url = texture.name;
                        texture.hasAlpha = true;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                        log.setState({ error: true });
                    });
                });
                material.albedoTexture = packedMaskTexture;
                material.useAlphaFromAlbedoTexture = false;
                log.setState({ done: true });
            }
            else {
                material.albedoTexture = maskTexture;
            }
        }
    }
}
exports.MaskPacker = MaskPacker;
//# sourceMappingURL=mask.js.map