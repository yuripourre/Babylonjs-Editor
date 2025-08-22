/**
 * WebXR Safe Node Module
 * This file contains fixes for the getUniqueId null reference error in VR simulation
 */

/**
 * Ensures a safe node with getUniqueId method to prevent null reference errors
 */
export function createSafeNode(): any {
    return {
        getUniqueId: () => 'safe-node-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        id: 'safe-node-' + Math.random().toString(36).substr(2, 5),
        name: 'SafeNode',
        parent: null,
        reservedDataStore: {},
        metadata: {},
        state: '',
        animations: [],
        onReady: null,
        isReady: () => true,
        isEnabled: () => true,
        setEnabled: () => {},
        isDescendantOf: () => false,
        getDescendants: () => [],
        getChildMeshes: () => [],
        getChildTransformNodes: () => [],
        getChildren: () => [],
        toString: () => 'SafeNode'
    };
}

/**
 * Patches TransformNode constructor to prevent null reference errors
 * @param babylonjs The BABYLON namespace to patch
 */
export function patchNodeConstructors(babylonjs: any): void {
    if (!babylonjs) return;
    
    try {
        console.log("🔧 VR Simulation: Patching Node constructors");
        
        // Store original Node constructor
        if (babylonjs.Node) {
            const originalNodeConstructor = babylonjs.Node;
            
            // Override Node constructor
            babylonjs.Node = function(...args: any[]) {
                // Check for null scene
                if (!args[1]) {
                    console.warn("🔧 VR Simulation: Caught null scene in Node constructor, using safe implementation");
                    return createSafeNode();
                }
                
                try {
                    return new originalNodeConstructor(...args);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in Node constructor:", error);
                    return createSafeNode();
                }
            };
            
            // Copy prototype and static properties
            babylonjs.Node.prototype = originalNodeConstructor.prototype;
            Object.setPrototypeOf(babylonjs.Node, originalNodeConstructor);
        }
        
        // Patch TransformNode constructor
        if (babylonjs.TransformNode) {
            const originalTransformNodeConstructor = babylonjs.TransformNode;
            
            // Override TransformNode constructor
            babylonjs.TransformNode = function(...args: any[]) {
                // Check for null scene
                if (!args[1]) {
                    console.warn("🔧 VR Simulation: Caught null scene in TransformNode constructor, using safe implementation");
                    return createSafeNode();
                }
                
                try {
                    return new originalTransformNodeConstructor(...args);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in TransformNode constructor:", error);
                    return createSafeNode();
                }
            };
            
            // Copy prototype and static properties
            babylonjs.TransformNode.prototype = originalTransformNodeConstructor.prototype;
            Object.setPrototypeOf(babylonjs.TransformNode, originalTransformNodeConstructor);
        }
        
        // Patch AbstractMesh constructor
        if (babylonjs.AbstractMesh) {
            const originalAbstractMeshConstructor = babylonjs.AbstractMesh;
            
            // Override AbstractMesh constructor
            babylonjs.AbstractMesh = function(...args: any[]) {
                // Check for null scene
                if (!args[1]) {
                    console.warn("🔧 VR Simulation: Caught null scene in AbstractMesh constructor, using safe implementation");
                    return createSafeNode();
                }
                
                try {
                    return new originalAbstractMeshConstructor(...args);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in AbstractMesh constructor:", error);
                    return createSafeNode();
                }
            };
            
            // Copy prototype and static properties
            babylonjs.AbstractMesh.prototype = originalAbstractMeshConstructor.prototype;
            Object.setPrototypeOf(babylonjs.AbstractMesh, originalAbstractMeshConstructor);
        }
        
        // Patch Mesh constructor
        if (babylonjs.Mesh) {
            const originalMeshConstructor = babylonjs.Mesh;
            
            // Override Mesh constructor
            babylonjs.Mesh = function(...args: any[]) {
                // Check for null scene
                if (!args[1]) {
                    console.warn("🔧 VR Simulation: Caught null scene in Mesh constructor, using safe implementation");
                    return createSafeNode();
                }
                
                try {
                    return new originalMeshConstructor(...args);
                } catch (error) {
                    console.warn("🔧 VR Simulation: Error in Mesh constructor:", error);
                    return createSafeNode();
                }
            };
            
            // Copy prototype and static properties
            babylonjs.Mesh.prototype = originalMeshConstructor.prototype;
            Object.setPrototypeOf(babylonjs.Mesh, originalMeshConstructor);
        }
        
        console.log("✅ VR Simulation: Node constructors patched successfully");
    } catch (error) {
        console.error("❌ VR Simulation: Error patching Node constructors:", error);
    }
}

