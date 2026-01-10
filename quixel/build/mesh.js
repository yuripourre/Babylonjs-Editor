"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importMeshes = importMeshes;
exports.saveMeshesAsBabylonFormat = saveMeshesAsBabylonFormat;
const posix_1 = require("path/posix");
const fs_extra_1 = require("fs-extra");
const babylonjs_1 = require("babylonjs");
const babylonjs_editor_1 = require("babylonjs-editor");
async function importMeshes(editor, lodList) {
    if (!editor.state.projectPath) {
        return [];
    }
    const results = await Promise.all(lodList
        .filter((lod) => lod.lod !== "high")
        .map(async (lod) => {
        const path = lod.path.replace(/\\/g, "/");
        return editor.layout.preview.importSceneFile(path, false);
    }));
    if (!results.length) {
        return [];
    }
    const sourceMeshes = results[0]?.meshes;
    if (!sourceMeshes) {
        return [];
    }
    sourceMeshes.forEach((mesh) => {
        mesh.id = babylonjs_1.Tools.RandomId();
        mesh.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
    });
    results[0].transformNodes.forEach((transformNode) => transformNode.dispose(true, false));
    for (let i = 1; i < results.length; ++i) {
        const result = results[i];
        if (!result) {
            continue;
        }
        result.meshes.forEach((mesh, lodIndex) => {
            mesh.id = babylonjs_1.Tools.RandomId();
            mesh.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
            if (!(0, babylonjs_editor_1.isMesh)(mesh)) {
                return;
            }
            const sourceMesh = sourceMeshes[lodIndex];
            if (!sourceMesh || !(0, babylonjs_editor_1.isMesh)(sourceMesh)) {
                return;
            }
            sourceMesh.addLODLevel(600 * i, mesh);
        });
        result.transformNodes.forEach((transformNode) => transformNode.dispose(true, false));
    }
    return results[0].meshes;
}
async function saveMeshesAsBabylonFormat(editor, meshes, assetFolder, variation) {
    await Promise.all(meshes.map(async (mesh) => {
        if (mesh._masterMesh) {
            return;
        }
        try {
            const json = babylonjs_1.SceneSerializer.SerializeMesh(mesh, false, false);
            json.materials = [];
            json.multiMaterials = [];
            const jsonMesh = json.meshes[0];
            jsonMesh.lodMeshIds = [];
            jsonMesh.lodDistances = [];
            jsonMesh.lodCoverages = [];
            mesh.id = babylonjs_1.Tools.RandomId();
            mesh.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
            for (const lod of mesh.getLODLevels()) {
                if (lod.mesh) {
                    const lodJson = babylonjs_1.SceneSerializer.SerializeMesh(lod.mesh, false, false);
                    json.meshes.push(...lodJson.meshes);
                    json.geometries.vertexData.push(...lodJson.geometries.vertexData);
                    jsonMesh.lodMeshIds.push(lod.mesh.id);
                    jsonMesh.lodDistances.push(lod.distanceOrScreenCoverage);
                    jsonMesh.lodCoverages.push(lod.distanceOrScreenCoverage);
                    lod.mesh.id = babylonjs_1.Tools.RandomId();
                    lod.mesh.uniqueId = babylonjs_editor_1.UniqueNumber.Get();
                }
            }
            const firstMesh = json.meshes.shift();
            json.meshes.push(firstMesh);
            await (0, fs_extra_1.writeJson)((0, posix_1.join)(assetFolder, `${mesh.name}${variation ?? ""}.babylon`), json);
            editor.layout.console.log(`Successfully saved mesh as Babylon format: ${mesh.name}${variation ?? ""}.babylon`);
        }
        catch (e) {
            // Catch silently.
        }
    }));
}
//# sourceMappingURL=mesh.js.map