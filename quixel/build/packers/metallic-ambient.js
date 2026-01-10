"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetallicAmbientPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class MetallicAmbientPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param metallicTexture defines the reference to the metallic texture.
     * @param roughnessTexture defines the reference to the roughness texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, metallicTexture, ambientTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (metallicTexture && ambientTexture) {
            const log = await editor.layout.console.progress("Packing ambient texture in metallic texture red channel.");
            const packedMetallicTexturePath = await textureMerger_1.TextureUtils.MergeTextures(metallicTexture, ambientTexture, rootFolder, (color1, color2) => ({
                r: color2.r,
                g: color1.g,
                b: color1.b,
                a: color1.a,
            }));
            if (packedMetallicTexturePath) {
                metallicTexture.dispose();
                ambientTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(ambientTexture.name)));
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(metallicTexture.name)));
                }
                catch (e) {
                    // Catch silently.
                }
                const packedMetallicTexture = await new Promise((resolve, reject) => {
                    const texture = new babylonjs_1.Texture(packedMetallicTexturePath, editor.layout.preview.scene, false, true, undefined, () => {
                        texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                        texture.name = packedMetallicTexturePath.replace(projectFolder, "");
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                        log.setState({ error: true });
                    });
                });
                material.metallicTexture = packedMetallicTexture;
                material.useAmbientOcclusionFromMetallicTextureRed = true;
            }
            log.setState({ done: true });
        }
        else {
            material.ambientTexture = ambientTexture;
        }
    }
}
exports.MetallicAmbientPacker = MetallicAmbientPacker;
//# sourceMappingURL=metallic-ambient.js.map