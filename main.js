const MODULE_ID = `parallax-tiles`;

Hooks.once('setup', registerModuleSettings);

Hooks.once("init", async function() {
	console.log("parallax Module Test");
	
	game.parallaxTiles = {
		getParallaxTiles,
		parallaxafyTileArray,
		parallaxTileArray:[]
	};
});


Hooks.on("renderTileConfig", (app, html, data) => {
	html = html[0] ?? html;

	const wasLastActive = app.tabGroups.sheet == 'parallax';

	//create new tab
	if (wasLastActive) {
		html.form.querySelector(`.sheet-tabs`).insertAdjacentHTML("beforeend", `	
		<a data-action="tab" data-group="sheet" data-tab="parallax" class="active">
			<i class="fa-solid fa-house" inert=""></i>
			<span>Parallax</span>
		</a>
		`);
	} else {
		html.form.querySelector(`.sheet-tabs`).insertAdjacentHTML("beforeend", `	
		<a data-action="tab" data-group="sheet" data-tab="parallax">
			<i class="fa-solid fa-house" inert=""></i>
			<span>Parallax</span>
		</a>
		`);
	}

	const enableCheckbox = app.document.getFlag(MODULE_ID, "enable") ? "checked" : "";
	const modeSelector = app.document.getFlag(MODULE_ID, "mode") || 0
	const maxDisplacement = app.document.getFlag(MODULE_ID, "maxDisplacement") ?? getDefaultMaxDisplacement(); //make this default to 1 grid of px
	const parallaxFactor = app.document.getFlag(MODULE_ID, "parallaxFactor") ?? game.settings.get(MODULE_ID, "defaultParallaxFactor");
	const lockX = app.document.getFlag(MODULE_ID, "lockX") ? "checked" : "";
	const lockY = app.document.getFlag(MODULE_ID, "lockY") ? "checked" : "";

	let tabActiveOrNot = "tab";
	if (wasLastActive) {
		tabActiveOrNot = "tab active";
	}

	//create tab content
	html.form.querySelector(`.form-footer`).insertAdjacentHTML("beforebegin", `	
	<div class="${tabActiveOrNot}" data-group="sheet" data-tab="parallax" data-application-part="parallax">
		<p class="notes">Parallax-Tile Options Here.</p>
		<div class="form-group">
			<label>Enable Parallax Tile</label>
			<div class="form-fields">
				<input type="checkbox" name="flags.${MODULE_ID}.enable" ${enableCheckbox}>
			</div>
		</div>

		<div class="form-group">
			<label>Parallax Mode</label>
			<div class="form-fields">
			<select name="flags.${MODULE_ID}.mode" data-dtype="Number">
				<option value="0" ${modeSelector==0 ? "selected":""}>Mesh Mode</option>
				<option value="1" ${modeSelector==1 ? "selected":""}>Texture Mode</option>
			</select>
			</div>
			<p class="hint">Mesh Mode: The tiles mesh moves realitive to the canvis.</p>
			<p class="hint">Texture Mode: The tiles mesh stays still, but the texture movies. Requires seemless texture for best effect</p>
		</div>

		<div class="form-group">
			<label>Max Displacement</label>
			<div class="form-fields">
				<input type="number" step="any" name="flags.${MODULE_ID}.maxDisplacement" value="${maxDisplacement}" placeholder="${getDefaultMaxDisplacement()}">
			</div>
			<p class="hint">The maximum value in pixels that the token can be displaced from its origin. (Default to scene grid size)</p>
		</div>	

		<div class="form-group">
			<label>Parallax Factor</label>
			<div class="form-fields">
				<input type="text" step="0.1" name="flags.${MODULE_ID}.parallaxFactor" value="${parallaxFactor}" placeholder="${game.settings.get(MODULE_ID, "defaultParallaxFactor")}">
			</div>
			<p class="hint">Equation for determining the strength of the parallax in respect to the relative positions canvas.\nFor example you may enter <code>@elevation * 0.1</code> which will use 1/10th of the tiles elevation value for the Parallax Factor.</p>
		</div>

		<div class="form-group">
			<label>Lock Axis: <strong>X</strong></label>
			<div class="form-fields">
				<input type="checkbox" name="flags.${MODULE_ID}.lockX" ${lockX}>
			</div>
		</div>	
		<div class="form-group">
			<label>Lock Axis: <strong>Y</strong></label>
			<div class="form-fields">
				<input type="checkbox" name="flags.${MODULE_ID}.lockY" ${lockY}>
			</div>
		</div>	
	</div>		
	`);

});

Hooks.on("ready",() =>{
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	game.parallaxTiles.parallaxTileArray = getParallaxTiles();
	parallaxafyTileArray();
});

//For the preveiw
Hooks.on("refreshTile",(tile) => {
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	preComputeParallaxFactor(tile.document);

	game.parallaxTiles.parallaxTileArray = getParallaxTiles();
	parallaxafyTileArray();
});


Hooks.on("updateTile", (tile)=>{
	preComputeParallaxFactor(tile);
});

//make the magic happen!
Hooks.on("canvasPan", (scene, screenPosistion) => {
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	parallaxafyTileArray();
});

function isV14OrNewer() {
	return (game.release?.generation ?? Number(game.version.split(".")[0])) >= 14;
}

function isV12OrNewer() {
	return (game.release?.generation ?? Number(game.version.split(".")[0])) >= 12;
}

function getTileMeshCenter(tile) {
	// In Foundry V14, Tile#mesh#position is equal to TileDocument#x/y.
	// TileDocument#x/y now represents the anchor position, not always the top-left corner.
	if (isV14OrNewer()) {
		const anchorX = Number(tile.texture?.anchorX ?? 0);
		const anchorY = Number(tile.texture?.anchorY ?? 0);

		return {
			x: Number(tile.x ?? 0) + ((0.5 - anchorX) * Number(tile.width ?? 0)),
			y: Number(tile.y ?? 0) + ((0.5 - anchorY) * Number(tile.height ?? 0))
		};
	}

	// Legacy V11-V13 behavior
	return {
		x: tile.object.x + tile.object.mesh.width / 2,
		y: tile.object.y + tile.object.mesh.height / 2
	};
}

function getTileMeshBasePosition(tile) {
	// In V14, mesh.x/y should be based on TileDocument x/y.
	if (isV14OrNewer()) {
		return {
			x: Number(tile.x ?? 0),
			y: Number(tile.y ?? 0)
		};
	}

	// In V11-V13, preserve the old module behavior.
	return getTileMeshCenter(tile);
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function getCanvasZoomFactor() {
	const zoom = canvas.stage.scale.x || 1;
	return clamp(Math.sqrt(zoom), 0.1, 2.50);
}

function parallaxafyTileArray(){
	for(const tile of game.parallaxTiles.parallaxTileArray){
		parallaxafyTile(tile);
	}
}

function parallaxafyTile(tile){
	if(tile.getFlag(MODULE_ID, "mode")){
		parallaxafyTileTexture(tile);
	} else {
		parallaxafyTileMesh(tile);
	}
}

function preComputeParallaxFactor(tile) {
	const rawParallaxFactor = tile.getFlag(MODULE_ID, "parallaxFactor");
	const defaultParallaxFactor = game.settings.get(MODULE_ID, "defaultParallaxFactor") ?? "1";

	const useDefault =
		rawParallaxFactor === undefined ||
		rawParallaxFactor === null ||
		rawParallaxFactor === "";

	const input = String(useDefault ? defaultParallaxFactor : rawParallaxFactor).trim();

	// Input is neither a number nor a valid mathematical equation
	if (input === "") {
		return tile.precomputedParallaxFactor = Number(defaultParallaxFactor) || 1;
	}

	const numericInput = Number(input);

	// Check if the input is only a number
	if (Number.isFinite(numericInput)) {
		return tile.precomputedParallaxFactor = numericInput;
	}

	const elevation = Math.abs(Number(tile.elevation ?? 0));
	const formula = input.replaceAll("@elevation", String(elevation));

	try {
		const r = new Roll(formula);

		if (r.isDeterministic) {
			if (isV12OrNewer()) { // Check V12+
				r.evaluateSync();
			} else {
				r.roll({ async: false }); // V11 support
			}
			return tile.precomputedParallaxFactor = r.total;
		}
	} catch (err) {
		console.warn("Parallax Tiles | Invalid parallax factor:", input, err);
	}

	const fallback = Number(defaultParallaxFactor);
	return tile.precomputedParallaxFactor = Number.isFinite(fallback) ? fallback : 1;
}

function computeParallaxFactor(tile){
	if(tile.precomputedParallaxFactor) return tile.precomputedParallaxFactor;

	return preComputeParallaxFactor(tile);
}

function parallaxafyTileMesh(tile){
	const lockX = tile.getFlag(MODULE_ID, "lockX");
	const lockY = tile.getFlag(MODULE_ID, "lockY");
	const parallaxFactor = computeParallaxFactor(tile);

	const maxOffset = tile.getFlag(MODULE_ID, "maxDisplacement") ?? getDefaultMaxDisplacement();
	
	if(lockX && lockY || !parallaxFactor || !maxOffset) return;

	// V14+ center calculation
	const objectMeshCenter = getTileMeshCenter(tile);
	const objectMeshBase = getTileMeshBasePosition(tile);

	// Calculate the distance between the camera center and the object's mesh center
	let deltaX = canvas.stage.pivot.x - objectMeshCenter.x;
	let deltaY = canvas.stage.pivot.y - objectMeshCenter.y;

	const zoomFactor = getCanvasZoomFactor();

	// Apply the parallax effect
	let rawParallaxOffsetX = deltaX * parallaxFactor * 0.1 * zoomFactor;
	let rawParallaxOffsetY = deltaY * parallaxFactor * 0.1 * zoomFactor;

	// Constrain the parallax offset using a smooth approach with tanh
	let parallaxOffsetX = maxOffset * Math.tanh(rawParallaxOffsetX / maxOffset);
	let parallaxOffsetY = maxOffset * Math.tanh(rawParallaxOffsetY / maxOffset);

	// Calculate the new position of the object's mesh
	if(!lockX) tile.object.mesh.x = objectMeshBase.x - parallaxOffsetX;
	if(!lockY) tile.object.mesh.y = objectMeshBase.y - parallaxOffsetY;
}

function parallaxafyTileTexture(tile){
	const lockX = tile.getFlag(MODULE_ID, "lockX");
	const lockY = tile.getFlag(MODULE_ID, "lockY");
	const parallaxFactor = computeParallaxFactor(tile);
	const maxOffset = tile.getFlag(MODULE_ID, "maxDisplacement") ?? getDefaultMaxDisplacement();

	if(lockX && lockY || !parallaxFactor || !maxOffset) return;

	//convert texture space to world space?
	//tile.object.mesh.texture.orig.width
	//tile.width

	//should this use linear calculation instead? Include option to choose between hyperbolic tangent and linear?

	// V14+ center calculate
	const objectMeshCenter = getTileMeshCenter(tile);

	const zoomFactor = getCanvasZoomFactor();

	// Calculate the distance between the camera center and the object's mesh center
	let deltaX = canvas.stage.pivot.x - objectMeshCenter.x * zoomFactor;
	let deltaY = canvas.stage.pivot.y - objectMeshCenter.y * zoomFactor;

	// Apply the parallax effect
	let rawParallaxOffsetX = deltaX * parallaxFactor * 0.1;
	let rawParallaxOffsetY = deltaY * parallaxFactor * 0.1;

	// Constrain the parallax offset using a smooth approach with tanh
	let parallaxOffsetX = maxOffset * Math.tanh(rawParallaxOffsetX / maxOffset);
	let parallaxOffsetY = maxOffset * Math.tanh(rawParallaxOffsetY / maxOffset);

	// V14: in Texture Mode the mesh itself should remain at its base TileDocument position.
	if (isV14OrNewer()) {
		if(!lockX) tile.object.mesh.x = tile.x;
		if(!lockY) tile.object.mesh.y = tile.y;
	}

	// Calculate the new position of the object's mesh
	if(!lockX) tile.object.mesh.texture.orig.x = parallaxOffsetX;
	if(!lockY) tile.object.mesh.texture.orig.y = parallaxOffsetY;

	tile.object.mesh.texture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
	tile.object.mesh.texture.update()
}

function getParallaxTiles(){
	const parallaxTiles = [];
	for(const t of canvas.scene.tiles){
		if(t.getFlag(MODULE_ID, "enable")){
			parallaxTiles.push(t);
		}
	}
	return parallaxTiles;
}

function getDefaultMaxDisplacement(){
	return canvas.scene.grid.size;
}


// will make more efficnet in future, but just refresh the array of tiles
Hooks.on("deleteTile",() =>{
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	game.parallaxTiles.parallaxTileArray = getParallaxTiles();
});

Hooks.on("createTile",() =>{
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	game.parallaxTiles.parallaxTileArray = getParallaxTiles();
});

Hooks.on("drawTilesLayer",() =>{
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	game.parallaxTiles.parallaxTileArray = getParallaxTiles();
});

//clear the array on canvasTearDown
Hooks.on("canvasTearDown",() =>{
	if(!game.settings.get(MODULE_ID, "enableClient")) return;
	game.parallaxTiles.parallaxTileArray = [];
});


function registerModuleSettings() {

	game.settings.register(MODULE_ID, "enableClient", {
		name: "Enable on Client",
		hint: "Enables Parallax Tiles to render on this game client.",
		scope: "client",
		config: true,
		type: Boolean,

		default: true,
		onChange: () => canvas.draw(),
	});

	game.settings.register(MODULE_ID, "defaultParallaxFactor",{
		name: "Default Parallax Factor",
		hint: "Equation for determining the strength of the default parallax Factor. If parallax factor is left blank, this value will be used.",
		scope: "global",
		config: true,
		type: String,
		default: "1",
		onChange: () => canvas.draw(),
	})
}