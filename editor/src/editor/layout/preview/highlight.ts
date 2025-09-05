import { AbstractMesh, Color3 } from "babylonjs";

import { Tween } from "../../../tools/animation/tween";
import { isInstancedMesh, isMesh } from "../../../tools/guards/nodes";

/**
 * Manages highlighting functionality for the preview component.
 * Handles highlighting meshes under the pointer and restoring their original state.
 */
export class HighlightManager {
	private _meshUnderPointer: AbstractMesh | null = null;

	/**
	 * Gets the currently highlighted mesh under the pointer.
	 */
	public get meshUnderPointer(): AbstractMesh | null {
		return this._meshUnderPointer;
	}

	/**
	 * Sets the mesh under the pointer.
	 */
	public set meshUnderPointer(mesh: AbstractMesh | null) {
		this._meshUnderPointer = mesh;
	}

	/**
	 * Highlights the given mesh under the pointer.
	 * @param pickedMesh The mesh to highlight
	 */
	public highlightCurrentMeshUnderPointer(pickedMesh: AbstractMesh): void {
		Tween.killTweensOf(pickedMesh);

		const effectiveMesh = isInstancedMesh(pickedMesh) ? pickedMesh.sourceMesh : pickedMesh;

		const meshes = [effectiveMesh];

		if (isMesh(effectiveMesh)) {
			effectiveMesh.getLODLevels().forEach((lod) => {
				if (lod.mesh) {
					meshes.push(lod.mesh);
				}
			});
		}

		meshes.forEach((mesh) => {
			Tween.create(mesh, 0.1, {
				overlayAlpha: 0.5,
				overlayColor: Color3.Black(),
				onStart: () => (mesh!.renderOverlay = true),
			});
		});
	}

	/**
	 * Restores the currently highlighted mesh to its original state.
	 */
	public restoreCurrentMeshUnderPointer(): void {
		const mesh = this._meshUnderPointer;

		if (mesh) {
			const effectiveMesh = isInstancedMesh(mesh) ? mesh.sourceMesh : mesh;

			const meshes = [effectiveMesh];

			if (isMesh(effectiveMesh)) {
				effectiveMesh.getLODLevels().forEach((lod) => {
					if (lod.mesh) {
						meshes.push(lod.mesh);
					}
				});
			}

			meshes.forEach((mesh) => {
				Tween.killTweensOf(mesh);

				mesh.overlayAlpha ??= 0;
				mesh.overlayColor ??= Color3.Black();

				Tween.create(mesh, 0.1, {
					overlayAlpha: 0,
					overlayColor: Color3.Black(),
					onStart: () => (mesh.renderOverlay = true),
				});
			});
		}
	}

	/**
	 * Clears the current mesh under pointer without restoring its state.
	 * This is useful when the mouse leaves the canvas.
	 */
	public clearMeshUnderPointer(): void {
		this._meshUnderPointer = null;
	}
}
