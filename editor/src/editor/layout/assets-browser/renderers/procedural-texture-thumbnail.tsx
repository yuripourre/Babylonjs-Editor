import { useEffect, useRef, useState } from "react";
import { Engine, Scene, CreateBox, Vector3, UniversalCamera, StandardMaterial, Color3 } from "babylonjs";

import { MdOutlineHdrOn } from "react-icons/md";

import { projectConfiguration } from "../../../../project/configuration";
import { PROCEDURAL_TEXTURE_TYPES } from "../../inspector/fields/procedural-texture";

export const TEXTURE_WIDTH = 128;
export const TEXTURE_HEIGHT = 128;

export interface IProceduralTextureThumbnailRendererProps {

	absolutePath: string;

	width?: number;

	height?: number;
}

export function ProceduralTextureThumbnailRenderer(props: IProceduralTextureThumbnailRendererProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { width = TEXTURE_WIDTH, height = TEXTURE_HEIGHT } = props;
	const [loadError, setLoadError] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!projectConfiguration.path) {
			return;
		}

		// Wait for the canvas to be available
		const waitForCanvas = async () => {
			let attempts = 0;
			const maxAttempts = 20; // Increased attempts
			
			while (!canvasRef.current && attempts < maxAttempts) {
				await new Promise(resolve => setTimeout(resolve, 50));
				attempts++;
			}
			
			if (!canvasRef.current) {
				console.warn("Canvas not available after multiple attempts");
				setLoadError(true);
				return;
			}
			
			return canvasRef.current;
		};

		// Load and apply the procedural texture
		import("fs-extra").then(({ readJSON }) => {
			readJSON(props.absolutePath)
				.then(async (data) => {
					try {
						// Wait for canvas to be available
						const canvas = await waitForCanvas();
						if (!canvas) return;
						
						// Ensure the canvas is visible and properly sized
						if (canvas.width === 0 || canvas.height === 0) {
							canvas.width = width;
							canvas.height = height;
						}
						
						// Add a small delay to ensure the canvas is fully ready
						await new Promise(resolve => setTimeout(resolve, 50));
						
						try {
							// Try to generate static thumbnail first
							const dataUrl = await generateStaticThumbnail(data);
							setThumbnailDataUrl(dataUrl);
							setIsLoading(false);
						} catch (staticError) {
							console.warn("Static thumbnail generation failed, falling back to live rendering:", staticError);
							
							// Fall back to live rendering if static generation fails
							const cleanup = await setupProceduralTextureScene(canvas, data, true);
							
							// Store cleanup function for later disposal
							(canvas as any)._cleanup = cleanup;
							
							setIsLoading(false);
						}
					} catch (e) {
						console.error("Failed to create procedural texture:", e);
						setLoadError(true);
						setIsLoading(false);
					}
				})
				.catch((e) => {
					console.error("ProceduralTextureThumbnailRenderer: Failed to read procedural texture file:", e);
					setLoadError(true);
					setIsLoading(false);
				});
		});

		return () => {
			// Clean up live rendering if it was used as fallback
			if (canvasRef.current && (canvasRef.current as any)._cleanup) {
				(canvasRef.current as any)._cleanup();
			}
		};
	}, [props.absolutePath, width, height]);

	// Function to generate a static thumbnail
	const generateStaticThumbnail = async (textureData: any): Promise<string> => {
		try {
			// Create a temporary canvas for rendering
			const tempCanvas = document.createElement('canvas');
			tempCanvas.width = width;
			tempCanvas.height = height;
			
			// Ensure the canvas is properly set up for WebGL
			const gl = tempCanvas.getContext('webgl2') || tempCanvas.getContext('webgl');
			if (!gl) {
				throw new Error("WebGL context not available on temporary canvas");
			}
			
			// Use the existing setupProceduralTextureScene but with isLiveRender = false
			// This will render once and then dispose everything
			const cleanup = await setupProceduralTextureScene(tempCanvas, textureData, false);
			
			// Wait a bit for the render to complete
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Get the data URL from the canvas
			const dataUrl = tempCanvas.toDataURL('image/png');
			
			// Clean up immediately
			if (cleanup) {
				cleanup();
			}
			
			return dataUrl;
		} catch (error) {
			console.error("Failed to generate static thumbnail:", error);
			// Fall back to the original approach if static generation fails
			throw error;
		}
	};

	if (loadError) {
		return <MdOutlineHdrOn size="64px" />;
	}

	return (
		<div className="relative w-full h-full">
			{thumbnailDataUrl ? (
				// Show static thumbnail
				<img 
					src={thumbnailDataUrl} 
					alt="Procedural Texture Thumbnail"
					width={width} 
					height={height} 
					className="w-full h-full object-contain rounded-md" 
				/>
			) : (
				// Show canvas for loading
				<canvas 
					ref={canvasRef} 
					width={width} 
					height={height} 
					className="w-full h-full object-contain rounded-md" 
				/>
			)}
			{/* Loading state */}
			{isLoading && (
				<div className="absolute inset-0 flex items-center justify-center bg-black/20">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
				</div>
			)}
			{/* Fallback icon that shows if canvas fails */}
			<div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
				<MdOutlineHdrOn size="32px" className="text-gray-400" />
			</div>
		</div>
	);
}

ProceduralTextureThumbnailRenderer.render = async (texture: any): Promise<Buffer> => {
	return new Promise(async (resolve, reject) => {
		try {
			const canvas = document.createElement("canvas");
			canvas.width = TEXTURE_WIDTH;
			canvas.height = TEXTURE_HEIGHT;

			const cleanup = await setupProceduralTextureScene(canvas, texture, false);

			setTimeout(async () => {
				try {
					canvas.toBlob(async (blob) => {
						if (blob) {
							const arrayBuffer = await blob.arrayBuffer();
							const buffer = Buffer.from(arrayBuffer);

							cleanup();
							resolve(buffer);
						} else {
							cleanup();
							reject(new Error("Failed to create blob from canvas"));
						}
					}, "image/png");
				} catch (e) {
					cleanup();
					reject(e);
				}
			}, 500);
		} catch (error) {
			reject(error);
		}
	});
};

async function setupProceduralTextureScene(canvas: HTMLCanvasElement, textureData: any, isLiveRender: boolean) {
	// Ensure the canvas is properly set up
	if (!canvas || !canvas.getContext) {
		throw new Error("Invalid canvas element");
	}

	// Get WebGL context first to ensure it's available
	const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
	if (!gl) {
		throw new Error("WebGL context not available");
	}

	let engine: Engine;
	let scene: Scene;
	
	try {
		engine = new Engine(canvas, true, {
			antialias: true,
			audioEngine: false,
			adaptToDeviceRatio: true,
			preserveDrawingBuffer: true,
			premultipliedAlpha: false,
			powerPreference: "default",
			failIfMajorPerformanceCaveat: false,
		});
		
		scene = new Scene(engine);
		scene.clearColor.set(0, 0, 0, 0);
	} catch (error) {
		console.error("Failed to create BabylonJS engine/scene:", error);
		throw error;
	}

	const camera = new UniversalCamera("ProceduralTextureCamera", new Vector3(0, 5, 0), scene);
	camera.fov = 0.8;
	camera.minZ = 0.1;

	const box = CreateBox(
		"box",
		{
			width: 4,
			height: 4,
			depth: 4,
		},
		scene
	);
	box.position.z = 0;

	camera.setTarget(box.position);

	const material = new StandardMaterial("proceduralTextureMaterial", scene);
	material.diffuseColor = new Color3(1, 1, 1);
	material.emissiveColor = new Color3(1, 1, 1);

	let proceduralTexture;
	try {
		proceduralTexture = textureData?.customType ? await createProceduralTexture(textureData, scene) : await createProceduralTextureFromInstance(textureData, scene);
	} catch (error) {
		console.warn("Failed to create procedural texture, using fallback:", error);
		proceduralTexture = await createDefaultProceduralTexture(scene);
	}

	if (proceduralTexture) {
		material.diffuseTexture = proceduralTexture;
		box.material = material;
	}

	if (isLiveRender) {
		engine.runRenderLoop(() => {
			if (scene) {
				scene.render();
			}
		});
	} else {
		engine.runRenderLoop(() => {
			scene.render();
		});
	}

	return () => {
		if (engine) {
			engine.stopRenderLoop();
			engine.dispose();
		}
		if (scene) {
			scene.dispose();
		}
	};
}

async function createProceduralTexture(data: any, scene: Scene) {
	const textureType = data?.customType || "BABYLON.PerlinNoiseProceduralTexture";
	const className = textureType.split(".").pop(); // Extract class name from "BABYLON.ClassName"

	const textureTypeKey = Object.keys(PROCEDURAL_TEXTURE_TYPES).find((key) => className?.includes(key));

	if (!textureTypeKey) {
		return createDefaultProceduralTexture(scene);
	}

	try {
		const { [PROCEDURAL_TEXTURE_TYPES[textureTypeKey as keyof typeof PROCEDURAL_TEXTURE_TYPES]]: ProceduralTextureClass } = await import("babylonjs-procedural-textures");
		return new ProceduralTextureClass(`${textureTypeKey.toLowerCase()}Texture`, TEXTURE_WIDTH, scene);
	} catch (e) {
		console.warn(`Failed to create ${textureTypeKey} procedural texture:`, e);
		return createDefaultProceduralTexture(scene);
	}
}

async function createProceduralTextureFromInstance(texture: any, scene: Scene) {
	if (!texture || typeof texture.getClassName !== "function") {
		return createDefaultProceduralTexture(scene);
	}

	const className = texture.getClassName();
	if (!className.includes("ProceduralTexture")) {
		return createDefaultProceduralTexture(scene);
	}

	const textureTypeKey = Object.keys(PROCEDURAL_TEXTURE_TYPES).find((key) => className.includes(key));

	if (!textureTypeKey) {
		return createDefaultProceduralTexture(scene);
	}

	try {
		const { [PROCEDURAL_TEXTURE_TYPES[textureTypeKey as keyof typeof PROCEDURAL_TEXTURE_TYPES]]: ProceduralTextureClass } = await import("babylonjs-procedural-textures");

		return new ProceduralTextureClass(`${textureTypeKey.toLowerCase()}Texture`, TEXTURE_WIDTH, scene);
	} catch (e) {
		console.warn(`Failed to create ${textureTypeKey} procedural texture:`, e);
		return createDefaultProceduralTexture(scene);
	}
}

async function createDefaultProceduralTexture(scene: Scene) {
	try {
		const { PerlinNoiseProceduralTexture } = await import("babylonjs-procedural-textures");
		return new PerlinNoiseProceduralTexture("defaultTexture", TEXTURE_WIDTH, scene);
	} catch (e) {
		console.warn("Failed to create fallback texture:", e);
		return null;
	}
}
