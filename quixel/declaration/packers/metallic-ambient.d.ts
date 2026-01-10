import { PBRMaterial, Texture } from "babylonjs";
import { Editor } from "babylonjs-editor";
export declare class MetallicAmbientPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param metallicTexture defines the reference to the metallic texture.
     * @param roughnessTexture defines the reference to the roughness texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static Pack(editor: Editor, material: PBRMaterial, metallicTexture: Texture | null, ambientTexture: Texture | null, rootFolder: string): Promise<void>;
}
