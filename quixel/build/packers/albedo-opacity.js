"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbedoOpacityPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class AlbedoOpacityPacker {
    /**
     * Packs the given albedo and opacity maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param albedoTexture defines the reference to the albedo texture.
     * @param opacityTexture defines the reference to the opacity texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, albedoTexture, opacityTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (albedoTexture && opacityTexture) {
            const log = await editor.layout.console.progress("Packing opacity texture in albedo texture alpha channel.");
            const packedAlbedoTexturePath = await textureMerger_1.TextureUtils.MergeTextures(albedoTexture, opacityTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));
            if (packedAlbedoTexturePath) {
                albedoTexture.dispose();
                opacityTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(albedoTexture.name)));
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(opacityTexture.name)));
                }
                catch (e) {
                    // Catch silently.
                }
                const packedAlbedoTexture = await new Promise((resolve, reject) => {
                    const texture = new babylonjs_1.Texture(packedAlbedoTexturePath, editor.layout.preview.scene, false, true, undefined, () => {
                        texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                        texture.name = packedAlbedoTexturePath.replace(projectFolder, "");
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                        log.setState({ error: true });
                    });
                });
                material.albedoTexture = packedAlbedoTexture;
                packedAlbedoTexture.hasAlpha = true;
                material.useAlphaFromAlbedoTexture = true;
            }
            log.setState({ done: true });
        }
        else {
            if (albedoTexture) {
                material.albedoTexture = albedoTexture;
            }
            if (opacityTexture) {
                material.opacityTexture = opacityTexture;
                opacityTexture.getAlphaFromRGB = true;
            }
        }
    }
}
exports.AlbedoOpacityPacker = AlbedoOpacityPacker;
//# sourceMappingURL=albedo-opacity.js.map