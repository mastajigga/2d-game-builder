import Phaser from "phaser";

const W = 1600;
const H = 900;

export class ConfirmDialog {
  private container!: Phaser.GameObjects.Container;
  private msgText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setDepth(2000).setScrollFactor(0).setVisible(false);

    const overlay = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.7);
    this.container.add(overlay);

    const box = scene.add.rectangle(W / 2, H / 2, 360, 160, 0x1a1a2e).setStrokeStyle(2, 0x44aaff);
    this.container.add(box);

    this.msgText = scene.add.text(W / 2, H / 2 - 30, "", {
      fontSize: "20px", color: "#ffffff", align: "center", wordWrap: { width: 320 },
    }).setOrigin(0.5);
    this.msgText.setName("msg");
    this.container.add(this.msgText);

    const yesBg = scene.add.rectangle(W / 2 - 70, H / 2 + 30, 100, 36, 0x226622).setStrokeStyle(1, 0x44aa44);
    const yesTxt = scene.add.text(W / 2 - 70, H / 2 + 30, "Oui", { fontSize: "18px", color: "#44ff44" }).setOrigin(0.5);
    yesBg.setInteractive({ useHandCursor: true });
    yesBg.on("pointerdown", () => {
      const cb = this.container.getData("onConfirm") as (() => void) | undefined;
      this.container.setVisible(false);
      cb?.();
    });
    this.container.add([yesBg, yesTxt]);

    const noBg = scene.add.rectangle(W / 2 + 70, H / 2 + 30, 100, 36, 0x662222).setStrokeStyle(1, 0xaa4444);
    const noTxt = scene.add.text(W / 2 + 70, H / 2 + 30, "Non", { fontSize: "18px", color: "#ff4444" }).setOrigin(0.5);
    noBg.setInteractive({ useHandCursor: true });
    noBg.on("pointerdown", () => this.container.setVisible(false));
    this.container.add([noBg, noTxt]);
  }

  show(msg: string, onConfirm: () => void): void {
    this.msgText.setText(msg);
    this.container.setData("onConfirm", onConfirm);
    this.container.setVisible(true);
  }

  hide(): void {
    this.container.setVisible(false);
  }

  isVisible(): boolean { return this.container.visible; }
}
