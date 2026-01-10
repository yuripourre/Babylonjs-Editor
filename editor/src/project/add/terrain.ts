import { Node, Tools } from "babylonjs";

import { Editor } from "../../editor/main";
import { TerrainMesh, TerrainLayer } from "../../editor/nodes/terrain";

import { configureAddedMesh } from "./configure";

/**
 * Adds a new terrain mesh to the scene
 * @param editor The editor instance
 * @param parent Optional parent node
 * @returns The created terrain mesh
 */
export function addTerrain(editor: Editor, parent?: Node): TerrainMesh | undefined {
	const terrain = new TerrainMesh("New Terrain", editor.layout.preview.scene, {
		width: 1024,
		depth: 1024,
		subdivisions: 64,
		minHeight: 0,
		maxHeight: 100,
	});

	// Create default layer
	const defaultLayer: TerrainLayer = {
		id: Tools.RandomId(),
		name: "Base Layer",
		diffuseTexture: "",
		normalTexture: "",
		roughness: 1,
		metallic: 0,
		tileSize: 10,
		blendMapChannel: 0,
	};

	terrain.metadata.layers.push(defaultLayer);

	return configureAddedMesh(editor, terrain, parent) as TerrainMesh;
}
