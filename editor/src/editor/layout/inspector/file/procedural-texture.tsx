import { basename } from "path/posix";
import { readJSON, writeJSON } from "fs-extra";

import { useEffect, useState, useRef } from "react";
import { MdOutlineHdrOn } from "react-icons/md";

import { Divider } from "@blueprintjs/core";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../ui/shadcn/ui/table";

import { FileInspectorObject } from "../file";
import { ProceduralTextureThumbnailRenderer } from "../../assets-browser/renderers/procedural-texture-thumbnail";
import { renderProceduralTextureProperties, getProceduralTextureType } from "../fields/procedural-texture";
import { projectConfiguration } from "../../../../project/configuration";
import { UniqueNumber } from "../../../../tools/tools";
import { join, dirname } from "path/posix";

export interface IEditorInspectorProceduralTextureComponentProps {
	object: FileInspectorObject;
}

export function EditorInspectorProceduralTextureComponent(props: IEditorInspectorProceduralTextureComponentProps) {
	const [config, setConfig] = useState<any>(null);
	const [size, setSize] = useState(512);
	const [textureType, setTextureType] = useState<string>("");
	const [proceduralTexture, setProceduralTexture] = useState<any>(null);
	const [scene, setScene] = useState<any>(null);
	const [creationFailed, setCreationFailed] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const [forceThumbnailUpdate, setForceThumbnailUpdate] = useState(0);

	useEffect(() => {
		readJSON(props.object.absolutePath)
			.then(async (data) => {
				setConfig(data);
				setSize(data.size ?? 512);
				setTextureType(data.customType ? data.customType.split(".").pop() : "PerlinNoiseProceduralTexture");
				
				// Create the procedural texture instance for editing
				try {
					const { Scene, Engine } = await import("babylonjs");
					const proceduralTextures = await import("babylonjs-procedural-textures");
					
					if (canvasRef.current) {
						try {
							// Create a temporary visible canvas for the engine
							const tempCanvas = document.createElement('canvas');
							tempCanvas.width = 256;
							tempCanvas.height = 256;
							tempCanvas.style.position = 'absolute';
							tempCanvas.style.left = '-9999px';
							tempCanvas.style.top = '-9999px';
							document.body.appendChild(tempCanvas);
							
							const engine = new Engine(tempCanvas, true);
							const newScene = new Scene(engine);
							setScene(newScene);
							
							// Store the temp canvas for cleanup
							(tempCanvas as any)._tempForCleanup = true;
							
							const fileNameWithExt = props.object.absolutePath.split("/").pop() || "";
							const baseName = fileNameWithExt.replace(".proceduraltexture", "");
							
							const className = data.customType ? data.customType.split(".").pop() : "PerlinNoiseProceduralTexture";
							const ProceduralTextureClass = (proceduralTextures as any)[className];
							
							if (ProceduralTextureClass) {
								try {
									const newTexture = new ProceduralTextureClass(baseName, size, newScene);
									newTexture.uniqueId = UniqueNumber.Get();
									
									const projectDir = join(dirname(projectConfiguration.path!), "/");
									const relativePath = props.object.absolutePath.replace(projectDir, "");
									newTexture.name = relativePath;
									newTexture.url = relativePath;
									
									// Apply any saved properties from config
									if (data.properties) {
										Object.keys(data.properties).forEach(key => {
											if (newTexture[key] !== undefined) {
												newTexture[key] = data.properties[key];
											}
										});
									}
									
									setProceduralTexture(newTexture);
								} catch (textureError) {
									console.error("Failed to create procedural texture instance:", textureError);
									setCreationFailed(true);
									// Fall back to just showing the thumbnail without editing capabilities
								}
							}
						} catch (engineError) {
							console.error("Failed to create engine/scene:", engineError);
							setCreationFailed(true);
							// Fall back to just showing the thumbnail without editing capabilities
						}
					}
				} catch (e) {
					console.error("Failed to import BabylonJS modules:", e);
				}
			})
			.catch((e) => {
				console.error("Failed to read procedural texture config:", e);
			});
	}, [props.object.absolutePath, size]);

	// Cleanup function to dispose scene and engine
	useEffect(() => {
		return () => {
			if (scene) {
				scene.dispose();
			}
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
			// Clean up temporary canvases
			const tempCanvases = document.querySelectorAll('canvas[_tempForCleanup="true"]');
			tempCanvases.forEach(canvas => {
				document.body.removeChild(canvas);
			});
		};
	}, [scene]);

	// Force thumbnail refresh when procedural texture changes
	useEffect(() => {
		if (proceduralTexture) {
			setForceThumbnailUpdate(prev => prev + 1);
		}
	}, [proceduralTexture]);

	const refreshThumbnail = () => {
		// Force the procedural texture to update
		if (proceduralTexture) {
			try {
				if (proceduralTexture.refresh) {
					proceduralTexture.refresh();
				}
				if (proceduralTexture.render) {
					proceduralTexture.render(false);
				}
				// Force a re-render of the component
				setProceduralTexture({ ...proceduralTexture });
				// Force thumbnail update by changing the key
				setForceThumbnailUpdate(prev => prev + 1);
				
				// Also try to force the scene to update
				if (scene) {
					scene.render();
				}
				
				// Force a complete re-render after a short delay
				setTimeout(() => {
					setForceThumbnailUpdate(prev => prev + 1);
				}, 100);
			} catch (error) {
				console.warn("Failed to refresh thumbnail:", error);
				// Still force a re-render even if the refresh fails
				setForceThumbnailUpdate(prev => prev + 1);
			}
		}
	};

	const handleSave = async () => {
		if (!proceduralTexture || !config) return;
		
		// Clear existing timeout
		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}
		
		// Set new timeout for debounced save
		saveTimeoutRef.current = setTimeout(async () => {
			try {
				// Get current properties from the procedural texture
				const currentProperties: any = {};
				const textureType = getProceduralTextureType(proceduralTexture);
				
				// Extract properties based on texture type
				switch (textureType) {
					case "BrickProceduralTexture":
						if (proceduralTexture._brickColor) currentProperties._brickColor = proceduralTexture._brickColor;
						if (proceduralTexture._jointColor) currentProperties._jointColor = proceduralTexture._jointColor;
						break;
					case "CloudProceduralTexture":
						if (proceduralTexture._cloudColor) currentProperties._cloudColor = proceduralTexture._cloudColor;
						if (proceduralTexture._skyColor) currentProperties._skyColor = proceduralTexture._skyColor;
						break;
					case "GrassProceduralTexture":
						if (proceduralTexture._grassColors) currentProperties._grassColors = proceduralTexture._grassColors;
						if (proceduralTexture._groundColor) currentProperties._groundColor = proceduralTexture._groundColor;
						break;
					case "WoodProceduralTexture":
						if (proceduralTexture._woodColor) currentProperties._woodColor = proceduralTexture._woodColor;
						if (proceduralTexture._ampScale) currentProperties._ampScale = proceduralTexture._ampScale;
						break;
					case "FireProceduralTexture":
						if (proceduralTexture._fireColors) currentProperties._fireColors = proceduralTexture._fireColors;
						break;
					case "MarbleProceduralTexture":
						if (proceduralTexture._jointColor) currentProperties._jointColor = proceduralTexture._jointColor;
						if (proceduralTexture._amplitude) currentProperties._amplitude = proceduralTexture._amplitude;
						if (proceduralTexture.numberOfTilesHeight) currentProperties.numberOfTilesHeight = proceduralTexture.numberOfTilesHeight;
						if (proceduralTexture.numberOfTilesWidth) currentProperties.numberOfTilesWidth = proceduralTexture.numberOfTilesWidth;
						break;
					case "RoadProceduralTexture":
						if (proceduralTexture._roadColor) currentProperties._roadColor = proceduralTexture._roadColor;
						break;
					case "StarfieldProceduralTexture":
						if (proceduralTexture._alpha) currentProperties._alpha = proceduralTexture._alpha;
						if (proceduralTexture._beta) currentProperties._beta = proceduralTexture._beta;
						if (proceduralTexture._zoom) currentProperties._zoom = proceduralTexture._zoom;
						if (proceduralTexture._stepsize) currentProperties._stepsize = proceduralTexture._stepsize;
						if (proceduralTexture._brightness) currentProperties._brightness = proceduralTexture._brightness;
						if (proceduralTexture._distfading) currentProperties._distfading = proceduralTexture._distfading;
						if (proceduralTexture._saturation) currentProperties._saturation = proceduralTexture._saturation;
						if (proceduralTexture._tile) currentProperties._tile = proceduralTexture._tile;
						if (proceduralTexture._formuparam) currentProperties._formuparam = proceduralTexture._formuparam;
						if (proceduralTexture._darkmatter) currentProperties._darkmatter = proceduralTexture._darkmatter;
						break;
					case "PerlinNoiseProceduralTexture":
						if (proceduralTexture._noiseScale) currentProperties._noiseScale = proceduralTexture._noiseScale;
						if (proceduralTexture._octaves) currentProperties._octaves = proceduralTexture._octaves;
						break;
				}
				
				// Update config with current properties
				const updatedConfig = {
					...config,
					properties: currentProperties,
					lastModified: new Date().toISOString()
				};
				
				// Save to file
				await writeJSON(props.object.absolutePath, updatedConfig, { spaces: 2 });
				
				// Update local state
				setConfig(updatedConfig);
				
				console.log("Procedural texture saved automatically");
			} catch (error) {
				console.error("Failed to save procedural texture:", error);
			}
		}, 500); // 500ms debounce delay
	};

	return (
		<div className="flex flex-col gap-2">
			{/* Hidden canvas for the scene */}
			<canvas ref={canvasRef} style={{ display: 'none' }} />
			
			<div className="flex gap-2 justify-center items-center text-xl font-bold">
				<MdOutlineHdrOn size="24px" />
				{basename(props.object.absolutePath)}
			</div>

			<Divider />

			<div className="w-full aspect-square p-5 rounded-lg bg-black/50">
				<ProceduralTextureThumbnailRenderer 
					key={`inspector-thumbnail-${forceThumbnailUpdate}`}
					absolutePath={props.object.absolutePath}
					width={256}
					height={256}
				/>
			</div>

			<div className="bg-black/50 p-5 rounded-lg">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Property</TableHead>
							<TableHead>Value</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						<TableRow>
							<TableCell className="font-medium">Type</TableCell>
							<TableCell>{textureType}</TableCell>
						</TableRow>
						<TableRow>
							<TableCell className="font-medium">Size</TableCell>
							<TableCell>{size}x{size}px</TableCell>
						</TableRow>
					</TableBody>
				</Table>
			</div>

			{/* Custom Properties Editor */}
			{proceduralTexture && (
				<div>
					{renderProceduralTextureProperties({
						texture: proceduralTexture,
						noUndoRedo: false,
						onChange: async () => {
							// Auto-save on change first
							await handleSave();
							// Then refresh the thumbnail to show the updated file
							refreshThumbnail();
						},
						forceUpdate: () => {
							// This will trigger a re-render of the component
							setProceduralTexture({ ...proceduralTexture });
						},
					})}
				</div>
			)}
			
			{/* Show message when creation fails */}
			{creationFailed && (
				<div className="bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-lg">
					<div className="text-yellow-400 font-medium mb-2">⚠️ Editing Unavailable</div>
					<div className="text-yellow-300 text-sm">
						The procedural texture thumbnail is displayed, but editing capabilities are not available due to a creation error. 
						You can still view the texture and its properties.
					</div>
				</div>
			)}
		</div>
	);
}
