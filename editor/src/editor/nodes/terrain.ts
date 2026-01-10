import {
	CreateGroundVertexData,
	DynamicTexture,
	Geometry,
	Mesh,
	Node,
	Scene,
	serialize,
	StandardMaterial,
	Tools,
	VertexBuffer,
	VertexData,
} from "babylonjs";

import { UniqueNumber } from "../../tools/tools";

export interface TerrainLayer {
	id: string;
	name: string;
	diffuseTexture: string;
	normalTexture?: string;
	roughness: number;
	metallic: number;
	tileSize: number;
	blendMapChannel: 0 | 1 | 2 | 3;
}

export interface TerrainMetadata {
	type: "Terrain";
	width: number;
	depth: number;
	subdivisions: number;
	minHeight: number;
	maxHeight: number;
	heightMapPath: string | null;
	layers: TerrainLayer[];
	lodLevels: number[];
	blendMapPaths: string[];
}

export interface TerrainOptions {
	width?: number;
	depth?: number;
	subdivisions?: number;
	minHeight?: number;
	maxHeight?: number;
	heightmapData?: Float32Array | null;
}

export class TerrainMesh extends Mesh {
	@serialize()
	public declare metadata: TerrainMetadata;

	public _heightmapData: Float32Array;
	public _blendMaps: DynamicTexture[] = [];

	/**
	 * Constructor
	 * @param name The value used by scene.getMeshByName() to do a lookup.
	 * @param scene The scene to add this mesh to.
	 * @param options Configuration options for terrain creation
	 */
	public constructor(name: string, scene: Scene, options: TerrainOptions = {}) {
		super(name, scene);

		this.id = Tools.RandomId();
		this.uniqueId = UniqueNumber.Get();

		const width = options.width ?? 1024;
		const depth = options.depth ?? 1024;
		const subdivisions = options.subdivisions ?? 64;
		const minHeight = options.minHeight ?? 0;
		const maxHeight = options.maxHeight ?? 100;

		// Initialize metadata
		this.metadata = {
			type: "Terrain",
			width,
			depth,
			subdivisions,
			minHeight,
			maxHeight,
			heightMapPath: null,
			layers: [],
			lodLevels: [200, 400, 800],
			blendMapPaths: [],
		};

		// Initialize heightmap data
		const totalVertices = (subdivisions + 1) * (subdivisions + 1);
		if (options.heightmapData) {
			this._heightmapData = options.heightmapData;
		} else {
			// Create flat heightmap at minHeight
			this._heightmapData = new Float32Array(totalVertices);
			for (let i = 0; i < totalVertices; i++) {
				this._heightmapData[i] = minHeight;
			}
		}

		// Create terrain geometry
		this._createTerrainGeometry();

		// Create default material
		const material = new StandardMaterial(`${name}_material`, scene);
		material.id = Tools.RandomId();
		material.uniqueId = UniqueNumber.Get();
		material.wireframe = false;
		this.material = material;
	}

	/**
	 * Creates the terrain geometry from heightmap data
	 */
	private _createTerrainGeometry(): void {
		const { width, depth, subdivisions } = this.metadata;

		// Create ground vertex data
		const vertexData = CreateGroundVertexData({
			width,
			height: depth,
			subdivisionsX: subdivisions,
			subdivisionsY: subdivisions,
		});

		// Apply heightmap to positions
		if (vertexData.positions) {
			this._applyHeightmapToPositions(vertexData.positions);
		}

		// Recompute normals with the new heights
		if (vertexData.positions && vertexData.indices && vertexData.normals) {
			VertexData.ComputeNormals(vertexData.positions, vertexData.indices, vertexData.normals);
		}

		// Create and apply geometry
		const geometry = new Geometry(Tools.RandomId(), this.getScene(), vertexData);
		geometry.uniqueId = UniqueNumber.Get();
		geometry.applyToMesh(this);

		this.refreshBoundingInfo(true);
	}

	/**
	 * Applies heightmap data to vertex positions
	 */
	private _applyHeightmapToPositions(positions: number[] | Float32Array): void {
		const { subdivisions } = this.metadata;
		const subdivisionsX = subdivisions + 1;
		const subdivisionsY = subdivisions + 1;

		// Update Y coordinates (height) from heightmap data
		for (let y = 0; y < subdivisionsY; y++) {
			for (let x = 0; x < subdivisionsX; x++) {
				const index = y * subdivisionsX + x;
				const vertexIndex = index * 3; // 3 components per vertex (x, y, z)

				// Get height from heightmap data
				const height = this._heightmapData[index];

				// Set Y coordinate
				positions[vertexIndex + 1] = height;
			}
		}
	}

	/**
	 * Updates the terrain geometry with current heightmap data
	 */
	public updateGeometry(): void {
		const positions = this.getVerticesData(VertexBuffer.PositionKind, false);
		const indices = this.getIndices(false);
		const normals = this.getVerticesData(VertexBuffer.NormalKind, false);

		if (!positions) return;

		// Update positions from heightmap
		this._applyHeightmapToPositions(positions);

		// Recompute normals
		if (normals && indices) {
			VertexData.ComputeNormals(positions, indices, normals);
		}

		// Apply updated data
		if (this.geometry) {
			this.geometry.setVerticesData(VertexBuffer.PositionKind, positions, false);
			if (normals) {
				this.geometry.setVerticesData(VertexBuffer.NormalKind, normals, false);
			}
		}

		this.refreshBoundingInfo(true);
	}

	/**
	 * Gets the height at a specific coordinate on the terrain
	 * @param x X coordinate in world space
	 * @param z Z coordinate in world space
	 * @returns Height at the given coordinates
	 */
	public getHeightAtCoordinates(x: number, z: number): number {
		const { width, depth, subdivisions } = this.metadata;

		// Convert world coordinates to heightmap indices
		const halfWidth = width / 2;
		const halfDepth = depth / 2;

		const normalizedX = (x + halfWidth) / width;
		const normalizedZ = (z + halfDepth) / depth;

		// Clamp to valid range
		const clampedX = Math.max(0, Math.min(1, normalizedX));
		const clampedZ = Math.max(0, Math.min(1, normalizedZ));

		// Get heightmap indices
		const indexX = Math.floor(clampedX * subdivisions);
		const indexZ = Math.floor(clampedZ * subdivisions);
		const subdivisionsX = subdivisions + 1;

		// Get height from heightmap
		const index = indexZ * subdivisionsX + indexX;
		return this._heightmapData[index] ?? this.metadata.minHeight;
	}

	/**
	 * Loads heightmap data from a Float32Array
	 * @param data Heightmap data
	 */
	public loadHeightmapData(data: Float32Array): void {
		const expectedSize = (this.metadata.subdivisions + 1) * (this.metadata.subdivisions + 1);

		if (data.length !== expectedSize) {
			console.error(`Heightmap data size mismatch. Expected ${expectedSize}, got ${data.length}`);
			return;
		}

		this._heightmapData = new Float32Array(data);
		this.updateGeometry();
	}

	/**
	 * Exports the current heightmap data
	 * @returns Copy of heightmap data
	 */
	public exportHeightmapData(): Float32Array {
		return new Float32Array(this._heightmapData);
	}

	/**
	 * Gets the current object class name.
	 * @return the class name
	 */
	public getClassName(): string {
		return "TerrainMesh";
	}
}

// Register with Babylon.js node system
Node.AddNodeConstructor("TerrainMesh", (name, scene) => {
	return () => new TerrainMesh(name, scene, {});
});
