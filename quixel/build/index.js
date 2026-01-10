"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.description = exports.title = void 0;
exports.main = main;
exports.close = close;
const net_1 = require("net");
const fs_extra_1 = require("fs-extra");
const posix_1 = require("path/posix");
const material_1 = require("./material");
const mesh_1 = require("./mesh");
exports.title = "Quixel Bridge";
exports.description = "Quixel Bridge integration for Babylon.js Editor";
let server = null;
function main(editor) {
    createRootFolder(editor);
    server = new net_1.Server((s) => {
        handeServerEvents(editor, s);
    });
    server.listen(24981);
}
function close() {
    try {
        server?.close();
    }
    catch (e) {
        // Catch silently
    }
    finally {
        server = null;
    }
}
function handeServerEvents(editor, socket) {
    let buffer = null;
    socket.on("data", (d) => {
        if (!buffer) {
            buffer = Buffer.from(d);
        }
        else {
            buffer = Buffer.concat([buffer, d]);
        }
    });
    socket.on("end", async () => {
        if (!buffer) {
            return;
        }
        try {
            const data = JSON.parse(buffer.toString("utf-8"));
            data.forEach((json) => {
                handleParsedAsset(editor, json);
            });
        }
        catch (e) {
            editor.layout.console.error("Failed to parse quixel JSON.");
        }
        buffer = null;
    });
}
async function createRootFolder(editor) {
    if (!editor.state.projectPath) {
        return;
    }
    const assetsFolder = (0, posix_1.join)((0, posix_1.dirname)(editor.state.projectPath), "assets");
    if (!(await (0, fs_extra_1.pathExists)(assetsFolder))) {
        await (0, fs_extra_1.mkdir)(assetsFolder);
    }
    const quixelFolder = (0, posix_1.join)(assetsFolder, "quixel");
    if (!(await (0, fs_extra_1.pathExists)(quixelFolder))) {
        await (0, fs_extra_1.mkdir)(quixelFolder);
    }
}
async function handleParsedAsset(editor, json) {
    if (!editor.state.projectPath) {
        return;
    }
    json.path = json.path.replace(/\\/g, "/");
    // Create folders
    const quixelFolder = (0, posix_1.join)((0, posix_1.dirname)(editor.state.projectPath), "assets", "quixel");
    const assetFolder = (0, posix_1.join)(quixelFolder, (0, posix_1.basename)(json.path));
    if (!(await (0, fs_extra_1.pathExists)(assetFolder))) {
        await (0, fs_extra_1.mkdir)(assetFolder);
    }
    const material = await (0, material_1.importMaterial)(editor, json, assetFolder);
    switch (json.type) {
        case "3d":
            await handleParse3d(editor, json, assetFolder, material);
            break;
        case "3dplant":
            await handleImport3dPlant(editor, json, assetFolder, material);
            break;
    }
    // Write preview for folder
    if (json.previewImage) {
        const extension = (0, posix_1.extname)(json.previewImage);
        await (0, fs_extra_1.copyFile)(json.previewImage, (0, posix_1.join)(assetFolder, `editor_preview${extension}`));
    }
    editor.layout.graph.refresh();
    editor.layout.assets.refresh();
}
async function handleParse3d(editor, json, assetFolder, material) {
    const meshes = await (0, mesh_1.importMeshes)(editor, json.lodList);
    meshes.forEach((mesh) => {
        mesh.material = material;
        mesh.getLODLevels().forEach((lodLevel) => {
            if (lodLevel.mesh) {
                lodLevel.mesh.material = material;
            }
        });
    });
    (0, mesh_1.saveMeshesAsBabylonFormat)(editor, meshes, assetFolder);
}
async function handleImport3dPlant(editor, json, assetFolder, material) {
    const variationsMap = new Map();
    json.lodList.forEach((lod) => {
        if (lod.variation === undefined) {
            return;
        }
        let variations = variationsMap.get(lod.variation);
        if (!variations) {
            variations = [lod];
            variationsMap.set(lod.variation, variations);
        }
        else {
            variations.push(lod);
        }
    });
    for (const [variation, lodList] of variationsMap) {
        const meshes = await (0, mesh_1.importMeshes)(editor, lodList);
        meshes.forEach((mesh) => {
            mesh.material = material;
            mesh.getLODLevels().forEach((lodLevel) => {
                if (lodLevel.mesh) {
                    lodLevel.mesh.material = material;
                }
            });
        });
        (0, mesh_1.saveMeshesAsBabylonFormat)(editor, meshes, assetFolder, variation);
    }
}
//# sourceMappingURL=index.js.map