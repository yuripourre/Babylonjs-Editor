"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReflectivityGlossinessPacker = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const textureMerger_1 = require("../tools/textureMerger");
class ReflectivityGlossinessPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param reflectivityTexture defines the reference to the reflectivity texture.
     * @param microSurfaceTexture defines the reference to the microsurface texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static async Pack(editor, material, reflectivityTexture, microSurfaceTexture, rootFolder) {
        if (!editor.state.projectPath) {
            return;
        }
        const projectFolder = (0, path_1.join)((0, path_1.dirname)(editor.state.projectPath), "/");
        if (reflectivityTexture && microSurfaceTexture) {
            const log = await editor.layout.console.progress("Packing micro surface texture in reflectivity texture alpha channel.");
            const packedReflectivityTexturePath = await textureMerger_1.TextureUtils.MergeTextures(reflectivityTexture, microSurfaceTexture, rootFolder, (color1, color2) => ({
                r: color1.r,
                g: color1.g,
                b: color1.b,
                a: color2.r,
            }));
            if (packedReflectivityTexturePath) {
                reflectivityTexture.dispose();
                microSurfaceTexture.dispose();
                try {
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(reflectivityTexture.name)));
                    await (0, fs_extra_1.remove)((0, path_1.join)(rootFolder, (0, path_1.basename)(microSurfaceTexture.name)));
                }
                catch (e) {
                    // Catch silently.
                }
                const packedReflectivityTexture = await new Promise((resolve, reject) => {
                    const texture = new babylonjs_1.Texture(packedReflectivityTexturePath, editor.layout.preview.scene, false, true, undefined, () => {
                        texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                        texture.name = packedReflectivityTexturePath.replace(projectFolder, "");
                        texture.url = texture.name;
                        resolve(texture);
                    }, (_, e) => {
                        reject(e);
                        log.setState({ error: true });
                    });
                });
                material.reflectivityTexture = packedReflectivityTexture;
                material.useMicroSurfaceFromReflectivityMapAlpha = true;
            }
            log.setState({ done: true });
        }
        else {
            material.reflectivityTexture = reflectivityTexture;
            material.microSurfaceTexture = microSurfaceTexture;
        }
    }
}
exports.ReflectivityGlossinessPacker = ReflectivityGlossinessPacker;
//# sourceMappingURL=reflectivity-glossiness.js.map