import { PBRMaterial, Texture } from "babylonjs";
import { Editor } from "babylonjs-editor";
export declare class AlbedoOpacityPacker {
    /**
     * Packs the given albedo and opacity maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param albedoTexture defines the reference to the albedo texture.
     * @param opacityTexture defines the reference to the opacity texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static Pack(editor: Editor, material: PBRMaterial, albedoTexture: Texture | null, opacityTexture: Texture | null, rootFolder: string): Promise<void>;
}
