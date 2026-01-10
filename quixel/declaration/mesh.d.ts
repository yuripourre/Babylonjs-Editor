import { Mesh } from "babylonjs";
import { Editor } from "babylonjs-editor";
import { QuixelLodListType } from "./typings";
export declare function importMeshes(editor: Editor, lodList: QuixelLodListType[]): Promise<Mesh[]>;
export declare function saveMeshesAsBabylonFormat(editor: Editor, meshes: Mesh[], assetFolder: string, variation?: number): Promise<void>;
