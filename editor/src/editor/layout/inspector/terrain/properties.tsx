import { Component, ReactNode } from "react";

import { TerrainMesh } from "../../../nodes/terrain";
import { onNodeModifiedObservable } from "../../../../tools/observables";

import { EditorInspectorNumberField } from "../fields/number";
import { EditorInspectorSectionField } from "../fields/section";

import { IEditorInspectorImplementationProps } from "../inspector";

export class TerrainPropertiesInspector extends Component<IEditorInspectorImplementationProps<TerrainMesh>> {
	/**
	 * Renders the component
	 */
	public render(): ReactNode {
		const terrain = this.props.object;
		const metadata = terrain.metadata;

		// Create proxy object for easy binding
		const proxy = {
			width: metadata.width,
			depth: metadata.depth,
			subdivisions: metadata.subdivisions,
			minHeight: metadata.minHeight,
			maxHeight: metadata.maxHeight,
		};

		return (
			<EditorInspectorSectionField title="Terrain Properties">
				<EditorInspectorNumberField
					object={proxy}
					property="width"
					label="Width"
					step={1}
					min={1}
					max={10000}
					onChange={(value) => {
						metadata.width = value;
						this._regenerateTerrain();
					}}
				/>

				<EditorInspectorNumberField
					object={proxy}
					property="depth"
					label="Depth"
					step={1}
					min={1}
					max={10000}
					onChange={(value) => {
						metadata.depth = value;
						this._regenerateTerrain();
					}}
				/>

				<EditorInspectorNumberField
					object={proxy}
					property="subdivisions"
					label="Subdivisions"
					step={1}
					min={8}
					max={256}
					onChange={(value) => {
						metadata.subdivisions = value;
						this._regenerateTerrain();
					}}
				/>

				<EditorInspectorNumberField
					object={proxy}
					property="minHeight"
					label="Min Height"
					step={1}
					onChange={(value) => {
						metadata.minHeight = value;
						terrain.updateGeometry();
						onNodeModifiedObservable.notifyObservers(terrain);
					}}
				/>

				<EditorInspectorNumberField
					object={proxy}
					property="maxHeight"
					label="Max Height"
					step={1}
					onChange={(value) => {
						metadata.maxHeight = value;
						terrain.updateGeometry();
						onNodeModifiedObservable.notifyObservers(terrain);
					}}
				/>
			</EditorInspectorSectionField>
		);
	}

	/**
	 * Regenerates the terrain with new dimensions
	 */
	private _regenerateTerrain(): void {
		const terrain = this.props.object;
		const metadata = terrain.metadata;

		// Store old heightmap data
		const oldHeightmapData = terrain.exportHeightmapData();
		const oldSubdivisions = Math.sqrt(oldHeightmapData.length) - 1;

		// Create new heightmap with new dimensions
		const newSize = (metadata.subdivisions + 1) * (metadata.subdivisions + 1);
		const newHeightmapData = new Float32Array(newSize);

		// Fill with default height
		for (let i = 0; i < newSize; i++) {
			newHeightmapData[i] = metadata.minHeight;
		}

		// Try to preserve existing heightmap data if subdivisions changed
		if (oldSubdivisions !== metadata.subdivisions) {
			// Sample from old heightmap to new heightmap (simple nearest neighbor)
			for (let y = 0; y <= metadata.subdivisions; y++) {
				for (let x = 0; x <= metadata.subdivisions; x++) {
					const oldX = Math.floor((x / metadata.subdivisions) * oldSubdivisions);
					const oldY = Math.floor((y / metadata.subdivisions) * oldSubdivisions);
					const oldIndex = oldY * (oldSubdivisions + 1) + oldX;
					const newIndex = y * (metadata.subdivisions + 1) + x;

					if (oldIndex < oldHeightmapData.length) {
						newHeightmapData[newIndex] = oldHeightmapData[oldIndex];
					}
				}
			}
		}

		// Load new heightmap
		terrain.loadHeightmapData(newHeightmapData);

		onNodeModifiedObservable.notifyObservers(terrain);
		this.forceUpdate();
	}
}
