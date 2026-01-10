import sharp from "sharp";
import { DynamicTexture, Scene } from "babylonjs";

import { TerrainMetadata } from "../../editor/nodes/terrain";

/**
 * Saves heightmap data to a PNG file
 * @param heightmapData Float32Array of height values
 * @param filePath Absolute path to save the PNG
 * @param metadata Terrain metadata for normalization
 */
export async function saveHeightmapToPng(
	heightmapData: Float32Array,
	filePath: string,
	metadata: TerrainMetadata
): Promise<void> {
	const subdivisions = metadata.subdivisions + 1;
	const buffer = Buffer.alloc(subdivisions * subdivisions);

	// Normalize height values to 0-255 range
	for (let i = 0; i < heightmapData.length; i++) {
		const normalizedHeight = (heightmapData[i] - metadata.minHeight) / (metadata.maxHeight - metadata.minHeight);
		buffer[i] = Math.floor(Math.max(0, Math.min(1, normalizedHeight)) * 255);
	}

	await sharp(buffer, {
		raw: {
			width: subdivisions,
			height: subdivisions,
			channels: 1,
		},
	})
		.png()
		.toFile(filePath);
}

/**
 * Loads heightmap data from a PNG file
 * @param filePath Absolute path to the PNG file
 * @param metadata Terrain metadata for denormalization
 * @returns Float32Array of height values
 */
export async function loadHeightmapFromPng(filePath: string, metadata: TerrainMetadata): Promise<Float32Array> {
	const sTexture = sharp(filePath);
	const textureBuffer = await sTexture.raw().ensureAlpha(0).toBuffer();

	const subdivisions = metadata.subdivisions + 1;
	const heightmapData = new Float32Array(subdivisions * subdivisions);

	// Denormalize from 0-255 to actual height range
	for (let i = 0; i < subdivisions * subdivisions; i++) {
		const normalizedHeight = textureBuffer[i] / 255;
		heightmapData[i] = metadata.minHeight + normalizedHeight * (metadata.maxHeight - metadata.minHeight);
	}

	return heightmapData;
}

/**
 * Saves a DynamicTexture to a PNG file
 * @param texture DynamicTexture to save
 * @param filePath Absolute path to save the PNG
 */
export async function saveBlendMapToPng(texture: DynamicTexture, filePath: string): Promise<void> {
	const context = texture.getContext();
	const size = texture.getSize();
	const imageData = context.getImageData(0, 0, size.width, size.height);

	await sharp(Buffer.from(imageData.data), {
		raw: {
			width: size.width,
			height: size.height,
			channels: 4, // RGBA
		},
	})
		.png()
		.toFile(filePath);
}

/**
 * Loads a blend map from a PNG file into a DynamicTexture
 * @param filePath Absolute path to the PNG file
 * @param scene Babylon.js scene
 * @returns DynamicTexture with loaded blend map data
 */
export async function loadBlendMapFromPng(filePath: string, scene: Scene): Promise<DynamicTexture> {
	const sTexture = sharp(filePath);
	const [textureMetadata, textureBuffer] = await Promise.all([sTexture.metadata(), sTexture.raw().ensureAlpha(255).toBuffer()]);

	const width = textureMetadata.width ?? 256;
	const height = textureMetadata.height ?? 256;

	// Create dynamic texture
	const texture = new DynamicTexture(`blendMap_${Date.now()}`, { width, height }, scene, false);
	const context = texture.getContext();

	// Create ImageData and load buffer
	const imageData = context.getImageData(0, 0, width, height);
	imageData.data.set(textureBuffer);
	context.putImageData(imageData, 0, 0);

	texture.update();

	return texture;
}
