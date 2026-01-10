import { PBRMaterial, Texture } from "babylonjs";
import { Editor } from "babylonjs-editor";
export declare class NormalDisplacementPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param bumpTexture defines the reference to the reflectivity texture.
     * @param displacementTexture defines the reference to the microsurface texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static Pack(editor: Editor, material: PBRMaterial, bumpTexture: Texture | null, displacementTexture: Texture | null, rootFolder: string): Promise<void>;
}
