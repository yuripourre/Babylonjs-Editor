import { 
	AbstractMesh, 
	Color3, 
	Mesh, 
	Scene, 
	Vector3, 
	StandardMaterial, 
	VertexData
} from "babylonjs";

import { isMesh, isInstancedMesh } from "../../tools/guards/nodes";

export class Outline {
	private _scene: Scene;
	private _currentSelectedMesh: AbstractMesh | null = null;
	private _outlineMeshes: Mesh[] = [];
	private _outlineMaterials: StandardMaterial[] = [];
	private _originalRenderingGroups: Map<string, number> = new Map();

	/**
	 * The outline color.
	 */
	public outlineColor: Color3 = Color3.FromHexString("#446BAA");

	/**
	 * The outline scale factor.
	 */
	public outlineScale: number = 1.05;

	/**
	 * The rendering group ID for original meshes (higher than outline).
	 */
	public originalRenderingGroupId: number = 1;

	/**
	 * The rendering group ID for outline meshes (lower than original).
	 */
	public outlineRenderingGroupId: number = 0;

	constructor(scene: Scene) {
		this._scene = scene;
	}

	/**
	 * Sets the outline for the specified mesh using a vertex-based approach.
	 * @param mesh The mesh to outline, or null to clear the outline
	 */
	public setOutlineMesh(mesh: AbstractMesh | null): void {
		console.log('setOutlineMesh called with:', mesh?.name || 'null');
		
		// Clear previous outline
		this._clearOutline();

		// Set new outline
		if (mesh && isMesh(mesh)) {
			console.log('Creating vertex-based outline for mesh:', mesh.name);
			this._createOutlineForMesh(mesh);
		} else if (mesh) {
			console.log('Mesh is not a valid Mesh type:', mesh.constructor.name);
		}

		this._currentSelectedMesh = mesh;
	}

	/**
	 * Creates an outline mesh from the vertices of the original mesh.
	 * @param mesh The mesh to create an outline for
	 */
	private _createOutlineForMesh(mesh: Mesh): void {
		const effectiveMesh = isInstancedMesh(mesh) ? mesh.sourceMesh : mesh;

		if (!isMesh(effectiveMesh)) {
			return;
		}

		console.log(`Creating outline for mesh: ${effectiveMesh.name}`);

		// Store original rendering group
		this._originalRenderingGroups.set(effectiveMesh.id, effectiveMesh.renderingGroupId);
		
		// Set the original mesh to render in a higher group (on top)
		effectiveMesh.renderingGroupId = this.originalRenderingGroupId;
		
		// Create a new mesh for the outline using the original's vertices
		const outlineMesh = this._createOutlineMeshFromVertices(effectiveMesh);
		if (!outlineMesh) {
			console.error('Failed to create outline mesh');
			return;
		}

		// Configure the outline mesh
		this._configureOutlineMesh(outlineMesh, effectiveMesh);
		this._outlineMeshes.push(outlineMesh);

		// Handle LOD levels
		effectiveMesh.getLODLevels().forEach((lod) => {
			if (lod.mesh && isMesh(lod.mesh)) {
				console.log(`Creating outline for LOD mesh: ${lod.mesh.name}`);
				const lodOutline = this._createOutlineMeshFromVertices(lod.mesh);
				if (lodOutline) {
					this._configureOutlineMesh(lodOutline, lod.mesh);
					this._outlineMeshes.push(lodOutline);
					lod.mesh.renderingGroupId = this.originalRenderingGroupId;
				}
			}
		});
	}

	/**
	 * Creates a new mesh from the vertices of the source mesh.
	 * @param sourceMesh The source mesh to copy vertices from
	 * @returns A new mesh with the same vertices
	 */
	private _createOutlineMeshFromVertices(sourceMesh: Mesh): Mesh | null {
		// Create a new mesh
		const outlineMesh = new Mesh(`${sourceMesh.name}_outline_${Date.now()}`, this._scene);
		
		try {
			// Get vertex data from the source mesh
			const vertexData = VertexData.ExtractFromMesh(sourceMesh);
			
			// Apply vertex data to the new mesh
			vertexData.applyToMesh(outlineMesh);
			
			return outlineMesh;
		} catch (error) {
			console.error('Error creating outline mesh:', error);
			outlineMesh.dispose();
			return null;
		}
	}

	/**
	 * Creates a solid material for the outline mesh.
	 * @returns A new standard material configured for outline rendering
	 */
	private _createOutlineMaterial(): StandardMaterial {
		const material = new StandardMaterial(`outlineMaterial_${Date.now()}`, this._scene);
		
		// Configure for solid color with no lighting
		material.emissiveColor = this.outlineColor;
		material.diffuseColor = this.outlineColor;
		material.specularColor = Color3.Black();
		material.ambientColor = Color3.Black();
		
		// Disable lighting effects
		material.disableLighting = true;
		
		// Ensure outline is visible through other objects
		material.zOffset = -0.1;
		material.backFaceCulling = false;
		
		// Store for later cleanup
		this._outlineMaterials.push(material);
		
		return material;
	}

	/**
	 * Configures a mesh to act as an outline.
	 * @param outlineMesh The mesh to configure as outline
	 * @param originalMesh The original mesh to reference
	 */
	private _configureOutlineMesh(outlineMesh: Mesh, originalMesh: AbstractMesh): void {
		// Scale the outline mesh to be slightly larger than the original
		outlineMesh.scaling = new Vector3(
			this.outlineScale, 
			this.outlineScale, 
			this.outlineScale
		);
		
		// Parent the outline mesh to the original mesh for perfect synchronization
		outlineMesh.parent = originalMesh;

		// Set rendering properties - outline renders behind original mesh
		outlineMesh.renderingGroupId = this.outlineRenderingGroupId;
		
		// Apply the outline material
		outlineMesh.material = this._createOutlineMaterial();
		
		// Disable interactions and effects
		outlineMesh.receiveShadows = false;
		outlineMesh.checkCollisions = false;
		outlineMesh.isPickable = false;
		outlineMesh.doNotSyncBoundingInfo = true;
	}

	/**
	 * Clears all current outlines.
	 */
	private _clearOutline(): void {
		// Dispose outline meshes (parenting will be automatically cleared)
		this._outlineMeshes.forEach((mesh) => {
			mesh.dispose();
		});
		this._outlineMeshes.length = 0;
		
		// Dispose outline materials
		this._outlineMaterials.forEach((material) => {
			material.dispose();
		});
		this._outlineMaterials.length = 0;

		// Restore original rendering groups
		this._originalRenderingGroups.forEach((originalGroup, meshId) => {
			const mesh = this._scene.getMeshByID(meshId);
			if (mesh && isMesh(mesh)) {
				mesh.renderingGroupId = originalGroup;
			}
		});
		
		// Clear stored data
		this._originalRenderingGroups.clear();
		
		console.log('Cleared vertex-based outline');
	}

	/**
	 * Updates the outline color dynamically.
	 * @param color The new outline color
	 */
	public updateOutlineColor(color: Color3): void {
		this.outlineColor = color;
		
		// Update color for all outline materials
		this._outlineMaterials.forEach((material) => {
			material.emissiveColor = color;
			material.diffuseColor = color;
		});
	}

	/**
	 * Updates the outline scale dynamically.
	 * @param scale The new scale factor (e.g., 1.05 for 5% larger than original)
	 */
	public updateOutlineScale(scale: number): void {
		this.outlineScale = scale;
		
		// Update all outline meshes with new scale
		this._outlineMeshes.forEach((mesh) => {
			mesh.scaling = new Vector3(scale, scale, scale);
		});
	}

	/**
	 * Disposes of the outline system and cleans up resources.
	 */
	public dispose(): void {
		this._clearOutline();
		this._currentSelectedMesh = null;
	}

	/**
	 * Gets the currently outlined mesh.
	 */
	public get currentMesh(): AbstractMesh | null {
		return this._currentSelectedMesh;
	}
}
