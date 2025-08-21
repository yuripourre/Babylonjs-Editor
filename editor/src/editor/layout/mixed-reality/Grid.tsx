import { Mesh, MeshBuilder, Vector3 } from "@babylonjs/core";
import { IGridProps } from "./types";
import { MaterialFactory } from "./Materials";

/**
 * Creates a grid mesh for better contrast and reference in the VR scene.
 */
export class Grid {
    /**
     * Creates a grid mesh for better contrast and reference.
     * @param props The grid properties
     * @returns The parent mesh containing all grid lines
     */
    public static create(props: IGridProps): Mesh {
        const { scene } = props;
        const gridSize = props.size || 10;
        const gridSpacing = props.spacing || 0.5;
        const gridLines: Mesh[] = [];
        
        // Create horizontal lines
        for (let i = -gridSize; i <= gridSize; i += gridSpacing) {
            const horizontalLine = MeshBuilder.CreateLines("grid-h-" + i, {
                points: [
                    new Vector3(-gridSize, 0, i),
                    new Vector3(gridSize, 0, i)
                ]
            }, scene);
            
            horizontalLine.material = MaterialFactory.createGridLineMaterial(scene);
            gridLines.push(horizontalLine);
        }
        
        // Create vertical lines
        for (let i = -gridSize; i <= gridSize; i += gridSpacing) {
            const verticalLine = MeshBuilder.CreateLines("grid-v-" + i, {
                points: [
                    new Vector3(i, 0, -gridSize),
                    new Vector3(i, 0, gridSize)
                ]
            }, scene);
            
            verticalLine.material = MaterialFactory.createGridLineMaterial(scene);
            gridLines.push(verticalLine);
        }
        
        // Create a parent mesh to group all grid lines
        const gridParent = MeshBuilder.CreateBox("grid-parent", { size: 0.1 }, scene);
        gridParent.setEnabled(false); // Hide the parent box
        
        // Parent all grid lines to the parent mesh
        gridLines.forEach(line => {
            line.parent = gridParent;
        });
        
        return gridParent;
    }
}
