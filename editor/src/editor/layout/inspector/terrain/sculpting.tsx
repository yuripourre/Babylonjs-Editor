import { Component, ReactNode } from "react";
import { Classes, Button, ButtonGroup, Divider, FormGroup } from "@blueprintjs/core";
import { Color3, Mesh, MeshBuilder, StandardMaterial, Vector3 } from "babylonjs";

import { Editor } from "../../../main";
import { TerrainMesh } from "../../../nodes/terrain";
import { TerrainSculptor } from "../../../tools/terrain/sculpting";
import { BrushType, BrushFalloff } from "../../../tools/terrain/brushes";
import { registerUndoRedo } from "../../../../tools/undoredo";
import { onNodeModifiedObservable } from "../../../../tools/observables";

import { EditorInspectorNumberField } from "../fields/number";
import { EditorInspectorSectionField } from "../fields/section";

export interface ITerrainSculptingInspectorProps {
	editor: Editor;
	object: TerrainMesh;
}

export interface ITerrainSculptingInspectorState {
	isActive: boolean;
	selectedTool: BrushType;
	brushRadius: number;
	brushStrength: number;
	brushFalloff: BrushFalloff;
}

/**
 * Terrain sculpting inspector component
 * Provides interactive terrain editing with brushes
 */
export class TerrainSculptingInspector extends Component<
	ITerrainSculptingInspectorProps,
	ITerrainSculptingInspectorState
> {
	private _sculptor: TerrainSculptor | null = null;
	private _brushVisualization: Mesh | null = null;
	private _isMouseDown: boolean = false;

	/**
	 * Constructor
	 */
	constructor(props: ITerrainSculptingInspectorProps) {
		super(props);

		this.state = {
			isActive: false,
			selectedTool: BrushType.Raise,
			brushRadius: 50,
			brushStrength: 1.0,
			brushFalloff: BrushFalloff.Smooth,
		};
	}

	/**
	 * Called when component mounts
	 */
	public async componentDidMount(): Promise<void> {
		// Create sculptor instance
		const scene = this.props.editor.layout.preview.scene;
		this._sculptor = new TerrainSculptor(this.props.object, scene);

		// Update brush settings
		this._sculptor.updateBrushSettings({
			type: this.state.selectedTool,
			radius: this.state.brushRadius,
			strength: this.state.brushStrength,
			falloff: this.state.brushFalloff,
		});

		// Listen for undo/redo events
		this._sculptor.onEndStrokeObservable.add((undoData) => {
			this._handleUndoRedo(undoData.before, undoData.after);
		});
	}

	/**
	 * Called when component unmounts
	 */
	public componentWillUnmount(): void {
		// Deactivate sculpting mode
		if (this.state.isActive) {
			this._deactivateSculpting();
		}

		// Dispose sculptor
		if (this._sculptor) {
			this._sculptor.dispose();
			this._sculptor = null;
		}
	}

	/**
	 * Renders the component
	 */
	public render(): ReactNode {
		const proxy = {
			brushRadius: this.state.brushRadius,
			brushStrength: this.state.brushStrength,
		};

		return (
			<EditorInspectorSectionField title="Sculpting">
				{/* Activate/Deactivate Button */}
				<FormGroup label="Sculpting Mode">
					<Button
						fill
						intent={this.state.isActive ? "success" : "none"}
						text={this.state.isActive ? "Sculpting Active (Click to Exit)" : "Start Sculpting"}
						onClick={() => this._toggleSculpting()}
					/>
				</FormGroup>

				<Divider />

				{/* Tool Selection */}
				<FormGroup label="Tool">
					<ButtonGroup fill vertical>
						{this._renderToolButton(BrushType.Raise, "Raise", "Raise terrain height")}
						{this._renderToolButton(BrushType.Lower, "Lower", "Lower terrain height")}
						{this._renderToolButton(BrushType.Smooth, "Smooth", "Smooth terrain surface")}
						{this._renderToolButton(BrushType.Flatten, "Flatten", "Flatten to initial height")}
						{this._renderToolButton(BrushType.Plateau, "Plateau", "Create plateau levels")}
						{this._renderToolButton(BrushType.Erode, "Erode", "Simulate erosion")}
					</ButtonGroup>
				</FormGroup>

				<Divider />

				{/* Brush Settings */}
				<FormGroup label="Brush Settings">
					<EditorInspectorNumberField
						object={proxy}
						property="brushRadius"
						label="Radius"
						step={5}
						min={5}
						max={500}
						onChange={(value) => this._updateBrushRadius(value)}
					/>

					<EditorInspectorNumberField
						object={proxy}
						property="brushStrength"
						label="Strength"
						step={0.1}
						min={0.1}
						max={10}
						onChange={(value) => this._updateBrushStrength(value)}
					/>
				</FormGroup>

				<Divider />

				{/* Falloff Selection */}
				<FormGroup label="Falloff">
					<ButtonGroup fill>
						{this._renderFalloffButton(BrushFalloff.Linear, "Linear")}
						{this._renderFalloffButton(BrushFalloff.Smooth, "Smooth")}
						{this._renderFalloffButton(BrushFalloff.Spherical, "Spherical")}
						{this._renderFalloffButton(BrushFalloff.Sharp, "Sharp")}
					</ButtonGroup>
				</FormGroup>

				{/* Instructions */}
				{this.state.isActive && (
					<div className={Classes.TEXT_MUTED} style={{ marginTop: 10, fontSize: "0.85em" }}>
						<strong>Controls:</strong>
						<br />• Click and drag to sculpt
						<br />• Release to finish stroke
						<br />• Undo/Redo supported
					</div>
				)}
			</EditorInspectorSectionField>
		);
	}

	/**
	 * Renders a tool selection button
	 */
	private _renderToolButton(tool: BrushType, label: string, tooltip: string): ReactNode {
		return (
			<Button
				active={this.state.selectedTool === tool}
				text={label}
				title={tooltip}
				onClick={() => this._selectTool(tool)}
			/>
		);
	}

	/**
	 * Renders a falloff selection button
	 */
	private _renderFalloffButton(falloff: BrushFalloff, label: string): ReactNode {
		return (
			<Button
				active={this.state.brushFalloff === falloff}
				text={label}
				onClick={() => this._selectFalloff(falloff)}
			/>
		);
	}

	/**
	 * Toggles sculpting mode on/off
	 */
	private _toggleSculpting(): void {
		if (this.state.isActive) {
			this._deactivateSculpting();
		} else {
			this._activateSculpting();
		}
	}

	/**
	 * Activates sculpting mode
	 */
	private _activateSculpting(): void {
		// Disable default picking
		this.props.editor.layout.preview.setState({ pickingEnabled: false });

		// Attach mouse event listeners
		const canvas = this.props.editor.layout.preview.engine.inputElement as HTMLCanvasElement;
		canvas.addEventListener("pointermove", this._handleMouseMove);
		canvas.addEventListener("pointerdown", this._handleMouseDown);
		canvas.addEventListener("pointerup", this._handleMouseUp);
		canvas.addEventListener("pointerleave", this._handleMouseLeave);

		// Create brush visualization
		this._createBrushVisualization();

		this.setState({ isActive: true });
	}

	/**
	 * Deactivates sculpting mode
	 */
	private _deactivateSculpting(): void {
		// Re-enable default picking
		this.props.editor.layout.preview.setState({ pickingEnabled: true });

		// Remove mouse event listeners
		const canvas = this.props.editor.layout.preview.engine.inputElement as HTMLCanvasElement;
		canvas.removeEventListener("pointermove", this._handleMouseMove);
		canvas.removeEventListener("pointerdown", this._handleMouseDown);
		canvas.removeEventListener("pointerup", this._handleMouseUp);
		canvas.removeEventListener("pointerleave", this._handleMouseLeave);

		// End stroke if active
		if (this._sculptor?.isSculpting) {
			this._sculptor.endStroke();
		}

		// Remove brush visualization
		this._removeBrushVisualization();

		this.setState({ isActive: false });
		this._isMouseDown = false;
	}

	/**
	 * Handles mouse move event
	 */
	private _handleMouseMove = (ev: PointerEvent): void => {
		if (!this._sculptor) return;

		const pickedPoint = this._sculptor.pickTerrain(ev.offsetX, ev.offsetY);

		if (pickedPoint) {
			// Update brush visualization position
			this._updateBrushVisualization(pickedPoint);

			// Apply sculpting if mouse is down
			if (this._isMouseDown) {
				this._sculptor.applySculpt(pickedPoint);
			}
		} else {
			// Hide brush visualization if not over terrain
			if (this._brushVisualization) {
				this._brushVisualization.setEnabled(false);
			}
		}
	};

	/**
	 * Handles mouse down event
	 */
	private _handleMouseDown = (ev: PointerEvent): void => {
		if (!this._sculptor || ev.button !== 0) return; // Only left mouse button

		this._isMouseDown = true;

		const pickedPoint = this._sculptor.pickTerrain(ev.offsetX, ev.offsetY);
		if (pickedPoint) {
			this._sculptor.beginStroke();
			this._sculptor.applySculpt(pickedPoint);
		}
	};

	/**
	 * Handles mouse up event
	 */
	private _handleMouseUp = (ev: PointerEvent): void => {
		if (!this._sculptor || ev.button !== 0) return;

		this._isMouseDown = false;

		if (this._sculptor.isSculpting) {
			this._sculptor.endStroke();
		}
	};

	/**
	 * Handles mouse leave event
	 */
	private _handleMouseLeave = (): void => {
		if (!this._sculptor) return;

		// End stroke if active
		if (this._sculptor.isSculpting) {
			this._sculptor.endStroke();
		}

		this._isMouseDown = false;

		// Hide brush visualization
		if (this._brushVisualization) {
			this._brushVisualization.setEnabled(false);
		}
	};

	/**
	 * Creates the brush visualization mesh
	 */
	private _createBrushVisualization(): void {
		const scene = this.props.editor.layout.preview.scene;

		// Create a circle mesh to visualize brush
		this._brushVisualization = MeshBuilder.CreateDisc(
			"brushVisualization",
			{ radius: this.state.brushRadius, tessellation: 32 },
			scene
		);

		// Create material
		const material = new StandardMaterial("brushVisualizationMaterial", scene);
		material.diffuseColor = Color3.Yellow();
		material.emissiveColor = Color3.Yellow();
		material.alpha = 0.3;
		material.wireframe = true;
		material.disableLighting = true;

		this._brushVisualization.material = material;
		this._brushVisualization.rotation.x = Math.PI / 2; // Rotate to lie flat
		this._brushVisualization.isPickable = false;
		this._brushVisualization.setEnabled(false);
	}

	/**
	 * Updates brush visualization position
	 */
	private _updateBrushVisualization(worldPosition: Vector3): void {
		if (!this._brushVisualization) return;

		this._brushVisualization.position.copyFrom(worldPosition);
		this._brushVisualization.position.y += 0.5; // Slightly above terrain
		this._brushVisualization.setEnabled(true);

		// Update size if changed
		const currentScale = this._brushVisualization.scaling.x;
		const targetScale = this.state.brushRadius / 50; // Base radius is 50
		if (Math.abs(currentScale - targetScale) > 0.01) {
			this._brushVisualization.scaling = new Vector3(targetScale, targetScale, targetScale);
		}
	}

	/**
	 * Removes the brush visualization mesh
	 */
	private _removeBrushVisualization(): void {
		if (this._brushVisualization) {
			this._brushVisualization.dispose();
			this._brushVisualization = null;
		}
	}

	/**
	 * Selects a sculpting tool
	 */
	private _selectTool(tool: BrushType): void {
		this.setState({ selectedTool: tool });

		if (this._sculptor) {
			this._sculptor.updateBrushSettings({ type: tool });
		}
	}

	/**
	 * Selects a brush falloff
	 */
	private _selectFalloff(falloff: BrushFalloff): void {
		this.setState({ brushFalloff: falloff });

		if (this._sculptor) {
			this._sculptor.updateBrushSettings({ falloff });
		}
	}

	/**
	 * Updates brush radius
	 */
	private _updateBrushRadius(value: number): void {
		this.setState({ brushRadius: value });

		if (this._sculptor) {
			this._sculptor.updateBrushSettings({ radius: value });
		}
	}

	/**
	 * Updates brush strength
	 */
	private _updateBrushStrength(value: number): void {
		this.setState({ brushStrength: value });

		if (this._sculptor) {
			this._sculptor.updateBrushSettings({ strength: value });
		}
	}

	/**
	 * Handles undo/redo registration
	 */
	private _handleUndoRedo(beforeData: Float32Array, afterData: Float32Array): void {
		const terrain = this.props.object;

		registerUndoRedo({
			executeRedo: false,
			undo: () => {
				terrain.loadHeightmapData(new Float32Array(beforeData));
			},
			redo: () => {
				terrain.loadHeightmapData(new Float32Array(afterData));
			},
		});

		// Notify observers that terrain was modified
		onNodeModifiedObservable.notifyObservers(terrain);
	}
}
