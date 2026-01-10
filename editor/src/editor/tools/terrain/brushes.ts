import { Vector3 } from "babylonjs";

import { TerrainMesh } from "../../nodes/terrain";

/**
 * Available brush types for terrain sculpting
 */
export enum BrushType {
	Raise = "raise",
	Lower = "lower",
	Smooth = "smooth",
	Flatten = "flatten",
	Plateau = "plateau",
	Erode = "erode",
}

/**
 * Brush falloff curves
 */
export enum BrushFalloff {
	Linear = "linear",
	Smooth = "smooth",
	Spherical = "spherical",
	Sharp = "sharp",
}

/**
 * Settings for terrain brush operations
 */
export interface BrushSettings {
	type: BrushType;
	radius: number;
	strength: number;
	falloff: BrushFalloff;
}

/**
 * Terrain brush class for sculpting operations
 */
export class TerrainBrush {
	private _settings: BrushSettings;
	private _terrain: TerrainMesh;

	/**
	 * Constructor
	 * @param terrain The terrain mesh to operate on
	 * @param settings Initial brush settings
	 */
	constructor(terrain: TerrainMesh, settings: BrushSettings) {
		this._terrain = terrain;
		this._settings = settings;
	}

	/**
	 * Gets current brush settings
	 */
	public get settings(): BrushSettings {
		return this._settings;
	}

	/**
	 * Updates brush settings
	 */
	public updateSettings(settings: Partial<BrushSettings>): void {
		this._settings = { ...this._settings, ...settings };
	}

	/**
	 * Applies the brush at a world position on the terrain
	 * @param worldPosition World position where brush is applied
	 * @returns Copy of the previous heightmap data (for undo)
	 */
	public applyBrush(worldPosition: Vector3): Float32Array {
		const heightmapData = this._terrain.exportHeightmapData();
		const previousData = new Float32Array(heightmapData);

		const { width, depth, subdivisions, minHeight, maxHeight } = this._terrain.metadata;

		// Convert world position to local terrain coordinates
		const localPosition = worldPosition.subtract(this._terrain.getAbsolutePosition());
		const normalizedX = (localPosition.x + width / 2) / width;
		const normalizedZ = (localPosition.z + depth / 2) / depth;

		// Calculate brush radius in vertex units
		const brushRadiusInUnits = this._settings.radius;
		const vertexSpacingX = width / subdivisions;
		const vertexSpacingZ = depth / subdivisions;
		const brushRadiusInVerticesX = brushRadiusInUnits / vertexSpacingX;
		const brushRadiusInVerticesZ = brushRadiusInUnits / vertexSpacingZ;

		// Center vertex indices
		const centerX = normalizedX * subdivisions;
		const centerZ = normalizedZ * subdivisions;

		// Calculate affected region
		const minX = Math.max(0, Math.floor(centerX - brushRadiusInVerticesX));
		const maxX = Math.min(subdivisions, Math.ceil(centerX + brushRadiusInVerticesX));
		const minZ = Math.max(0, Math.floor(centerZ - brushRadiusInVerticesZ));
		const maxZ = Math.min(subdivisions, Math.ceil(centerZ + brushRadiusInVerticesZ));

		// Cache for smooth and erode algorithms
		const neighborHeights: number[] = [];

		// Apply brush to affected vertices
		for (let z = minZ; z <= maxZ; z++) {
			for (let x = minX; x <= maxX; x++) {
				// Calculate distance from brush center
				const dx = (x - centerX) * vertexSpacingX;
				const dz = (z - centerZ) * vertexSpacingZ;
				const distance = Math.sqrt(dx * dx + dz * dz);

				// Skip if outside brush radius
				if (distance > brushRadiusInUnits) continue;

				// Calculate falloff
				const falloff = this._calculateFalloff(distance / brushRadiusInUnits);
				const effectiveStrength = this._settings.strength * falloff;

				// Get vertex index
				const index = z * (subdivisions + 1) + x;
				const currentHeight = heightmapData[index];

				// Apply brush operation
				let newHeight = currentHeight;

				switch (this._settings.type) {
					case BrushType.Raise:
						newHeight = currentHeight + effectiveStrength;
						break;

					case BrushType.Lower:
						newHeight = currentHeight - effectiveStrength;
						break;

					case BrushType.Smooth:
						// Calculate average height of neighbors
						neighborHeights.length = 0;
						this._getNeighborHeights(x, z, subdivisions, heightmapData, neighborHeights);
						const avgHeight = neighborHeights.reduce((a, b) => a + b, 0) / neighborHeights.length;
						newHeight = currentHeight + (avgHeight - currentHeight) * effectiveStrength * 0.1;
						break;

					case BrushType.Flatten:
						// Flatten towards the initial clicked height (stored in brush context)
						const targetHeight = this._getTargetHeight(worldPosition);
						newHeight = currentHeight + (targetHeight - currentHeight) * effectiveStrength * 0.1;
						break;

					case BrushType.Plateau:
						// Create flat areas by snapping to nearest height level
						const plateauLevels = 10;
						const levelHeight = (maxHeight - minHeight) / plateauLevels;
						const targetLevel = Math.round(currentHeight / levelHeight) * levelHeight;
						newHeight = currentHeight + (targetLevel - currentHeight) * effectiveStrength * 0.05;
						break;

					case BrushType.Erode:
						// Simulate erosion by moving height towards local minimum
						neighborHeights.length = 0;
						this._getNeighborHeights(x, z, subdivisions, heightmapData, neighborHeights);
						const minNeighborHeight = Math.min(...neighborHeights, currentHeight);
						newHeight = currentHeight + (minNeighborHeight - currentHeight) * effectiveStrength * 0.05;
						break;
				}

				// Clamp to terrain height range
				newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

				// Update heightmap
				heightmapData[index] = newHeight;
			}
		}

		// Load the modified heightmap into terrain
		this._terrain.loadHeightmapData(heightmapData);

		return previousData;
	}

	/**
	 * Calculates brush falloff based on distance
	 * @param normalizedDistance Distance from center (0-1)
	 * @returns Falloff multiplier (0-1)
	 */
	private _calculateFalloff(normalizedDistance: number): number {
		switch (this._settings.falloff) {
			case BrushFalloff.Linear:
				return 1 - normalizedDistance;

			case BrushFalloff.Smooth:
				// Smoothstep falloff
				const t = 1 - normalizedDistance;
				return t * t * (3 - 2 * t);

			case BrushFalloff.Spherical:
				// Cosine falloff (spherical)
				return Math.cos(normalizedDistance * Math.PI * 0.5);

			case BrushFalloff.Sharp:
				// Power falloff for sharp edges
				return Math.pow(1 - normalizedDistance, 3);

			default:
				return 1 - normalizedDistance;
		}
	}

	/**
	 * Gets heights of neighboring vertices
	 */
	private _getNeighborHeights(
		x: number,
		z: number,
		subdivisions: number,
		heightmapData: Float32Array,
		output: number[]
	): void {
		const maxIndex = subdivisions;

		// 8-connected neighbors
		const offsets = [
			[-1, -1], [0, -1], [1, -1],
			[-1, 0], [1, 0],
			[-1, 1], [0, 1], [1, 1],
		];

		for (const [dx, dz] of offsets) {
			const nx = x + dx;
			const nz = z + dz;

			// Check bounds
			if (nx >= 0 && nx <= maxIndex && nz >= 0 && nz <= maxIndex) {
				const index = nz * (subdivisions + 1) + nx;
				output.push(heightmapData[index]);
			}
		}
	}

	/**
	 * Gets the target height for flatten operation
	 * This should be set when the brush starts (first click)
	 */
	private _targetHeight: number | null = null;

	private _getTargetHeight(worldPosition: Vector3): number {
		if (this._targetHeight === null) {
			// Get height at clicked position
			const localPosition = worldPosition.subtract(this._terrain.getAbsolutePosition());
			this._targetHeight = this._terrain.getHeightAtCoordinates(localPosition.x, localPosition.z);
		}
		return this._targetHeight;
	}

	/**
	 * Resets the target height (call when starting a new brush stroke)
	 */
	public resetTargetHeight(): void {
		this._targetHeight = null;
	}
}
