import React from "react";
import { EditorInspectorSectionField } from "./section";
import { EditorInspectorColorField } from "./color";
import { EditorInspectorNumberField } from "./number";

export const PROCEDURAL_TEXTURE_TYPES = {
	Wood: "WoodProceduralTexture",
	Brick: "BrickProceduralTexture",
	Cloud: "CloudProceduralTexture",
	Fire: "FireProceduralTexture",
	Grass: "GrassProceduralTexture",
	Marble: "MarbleProceduralTexture",
	Road: "RoadProceduralTexture",
	Starfield: "StarfieldProceduralTexture",
	PerlinNoise: "PerlinNoiseProceduralTexture",
	NormalMap: "NormalMapProceduralTexture",
} as const;

export function isProceduralTexture(texture: any): boolean {
	return (
		texture?.getClassName?.()?.includes("ProceduralTexture") ||
		texture?.constructor?.name?.includes("ProceduralTexture") ||
		texture?.url?.toLowerCase().includes(".proceduraltexture")
	);
}

/**
 * Get the type of procedural texture from the texture object based on the properties.
 * 
 * @param texture - The texture object to get the type of.
 * @returns The type of procedural texture.
 */
export function getProceduralTextureType(texture: any): string {
	if (texture._fireColors !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Fire;
	}

	if (texture.grassColors !== undefined || texture._grassColors !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Grass;
	}

	if (texture.brickColor !== undefined || texture._brickColor !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Brick;
	}

	if (texture.jointColor !== undefined || texture._jointColor !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Marble;
	}

	if (texture.woodColor !== undefined || texture.ampScale !== undefined || texture._woodColor !== undefined || texture._ampScale !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Wood;
	}

	if (texture.skyColor !== undefined || texture.cloudColor !== undefined || texture._skyColor !== undefined || texture._cloudColor !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Cloud;
	}

	if (texture.roadColor !== undefined || texture._roadColor !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Road;
	}

	if (texture._formuparam !== undefined || texture._darkmatter !== undefined) {
		return PROCEDURAL_TEXTURE_TYPES.Starfield;
	}

	return PROCEDURAL_TEXTURE_TYPES.PerlinNoise;
}

export function updateTexture(texture: any): void {
	try {
		if (typeof texture.updateShaderUniforms === "function") {
			texture.updateShaderUniforms();
		}
		if (typeof texture.refresh === "function") {
			texture.refresh();
		}
		if (typeof texture.render === "function") {
			texture.render(false);
		}
	} catch {}
}

export interface IProceduralTextureInspectorProps {
	texture: any;
	noUndoRedo?: boolean;
	onChange: () => void;
	forceUpdate: () => void;
}

export function renderProceduralTextureProperties(props: IProceduralTextureInspectorProps): React.ReactNode {
	const { texture, noUndoRedo, onChange, forceUpdate } = props;
	const textureType = getProceduralTextureType(texture);

	switch (textureType) {
		case PROCEDURAL_TEXTURE_TYPES.Brick:
			return (
				<EditorInspectorSectionField title="Brick Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Brick Color"
							object={texture}
							property="_brickColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Joint Color"
							object={texture}
							property="_jointColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Cloud:
			return (
				<EditorInspectorSectionField title="Cloud Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Cloud Color"
							object={texture}
							property="_cloudColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Sky Color"
							object={texture}
							property="_skyColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Grass:
			return (
				<EditorInspectorSectionField title="Grass Properties">
					<div className="px-2 py-2">
						<div className="text-sm text-muted-foreground mb-2">Grass Colors (Array of 3 colors)</div>
						<div className="space-y-2">
							{Array.from({ length: 3 }, (_, i) => (
								<EditorInspectorColorField
									key={i}
									noUndoRedo={noUndoRedo}
									label={`Color ${i + 1}`}
									object={texture}
									property={`_grassColors.${i}`}
									onChange={forceUpdate}
									onFinishChange={onChange}
								/>
							))}
						</div>
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Ground Color"
							object={texture}
							property="_groundColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Wood:
			return (
				<EditorInspectorSectionField title="Wood Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Amplitude Scale"
							object={texture}
							property="_ampScale"
							step={1}
							min={1}
							max={1000}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Wood Color"
							object={texture}
							property="_woodColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Fire:
			return (
				<EditorInspectorSectionField title="Fire Properties">
					<div className="px-2 py-2">
						<div className="text-sm text-muted-foreground mb-2">Fire Colors (Array of 6 colors)</div>
						<div className="space-y-2">
							{Array.from({ length: 6 }, (_, i) => (
								<EditorInspectorColorField
									key={i}
									noUndoRedo={noUndoRedo}
									label={`Color ${i + 1}`}
									object={texture}
									property={`_fireColors.${i}`}
									onChange={forceUpdate}
									onFinishChange={onChange}
								/>
							))}
						</div>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Marble:
			return (
				<EditorInspectorSectionField title="Marble Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Joint Color"
							object={texture}
							property="_jointColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Amplitude"
							object={texture}
							property="_amplitude"
							step={1}
							min={1}
							max={1000}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Number of Tiles Height"
							object={texture}
							property="numberOfTilesHeight"
							step={1}
							min={1}
							max={1000}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Number of Tiles Width"
							object={texture}
							property="numberOfTilesWidth"
							step={1}
							min={1}
							max={1000}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Road:
			return (
				<EditorInspectorSectionField title="Road Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorColorField
							noUndoRedo={noUndoRedo}
							label="Road Color"
							object={texture}
							property="_roadColor"
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.Starfield:
			return (
				<EditorInspectorSectionField title="Starfield Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Alpha"
							object={texture}
							property="_alpha"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Beta"
							object={texture}
							property="_beta"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Zoom"
							object={texture}
							property="_zoom"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Stepsize"
							object={texture}
							property="_stepsize"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Brightness"
							object={texture}
							property="_brightness"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Dist Fading"
							object={texture}
							property="_distfading"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Saturation"
							object={texture}
							property="_saturation"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Tile"
							object={texture}
							property="_tile"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Formu Param"
							object={texture}
							property="_formuparam"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Dark Matter"
							object={texture}
							property="_darkmatter"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		case PROCEDURAL_TEXTURE_TYPES.PerlinNoise:
			return (
				<EditorInspectorSectionField title="Noise Properties">
					<div className="px-2 py-2 space-y-2">
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Noise Scale"
							object={texture}
							property="_noiseScale"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
						<EditorInspectorNumberField
							noUndoRedo={noUndoRedo}
							label="Octaves"
							object={texture}
							property="_octaves"
							step={0.1}
							min={0}
							max={10}
							onChange={forceUpdate}
							onFinishChange={onChange}
						/>
					</div>
				</EditorInspectorSectionField>
			);

		default:
			return null;
	}
}
