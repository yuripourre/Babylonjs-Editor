import { PBRMaterial, Texture } from "babylonjs";
import { Editor } from "babylonjs-editor";
export declare class MaskPacker {
    /**
     * Packs the given reflectivity and microsurface maps.
     * @param editor defines the reference to the editor.
     * @param material defines the reference to the material being configured.
     * @param maskTexture defines the reference to the mask texture.
     * @param rootFolder defines the root folder where to write the resulted texture.
     */
    static Pack(editor: Editor, material: PBRMaterial, maskTexture: Texture | null, rootFolder: string): Promise<void>;
}
