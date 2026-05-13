// src/editor-ui/SoundMapper.ts
// Sound mapper — associate audio files with animation states and specific frames
// Drag & drop WAV/MP3/OGG onto states. "This animation plays this sound at frame 3."

export interface SoundEvent {
  id: string;
  frameIndex: number;          // frame when the sound triggers
  stateKey: string;            // which animation state
  fileName: string;            // original file name
  dataUrl: string;             // base64 data URL (stored in browser)
  volume: number;              // 0-1
  loop: boolean;
  triggerMode: "once" | "loop" | "retrigger";
}

export class SoundMapper {
  private container: HTMLElement;
  private events: SoundEvent[] = [];
  private states: Array<{ key: string; label: string; frameStart: number; frameEnd: number }> = [];
  private onChange: (events: SoundEvent[]) => void;
  private audioContext: AudioContext | null = null;
  private playingId: string | null = null;
  private dropZone: HTMLElement | null = null;
  private eventList: HTMLElement | null = null;
  private eventIdCounter = 0;

  constructor(
    parent: HTMLElement,
    states: Array<{ key: string; label: string; frameStart: number; frameEnd: number }>,
    onChange: (events: SoundEvent[]) => void
  ) {
    this.container = parent;
    this.states = states;
    this.onChange = onChange;
    this._build();
  }

  setStates(states: Array<{ key: string; label: string; frameStart: number; frameEnd: number }>): void {
    this.states = states;
    this._rebuildEventList();
  }

  setEvents(events: SoundEvent[]): void {
    this.events = events;
    if (events.length > 0) {
      this.eventIdCounter = Math.max(...events.map(e => parseInt(e.id) || 0)) + 1;
    }
    this._rebuildEventList();
  }

  getEvents(): SoundEvent[] {
    return this.events;
  }

  // ── Build ───────────────────────────────────────────────────

  private _build(): void {
    this.container.innerHTML = "";
    this.container.style.display = "flex";
    this.container.style.flexDirection = "column";
    this.container.style.gap = "8px";
    this.container.style.padding = "8px";

    // Header
    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
    header.innerHTML = `<strong style="font-size:12px;color:var(--text-primary);">🔊 Sons</strong>`;
    this.container.appendChild(header);

    // Drop zone
    this.dropZone = document.createElement("div");
    this.dropZone.className = "sound-dropzone";
    this.dropZone.innerHTML = `
      <p>🎵 Déposez des fichiers audio ici</p>
      <p style="font-size:10px;color:var(--text-secondary);">WAV, MP3, OGG acceptés</p>
    `;
    this._bindDropEvents();
    this.container.appendChild(this.dropZone);

    // Event list
    this.eventList = document.createElement("div");
    this.eventList.className = "sound-event-list";
    this.container.appendChild(this.eventList);

    this._rebuildEventList();
  }

  private _rebuildEventList(): void {
    if (!this.eventList) return;
    this.eventList.innerHTML = "";

    if (this.events.length === 0) {
      this.eventList.innerHTML = "<p style='font-size:11px;color:var(--text-secondary);padding:8px;'>Aucun son assigné. Déposez un fichier audio.</p>";
      return;
    }

    for (const evt of this.events) {
      const row = document.createElement("div");
      row.className = "sound-event-row";

      // File name
      const nameSpan = document.createElement("span");
      nameSpan.className = "sound-event-name";
      nameSpan.textContent = evt.fileName;
      nameSpan.title = evt.fileName;
      row.appendChild(nameSpan);

      // State selector
      const stateSelect = document.createElement("select");
      stateSelect.className = "prop-input-text sound-event-select";
      for (const s of this.states) {
        const opt = document.createElement("option");
        opt.value = s.key;
        opt.textContent = s.label;
        if (s.key === evt.stateKey) opt.selected = true;
        stateSelect.appendChild(opt);
      }
      stateSelect.addEventListener("change", () => {
        evt.stateKey = stateSelect.value;
        this._emitChange();
      });
      row.appendChild(stateSelect);

      // Frame number
      const frameLabel = document.createElement("span");
      frameLabel.textContent = "Frame:";
      frameLabel.style.fontSize = "10px";
      frameLabel.style.color = "var(--text-secondary)";
      row.appendChild(frameLabel);

      const frameInput = document.createElement("input");
      frameInput.type = "number";
      frameInput.min = "0";
      frameInput.max = "99";
      frameInput.value = String(evt.frameIndex);
      frameInput.style.width = "42px";
      frameInput.className = "prop-input-text";
      frameInput.addEventListener("change", () => {
        evt.frameIndex = parseInt(frameInput.value) || 0;
        this._emitChange();
      });
      row.appendChild(frameInput);

      // Volume slider
      const volInput = document.createElement("input");
      volInput.type = "range";
      volInput.min = "0";
      volInput.max = "100";
      volInput.value = String(Math.round(evt.volume * 100));
      volInput.style.width = "60px";
      volInput.addEventListener("input", () => {
        evt.volume = parseInt(volInput.value) / 100;
        this._emitChange();
      });
      row.appendChild(volInput);

      // Preview button
      const playBtn = document.createElement("button");
      playBtn.className = "panel-btn";
      playBtn.textContent = "▶";
      playBtn.style.width = "28px";
      playBtn.style.padding = "2px 4px";
      playBtn.title = "Prévisualiser";
      playBtn.addEventListener("click", () => this._previewSound(evt));
      row.appendChild(playBtn);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.className = "panel-btn";
      delBtn.textContent = "✕";
      delBtn.style.width = "28px";
      delBtn.style.padding = "2px 4px";
      delBtn.style.color = "var(--danger)";
      delBtn.addEventListener("click", () => {
        this.events = this.events.filter(e => e.id !== evt.id);
        this._emitChange();
        this._rebuildEventList();
      });
      row.appendChild(delBtn);

      this.eventList!.appendChild(row);
    }
  }

  // ── Drop events ─────────────────────────────────────────────

  private _bindDropEvents(): void {
    if (!this.dropZone) return;

    this.dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dropZone!.classList.add("drag-over");
    });

    this.dropZone.addEventListener("dragleave", () => {
      this.dropZone!.classList.remove("drag-over");
    });

    this.dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropZone!.classList.remove("drag-over");

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("audio/")) continue;

        const reader = new FileReader();
        reader.onload = () => {
          const id = String(this.eventIdCounter++);
          this.events.push({
            id,
            stateKey: this.states[0]?.key ?? "idle",
            frameIndex: 0,
            fileName: file.name,
            dataUrl: reader.result as string,
            volume: 0.8,
            loop: false,
            triggerMode: "once",
          });
          this._emitChange();
          this._rebuildEventList();
        };
        reader.readAsDataURL(file);
      }
    });

    // Also allow click to browse
    this.dropZone.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "audio/*";
      input.multiple = true;
      input.addEventListener("change", () => {
        const files = input.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const reader = new FileReader();
          reader.onload = () => {
            const id = String(this.eventIdCounter++);
            this.events.push({
              id,
              stateKey: this.states[0]?.key ?? "idle",
              frameIndex: 0,
              fileName: file.name,
              dataUrl: reader.result as string,
              volume: 0.8,
              loop: false,
              triggerMode: "once",
            });
            this._emitChange();
            this._rebuildEventList();
          };
          reader.readAsDataURL(file);
        }
      });
      input.click();
    });
  }

  // ── Audio preview ───────────────────────────────────────────

  private _previewSound(evt: SoundEvent): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Decode and play
    const audioCtx = this.audioContext;
    const base64 = evt.dataUrl.split(",")[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    audioCtx.decodeAudioData(bytes.buffer, (buffer) => {
      const source = audioCtx.createBufferSource();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = evt.volume;
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      source.start(0);
    });
  }

  // ── Play sound at frame ─────────────────────────────────────
  // Called externally when animation reaches a frame

  playAtFrame(stateKey: string, frameIndex: number): void {
    const matching = this.events.filter(
      e => e.stateKey === stateKey && e.frameIndex === frameIndex
    );
    for (const evt of matching) {
      this._previewSound(evt);
    }
  }

  private _emitChange(): void {
    this.onChange(this.events);
  }
}

// ══════════════════════════════════════════════════════════════
// Sound Mapper Modal — wraps the SoundMapper in a modal dialog
// ══════════════════════════════════════════════════════════════

export class SoundMapperModal {
  private overlay: HTMLDivElement;
  private soundMapper: SoundMapper | null = null;
  private onSave: (events: SoundEvent[]) => void;
  private events: SoundEvent[] = [];

  constructor(
    private states: Array<{ key: string; label: string; frameStart: number; frameEnd: number }>,
    initialEvents: SoundEvent[],
    onSave: (events: SoundEvent[]) => void
  ) {
    this.events = initialEvents;
    this.onSave = onSave;

    this.overlay = document.createElement("div");
    this.overlay.className = "modal-overlay";
    this.overlay.innerHTML = `
      <div class="modal-box" style="width:480px;max-width:95vw;max-height:80vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h3>🔊 Sound Mapper</h3>
          <button class="page-close-btn" id="sound-modal-close">✕</button>
        </div>
        <div id="sound-mapper-container" style="flex:1;overflow-y:auto;min-height:200px;"></div>
        <div class="modal-actions" style="margin-top:8px;">
          <button class="panel-btn" id="sound-modal-cancel">Annuler</button>
          <button class="panel-btn primary" id="sound-modal-save">Enregistrer</button>
        </div>
      </div>
    `;

    const container = this.overlay.querySelector("#sound-mapper-container") as HTMLElement;
    this.soundMapper = new SoundMapper(container, this.states, (evts) => {
      this.events = evts;
    });
    this.soundMapper.setEvents(this.events);

    this.overlay.querySelector("#sound-modal-close")!.addEventListener("click", () => this.close());
    this.overlay.querySelector("#sound-modal-cancel")!.addEventListener("click", () => this.close());
    this.overlay.querySelector("#sound-modal-save")!.addEventListener("click", () => {
      this.onSave(this.events);
      this.close();
    });
    this.overlay.addEventListener("click", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
  }

  close(): void {
    this.overlay.remove();
  }
}
