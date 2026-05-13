import Phaser from "phaser";

const PALETTE_W = 320;

type ToolbarMode = "stage" | "entity" | "background" | "collision" | "select" | "delete" | "pan";

export class ToolbarManager {
  private container!: Phaser.GameObjects.Container;
  private buttons: Phaser.GameObjects.Container[] = [];
  private mode: ToolbarMode = "stage";
  private onModeChange?: (mode: ToolbarMode) => void;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(PALETTE_W + 10, 6).setDepth(1001).setScrollFactor(0);

    const modes: Array<{ label: string; mode: ToolbarMode; color: number; icon?: string }> = [
      { label: "Stage", mode: "stage", color: 0x44ff88 },
      { label: "Entities", mode: "entity", color: 0xffaa44 },
      { label: "BG", mode: "background", color: 0x8df5e8 },
      { label: "Coll", mode: "collision", color: 0xff4444 },
      { label: "Select", mode: "select", color: 0x44aaff },
      { label: "Delete", mode: "delete", color: 0xff4444 },
      { label: "Pan", mode: "pan", color: 0xffaa44 },
    ];

    modes.forEach((m, i) => {
      const x = i * 76;
      const bg = scene.add.rectangle(x, 0, 72, 28, 0x333333).setStrokeStyle(1, 0x555555);
      const txt = scene.add.text(x, 0, m.label, {
        fontSize: "13px", color: `#${m.color.toString(16).padStart(6, "0")}`,
      }).setOrigin(0.5);
      const btn = scene.add.container(0, 0, [bg, txt]);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        this.mode = m.mode;
        this.refresh();
        this.onModeChange?.(m.mode);
      });
      btn.setData("bg", bg);
      btn.setData("mode", m.mode);
      this.buttons.push(btn);
      this.container.add(btn);
    });

    // Action buttons
    const addBtn = (x: number, label: string, color: number, onClick: () => void, w = 50) => {
      const bg = scene.add.rectangle(x, 0, w, 28, color).setStrokeStyle(1, color + 0x222222);
      const txt = scene.add.text(x, 0, label, { fontSize: "13px", color: "#ffffff" }).setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", onClick);
      this.container.add([bg, txt]);
    };

    const baseX = modes.length * 76 + 16;
    addBtn(baseX, "\ud83d\udcbe", 0x225522, () => this.onSave?.());
    addBtn(baseX + 56, "Export", 0x224466, () => this.onExport?.(), 55);
    addBtn(baseX + 120, "Import", 0x444422, () => this.onImport?.(), 55);
    addBtn(baseX + 184, "Test", 0x442266, () => this.onTestMenu?.(), 48);
  }

  onSave?: () => void;
  onExport?: () => void;
  onImport?: () => void;
  onTestMenu?: () => void;

  setMode(mode: ToolbarMode): void {
    this.mode = mode;
    this.refresh();
  }

  getMode(): ToolbarMode { return this.mode; }

  setOnModeChange(cb: (mode: ToolbarMode) => void): void {
    this.onModeChange = cb;
  }

  private refresh(): void {
    for (const btn of this.buttons) {
      const mode = btn.getData("mode") as ToolbarMode;
      const bg = btn.getData("bg") as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(this.mode === mode ? 3 : 1, this.mode === mode ? 0xffffff : 0x555555);
    }
  }
}
