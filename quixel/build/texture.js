"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTextures = setupTextures;
exports.copyTextures = copyTextures;
const posix_1 = require("path/posix");
const fs_extra_1 = require("fs-extra");
const sharp_1 = __importDefault(require("sharp"));
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
const mask_1 = require("./packers/mask");
const albedo_opacity_1 = require("./packers/albedo-opacity");
const metallic_ambient_1 = require("./packers/metallic-ambient");
const metallic_roughness_1 = require("./packers/metallic-roughness");
const normal_displacement_1 = require("./packers/normal-displacement");
const reflectivity_glossiness_1 = require("./packers/reflectivity-glossiness");
const supportedTexturesTypes = ["albedo", "normal", "specular", "ao", "metalness", "opacity", "roughness", "specular", "gloss", "translucency", "mask", "displacement"];
async function setupTextures(editor, json, material, assetsFolder) {
    if (!editor.state.projectPath) {
        return [];
    }
    const projectFolder = (0, posix_1.join)((0, posix_1.dirname)(editor.state.projectPath), "/");
    let albedoTexture = null;
    let opacityTexture = null;
    let reflectivityTexture = null;
    let microSurfaceTexture = null;
    let metallicTexture = null;
    let roughnessTexture = null;
    let bumpTexture = null;
    let displacementTexture = null;
    let aoTexture = null;
    let maskTexture = null;
    const components = json.components.concat(json.packedTextures ?? []).filter((c) => supportedTexturesTypes.indexOf(c.type) !== -1);
    const metallicRoughnessComponent = components.find((c) => c.type === "metalness" || c.type === "roughness");
    const promises = components.map(async (c) => {
        if ((c.type === "specular" || c.type === "gloss") && metallicRoughnessComponent) {
            return;
        }
        const path = (0, posix_1.join)(assetsFolder, c.name);
        let texture;
        try {
            texture = await new Promise((resolve, reject) => {
                const texture = new babylonjs_1.Texture(path, editor.layout.preview.scene, false, true, undefined, () => {
                    texture.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                    texture.name = path.replace(projectFolder, "");
                    texture.url = texture.name;
                    resolve(texture);
                }, (_, e) => {
                    texture.dispose();
                    reject(e);
                });
            });
        }
        catch (e) {
            return;
        }
        switch (c.type) {
            case "albedo":
                albedoTexture = texture;
                break;
            case "opacity":
                opacityTexture = texture;
                break;
            case "mask":
                maskTexture = texture;
                break;
            case "normal":
                bumpTexture = texture;
                break;
            case "displacement":
                displacementTexture = texture;
                break;
            case "specular":
                if (!metallicRoughnessComponent) {
                    reflectivityTexture = texture;
                }
                break;
            case "gloss":
                if (!metallicRoughnessComponent) {
                    microSurfaceTexture = texture;
                }
                break;
            case "metalness":
                metallicTexture = texture;
                break;
            case "roughness":
                roughnessTexture = texture;
                break;
            case "ao":
                aoTexture = texture;
                break;
            case "translucency":
                material.subSurface.isTranslucencyEnabled = true;
                material.subSurface.thicknessTexture = texture;
                material.subSurface.useMaskFromThicknessTexture = true;
                break;
        }
    });
    await Promise.all(promises);
    // Pack textures
    await Promise.all([
        albedo_opacity_1.AlbedoOpacityPacker.Pack(editor, material, albedoTexture, opacityTexture, assetsFolder),
        reflectivity_glossiness_1.ReflectivityGlossinessPacker.Pack(editor, material, reflectivityTexture, microSurfaceTexture, assetsFolder),
        metallic_roughness_1.MetallicRoughnessPacker.Pack(editor, material, metallicTexture, roughnessTexture, assetsFolder),
        normal_displacement_1.NormalDisplacementPacker.Pack(editor, material, bumpTexture, displacementTexture, assetsFolder),
    ]);
    // Pack ao with metal
    await metallic_ambient_1.MetallicAmbientPacker.Pack(editor, material, material.metallicTexture, aoTexture, assetsFolder);
    // Pack mask texture
    await mask_1.MaskPacker.Pack(editor, material, maskTexture, assetsFolder);
}
async function copyTextures(editor, json, assetsFolder) {
    const components = json.components.concat(json.packedTextures ?? []).filter((c) => supportedTexturesTypes.indexOf(c.type) !== -1);
    const promises = components.map(async (c) => {
        // Get mode
        let simpleCopy = false;
        if (c.type === "albedo") {
            simpleCopy = true;
        }
        if (c.type === "opacity") {
            simpleCopy = true;
        }
        // Simply copy?
        if (simpleCopy) {
            const path = (0, posix_1.join)(assetsFolder, c.name);
            await (0, fs_extra_1.copyFile)(c.path, path);
            return editor.layout.console.log(`Copied texture "${c.name}" at ${path}`);
        }
        // Check texture
        if (c.type === "specular" && json.components.find((c) => c.type === "roughness")) {
            return;
        }
        // Resize to lower resolution
        try {
            const buffer = await (0, sharp_1.default)(c.path).resize(1024, 1024).toBuffer();
            const path = (0, posix_1.join)(assetsFolder, c.name);
            await (0, fs_extra_1.writeFile)(path, buffer);
            editor.layout.console.log(`Copied resized texture "${c.name}" at ${path}`);
        }
        catch (e) {
            // Catch silently.
        }
    });
    await Promise.all(promises);
}
//# sourceMappingURL=texture.js.map