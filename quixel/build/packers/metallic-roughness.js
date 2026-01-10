"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetallicRoughnessPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class MetallicRoughnessPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param metallicTexture defines the reference to the metallic texture.
     * @param roughnessTexture defines the reference to the roughness texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, metallicTexture, roughnessTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (metallicTexture && roughnessTexture) {
            const log = await editor.layout.console.progress("Packing roughness texture in metallic texture green channel.");
            const packedMetallicTexturePath = await textureMerger_1.TextureUtils.MergeTextures(metallicTexture, roughnessTexture, rootFolder, (color1, color2) => ({
                r: 0,
                g: color2.r,
                b: color1.r,
                a: 255,
            }));
            if (packedMetallicTexturePath) {
                metallicTexture.dispose();
                roughnessTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(metallicTexture.name)));
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(roughnessTexture.name)));
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
                material.metallic = 1;
                material.roughness = 1;
                material.useRoughnessFromMetallicTextureAlpha = false;
                material.useRoughnessFromMetallicTextureGreen = true;
                material.useMetallnessFromMetallicTextureBlue = true;
            }
            log.setState({ done: true });
        }
        else if (metallicTexture) {
            material.metallicTexture = metallicTexture;
            material.metallic = 1;
            material.roughness = 0;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = false;
            material.useMetallnessFromMetallicTextureBlue = true;
        }
        else if (roughnessTexture) {
            material.metallicTexture = roughnessTexture;
            material.metallic = 0;
            material.roughness = 1;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = true;
            material.useMetallnessFromMetallicTextureBlue = false;
        }
    }
}
exports.MetallicRoughnessPacker = MetallicRoughnessPacker;
//# sourceMappingURL=metallic-roughness.js.map