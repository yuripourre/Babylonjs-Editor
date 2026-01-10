"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importMaterial = importMaterial;
exports.importMaterialTextures = importMaterialTextures;
const fs_extra_1 = require("fs-extra");
const posix_1 = require("path/posix");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const texture_1 = require("./texture");
async function importMaterial(editor, json, assetsFolder) {
    const material = new babylonjs_1.PBRMaterial((0, posix_1.basename)(json.path), editor.layout.preview.scene);
    material.id = babylonjs_1.Tools.RandomId();
    material.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
    material.invertNormalMapX = true;
    material.invertNormalMapY = true;
    importMaterialTextures(editor, json, assetsFolder, material);
    return material;
}
async function importMaterialTextures(editor, json, assetsFolder, material) {
    if (!editor.state.projectPath) {
        return null;
    }
    await (0, texture_1.copyTextures)(editor, json, assetsFolder);
    await (0, texture_1.setupTextures)(editor, json, material, assetsFolder);
    await (0, fs_extra_1.writeJSON)((0, posix_1.join)(assetsFolder, `${(0, posix_1.basename)(assetsFolder)}.material`), material.serialize(), {
        spaces: "\t",
        encoding: "utf-8",
    });
}
//# sourceMappingURL=material.js.map