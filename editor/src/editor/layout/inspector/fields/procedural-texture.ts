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

export type ProceduralTextureType = (typeof PROCEDURAL_TEXTURE_TYPES)[keyof typeof PROCEDURAL_TEXTURE_TYPES];

export const PROPERTY_CONFIG = {
	SCALE: { step: 0.1, min: 0, max: 10 },
	COUNT: { step: 1, min: 1, max: 100 },
	SPEED: { step: 0.1, min: 0, max: 10 },
	OCTAVES: { step: 1, min: 1, max: 10 },
	AMPLITUDE: { step: 1, min: 1, max: 1000 },
} as const;

// Simplified procedural texture detection
export function isProceduralTexture(texture: any): boolean {
	return (
		texture?.getClassName?.()?.includes("ProceduralTexture") ||
		texture?.constructor?.name?.includes("ProceduralTexture") ||
		texture?.url?.toLowerCase().includes(".proceduraltexture")
	);
}

// Get procedural texture type
export function getProceduralTextureType(texture: any): ProceduralTextureType | string {
	const className = texture?.getClassName?.() || texture?.constructor?.name;
	if (!className || className === "Texture") {
		return "ProceduralTexture";
	}

	const textureTypeKey = Object.keys(PROCEDURAL_TEXTURE_TYPES).find((key) => className.includes(key));

	return textureTypeKey ? PROCEDURAL_TEXTURE_TYPES[textureTypeKey as keyof typeof PROCEDURAL_TEXTURE_TYPES] : className;
}

// Gather properties from texture
export function gatherProperties(texture: any): Array<{ name: string; type: string; value: any }> {
	const properties: Array<{ name: string; type: string; value: any }> = [];

	if (!texture) {
		return properties;
	}

	// Get all properties from the texture
	const allKeys = new Set<string>();

	// Enumerable properties
	for (const key in texture) {
		if (Object.prototype.hasOwnProperty.call(texture, key)) {
			allKeys.add(key);
		}
	}

	// Non-enumerable properties
	Object.getOwnPropertyNames(texture).forEach((key) => allKeys.add(key));

	// Process properties
	for (const key of allKeys) {
		if (shouldSkipProperty(key)) {
			continue;
		}

		try {
			const value = (texture as any)[key];
			if (value !== undefined && value !== null) {
				const type = determinePropertyType(value);
				if (type) {
					properties.push({ name: key, type, value });
				}
			}
		} catch {
			// Skip properties that can't be accessed
		}
	}

	// Sort: public first, then private
	return properties.sort((a, b) => {
		const aIsPrivate = a.name.startsWith("_");
		const bIsPrivate = b.name.startsWith("_");
		if (aIsPrivate && !bIsPrivate) {
			return 1;
		}
		if (!aIsPrivate && bIsPrivate) {
			return -1;
		}
		return a.name.localeCompare(b.name);
	});
}

// Check if property should be skipped
function shouldSkipProperty(key: string): boolean {
	if (key.startsWith("_") || key.startsWith("is") || key.startsWith("get") || key.startsWith("set")) {
		return true;
	}

	const skipProperties = [
		"constructor",
		"getClassName",
		"getSize",
		"__proto__",
		"hasOwnProperty",
		"isPrototypeOf",
		"propertyIsEnumerable",
		"toLocaleString",
		"toString",
		"valueOf",
		"defines",
		"useAlphaFromDiffuseTexture",
		"gammaSpace",
		"getAlphaFromRGB",
		"is2DArray",
		"is3D",
		"isBlocking",
		"isCube",
		"isEnabled",
		"canRescale",
		"invertY",
		"wrapR",
		"delayLoadState",
		"metadata",
		"reservedDataStore",
		"optimizeUVAllocation",
		"invertZ",
		"lodLevelInAlpha",
		"animations",
		"onDisposeObservable",
		"uniqueId",
		"url",
		"onLoadObservable",
		"name",
		"autoClear",
		"onGeneratedObservable",
		"onBeforeGenerationObservable",
		"nodeMaterialSource",
		"time",
		"timeScale",
		"translationSpeed",
		"updateShaderUniforms",
		"render",
		"resize",
		"serialize",
		"coordinatesIndex",
		"coordinatesMode",
		"wrapU",
		"wrapV",
		"uOffset",
		"vOffset",
		"uScale",
		"vScale",
		"lodGenerationOffset",
		"lodGenerationScale",
		"linearSpecularLOD",
		"irradianceTexture",
		"uid",
		"onDispose",
		"loadingError",
		"errorObject",
		"scale",
		"textureType",
		"textureFormat",
		"readPixels",
		"forceSphericalPolynomialsRecompute",
		"sphericalPolynomial",
		"samplingMode",
		"updateSamplingMode",
		"releaseInternalTexture",
		"homogeneousRotationInUVTransform",
		"inspectableCustomProperties",
		"shaderLanguage",
		"reset",
		"executeWhenReady",
		"resetRefreshCounter",
		"refreshRate",
		"clone",
		"dispose",
		"noMipmap",
		"mimeType",
		"updateURL",
		"delayLoad",
		"hasAlpha",
		"anisotropicFilteringLevel",
	];

	return skipProperties.includes(key);
}

// Determine property type
function determinePropertyType(value: any): string | null {
	const type = typeof value;

	if (type === "number" || type === "boolean" || type === "string") {
		return type;
	}

	// Check if it's a color object (has r, g, b properties)
	if (type === "object" && value && typeof value.r === "number" && typeof value.g === "number" && typeof value.b === "number") {
		return "color";
	}

	return null;
}

// Get property configuration
export function getPropertyConfig(propertyName: string) {
	const name = propertyName.toLowerCase();

	if (name.includes("scale") || name.includes("size")) {
		return PROPERTY_CONFIG.SCALE;
	}

	if (name.includes("count") || name.includes("number")) {
		return PROPERTY_CONFIG.COUNT;
	}

	if (name.includes("speed")) {
		return PROPERTY_CONFIG.SPEED;
	}

	if (name.includes("octaves")) {
		return PROPERTY_CONFIG.OCTAVES;
	}

	if (name.includes("amplitude") || name.includes("amp")) {
		return PROPERTY_CONFIG.AMPLITUDE;
	}

	return PROPERTY_CONFIG.SCALE;
}

// Format property label
export function formatPropertyLabel(propertyName: string): string {
	return propertyName
		.replace(/([A-Z])/g, " $1")
		.replace(/^./, (str) => str.toUpperCase())
		.trim();
}

// Update texture after property changes
export function updateTexture(texture: any): void {
	try {
		// Try common update methods
		if (typeof texture.updateShaderUniforms === "function") {
			texture.updateShaderUniforms();
		}
		if (typeof texture.refresh === "function") {
			texture.refresh();
		}
		if (typeof texture.render === "function") {
			texture.render(false);
		}
	} catch {
		// Silent fail in production
	}
}
