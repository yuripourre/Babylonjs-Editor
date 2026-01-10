# Custom Metadata Feature

## Overview

The custom metadata feature allows users to add arbitrary key-value pairs to Babylon.js objects (meshes, lights, cameras, transform nodes) through the editor UI. This metadata is preserved during serialization and can be used in your game/application logic.

## How It Works

### Data Structure

Custom metadata is stored in the object's metadata under the `customMetadata` property:

```javascript
myObject.metadata = {
  // Editor-specific metadata
  isLocked: false,
  doNotSerialize: false,
  
  // Your custom metadata
  customMetadata: {
    enemyType: "boss",
    health: "100",
    spawnPoint: "area1"
  }
}
```

### UI Location

The "Custom Metadata" section appears at the end of the inspector panel for:
- Transform Nodes
- Meshes (including instanced meshes)
- Lights
- Cameras

### Usage in the Editor

1. **Select an object** in the scene (mesh, light, camera, or transform node)
2. **Scroll to the bottom** of the inspector panel
3. **Find the "Custom Metadata" section**
4. **Click "Add"** to create a new key-value pair
5. **Enter a key name** (must start with a letter or underscore, and contain only letters, numbers, and underscores)
6. **Edit the value** by typing in the value field
7. **Remove entries** by clicking the X button next to each entry

### Serialization

When you export your project or save your scene, custom metadata is automatically included:

```json
{
  "meshes": [
    {
      "id": "box1",
      "name": "EnemyBox",
      "metadata": {
        "customMetadata": {
          "enemyType": "boss",
          "health": "100",
          "spawnPoint": "area1"
        }
      }
    }
  ]
}
```

### Using Custom Metadata in Your Code

Access custom metadata in your game scripts:

```typescript
// In a script attached to your object
export default class MyScript extends Script {
  public onStart(): void {
    const metadata = this._entity.metadata?.customMetadata;
    
    if (metadata) {
      console.log("Enemy Type:", metadata.enemyType);
      console.log("Health:", metadata.health);
      console.log("Spawn Point:", metadata.spawnPoint);
    }
  }
}
```

Or directly from scene loading:

```typescript
scene.meshes.forEach((mesh) => {
  const customMetadata = mesh.metadata?.customMetadata;
  
  if (customMetadata?.enemyType === "boss") {
    // Special handling for boss enemies
    setupBossEnemy(mesh, customMetadata);
  }
});
```

## Implementation Details

### Files Modified/Created

1. **UI Component**: `editor/src/editor/layout/inspector/metadata/custom-metadata.tsx`
   - Provides the inspector UI for adding/editing/removing custom metadata

2. **Inspector Integration**:
   - `editor/src/editor/layout/inspector/transform.tsx` - Added to transform nodes
   - `editor/src/editor/layout/inspector/mesh/mesh.tsx` - Added to meshes

3. **Serialization**: `editor/src/project/export/metadata.ts`
   - Ensures customMetadata is properly exported to Babylon JSON files

4. **Export Pipeline**: `editor/src/project/export/export.tsx`
   - Integrated custom metadata export into the project export process

### Key Design Decisions

1. **Separate Namespace**: Custom metadata is stored under `metadata.customMetadata` to avoid conflicts with internal editor metadata
2. **String Values Only**: All values are stored as strings for simplicity (you can parse them in your code as needed)
3. **Key Validation**: Keys must be valid JavaScript identifiers
4. **Auto-serialization**: Custom metadata is automatically included in all exports

## Best Practices

1. **Use Descriptive Keys**: Choose clear, semantic key names
   - ✅ Good: `enemyType`, `maxHealth`, `spawnZone`
   - ❌ Bad: `et`, `mh`, `sz`

2. **Document Your Schema**: Keep a list of metadata keys you're using
   - Create a constants file in your project
   - Use TypeScript interfaces to define expected metadata structure

3. **Parse Values Appropriately**: Remember all values are strings
   ```typescript
   const health = parseInt(metadata.health);
   const isActive = metadata.isActive === "true";
   ```

4. **Check for Existence**: Always check if metadata exists before accessing
   ```typescript
   const customMetadata = mesh.metadata?.customMetadata;
   if (customMetadata?.enemyType) {
     // Use the metadata
   }
   ```

## Example Use Cases

1. **Game Entity Configuration**
   - Enemy types and stats
   - Spawn point markers
   - Trigger zones

2. **Level Design**
   - Interactive object properties
   - Puzzle piece identifiers
   - Collectible item data

3. **Animation Control**
   - Animation clip names
   - Loop settings
   - Transition parameters

4. **Audio Triggers**
   - Sound effect names
   - Volume levels
   - Spatial audio settings

## Future Enhancements

Potential improvements for this feature:
- Support for different value types (numbers, booleans, arrays)
- Metadata templates for common use cases
- Import/export metadata from CSV or JSON files
- Metadata search and filtering in the scene hierarchy
