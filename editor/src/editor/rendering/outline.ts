import { AbstractMesh, Color3, Mesh, Scene, StandardMaterial, Vector3 } from "babylonjs";

import { isMesh, isInstancedMesh } from "../../tools/guards/nodes";

/**
 * Perfect outline class using two-pass rendering technique.
 * This creates flawless outlines without missing pixels by cloning and scaling meshes.
 */
export class Outline {
	private _scene: Scene;
	private _outlineMeshes: Mesh[] = [];
	private _outlineMaterial: StandardMaterial;
	private _currentSelectedMesh: AbstractMesh | null = null;

	/**
	 * The outline color.
	 */
	public outlineColor: Color3 = Color3.FromHexString("#FF6B35");

	/**
	 * The outline thickness (scale factor).
	 */
	public outlineThickness: number = 1.02; // 2% larger than original

	/**
	 * The rendering group ID for outline meshes.
	 */
	public renderingGroupId: number = 1; // Separate group, renders after group 0

	constructor(scene: Scene) {
		this._scene = scene;
		
		// Create outline material - use wireframe for clean edges
		this._outlineMaterial = new StandardMaterial(`outlineMaterial_${Date.now()}`, this._scene);
		this._outlineMaterial.diffuseColor = this.outlineColor;
		this._outlineMaterial.emissiveColor = this.outlineColor;
		this._outlineMaterial.disableLighting = true;
		this._outlineMaterial.wireframe = true; // Use wireframe for clean outline
		this._outlineMaterial.freeze(); // Optimize performance
	}

	/**
	 * Sets the perfect outline for the specified mesh using two-pass rendering.
	 * @param mesh The mesh to outline, or null to clear the outline
	 */
	public setOutlineMesh(mesh: AbstractMesh | null): void {
		console.log('setOutlineMesh called with:', mesh?.name || 'null');
		
		// Clear previous outline
		this._clearOutline();

		// Set new outline
		if (mesh && isMesh(mesh)) {
			console.log('Creating perfect outline for mesh:', mesh.name);
			this._createPerfectOutlineForMesh(mesh);
		} else if (mesh) {
			console.log('Mesh is not a valid Mesh type:', mesh.constructor.name);
		}

		this._currentSelectedMesh = mesh;
	}

	/**
	 * Creates a perfect outline using the two-pass rendering technique.
	 * @param mesh The mesh to create an outline for
	 */
	private _createPerfectOutlineForMesh(mesh: Mesh): void {
		const effectiveMesh = isInstancedMesh(mesh) ? mesh.sourceMesh : mesh;

		if (!isMesh(effectiveMesh)) {
			return;
		}

		// Ensure original mesh renders in group 0 (before outline)
		effectiveMesh.renderingGroupId = 0;

		console.log(`Creating perfect outline for mesh: ${effectiveMesh.name}, thickness: ${this.outlineThickness}`);

		// Clone the mesh for outline
		const outlineMesh = effectiveMesh.clone(`${effectiveMesh.name}_perfect_outline`);
		if (!outlineMesh) {
			console.error('Failed to clone mesh for outline');
			return;
		}

		// Configure the outline mesh
		this._configurePerfectOutlineMesh(outlineMesh, effectiveMesh);
		this._outlineMeshes.push(outlineMesh);

		// Handle LOD levels
		effectiveMesh.getLODLevels().forEach((lod) => {
			if (lod.mesh && isMesh(lod.mesh)) {
				console.log(`Creating perfect outline for LOD mesh: ${lod.mesh.name}`);
				const lodOutline = lod.mesh.clone(`${lod.mesh.name}_perfect_outline`);
				if (lodOutline) {
					this._configurePerfectOutlineMesh(lodOutline, effectiveMesh);
					this._outlineMeshes.push(lodOutline);
				}
			}
		});
	}

	/**
	 * Configures a cloned mesh to act as a perfect outline.
	 * @param outlineMesh The cloned mesh to configure as outline
	 * @param originalMesh The original mesh to parent to
	 */
	private _configurePerfectOutlineMesh(outlineMesh: Mesh, originalMesh: AbstractMesh): void {
		// Copy world matrix instead of parenting to avoid transform conflicts
		outlineMesh.position = originalMesh.getAbsolutePosition().clone();
		outlineMesh.rotation = originalMesh.rotation.clone();
		outlineMesh.scaling = originalMesh.scaling.clone().multiplyInPlace(new Vector3(this.outlineThickness, this.outlineThickness, this.outlineThickness));

		// Apply outline material
		outlineMesh.material = this._outlineMaterial;

		// Set rendering properties - render in group 1 (after group 0)
		outlineMesh.renderingGroupId = this.renderingGroupId;
		
		// Disable interactions and effects
		outlineMesh.receiveShadows = false;
		outlineMesh.checkCollisions = false;
		outlineMesh.isPickable = false; // Don't interfere with picking
		outlineMesh.doNotSyncBoundingInfo = true; // Don't affect bounding calculations

		// Create a unique name to avoid conflicts
		outlineMesh.name = `${originalMesh.name}_outline_${Date.now()}`;
		outlineMesh.id = `${originalMesh.id}_outline_${Date.now()}`;
	}

	/**
	 * Clears all current outline meshes.
	 */
	private _clearOutline(): void {
		this._outlineMeshes.forEach((mesh) => {
			mesh.dispose();
		});
		this._outlineMeshes.length = 0;
	}

	/**
	 * Updates the outline color dynamically.
	 * @param color The new outline color
	 */
	public updateOutlineColor(color: Color3): void {
		this.outlineColor = color;
		this._outlineMaterial.diffuseColor = color;
		this._outlineMaterial.emissiveColor = color;
	}

	/**
	 * Updates the outline thickness dynamically.
	 * @param thickness The new outline thickness (scale factor)
	 */
	public updateOutlineThickness(thickness: number): void {
		this.outlineThickness = thickness;
		if (this._currentSelectedMesh && isMesh(this._currentSelectedMesh)) {
			this._outlineMeshes.forEach((mesh) => {
				const originalScaling = this._currentSelectedMesh!.scaling.clone();
				mesh.scaling = originalScaling.multiplyInPlace(new Vector3(thickness, thickness, thickness));
			});
		}
	}

	/**
	 * Updates the outline position to match the original mesh.
	 * Call this if the original mesh has moved.
	 */
	public updateOutlinePosition(): void {
		if (this._currentSelectedMesh && isMesh(this._currentSelectedMesh)) {
			this._outlineMeshes.forEach((mesh) => {
				mesh.position = this._currentSelectedMesh!.getAbsolutePosition().clone();
				mesh.rotation = this._currentSelectedMesh!.rotation.clone();
				const originalScaling = this._currentSelectedMesh!.scaling.clone();
				mesh.scaling = originalScaling.multiplyInPlace(new Vector3(this.outlineThickness, this.outlineThickness, this.outlineThickness));
			});
		}
	}

	/**
	 * Disposes of the outline system and cleans up resources.
	 */
	public dispose(): void {
		this._clearOutline();
		this._outlineMaterial.dispose();
		this._currentSelectedMesh = null;
	}

	/**
	 * Gets the currently outlined mesh.
	 */
	public get currentMesh(): AbstractMesh | null {
		return this._currentSelectedMesh;
	}
}
