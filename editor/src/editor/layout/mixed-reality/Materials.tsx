import { StandardMaterial, Scene, Color3 } from "@babylonjs/core";

/**
 * Creates materials used in the mixed reality components
 */
export class MaterialFactory {
    /**
     * Creates a material for the VR headset cube.
     * @param scene The scene to create the material in
     * @returns A StandardMaterial for the VR headset
     */
    public static createHeadsetMaterial(scene: Scene): StandardMaterial {
        const material = new StandardMaterial("vr-headset-material", scene);
        material.diffuseColor = new Color3(0.2, 0.6, 1.0); // Blue color
        material.specularColor = new Color3(0.1, 0.3, 0.5);
        material.emissiveColor = new Color3(0.05, 0.15, 0.25);
        return material;
    }

    /**
     * Creates a material for the VR indicator.
     * @param scene The scene to create the material in
     * @returns A StandardMaterial for the VR indicator
     */
    public static createIndicatorMaterial(scene: Scene): StandardMaterial {
        const material = new StandardMaterial("vr-indicator-material", scene);
        material.diffuseColor = new Color3(0, 1, 0); // Green color
        material.emissiveColor = new Color3(0, 0.5, 0);
        return material;
    }

    /**
     * Creates a material for grid lines.
     * @param scene The scene to create the material in
     * @returns A StandardMaterial for grid lines
     */
    public static createGridLineMaterial(scene: Scene): StandardMaterial {
        const material = new StandardMaterial("grid-line-material", scene);
        material.diffuseColor = new Color3(0.3, 0.3, 0.3); // Dark gray
        material.alpha = 0.4; // Semi-transparent
        return material;
    }
}
