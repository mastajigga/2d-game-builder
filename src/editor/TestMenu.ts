import Phaser from "phaser";

const W = 1600;
const H = 900;

export type TestType = "jump" | "attack" | "patrol" | "collision" | null;

export interface TestConfig {
  autoRun: boolean;
  showHitboxes: boolean;
  showPatrolZones: boolean;
}

export class TestMenu {
  private container!: Phaser.GameObjects.Container;
  private visible = false;
  private config: TestConfig = {
    autoRun: false,
    showHitboxes: false,
    showPatrolZones: false,
  };
  private onRunTest?: (type: TestType) => void;
  private onToggle?: (key: keyof TestConfig, value: boolean) => void;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(W / 2, H / 2).setDepth(3000).setScrollFactor(0).setVisible(false);

    const bg = scene.add.rectangle(0, 0, 420, 420, 0x0a0a14, 0.96).setStrokeStyle(2, 0x44aaff);
    this.container.add(bg);

    const title = scene.add.text(0, -180, "TEST MENU", { fontSize: "24px", color: "#44aaff", fontStyle: "bold" }).setOrigin(0.5);
    this.container.add(title);

    const tests: Array<{ label: string; type: TestType }> = [
      { label: "\u25b6 Test de saut", type: "jump" },
      { label: "\u25b6 Test d'attaque", type: "attack" },
      { label: "\u25b6 Test de patrouille", type: "patrol" },
      { label: "\u25b6 Test de collision", type: "collision" },
    ];

    tests.forEach((t, i) => {
      const y = -120 + i * 44;
      const btn = scene.add.rectangle(0, y, 280, 34, 0x1a1a2e).setStrokeStyle(1, 0x4488cc);
      const txt = scene.add.text(0, y, t.label, { fontSize: "16px", color: "#88ccff" }).setOrigin(0.5);
      btn.setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => this.onRunTest?.(t.type));
      this.container.add([btn, txt]);
    });

    // Toggles
    const toggles: Array<{ label: string; key: keyof TestConfig }> = [
      { label: "Auto-run on load", key: "autoRun" },
      { label: "Show hitboxes", key: "showHitboxes" },
      { label: "Show patrol zones", key: "showPatrolZones" },
    ];

    toggles.forEach((t, i) => {
      const y = 40 + i * 32;
      const box = scene.add.rectangle(-100, y, 18, 18, 0x222222).setStrokeStyle(1, 0x888888);
      const check = scene.add.text(-100, y, "", { fontSize: "14px", color: "#44ff88" }).setOrigin(0.5);
      check.setName(`check-${t.key}`);
      const lbl = scene.add.text(-80, y, t.label, { fontSize: "14px", color: "#cccccc" }).setOrigin(0, 0.5);
      box.setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => {
        this.config[t.key] = !this.config[t.key];
        this.refresh();
        this.onToggle?.(t.key, this.config[t.key]);
      });
      this.container.add([box, check, lbl]);
    });

    // Close btn
    const close = scene.add.rectangle(0, 175, 80, 28, 0x662222).setStrokeStyle(1, 0xaa4444);
    const closeTxt = scene.add.text(0, 175, "Fermer", { fontSize: "14px", color: "#ff8888" }).setOrigin(0.5);
    close.setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.hide());
    this.container.add([close, closeTxt]);

    this.refresh();
  }

  setCallbacks(onRun: (type: TestType) => void, onToggle: (key: keyof TestConfig, value: boolean) => void): void {
    this.onRunTest = onRun;
    this.onToggle = onToggle;
  }

  show(): void {
    this.visible = true;
    this.container.setVisible(true);
  }

  hide(): void {
    this.visible = false;
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.visible) this.hide(); else this.show();
  }

  isVisible(): boolean { return this.visible; }

  getConfig(): TestConfig { return { ...this.config }; }

  private refresh(): void {
    for (const key of ["autoRun", "showHitboxes", "showPatrolZones"] as const) {
      const check = this.container.getByName(`check-${key}`) as Phaser.GameObjects.Text;
      if (check) check.setText(this.config[key] ? "\u2713" : "");
    }
  }
}
