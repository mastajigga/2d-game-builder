import { emitEditorEvent } from "./EditorBridge";
import { ASSET_CATALOG, getFullCatalog, createClone } from "../level/AssetCatalog";
import { SpriteEditorUI } from "./SpriteEditorUI";
import { StateMachineEditor } from "./StateMachineEditor";
import { HitboxEditor, type HitboxFrameData } from "./HitboxEditor";
import { exportGIF, exportAPNG, captureFramesFromSheet, downloadBlob } from "./AnimationExport";
import { AnimationLivePreview } from "./AnimationLivePreview";
import { CharacterCompareView } from "./CharacterCompare";
import { analyzePart, suggestConnections, type RigPart } from "./AutoRig";
import { ParticlePreviewUI } from "./ParticlePreview";
import { SoundMapperModal, type SoundEvent } from "./SoundMapper";

interface AnimState {
  key: string;
  label: string;
  frameStart: number;
  frameEnd: number;
  frameRate: number;
  repeat: boolean;
  transitions: Array<{ to: string; condition: string }>;
}

function generateDefaultStates(totalFrames: number): AnimState[] {
  // Single "anim" state spanning all frames — user can customise from there
  const n = Math.max(1, totalFrames);
  return [
    { key: "anim", label: "Anim", frameStart: 0, frameEnd: n - 1, frameRate: 10, repeat: true, transitions: [] },
  ];
}

export class AnimationPageUI {
  private root: HTMLElement;
  private visible = false;
  private selectedAssetId: string | null = null;
  private states: AnimState[] = [];
  private currentState = "anim";
  private isPlaying = false;
  private playInterval: number | null = null;
  private currentFrame = 0;
  private speed = 1;
  private onionSkin = false;
  private spriteCanvas: HTMLCanvasElement | null = null;
  private onionCanvas: HTMLCanvasElement | null = null;
  private frameInfo: HTMLElement | null = null;
  private filmstripEl: HTMLElement | null = null;
  private zoom = 2;
  private sheetImg: HTMLImageElement | null = null;
  private sheetLoaded = false;
  private currentAssetId: string | null = null;
  private spriteEditor: SpriteEditorUI | null = null;
  private sidebarWidth = 320; // default, resizable
  private smEditor: StateMachineEditor | null = null;
  private customFramesPerRow = 0;
  private customPadding = 0;
  private hitboxEditor: HitboxEditor | null = null;
  private hitboxData: HitboxFrameData[] = [];
  private showHitboxes = false;
  private livePreview: AnimationLivePreview | null = null;
  private livePreviewContainer: HTMLElement | null = null;
  private livePreviewVisible = false;
  private compareView: CharacterCompareView | null = null;
  private compareContainer: HTMLElement | null = null;
  private compareVisible = false;
  private particleUI: ParticlePreviewUI | null = null;
  private soundEvents: SoundEvent[] = [];
  private soundMapper: SoundMapperModal | null = null;

  constructor(containerId: string) {
    this.root = document.getElementById(containerId)!;
    if (!this.root) throw new Error(`AnimationPageUI: #${containerId} not found`);
    (window as any).__animDebug = this;
    this._build();
  }

  show(): void {
    this.visible = true;
    this.root.classList.add("visible");
  }

  hide(): void {
    this.visible = false;
    this.root.classList.remove("visible");
    this._stop();
  }

  isVisible(): boolean {
    return this.visible;
  }

  // ──────────────────────────────────────────────────────────────────────────────────────

  private _build(): void {
    this.root.innerHTML = "";
    this.root.className = "page-container animation-page-container";

    // Header
    const header = document.createElement("div");
    header.className = "page-header";
    header.innerHTML = `<h1>\ud83c\udfa8 Animation Lab</h1>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "page-close-btn";
    closeBtn.textContent = "\u2715 Fermer";
    closeBtn.addEventListener("click", () => {
      this.hide();
      emitEditorEvent("menu-show", {});
    });
    header.appendChild(closeBtn);
    this.root.appendChild(header);

    // Toolbar: asset selector + controls
    const toolbar = document.createElement("div");
    toolbar.className = "anim-toolbar";

    const assetSelect = document.createElement("select");
    assetSelect.className = "prop-input-text";
    assetSelect.style.width = "220px";
    const spritesheets = getFullCatalog().filter((a) => a.sheetPath && (a.category === "enemy" || a.category === "spawn"));
    for (const asset of spritesheets) {
      const opt = document.createElement("option");
      opt.value = asset.id;
      opt.textContent = asset.label;
      assetSelect.appendChild(opt);
    }
    if (spritesheets.length === 0) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "Aucun character";
      assetSelect.appendChild(opt);
    }
    assetSelect.addEventListener("change", () => {
      this.selectedAssetId = assetSelect.value || null;
      this._regenerateStates();
      this._renderPreview();
    });
    this.selectedAssetId = spritesheets[0]?.id ?? null;
    this._regenerateStates();
    toolbar.appendChild(assetSelect);

    const cloneBtn = document.createElement("button");
    cloneBtn.className = "panel-btn";
    cloneBtn.textContent = "Cloner";
    cloneBtn.addEventListener("click", () => this._showCloneModal(assetSelect));
    toolbar.appendChild(cloneBtn);

    const playBtn = document.createElement("button");
    playBtn.className = "panel-btn primary";
    playBtn.textContent = "\u25b6 Play";
    playBtn.addEventListener("click", () => this._togglePlay());
    toolbar.appendChild(playBtn);

    const prevBtn = document.createElement("button");
    prevBtn.className = "panel-btn";
    prevBtn.textContent = "\u25c0 Prev";
    prevBtn.addEventListener("click", () => this._step(-1));
    toolbar.appendChild(prevBtn);

    const nextBtn = document.createElement("button");
    nextBtn.className = "panel-btn";
    nextBtn.textContent = "Next \u25b6";
    nextBtn.addEventListener("click", () => this._step(1));
    toolbar.appendChild(nextBtn);

    const speedLbl = document.createElement("label");
    speedLbl.textContent = "Vitesse:";
    speedLbl.style.marginLeft = "12px";
    toolbar.appendChild(speedLbl);

    const speedInput = document.createElement("input");
    speedInput.type = "range";
    speedInput.min = "0.25";
    speedInput.max = "2";
    speedInput.step = "0.25";
    speedInput.value = "1";
    speedInput.addEventListener("input", () => {
      this.speed = parseFloat(speedInput.value);
      if (this.isPlaying) { this._stop(); this._start(); }
    });
    toolbar.appendChild(speedInput);

    const onionToggle = document.createElement("button");
    onionToggle.className = "prop-btn-toggle off";
    onionToggle.textContent = "Onion Skin";
    onionToggle.addEventListener("click", () => {
      this.onionSkin = !this.onionSkin;
      onionToggle.classList.toggle("on", this.onionSkin);
      onionToggle.classList.toggle("off", !this.onionSkin);
      this._renderPreview();
    });
    toolbar.appendChild(onionToggle);

    const zoomLbl = document.createElement("label");
    zoomLbl.textContent = "Zoom:";
    zoomLbl.style.marginLeft = "12px";
    toolbar.appendChild(zoomLbl);

    const zoomInput = document.createElement("input");
    zoomInput.type = "range";
    zoomInput.min = "0.5";
    zoomInput.max = "8";
    zoomInput.step = "0.5";
    zoomInput.value = String(this.zoom);
    zoomInput.style.width = "80px";
    zoomInput.addEventListener("input", () => {
      this.zoom = parseFloat(zoomInput.value);
      this._applyZoom();
    });
    toolbar.appendChild(zoomInput);

    const zoomVal = document.createElement("span");
    zoomVal.textContent = `${this.zoom}x`;
    zoomVal.style.fontSize = "11px";
    zoomVal.style.color = "var(--text-secondary)";
    zoomVal.style.minWidth = "28px";
    zoomInput.addEventListener("input", () => {
      zoomVal.textContent = `${zoomInput.value}x`;
    });
    toolbar.appendChild(zoomVal);

    const exportBtn = document.createElement("button");
    exportBtn.className = "panel-btn";
    exportBtn.textContent = "Exporter JSON";
    exportBtn.addEventListener("click", () => this._exportJSON());
    toolbar.appendChild(exportBtn);

    const exportGifBtn = document.createElement("button");
    exportGifBtn.className = "panel-btn";
    exportGifBtn.textContent = "GIF ⬇";
    exportGifBtn.title = "Exporter en GIF animé";
    exportGifBtn.addEventListener("click", () => this._exportGIF());
    toolbar.appendChild(exportGifBtn);

    const exportApngBtn = document.createElement("button");
    exportApngBtn.className = "panel-btn";
    exportApngBtn.textContent = "APNG ⬇";
    exportApngBtn.title = "Exporter en APNG";
    exportApngBtn.addEventListener("click", () => this._exportAPNG());
    toolbar.appendChild(exportApngBtn);

    // Separator
    const sep1 = document.createElement("span");
    sep1.style.width = "1px";
    sep1.style.height = "24px";
    sep1.style.background = "var(--border)";
    sep1.style.margin = "0 4px";
    toolbar.appendChild(sep1);

    // Layout editor controls
    const layoutLbl = document.createElement("label");
    layoutLbl.textContent = "Layout:";
    layoutLbl.style.fontSize = "11px";
    layoutLbl.style.marginLeft = "4px";
    toolbar.appendChild(layoutLbl);

    const fprInput = document.createElement("input");
    fprInput.type = "number";
    fprInput.min = "1";
    fprInput.max = "20";
    fprInput.value = "0";
    fprInput.placeholder = "F/R";
    fprInput.style.width = "42px";
    fprInput.className = "prop-input-text";
    fprInput.title = "Frames per row (0 = auto)";
    fprInput.addEventListener("change", () => {
      this.customFramesPerRow = parseInt(fprInput.value) || 0;
      this._redrawAll();
    });
    toolbar.appendChild(fprInput);

    const padInput = document.createElement("input");
    padInput.type = "number";
    padInput.min = "0";
    padInput.max = "16";
    padInput.value = "0";
    padInput.placeholder = "px";
    padInput.style.width = "38px";
    padInput.className = "prop-input-text";
    padInput.title = "Padding entre frames (px)";
    padInput.addEventListener("change", () => {
      this.customPadding = parseInt(padInput.value) || 0;
      this._redrawAll();
    });
    toolbar.appendChild(padInput);

    // Separator
    const sep2 = document.createElement("span");
    sep2.style.width = "1px";
    sep2.style.height = "24px";
    sep2.style.background = "var(--border)";
    sep2.style.margin = "0 4px";
    toolbar.appendChild(sep2);

    const hitboxBtn = document.createElement("button");
    hitboxBtn.className = "prop-btn-toggle off";
    hitboxBtn.textContent = "Hitboxes";
    hitboxBtn.title = "Afficher/éditer les hitboxes";
    hitboxBtn.addEventListener("click", () => {
      this.showHitboxes = !this.showHitboxes;
      hitboxBtn.classList.toggle("on", this.showHitboxes);
      hitboxBtn.classList.toggle("off", !this.showHitboxes);
      this._toggleHitboxes();
    });
    toolbar.appendChild(hitboxBtn);

    const liveBtn = document.createElement("button");
    liveBtn.className = "prop-btn-toggle off";
    liveBtn.textContent = "Live";
    liveBtn.title = "Aperçu live Phaser";
    liveBtn.addEventListener("click", () => {
      this.livePreviewVisible = !this.livePreviewVisible;
      liveBtn.classList.toggle("on", this.livePreviewVisible);
      liveBtn.classList.toggle("off", !this.livePreviewVisible);
      this._toggleLivePreview(liveBtn);
    });
    toolbar.appendChild(liveBtn);

    const compareBtn = document.createElement("button");
    compareBtn.className = "prop-btn-toggle off";
    compareBtn.textContent = "Comparer";
    compareBtn.title = "Comparer 2 personnages";
    compareBtn.addEventListener("click", () => {
      this.compareVisible = !this.compareVisible;
      compareBtn.classList.toggle("on", this.compareVisible);
      compareBtn.classList.toggle("off", !this.compareVisible);
      this._toggleCompare();
    });
    toolbar.appendChild(compareBtn);

    const particleBtn = document.createElement("button");
    particleBtn.className = "prop-btn-toggle off";
    particleBtn.textContent = "Particules";
    particleBtn.title = "Éditeur de particules";
    particleBtn.addEventListener("click", () => {
      const isOpen = this.particleUI?.isVisible();
      if (isOpen) {
        this.particleUI?.hide();
        particleBtn.classList.remove("on");
        particleBtn.classList.add("off");
      } else {
        this._showParticleEditor(particleBtn);
      }
    });
    toolbar.appendChild(particleBtn);

    const soundBtn = document.createElement("button");
    soundBtn.className = "panel-btn";
    soundBtn.textContent = "Sons 🔊";
    soundBtn.title = "Sound Mapper — associer des sons aux animations";
    soundBtn.addEventListener("click", () => this._showSoundMapper());
    toolbar.appendChild(soundBtn);

    const rigBtn = document.createElement("button");
    rigBtn.className = "panel-btn";
    rigBtn.textContent = "Auto-Rig";
    rigBtn.title = "Suggérer des points de pivot";
    rigBtn.addEventListener("click", () => this._showAutoRigModal());
    toolbar.appendChild(rigBtn);

    this.root.appendChild(toolbar);

    // Main area: preview + sidebar
    const main = document.createElement("div");
    main.className = "anim-main";

    // Preview canvas area
    const previewWrap = document.createElement("div");
    previewWrap.className = "anim-preview-wrap";

    const previewBg = document.createElement("div");
    previewBg.className = "anim-preview-bg";

    this.spriteCanvas = document.createElement("canvas");
    this.spriteCanvas.className = "anim-sprite-canvas";
    previewBg.appendChild(this.spriteCanvas);

    this.onionCanvas = document.createElement("canvas");
    this.onionCanvas.className = "anim-onion-canvas";
    previewBg.appendChild(this.onionCanvas);

    // Live preview container (hidden by default)
    this.livePreviewContainer = document.createElement("div");
    this.livePreviewContainer.className = "anim-live-preview";
    this.livePreviewContainer.style.display = "none";
    previewBg.appendChild(this.livePreviewContainer);

    // Hitbox overlay canvas (managed by HitboxEditor, inserted later)
    const hitboxCanvasContainer = document.createElement("div");
    hitboxCanvasContainer.className = "hitbox-canvas-container";
    hitboxCanvasContainer.id = "hitbox-canvas-container";
    previewBg.appendChild(hitboxCanvasContainer);

    previewWrap.appendChild(previewBg);

    // Filmstrip (all frames of the set)
    this.filmstripEl = document.createElement("div");
    this.filmstripEl.className = "anim-filmstrip";
    previewWrap.appendChild(this.filmstripEl);

    this.frameInfo = document.createElement("div");
    this.frameInfo.className = "anim-frame-info";
    previewWrap.appendChild(this.frameInfo);

    main.appendChild(previewWrap);

    // Resize handle between preview and sidebar
    const handle = document.createElement("div");
    handle.className = "anim-resize-handle";
    main.appendChild(handle);

    // Sidebar: tabbed state machine + properties
    const sidebar = document.createElement("div");
    sidebar.className = "anim-sidebar";
    sidebar.style.width = `${this.sidebarWidth}px`;
    this._setupResizeHandle(handle, sidebar);
    main.appendChild(sidebar);

    // Tab bar: [Graph] [List]
    const tabBar = document.createElement("div");
    tabBar.className = "sm-tab-bar";

    const graphTab = document.createElement("button");
    graphTab.className = "sm-tab-btn active";
    graphTab.textContent = "Graph";
    const listTab = document.createElement("button");
    listTab.className = "sm-tab-btn";
    listTab.textContent = "List";
    tabBar.appendChild(graphTab);
    tabBar.appendChild(listTab);
    sidebar.appendChild(tabBar);

    // Graph container
    const graphContainer = document.createElement("div");
    graphContainer.className = "sm-graph-container";
    graphContainer.style.display = "block";
    sidebar.appendChild(graphContainer);

    // List container
    const listContainer = document.createElement("div");
    listContainer.className = "sm-list-container";
    listContainer.style.display = "none";
    listContainer.style.overflowY = "auto";
    listContainer.style.flex = "1";
    sidebar.appendChild(listContainer);

    // Tab switching
    graphTab.addEventListener("click", () => {
      graphTab.classList.add("active");
      listTab.classList.remove("active");
      graphContainer.style.display = "block";
      listContainer.style.display = "none";
      if (this.smEditor) {
        this.smEditor.sync(this.states);
      }
    });

    listTab.addEventListener("click", () => {
      listTab.classList.add("active");
      graphTab.classList.remove("active");
      graphContainer.style.display = "none";
      listContainer.style.display = "block";
      this._buildStateList(listContainer);
    });

    // Initialize StateMachineEditor
    this.smEditor = new StateMachineEditor(graphContainer, this.states, (newStates) => {
      this.states = newStates;
      // Rebuild list view if visible
      if (listContainer.style.display !== "none") {
        this._buildStateList(listContainer);
      }
    });

    // Toolbar below graph
    const graphToolbar = document.createElement("div");
    graphToolbar.className = "sm-graph-toolbar";

    const addStateBtn = document.createElement("button");
    addStateBtn.className = "panel-btn";
    addStateBtn.textContent = "+ Ajouter État";
    addStateBtn.addEventListener("click", () => this._showNewAnimModal());
    graphToolbar.appendChild(addStateBtn);

    const autoLayoutBtn = document.createElement("button");
    autoLayoutBtn.className = "panel-btn";
    autoLayoutBtn.textContent = "Auto Layout";
    autoLayoutBtn.addEventListener("click", () => {
      this._autoLayoutStates();
      if (this.smEditor) this.smEditor.sync(this.states);
    });
    graphToolbar.appendChild(autoLayoutBtn);

    sidebar.appendChild(graphToolbar);

    // Frame properties (below graph toolbar)
    const propsHeader = document.createElement("h3");
    propsHeader.textContent = "Propriétés de la frame";
    propsHeader.style.marginTop = "10px";
    sidebar.appendChild(propsHeader);

    const props = document.createElement("div");
    props.className = "anim-props";
    props.innerHTML = `
      <div class="prop-row"><span class="prop-label">Frame</span><span class="prop-value" id="anim-prop-frame">0</span></div>
      <div class="prop-row"><span class="prop-label">Duration</span><span class="prop-value" id="anim-prop-dur">100ms</span></div>
      <div class="prop-row"><span class="prop-label">Loop</span><span class="prop-value" id="anim-prop-loop">Oui</span></div>
    `;
    sidebar.appendChild(props);

    // Build initial list view content
    this._buildStateList(listContainer);

    main.appendChild(sidebar);
    this.root.appendChild(main);

    // Timeline
    const timeline = document.createElement("div");
    timeline.className = "anim-timeline";
    const timelineHeader = document.createElement("div");
    timelineHeader.className = "anim-timeline-header";
    timelineHeader.textContent = "Timeline";
    timeline.appendChild(timelineHeader);

    const track = document.createElement("div");
    track.className = "anim-track";
    for (let i = 0; i <= 40; i++) {
      const tick = document.createElement("div");
      tick.className = "anim-tick";
      tick.textContent = String(i);
      tick.dataset.frame = String(i);
      tick.addEventListener("click", () => {
        this.currentFrame = i;
        this._renderPreview();
      });
      track.appendChild(tick);
    }
    timeline.appendChild(track);
    this.root.appendChild(timeline);

    // Compare container (hidden by default)
    this.compareContainer = document.createElement("div");
    this.compareContainer.id = "compare-container";
    this.root.appendChild(this.compareContainer);
    this.compareView = new CharacterCompareView(this.compareContainer, () => {
      this.compareVisible = false;
      this._toggleCompare();
    });

    // Particle container (hidden by default)
    const particleContainer = document.createElement("div");
    particleContainer.id = "particle-preview-container";
    this.root.appendChild(particleContainer);
    this.particleUI = new ParticlePreviewUI(particleContainer, () => {
      // Find the particle button and toggle it off
      const btns = this.root.querySelectorAll(".prop-btn-toggle");
      btns.forEach(b => { if (b.textContent === "Particules") { b.classList.remove("on"); b.classList.add("off"); }});
    });

    this._renderPreview();
  }

  private _setupResizeHandle(handle: HTMLElement, sidebar: HTMLElement): void {
    const MIN_W = 200;
    const MAX_W = 800;
    let startX = 0;
    let startW = 0;
    let dragging = false;

    handle.addEventListener("mousedown", (e: MouseEvent) => {
      e.preventDefault();
      dragging = true;
      startX = e.clientX;
      startW = this.sidebarWidth;
      handle.classList.add("active");
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (e: MouseEvent) => {
      if (!dragging) return;
      const dx = startX - e.clientX;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW + dx));
      this.sidebarWidth = newW;
      sidebar.style.width = `${newW}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove("active");
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    });
  }

  private _regenerateStates(): void {
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    const totalFrames = asset?.totalFrames ?? 0;
    this.states = totalFrames > 0 ? generateDefaultStates(totalFrames) : [];
    this.currentState = this.states[0]?.key ?? "anim";
    this.currentFrame = 0;
    // Sync state machine editor
    if (this.smEditor) this.smEditor.sync(this.states);
    // Rebuild list view if visible
    const listContainer = this.root.querySelector(".sm-list-container") as HTMLElement;
    if (listContainer && listContainer.style.display !== "none") this._buildStateList(listContainer);
  }

  private _getCurrentState(): AnimState | undefined {
    return this.states.find((s) => s.key === this.currentState);
  }

  private _renderPreview(): void {
    if (!this.spriteCanvas || !this.frameInfo) return;
    const state = this._getCurrentState();
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.textureKey) {
      this.spriteCanvas.style.display = "none";
      if (this.onionCanvas) this.onionCanvas.style.display = "none";
      return;
    }

    const basePath = (window as any).__oakwoods_basePath ?? "";
    const imgPath = asset.imagePath ?? asset.sheetPath ?? `${asset.textureKey}.png`;
    const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http")
      ? imgPath
      : `${basePath}/${imgPath}`;

    this.spriteCanvas.style.display = "block";

    if (this.currentAssetId !== this.selectedAssetId || !this.sheetImg) {
      this.currentAssetId = this.selectedAssetId;
      this.sheetLoaded = false;
      this.sheetImg = new Image();
      this.sheetImg.crossOrigin = "anonymous";
      this.sheetImg.onload = () => {
        this.sheetLoaded = true;
        this._redrawAll();
      };
      this.sheetImg.onerror = () => {
        this.sheetLoaded = false;
        if (this.spriteCanvas) this.spriteCanvas.style.display = "none";
      };
      this.sheetImg.src = fullPath;
    } else if (this.sheetLoaded) {
      this._redrawAll();
    }

    const frame = this.currentFrame;
    this.frameInfo.textContent = `${state?.label ?? "?"} | Frame ${frame} / ${state?.frameEnd ?? "?"}`;

    const propFrame = document.getElementById("anim-prop-frame");
    const propDur = document.getElementById("anim-prop-dur");
    const propLoop = document.getElementById("anim-prop-loop");
    if (propFrame) propFrame.textContent = String(frame);
    if (propDur) propDur.textContent = state ? `${Math.round(1000 / state.frameRate)}ms` : "-";
    if (propLoop) propLoop.textContent = state?.repeat ? "Oui" : "Non";

    // Highlight timeline tick
    const ticks = this.root.querySelectorAll(".anim-tick");
    ticks.forEach((t) => t.classList.toggle("active", parseInt((t as HTMLElement).dataset.frame ?? "-1") === frame));
  }

  private _redrawAll(): void {
    if (!this.spriteCanvas || !this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset) return;

    const fw = asset.frameW;
    const fh = asset.frameH;

    if (fw && fh && this.sheetImg.naturalWidth > 0) {
      this._drawFrame(this.spriteCanvas, this.currentFrame, true);
      // Onion skin
      if (this.onionCanvas) {
        const state = this._getCurrentState();
        if (this.onionSkin && this.currentFrame > (state?.frameStart ?? 0)) {
          this._drawFrame(this.onionCanvas, this.currentFrame - 1, false);
          this.onionCanvas.style.display = "block";
          this.onionCanvas.style.opacity = "0.3";
        } else {
          this.onionCanvas.style.display = "none";
        }
      }
      this._updateFilmstrip();
    } else {
      // Fallback: full image
      this._drawFullImage(this.spriteCanvas);
      if (this.onionCanvas) this.onionCanvas.style.display = "none";
      if (this.filmstripEl) this.filmstripEl.innerHTML = "";
    }

    // Sync hitbox editor
    if (this.showHitboxes && this.hitboxEditor && this.sheetImg && this.sheetLoaded) {
      const a = getFullCatalog().find((x) => x.id === this.selectedAssetId);
      if (a?.frameW && a?.frameH) {
        const { fpr } = this._getLayout();
        this.hitboxEditor.setSheet(this.sheetImg, a.frameW, a.frameH, fpr);
        this.hitboxEditor.setFrame(this.currentFrame);
        this.hitboxEditor.draw();
      }
    }
  }

  private _getLayout(): { fpr: number; padding: number; fw: number; fh: number } {
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return { fpr: 1, padding: 0, fw: 0, fh: 0 };
    const fw = asset.frameW;
    const fh = asset.frameH;
    const defaultFpr = this.sheetImg ? Math.max(1, Math.floor(this.sheetImg.naturalWidth / fw)) : 1;
    const fpr = this.customFramesPerRow > 0 ? this.customFramesPerRow : defaultFpr;
    const padding = this.customPadding;
    return { fpr, padding, fw, fh };
  }

  private _getFramePos(frame: number): { sx: number; sy: number } {
    const { fpr, padding, fw, fh } = this._getLayout();
    const col = frame % fpr;
    const row = Math.floor(frame / fpr);
    const sx = col * (fw + padding);
    const sy = row * (fh + padding);
    return { sx, sy };
  }

  private _drawFrame(canvas: HTMLCanvasElement, frame: number, applyZoom: boolean): void {
    if (!this.sheetImg) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const maxFrames = asset.totalFrames ?? 999;

    const clampedFrame = Math.max(0, Math.min(frame, maxFrames - 1));
    const { sx, sy } = this._getFramePos(clampedFrame);

    canvas.width = fw;
    canvas.height = fh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, fw, fh);
    ctx.drawImage(this.sheetImg, sx, sy, fw, fh, 0, 0, fw, fh);

    if (applyZoom) {
      canvas.style.width = `${Math.round(fw * this.zoom)}px`;
      canvas.style.height = `${Math.round(fh * this.zoom)}px`;
    }
  }

  private _drawFullImage(canvas: HTMLCanvasElement): void {
    if (!this.sheetImg) return;
    canvas.width = this.sheetImg.naturalWidth;
    canvas.height = this.sheetImg.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.sheetImg, 0, 0);
    canvas.style.width = `${Math.round(canvas.width * this.zoom)}px`;
    canvas.style.height = `${Math.round(canvas.height * this.zoom)}px`;
  }

  private _updateFilmstrip(): void {
    if (!this.filmstripEl || !this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) {
      this.filmstripEl.innerHTML = "";
      return;
    }

    const fw = asset.frameW;
    const fh = asset.frameH;
    const total = asset.totalFrames ?? 0;
    if (total === 0) { this.filmstripEl.innerHTML = ""; return; }
    const { fpr } = this._getLayout();

    // Rebuild only if count changed
    const existing = this.filmstripEl.querySelectorAll(".anim-filmstrip-frame");
    if (existing.length !== total) {
      this.filmstripEl.innerHTML = "";
      for (let i = 0; i < total; i++) {
        const wrap = document.createElement("div");
        wrap.className = "anim-filmstrip-frame";
        wrap.dataset.frame = String(i);
        const cvs = document.createElement("canvas");
        cvs.className = "anim-filmstrip-canvas";
        wrap.appendChild(cvs);
        wrap.addEventListener("click", () => {
          this.currentFrame = i;
          this._renderPreview();
        });
        wrap.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this._showFrameContextMenu(e as MouseEvent, i);
        });
        // Drag & drop
        wrap.draggable = true;
        wrap.addEventListener("dragstart", (e) => this._onFrameDragStart(e as DragEvent, i));
        wrap.addEventListener("dragover", (e) => { e.preventDefault(); });
        wrap.addEventListener("drop", (e) => this._onFrameDrop(e as DragEvent, i));
        wrap.addEventListener("dragend", () => this._onFrameDragEnd());
        this.filmstripEl.appendChild(wrap);
      }
    }

    const frames = this.filmstripEl.querySelectorAll(".anim-filmstrip-frame");
    frames.forEach((wrap, i) => {
      const cvs = wrap.querySelector("canvas") as HTMLCanvasElement;
      if (!cvs) return;
      cvs.width = fw;
      cvs.height = fh;
      const ctx = cvs.getContext("2d");
      if (!ctx) return;
      const { sx, sy } = this._getFramePos(i);
      ctx.clearRect(0, 0, fw, fh);
      ctx.drawImage(this.sheetImg!, sx, sy, fw, fh, 0, 0, fw, fh);

      const isActive = i === this.currentFrame;
      wrap.classList.toggle("active", isActive);
    });
  }

  private _togglePlay(): void {
    if (this.isPlaying) {
      this._stop();
    } else {
      this._start();
    }
  }

  private _start(): void {
    this.isPlaying = true;
    const state = this._getCurrentState();
    if (!state) return;
    const interval = Math.max(50, Math.round(1000 / (state.frameRate * this.speed)));
    this.playInterval = window.setInterval(() => {
      this.currentFrame++;
      if (this.currentFrame > state.frameEnd) {
        if (state.repeat) {
          this.currentFrame = state.frameStart;
        } else {
          this.currentFrame = state.frameEnd;
          this._stop();
        }
      }
      this._renderPreview();
    }, interval);
  }

  private _stop(): void {
    this.isPlaying = false;
    if (this.playInterval !== null) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
  }

  private _step(dir: number): void {
    this._stop();
    const state = this._getCurrentState();
    if (!state) return;
    this.currentFrame += dir;
    if (this.currentFrame < state.frameStart) this.currentFrame = state.frameStart;
    if (this.currentFrame > state.frameEnd) this.currentFrame = state.frameEnd;
    this._renderPreview();
  }

  private _applyZoom(): void {
    if (!this.spriteCanvas) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (asset?.frameW && asset?.frameH) {
      this.spriteCanvas.style.width = `${Math.round(asset.frameW * this.zoom)}px`;
      this.spriteCanvas.style.height = `${Math.round(asset.frameH * this.zoom)}px`;
    } else if (this.sheetImg) {
      this.spriteCanvas.style.width = `${Math.round(this.sheetImg.naturalWidth * this.zoom)}px`;
      this.spriteCanvas.style.height = `${Math.round(this.sheetImg.naturalHeight * this.zoom)}px`;
    }
    // Also apply zoom to onion canvas if visible
    if (this.onionCanvas && this.onionCanvas.style.display !== "none" && asset?.frameW && asset?.frameH) {
      this.onionCanvas.style.width = `${Math.round(asset.frameW * this.zoom)}px`;
      this.onionCanvas.style.height = `${Math.round(asset.frameH * this.zoom)}px`;
    }
  }

  private _showCloneModal(assetSelect: HTMLSelectElement): void {
    if (!this.selectedAssetId) return;
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-box">
        <h3>Cloner le personnage</h3>
        <p>Nom du clone :</p>
        <input type="text" class="prop-input-text modal-input" id="clone-name-input" placeholder="MonClone" />
        <div class="modal-actions">
          <button class="panel-btn" id="clone-cancel">Annuler</button>
          <button class="panel-btn primary" id="clone-confirm">Cloner</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    const input = modal.querySelector("#clone-name-input") as HTMLInputElement;
    input.focus();

    modal.querySelector("#clone-cancel")!.addEventListener("click", () => modal.remove());
    modal.querySelector("#clone-confirm")!.addEventListener("click", async () => {
      const name = input.value.trim() || "Clone";
      modal.querySelector("#clone-confirm")!.textContent = "...";
      const clone = await createClone(this.selectedAssetId!, name);
      modal.remove();
      if (clone) {
        this._refreshAssetSelect(assetSelect, clone.id);
      }
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private _refreshAssetSelect(assetSelect: HTMLSelectElement, selectId?: string): void {
    assetSelect.innerHTML = "";
    const spritesheets = getFullCatalog().filter((a) => a.sheetPath && (a.category === "enemy" || a.category === "spawn"));
    for (const asset of spritesheets) {
      const opt = document.createElement("option");
      opt.value = asset.id;
      opt.textContent = asset.label;
      assetSelect.appendChild(opt);
    }
    if (selectId && spritesheets.find((a) => a.id === selectId)) {
      assetSelect.value = selectId;
      this.selectedAssetId = selectId;
      this._renderPreview();
    } else if (spritesheets.length > 0) {
      this.selectedAssetId = spritesheets[0].id;
      this._renderPreview();
    }
  }

  private dragSourceIdx = -1;

  private _onFrameDragStart(e: DragEvent, idx: number): void {
    this.dragSourceIdx = idx;
    e.dataTransfer!.effectAllowed = "move";
    (e.target as HTMLElement).classList.add("dragging");
  }

  private _onFrameDrop(e: DragEvent, targetIdx: number): void {
    e.preventDefault();
    (e.target as HTMLElement).classList.remove("drag-over");
    if (this.dragSourceIdx < 0 || this.dragSourceIdx === targetIdx) return;
    this._swapFrames(this.dragSourceIdx, targetIdx);
    this.dragSourceIdx = -1;
  }

  private _onFrameDragEnd(): void {
    this.dragSourceIdx = -1;
    this.filmstripEl?.querySelectorAll(".anim-filmstrip-frame").forEach(f => {
      f.classList.remove("dragging", "drag-over");
    });
  }

  private _swapFrames(srcIdx: number, dstIdx: number): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const sw = this.sheetImg.naturalWidth;

    // Extract both frames
    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = sw;
    tmpCanvas.height = asset.frameH;
    const tctx = tmpCanvas.getContext("2d")!;
    tctx.drawImage(this.sheetImg, 0, 0);

    const src = this._getFramePos(srcIdx);
    const dst = this._getFramePos(dstIdx);

    // Swap: copy src frame to temp, copy dst frame to src, copy temp to dst
    const tempData = tctx.getImageData(src.sx, src.sy, fw, fh);
    tctx.putImageData(tctx.getImageData(dst.sx, dst.sy, fw, fh), src.sx, src.sy);
    tctx.putImageData(tempData, dst.sx, dst.sy);

    // Update sheetImg
    const newDataUrl = tmpCanvas.toDataURL("image/png");
    this.sheetImg = new Image();
    this.sheetImg.crossOrigin = "anonymous";
    this.sheetImg.onload = () => {
      this.sheetLoaded = true;
      this._redrawAll();
    };
    this.sheetImg.src = newDataUrl;
  }

  private _showFrameContextMenu(e: MouseEvent, frameIndex: number): void {
    // Remove any existing context menu
    document.querySelector(".anim-context-menu")?.remove();

    const menu = document.createElement("div");
    menu.className = "anim-context-menu";
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;

    const items: { label: string; action: () => void }[] = [
      { label: "✏️ Éditer cette frame", action: () => this._editFrame(frameIndex) },
      { label: "📋 Dupliquer cette frame", action: () => this._duplicateFrame(frameIndex) },
      { label: "🗑️ Supprimer cette frame", action: () => this._deleteFrame(frameIndex) },
    ];

    for (const item of items) {
      const el = document.createElement("div");
      el.className = "anim-context-item";
      el.textContent = item.label;
      el.addEventListener("click", () => {
        menu.remove();
        item.action();
      });
      menu.appendChild(el);
    }

    document.body.appendChild(menu);

    // Close on click outside
    const close = (ev: MouseEvent) => {
      if (!menu.contains(ev.target as Node)) {
        menu.remove();
        document.removeEventListener("click", close);
      }
    };
    setTimeout(() => document.addEventListener("click", close), 0);
  }

  private _duplicateFrame(frameIndex: number): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const sw = this.sheetImg.naturalWidth;
    const sh = this.sheetImg.naturalHeight;
    const { fpr, padding } = this._getLayout();
    const total = asset.totalFrames ?? (Math.floor(sh / (fh + padding)) * fpr);

    // Create new spritesheet with +1 frame
    const newTotal = total + 1;
    const newRows = Math.ceil(newTotal / fpr);
    const newSh = newRows * (fh + padding);

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = sw;
    tmpCanvas.height = newSh;
    const tctx = tmpCanvas.getContext("2d")!;

    // Copy frames 0..frameIndex
    for (let i = 0; i <= frameIndex; i++) {
      const pos = this._getFramePos(i);
      tctx.drawImage(this.sheetImg, pos.sx, pos.sy, fw, fh, pos.sx, pos.sy, fw, fh);
    }

    // Duplicate frame at frameIndex+1
    const srcPos = this._getFramePos(frameIndex);
    const dstPos = this._getFramePos(frameIndex + 1);
    tctx.drawImage(this.sheetImg, srcPos.sx, srcPos.sy, fw, fh, dstPos.sx, dstPos.sy, fw, fh);

    // Copy frames frameIndex+1..total-1, shifted by 1
    for (let i = frameIndex + 1; i < total; i++) {
      const sp = this._getFramePos(i);
      const dp = this._getFramePos(i + 1);
      tctx.drawImage(this.sheetImg, sp.sx, sp.sy, fw, fh, dp.sx, dp.sy, fw, fh);
    }

    // Update assets and reload
    asset.totalFrames = newTotal;

    const newDataUrl = tmpCanvas.toDataURL("image/png");
    this.sheetImg = new Image();
    this.sheetImg.crossOrigin = "anonymous";
    this.sheetImg.onload = () => {
      this.sheetLoaded = true;
      this._redrawAll();
    };
    this.sheetImg.src = newDataUrl;
  }

  private _deleteFrame(frameIndex: number): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const sw = this.sheetImg.naturalWidth;
    const sh = this.sheetImg.naturalHeight;
    const { fpr, padding } = this._getLayout();
    const total = asset.totalFrames ?? (Math.floor(sh / (fh + padding)) * fpr);
    if (total <= 1) return; // can't delete last frame

    const newTotal = total - 1;
    const newRows = Math.ceil(newTotal / fpr);
    const newSh = newRows * (fh + padding);

    const tmpCanvas = document.createElement("canvas");
    tmpCanvas.width = sw;
    tmpCanvas.height = newSh;
    const tctx = tmpCanvas.getContext("2d")!;

    // Copy frames before the deleted one
    for (let i = 0; i < frameIndex; i++) {
      const pos = this._getFramePos(i);
      tctx.drawImage(this.sheetImg, pos.sx, pos.sy, fw, fh, pos.sx, pos.sy, fw, fh);
    }

    // Copy frames after the deleted one, shifted left
    for (let i = frameIndex + 1; i < total; i++) {
      const sp = this._getFramePos(i);
      const dp = this._getFramePos(i - 1);
      tctx.drawImage(this.sheetImg, sp.sx, sp.sy, fw, fh, dp.sx, dp.sy, fw, fh);
    }

    asset.totalFrames = newTotal;

    const newDataUrl = tmpCanvas.toDataURL("image/png");
    this.sheetImg = new Image();
    this.sheetImg.crossOrigin = "anonymous";
    this.sheetImg.onload = () => {
      this.sheetLoaded = true;
      this._redrawAll();
    };
    this.sheetImg.src = newDataUrl;
  }

  private _editFrame(frameIndex: number): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const { sx, sy } = this._getFramePos(frameIndex);

    // Extract frame as dataURL
    const extractCanvas = document.createElement("canvas");
    extractCanvas.width = fw;
    extractCanvas.height = fh;
    const ectx = extractCanvas.getContext("2d")!;
    ectx.drawImage(this.sheetImg, sx, sy, fw, fh, 0, 0, fw, fh);
    const frameDataUrl = extractCanvas.toDataURL("image/png");

    // Open sprite editor
    this.spriteEditor = new SpriteEditorUI({
      sourceImage: frameDataUrl,
      frameW: fw,
      frameH: fh,
      onSave: (editedDataUrl: string) => this._onFrameSaved(frameIndex, editedDataUrl),
      onClose: () => { this.spriteEditor = null; },
    });
    this.spriteEditor.show();
  }

  private _onFrameSaved(frameIndex: number, editedDataUrl: string): void {
    if (!this.sheetImg) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const fw = asset.frameW;
    const fh = asset.frameH;
    const sw = this.sheetImg.naturalWidth;
    const sh = this.sheetImg.naturalHeight;

    // Load the edited frame back
    const editImg = new Image();
    editImg.onload = () => {
      // Rebuild the spritesheet with the edited frame
      const rebuildCanvas = document.createElement("canvas");
      rebuildCanvas.width = sw;
      rebuildCanvas.height = sh;
      const rctx = rebuildCanvas.getContext("2d")!;

      // Draw the original sheet
      rctx.drawImage(this.sheetImg!, 0, 0);

      // Overwrite the specific frame
      const { sx, sy } = this._getFramePos(frameIndex);
      rctx.clearRect(sx, sy, fw, fh);
      rctx.drawImage(editImg, sx, sy);

      // Update sheetImg source
      const newDataUrl = rebuildCanvas.toDataURL("image/png");
      this.sheetImg = new Image();
      this.sheetImg.crossOrigin = "anonymous";
      this.sheetImg.onload = () => {
        this.sheetLoaded = true;
        this._redrawAll();
      };
      this.sheetImg.src = newDataUrl;
    };
    editImg.src = editedDataUrl;

    // Close the editor
    if (this.spriteEditor) {
      this.spriteEditor.hide();
      this.spriteEditor = null;
    }
  }

  private _showNewAnimModal(): void {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-box">
        <h3>Nouvelle animation</h3>
        <p>Nom :</p>
        <input type="text" class="prop-input-text modal-input" id="new-anim-name" placeholder="walk" />
        <div style="display:flex;gap:8px;margin-bottom:8px;">
          <div style="flex:1"><p>Frame début</p><input type="number" class="prop-input-text" id="new-anim-start" value="0" min="0" /></div>
          <div style="flex:1"><p>Frame fin</p><input type="number" class="prop-input-text" id="new-anim-end" value="7" min="0" /></div>
        </div>
        <p>Frame Rate :</p>
        <input type="number" class="prop-input-text modal-input" id="new-anim-fps" value="10" min="1" max="60" />
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;margin:8px 0;">
          <input type="checkbox" id="new-anim-repeat" checked /> Répéter (loop)
        </label>
        <div class="modal-actions">
          <button class="panel-btn" id="new-anim-cancel">Annuler</button>
          <button class="panel-btn primary" id="new-anim-confirm">Créer</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    const nameInput = modal.querySelector("#new-anim-name") as HTMLInputElement;
    nameInput.focus();

    modal.querySelector("#new-anim-cancel")!.addEventListener("click", () => modal.remove());
    modal.querySelector("#new-anim-confirm")!.addEventListener("click", () => {
      const name = nameInput.value.trim() || "anim";
      const start = parseInt((modal.querySelector("#new-anim-start") as HTMLInputElement).value) || 0;
      const end = parseInt((modal.querySelector("#new-anim-end") as HTMLInputElement).value) || 0;
      const fps = parseInt((modal.querySelector("#new-anim-fps") as HTMLInputElement).value) || 10;
      const repeatCheckbox = modal.querySelector("#new-anim-repeat") as HTMLInputElement;
      const repeat = repeatCheckbox?.checked ?? true;

      const key = name.toLowerCase().replace(/\s+/g, "-");
      const newState: AnimState = {
        key,
        label: name,
        frameStart: start,
        frameEnd: end,
        frameRate: fps,
        repeat,
        transitions: [],
      };
      this.states.push(newState);
      modal.remove();

      // Sync graph editor
      if (this.smEditor) {
        this.smEditor.sync(this.states);
      }
      // Rebuild list view if visible
      const listContainer = this.root.querySelector(".sm-list-container") as HTMLElement;
      if (listContainer && listContainer.style.display !== "none") {
        this._buildStateList(listContainer);
      }
    });
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  private _buildStateList(container: HTMLElement): void {
    container.innerHTML = "";
    const header = document.createElement("h3");
    header.textContent = "State Machine";
    container.appendChild(header);

    const stateList = document.createElement("div");
    stateList.className = "anim-state-list";
    for (const s of this.states) {
      const row = document.createElement("div");
      row.className = "anim-state-row";
      if (s.key === this.currentState) row.classList.add("active");
      row.innerHTML = `<strong>${s.label}</strong> <span>${s.frameStart}-${s.frameEnd} @ ${s.frameRate}fps</span>`;
      row.addEventListener("click", () => {
        this.currentState = s.key;
        this.currentFrame = s.frameStart;
        this._renderPreview();
        stateList.querySelectorAll(".anim-state-row").forEach((r) => r.classList.remove("active"));
        row.classList.add("active");
      });
      stateList.appendChild(row);

      // Transitions
      if (s.transitions.length > 0) {
        const transUl = document.createElement("ul");
        transUl.className = "anim-trans-list";
        for (const t of s.transitions) {
          const li = document.createElement("li");
          li.textContent = `→ ${t.to}  [${t.condition}]`;
          transUl.appendChild(li);
        }
        stateList.appendChild(transUl);
      }
    }
    // "+ Nouvelle animation" button
    const addAnimBtn = document.createElement("button");
    addAnimBtn.className = "panel-btn";
    addAnimBtn.style.marginTop = "8px";
    addAnimBtn.textContent = "+ Nouvelle animation";
    addAnimBtn.addEventListener("click", () => this._showNewAnimModal());
    stateList.appendChild(addAnimBtn);
    container.appendChild(stateList);
  }

  private _autoLayoutStates(): void {
    // Simple grid layout: arrange nodes in a 3-column grid
    const cols = 3;
    const nodeW = 140;
    const nodeH = 50;
    const gapX = 60;
    const gapY = 50;
    for (let i = 0; i < this.states.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // We use a temporary x,y in _syncNodes — but that's in StateMachineEditor
      // Instead, we just trigger a full rebuild by toggling
    }
    // Auto-layout is handled by StateMachineEditor.sync() which places new nodes in grid
    // To force relayout, we destroy and recreate the editor
    if (this.smEditor) {
      this.smEditor.destroy();
      const graphContainer = this.root.querySelector(".sm-graph-container") as HTMLElement;
      if (!graphContainer) return;
      // Clear container
      graphContainer.innerHTML = "";
      // Recreate with fresh positions
      this.smEditor = new StateMachineEditor(graphContainer, this.states, (newStates) => {
        this.states = newStates;
      });
    }
  }

  private _exportJSON(): void {
    const exportData = {
      assetId: this.selectedAssetId,
      states: this.states,
      hitboxes: this.hitboxData,
      sounds: this.soundEvents,
      version: "1.2",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "animation-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Export GIF / APNG ───────────────────────────────────────

  private _exportGIF(): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const state = this._getCurrentState();
    const frameStart = state?.frameStart ?? 0;
    const frameEnd = state?.frameEnd ?? (asset.totalFrames ?? 0) - 1;
    const fps = state?.frameRate ?? 10;

    const { fpr } = this._getLayout();
    const frames = captureFramesFromSheet(this.sheetImg, asset.frameW, asset.frameH, fpr, frameStart, frameEnd);
    const blob = exportGIF({ frames, delayMs: Math.round(1000 / fps) });
    downloadBlob(blob, `${asset.label}-${state?.key ?? "anim"}.gif`);
  }

  private _exportAPNG(): void {
    if (!this.sheetImg || !this.sheetLoaded) return;
    const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
    if (!asset || !asset.frameW || !asset.frameH) return;

    const state = this._getCurrentState();
    const frameStart = state?.frameStart ?? 0;
    const frameEnd = state?.frameEnd ?? (asset.totalFrames ?? 0) - 1;
    const fps = state?.frameRate ?? 10;

    const { fpr } = this._getLayout();
    const frames = captureFramesFromSheet(this.sheetImg, asset.frameW, asset.frameH, fpr, frameStart, frameEnd);
    try {
      const blob = exportAPNG({ frames, delayMs: Math.round(1000 / fps) });
      downloadBlob(blob, `${asset.label}-${state?.key ?? "anim"}.apng`);
    } catch {
      // APNG may fail if CompressionStream unavailable — fallback to GIF
      const gifBlob = exportGIF({ frames, delayMs: Math.round(1000 / fps) });
      downloadBlob(gifBlob, `${asset.label}-${state?.key ?? "anim"}.gif`);
    }
  }

  // ── Hitbox overlay ──────────────────────────────────────────

  private _toggleHitboxes(): void {
    const container = document.getElementById("hitbox-canvas-container");
    if (!container) return;

    if (this.showHitboxes) {
      if (!this.hitboxEditor) {
        this.hitboxEditor = new HitboxEditor(container, (data) => {
          this.hitboxData = data;
        });
      }
      this.hitboxEditor.show();
      // Sync with current frame
      if (this.sheetImg && this.sheetLoaded) {
        const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
        if (asset?.frameW && asset?.frameH) {
          const { fpr } = this._getLayout();
          this.hitboxEditor.setSheet(this.sheetImg, asset.frameW, asset.frameH, fpr);
          this.hitboxEditor.setFrame(this.currentFrame);
          this.hitboxEditor.setHitboxes(this.hitboxData);
        }
      }
    } else {
      this.hitboxEditor?.hide();
    }
  }

  // ── Live preview ────────────────────────────────────────────

  private _toggleLivePreview(btn?: HTMLButtonElement): void {
    if (!this.livePreviewContainer) return;

    if (this.livePreviewVisible) {
      const asset = getFullCatalog().find((a) => a.id === this.selectedAssetId);
      if (!asset || !asset.frameW || !asset.frameH) {
        this.livePreviewVisible = false;
        if (btn) { btn.classList.remove("on"); btn.classList.add("off"); }
        return;
      }

      const basePath = (window as any).__oakwoods_basePath ?? "";
      const imgPath = asset.imagePath ?? asset.sheetPath ?? `${asset.textureKey}.png`;
      const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http") ? imgPath : `${basePath}/${imgPath}`;

      this.livePreviewContainer.style.display = "block";
      if (!this.livePreview) {
        this.livePreview = new AnimationLivePreview(this.livePreviewContainer);
      }

      const anims = this.states.map((s) => ({
        key: s.key,
        frameStart: s.frameStart,
        frameEnd: s.frameEnd,
        frameRate: s.frameRate,
        repeat: s.repeat,
      }));

      this.livePreview.load({
        parent: this.livePreviewContainer,
        width: 480,
        height: 270,
        sheetPath: fullPath,
        textureKey: "__PREVIEW_SHEET",
        frameW: asset.frameW,
        frameH: asset.frameH,
        anims,
      }).then(() => {
        this.livePreview?.show();
      });
    } else {
      if (this.livePreview) {
        this.livePreview.hide();
      }
      this.livePreviewContainer.style.display = "none";
    }
  }

  // ── Character compare ───────────────────────────────────────

  private _toggleCompare(): void {
    if (!this.compareView) return;
    if (this.compareVisible) {
      this.compareView.show();
    } else {
      this.compareView.hide();
    }
  }

  // ── Auto-Rig ────────────────────────────────────────────────

  private _showAutoRigModal(): void {
    if (!this.selectedAssetId) return;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-box" style="width:500px;max-width:90vw;">
        <h3>🦴 Auto-Rig — Suggestion de pivots</h3>
        <p style="font-size:12px;color:var(--text-secondary);">
          Importez les parties séparées (tête, torse, jambes) pour suggérer des points de connexion.
        </p>
        <div id="auto-rig-parts" style="margin:8px 0;max-height:300px;overflow-y:auto;"></div>
        <div style="margin:8px 0;">
          <button class="panel-btn" id="auto-rig-add-part">+ Ajouter une partie</button>
          <button class="panel-btn primary" id="auto-rig-analyze" style="margin-left:8px;">Analyser</button>
        </div>
        <div id="auto-rig-results" style="margin:8px 0;font-size:11px;color:var(--text-secondary);"></div>
        <div class="modal-actions">
          <button class="panel-btn" id="auto-rig-close">Fermer</button>
        </div>
      </div>
    `;
    this.root.appendChild(modal);

    const parts: RigPart[] = [];
    const partsContainer = modal.querySelector("#auto-rig-parts")!;
    const resultsEl = modal.querySelector("#auto-rig-results")!;

    function addPartRow(): void {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px;";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "prop-input-text";
      labelInput.placeholder = "Nom (ex: head)";
      labelInput.style.width = "120px";
      row.appendChild(labelInput);

      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/png";
      row.appendChild(fileInput);

      const removeBtn = document.createElement("button");
      removeBtn.className = "panel-btn";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => row.remove());
      row.appendChild(removeBtn);

      partsContainer.appendChild(row);
    }

    addPartRow();
    modal.querySelector("#auto-rig-add-part")!.addEventListener("click", addPartRow);

    modal.querySelector("#auto-rig-analyze")!.addEventListener("click", () => {
      parts.length = 0;
      resultsEl.innerHTML = "Analyse en cours...";
      const rows = partsContainer.querySelectorAll("div");
      let loaded = 0;
      const total = rows.length;

      rows.forEach((row) => {
        const labelInput = row.querySelector("input[type='text']") as HTMLInputElement;
        const fileInput = row.querySelector("input[type='file']") as HTMLInputElement;
        const label = labelInput.value.trim() || "part";
        const file = fileInput.files?.[0];
        if (!file) { loaded++; if (loaded >= total) showResults(); return; }

        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            parts.push({ label, image: img, pivotX: 0.5, pivotY: 0.5 });
            loaded++;
            if (loaded >= total) showResults();
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });

      function showResults(): void {
        if (parts.length === 0) {
          resultsEl.innerHTML = "<p>Aucune partie chargée.</p>";
          return;
        }

        // Analyze each part
        let html = "<table style='width:100%;font-size:11px;'>";
        html += "<tr><th>Partie</th><th>Suggestion</th><th>Confiance</th></tr>";
        for (const part of parts) {
          const suggestions = analyzePart(part.image, part.label);
          const top = suggestions[0];
          html += `<tr>
            <td>${part.label}</td>
            <td>${top.label} (${top.x},${top.y})</td>
            <td>${Math.round(top.confidence * 100)}%</td>
          </tr>`;
        }
        html += "</table>";

        // Suggest connections
        const connections = suggestConnections(parts);
        if (connections.length > 0) {
          html += "<p style='margin-top:8px;'><strong>Connexions suggérées :</strong></p>";
          for (const conn of connections) {
            html += `<p>→ ${conn.partA} pivot (${conn.pivotA.x},${conn.pivotA.y}) ↔ ${conn.partB} pivot (${conn.pivotB.x},${conn.pivotB.y}) — ${Math.round(conn.confidence * 100)}%</p>`;
          }
        }

        resultsEl.innerHTML = html;
      }
    });

    modal.querySelector("#auto-rig-close")!.addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });
  }

  // ── Particle editor ─────────────────────────────────────────

  private _showParticleEditor(btn?: HTMLButtonElement): void {
    if (!this.particleUI) return;
    this.particleUI.show();
    if (btn) {
      btn.classList.remove("off");
      btn.classList.add("on");
    }
  }

  // ── Sound mapper ────────────────────────────────────────────

  private _showSoundMapper(): void {
    const stateList = this.states.map(s => ({
      key: s.key,
      label: s.label,
      frameStart: s.frameStart,
      frameEnd: s.frameEnd,
    }));

    this.soundMapper = new SoundMapperModal(
      stateList,
      this.soundEvents,
      (events) => {
        this.soundEvents = events;
      }
    );
  }
}
