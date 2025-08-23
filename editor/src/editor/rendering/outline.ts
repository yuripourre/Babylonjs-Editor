import { AbstractMesh, Color3, Mesh, Scene, StandardMaterial, Vector3, Material } from "babylonjs";

import { isMesh, isInstancedMesh } from "../../tools/guards/nodes";

export class Outline {
	private _outlineMeshes: Mesh[] = [];
	private _outlineMaterial: StandardMaterial;
	private _currentSelectedMesh: AbstractMesh | null = null;
	private _originalMaterials: Map<string, Material | null> = new Map();
	private _originalRenderingGroups: Map<string, number> = new Map();

	/**
	 * The outline color.
	 */
	public outlineColor: Color3 = Color3.FromHexString("#446BAA");

	/**
	 * The outline thickness (scale factor).
	 */
	public outlineThickness: number = 1.03; // 3% larger than original

	/**
	 * The rendering group ID for outline meshes.
	 */
	public renderingGroupId: number = 0; // Same group as original meshes

	constructor(scene: Scene) {
		// Create outline material - solid color
		this._outlineMaterial = new StandardMaterial(`outlineMaterial_${Date.now()}`, scene);
		this._outlineMaterial.diffuseColor = this.outlineColor;
		this._outlineMaterial.emissiveColor = this.outlineColor;
		this._outlineMaterial.disableLighting = true;
		this._outlineMaterial.wireframe = false;
		this._outlineMaterial.backFaceCulling = false;
		this._outlineMaterial.zOffset = -0.5; // Negative zOffset to ensure it renders behind
		this._outlineMaterial.alpha = 1.0;
		this._outlineMaterial.freeze();
	}

	/**
	 * Sets the outline for the specified mesh using the edge detection technique.
	 * @param mesh The mesh to outline, or null to clear the outline
	 */
	public setOutlineMesh(mesh: AbstractMesh | null): void {
		console.log('setOutlineMesh called with:', mesh?.name || 'null');
		
		// Clear previous outline
		this._clearOutline();

		// Set new outline
		if (mesh && isMesh(mesh)) {
			console.log('Creating outline for mesh:', mesh.name);
			this._createOutlineForMesh(mesh);
		} else if (mesh) {
			console.log('Mesh is not a valid Mesh type:', mesh.constructor.name);
		}

		this._currentSelectedMesh = mesh;
	}

	/**
	 * Creates an outline using the clone mesh technique.
	 * @param mesh The mesh to create an outline for
	 */
	private _createOutlineForMesh(mesh: Mesh): void {
		const effectiveMesh = isInstancedMesh(mesh) ? mesh.sourceMesh : mesh;

		if (!isMesh(effectiveMesh)) {
			return;
		}

		console.log(`Creating outline for mesh: ${effectiveMesh.name}`);

		// Store original rendering group and material
		this._originalRenderingGroups.set(effectiveMesh.id, effectiveMesh.renderingGroupId);
		this._originalMaterials.set(effectiveMesh.id, effectiveMesh.material);
		
		// Set the original mesh to render in group 1 (after outline)
		effectiveMesh.renderingGroupId = 1;

		// Clone the mesh for outline
		const outlineMesh = effectiveMesh.clone(`${effectiveMesh.name}_outline`, null, false);
		if (!outlineMesh) {
			console.error('Failed to clone mesh for outline');
			return;
		}

		// Configure the outline mesh
		this._configureOutlineMesh(outlineMesh, effectiveMesh);
		this._outlineMeshes.push(outlineMesh);

		// Handle LOD levels
		effectiveMesh.getLODLevels().forEach((lod) => {
			if (lod.mesh && isMesh(lod.mesh)) {
				console.log(`Creating outline for LOD mesh: ${lod.mesh.name}`);
				const lodOutline = lod.mesh.clone(`${lod.mesh.name}_outline`, null, false);
				if (lodOutline) {
					this._configureOutlineMesh(lodOutline, lod.mesh);
					this._outlineMeshes.push(lodOutline);
				}
			}
		});
	}
	/**
	 * Configures a cloned mesh to act as an outline.
	 * @param outlineMesh The cloned mesh to configure as outline
	 * @param originalMesh The original mesh to reference
	 */
	private _configureOutlineMesh(outlineMesh: Mesh, originalMesh: AbstractMesh): void {
		// Copy transforms
		outlineMesh.position = originalMesh.position.clone();
		outlineMesh.rotation = originalMesh.rotation.clone();
		outlineMesh.scaling = originalMesh.scaling.clone().multiplyInPlace(new Vector3(this.outlineThickness, this.outlineThickness, this.outlineThickness));

		// Apply outline material
		outlineMesh.material = this._outlineMaterial;
        outlineMesh.setParent(originalMesh);

		// Set rendering properties - CRITICAL: render in group 0 (BEFORE original)
		outlineMesh.renderingGroupId = 0;
		
		// Disable interactions and effects
		outlineMesh.receiveShadows = false;
		outlineMesh.checkCollisions = false;
		outlineMesh.isPickable = false;
		outlineMesh.doNotSyncBoundingInfo = true;

		// Create a unique name to avoid conflicts
		outlineMesh.name = `${originalMesh.name}_outline_${Date.now()}`;
		outlineMesh.id = `${originalMesh.id}_outline_${Date.now()}`;
	}

	/**
	 * Clears all current outlines.
	 */
	private _clearOutline(): void {
		// Dispose outline meshes
		this._outlineMeshes.forEach((mesh) => {
			mesh.dispose();
		});
		this._outlineMeshes.length = 0;
		
		// Restore original materials and rendering groups
		if (this._currentSelectedMesh) {
			const id = this._currentSelectedMesh.id;
			if (this._originalRenderingGroups.has(id)) {
				this._currentSelectedMesh.renderingGroupId = this._originalRenderingGroups.get(id) || 0;
				this._originalRenderingGroups.delete(id);
			}
		}
		this._originalMaterials.clear();
	}

	/**
	 * Updates the outline color dynamically.
	 * @param color The new outline color
	 */
	public updateOutlineColor(color: Color3): void {
		this.outlineColor = color;
		if (this._outlineMaterial) {
			this._outlineMaterial.diffuseColor = color;
			this._outlineMaterial.emissiveColor = color;
		}
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
	 * Disposes of the outline system and cleans up resources.
	 */
	public dispose(): void {
		this._clearOutline();
		if (this._outlineMaterial) {
			this._outlineMaterial.dispose();
		}
		this._currentSelectedMesh = null;
	}

	/**
	 * Gets the currently outlined mesh.
	 */
	public get currentMesh(): AbstractMesh | null {
		return this._currentSelectedMesh;
	}
}
