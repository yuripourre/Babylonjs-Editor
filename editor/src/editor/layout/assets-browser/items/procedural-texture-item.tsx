import { ReactNode } from "react";
import { AssetsBrowserItem } from "./item";
import { ProceduralTextureThumbnailRenderer } from "../renderers/procedural-texture-thumbnail";

export class AssetBrowserProceduralTextureItem extends AssetsBrowserItem {
	protected getContextMenuContent(): ReactNode {
		return null;
	}

	protected getIcon(): ReactNode {
		return (
			<div className="w-full h-full pointer-events-none">
				<ProceduralTextureThumbnailRenderer absolutePath={this.props.absolutePath} />
			</div>
		);
	}
}
