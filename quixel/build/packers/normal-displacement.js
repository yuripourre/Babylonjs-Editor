"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NormalDisplacementPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class NormalDisplacementPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param bumpTexture defines the reference to the reflectivity texture.
     * @param displacementTexture defines the reference to the microsurface texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, bumpTexture, displacementTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (bumpTexture && displacementTexture) {
            const log = await editor.layout.console.progress("Packing displacement texture in bump texture alpha channel to use parallax mapping.");
            const packedBumpTexturePath = await textureMerger_1.TextureUtils.MergeTextures(bumpTexture, displacementTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r < 128 ? 128 : 255,
            }));
            if (packedBumpTexturePath) {
                bumpTexture.dispose();
                displacementTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(bumpTexture.name)));
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(displacementTexture.name)));
                }
                catch (e) {
                    // Catch silently.
                }
                const packedBumpTexture = await new Promise((resolve, reject) => {
                    const texture = new babylonjs_1.Texture(packedBumpTexturePath, editor.layout.preview.scene, false, true, undefined, () => {
                        texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                        texture.name = packedBumpTexturePath.replace(projectFolder, "");
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                        log.setState({ error: true });
                    });
                });
                material.bumpTexture = packedBumpTexture;
                material.useParallax = true;
                material.useParallaxOcclusion = true;
                material.parallaxScaleBias = -0.01;
            }
            log.setState({ done: true });
        }
        else {
            material.bumpTexture = bumpTexture;
        }
    }
}
exports.NormalDisplacementPacker = NormalDisplacementPacker;
//# sourceMappingURL=normal-displacement.js.map