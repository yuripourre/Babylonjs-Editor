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

	useEffect(() => {
		if (!projectConfiguration.path || !canvasRef.current) {
			return;
		}

		let cleanup: (() => void) | null = null;

		// Load and apply the procedural texture
		import("fs-extra").then(({ readJSON }) => {
			readJSON(props.absolutePath)
				.then(async (data) => {
					try {
						cleanup = await setupProceduralTextureScene(canvasRef.current!, data, true);
					} catch (e) {
						console.error("Failed to create procedural texture:", e);
						setLoadError(true);
					}
				})
				.catch((e) => {
					console.error("ProceduralTextureThumbnailRenderer: Failed to read procedural texture file:", e);
					setLoadError(true);
				});
		});

		return () => {
			if (cleanup) {
				cleanup();
			}
		};
	}, [props.absolutePath]);

	if (loadError) {
		return <MdOutlineHdrOn size="64px" />;
	}

	return <canvas ref={canvasRef} width={width} height={height} className="w-full h-full object-contain rounded-md" />;
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
	const engine = new Engine(canvas, true, {
		antialias: true,
		audioEngine: false,
		adaptToDeviceRatio: true,
		preserveDrawingBuffer: true,
		premultipliedAlpha: false,
	});
	const scene = new Scene(engine);
	scene.clearColor.set(0, 0, 0, 0);

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

	const proceduralTexture = textureData?.customType ? await createProceduralTexture(textureData, scene) : await createProceduralTextureFromInstance(textureData, scene);

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
