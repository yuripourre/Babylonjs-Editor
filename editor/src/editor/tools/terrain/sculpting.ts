import { Observable, Scene, Vector3 } from "babylonjs";

import { TerrainMesh } from "../../nodes/terrain";
import { TerrainBrush, BrushSettings, BrushType, BrushFalloff } from "./brushes";

/**
 * Terrain sculpting manager
 * Handles sculpting mode, brush operations, and undo/redo
 */
export class TerrainSculptor {
	private _terrain: TerrainMesh;
	private _scene: Scene;
	private _brush: TerrainBrush;
	private _isSculpting: boolean = false;
	private _lastBrushPosition: Vector3 | null = null;
	private _brushStrokeStartData: Float32Array | null = null;

	// Observables
	public onBeginStrokeObservable = new Observable<void>();
	public onStrokeObservable = new Observable<Vector3>();
	public onEndStrokeObservable = new Observable<{ before: Float32Array; after: Float32Array }>();

	/**
	 * Constructor
	 * @param terrain The terrain mesh to sculpt
	 * @param scene The Babylon.js scene
	 */
	constructor(terrain: TerrainMesh, scene: Scene) {
		this._terrain = terrain;
		this._scene = scene;

		// Initialize brush with default settings
		const defaultSettings: BrushSettings = {
			type: BrushType.Raise,
			radius: 50,
			strength: 1.0,
			falloff: BrushFalloff.Smooth,
		};

		this._brush = new TerrainBrush(terrain, defaultSettings);
	}

	/**
	 * Gets current brush settings
	 */
	public get brushSettings(): BrushSettings {
		return this._brush.settings;
	}

	/**
	 * Updates brush settings
	 */
	public updateBrushSettings(settings: Partial<BrushSettings>): void {
		this._brush.updateSettings(settings);
	}

	/**
	 * Gets whether currently sculpting
	 */
	public get isSculpting(): boolean {
		return this._isSculpting;
	}

	/**
	 * Gets the last brush position
	 */
	public get lastBrushPosition(): Vector3 | null {
		return this._lastBrushPosition;
	}

	/**
	 * Begins a sculpting stroke
	 */
	public beginStroke(): void {
		if (this._isSculpting) return;

		this._isSculpting = true;
		this._brushStrokeStartData = this._terrain.exportHeightmapData();
		this._brush.resetTargetHeight();

		this.onBeginStrokeObservable.notifyObservers();
	}

	/**
	 * Applies brush at the given world position
	 * @param worldPosition World position to apply brush
	 */
	public applySculpt(worldPosition: Vector3): void {
		if (!this._isSculpting) return;

		this._lastBrushPosition = worldPosition.clone();

		// Apply brush (brush handles heightmap modification internally)
		this._brush.applyBrush(worldPosition);

		this.onStrokeObservable.notifyObservers(worldPosition);
	}

	/**
	 * Ends the sculpting stroke
	 * @returns Undo data (before and after heightmaps)
	 */
	public endStroke(): { before: Float32Array; after: Float32Array } | null {
		if (!this._isSculpting) return null;

		this._isSculpting = false;
		this._lastBrushPosition = null;

		const afterData = this._terrain.exportHeightmapData();
		const beforeData = this._brushStrokeStartData!;

		this._brushStrokeStartData = null;

		const undoData = { before: beforeData, after: afterData };
		this.onEndStrokeObservable.notifyObservers(undoData);

		return undoData;
	}

	/**
	 * Picks a point on the terrain at screen coordinates
	 * @param screenX Screen X coordinate
	 * @param screenY Screen Y coordinate
	 * @returns Picked world position or null if no hit
	 */
	public pickTerrain(screenX: number, screenY: number): Vector3 | null {
		const pickingInfo = this._scene.pick(
			screenX,
			screenY,
			(mesh) => mesh === this._terrain,
			false
		);

		if (pickingInfo.hit && pickingInfo.pickedPoint) {
			return pickingInfo.pickedPoint;
		}

		return null;
	}

	/**
	 * Disposes the sculptor
	 */
	public dispose(): void {
		this.onBeginStrokeObservable.clear();
		this.onStrokeObservable.clear();
		this.onEndStrokeObservable.clear();
		this._isSculpting = false;
		this._lastBrushPosition = null;
		this._brushStrokeStartData = null;
	}
}
