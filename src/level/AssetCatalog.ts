// Catalogue centralisé de tous les assets utilisables par l'éditeur de niveau.
// Chaque entrée décrit comment l'asset est chargé et affiché.

export type AssetCategory = "background" | "platform" | "decoration" | "enemy" | "spawn" | "hazard" | "system";

export interface AssetDef {
  id:        string;        // identifiant unique
  label:     string;        // texte affiché dans la palette
  category:  AssetCategory;
  textureKey: string;       // clé Phaser après load
  // Pour les images simples
  imagePath?: string;
  // Pour les spritesheets
  sheetPath?: string;
  frameW?:   number;
  frameH?:   number;
  totalFrames?: number;
  defaultAnim?: { key: string; start: number; end: number; fps: number; repeat: number };
  // Affichage par défaut
  defaultScale: number;
  // Anchor (origin) — par défaut pieds en bas-centre pour ennemis/personnage
  originX?: number;
  originY?: number;
  // Pour les plateformes/tilesprites : offset dans la texture source
  tileOffsetX?: number;
  tileOffsetY?: number;
  // Pour les plateformes "image fixe" : crop dans la texture source (pas tileable)
  // Si défini, on utilise une frame Phaser au lieu d'un tileSprite
  sourceFrame?: { x: number; y: number; w: number; h: number };
  // Taille par defaut dans le monde, separee du crop source.
  defaultWidth?: number;
  defaultHeight?: number;
}

const PLANT_BASE   = "assets/Plant Animations";
const MUSH_BASE    = "assets/Mushroom with VFX";
const MOSSY_BASE   = "assets/Mossy Tileset";

// On utilise une seule frame représentative par plante (~milieu de l'animation)
// pour éviter de charger les 60-90 PNG par plante.
const plant = (id: string, label: string, folder: string, fname: string, scale: number): AssetDef => ({
  id, label, category: "decoration",
  textureKey: id,
  imagePath:  `${PLANT_BASE}/${folder}/${fname}`,
  defaultScale: scale,
  originX: 0.5, originY: 1,
});

// Helper pour créer un asset plateforme avec offset dans le tileset source
const platformVariant = (
  id: string, label: string, textureKey: string, imagePath: string,
  ox: number, oy: number,
): AssetDef => ({
  id, label, category: "platform",
  textureKey, imagePath,
  defaultScale: 1,
  originX: 0, originY: 0,
  tileOffsetX: ox, tileOffsetY: oy,
});

// Helper pour une plateforme flottante = image fixe découpée du spritesheet
const floatingPlatform = (
  id: string, label: string,
  x: number, y: number, w: number, h: number,
): AssetDef => ({
  id, label, category: "platform",
  textureKey: "mossy-floating",
  imagePath: `${MOSSY_BASE}/Mossy - FloatingPlatforms.png`,
  defaultScale: 1,
  originX: 0, originY: 0,
  sourceFrame: { x, y, w, h },
  defaultWidth: Math.round(w * 0.5),
  defaultHeight: Math.round(h * 0.5),
});

const hangingPlant = (
  id: string, label: string,
  x: number, y: number, w: number, h: number,
  scale = 0.45,
): AssetDef => ({
  id, label, category: "background",
  textureKey: "mossy-hanging",
  imagePath: `${MOSSY_BASE}/Mossy - Hanging Plants.png`,
  defaultScale: 1,
  originX: 0, originY: 0,
  sourceFrame: { x, y, w, h },
  defaultWidth: Math.round(w * scale),
  defaultHeight: Math.round(h * scale),
});

// Helper pour créer un asset décor/hazard depuis le spritesheet Mossy Decorations&Hazards
const mossyDeco = (
  id: string, label: string, ox: number, oy: number,
): AssetDef => ({
  id, label, category: "hazard",
  textureKey: "mossy-hazards",
  imagePath: `${MOSSY_BASE}/Mossy - Decorations&Hazards.png`,
  defaultScale: 1,
  originX: 0, originY: 0,
  tileOffsetX: ox, tileOffsetY: oy,
  sourceFrame: { x: ox, y: oy, w: 256, h: 256 },
  defaultWidth: 128,
  defaultHeight: 128,
});

const mossyHill = (
  id: string, label: string,
  x: number, y: number, w: number, h: number,
): AssetDef => ({
  id, label, category: "background",
  textureKey: "mossy-hills-sheet",
  imagePath: `${MOSSY_BASE}/Mossy - MossyHills.png`,
  defaultScale: 1,
  originX: 0, originY: 0,
  sourceFrame: { x, y, w, h },
  defaultWidth: Math.round(w * 0.5),
  defaultHeight: Math.round(h * 0.5),
});

export const ASSET_CATALOG: AssetDef[] = [
  hangingPlant("hang-vine-long",    "Liane longue",    110,  120,  390,  930, 0.38),
  hangingPlant("hang-vine-wide",    "Liane large",     540,  110,  420,  880, 0.36),
  hangingPlant("hang-vine-center",  "Liane centre",    955,  105,  420,  880, 0.36),
  hangingPlant("hang-vine-short",   "Liane courte",    1380, 115,  310,  710, 0.38),
  hangingPlant("hang-side-leaves",  "Feuilles cote",   1710, 100,  338,  850, 0.44),
  hangingPlant("hang-moss-column",  "Rideau mousse",   70,   1390, 470, 1480, 0.32),
  hangingPlant("hang-moss-column2", "Rideau mousse 2", 730,  1390, 500, 1480, 0.32),
  hangingPlant("hang-curved-leaf",  "Feuille courbe",  1210, 1120, 800, 520, 0.32),
  // ─── Plateformes solides ────────────────────────────────────────────────────
  // Variantes basées sur Mossy - TileSet.png (3584×3584). Chaque offset montre
  // une portion différente du tileset. Si tu vois autre chose que ce que tu
  // voulais, ajuste tileOffsetX/Y.
  platformVariant("platform-mossy",      "Mossy A",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  0,    0   ),
  platformVariant("platform-mossy-2",    "Mossy B",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  192,  0   ),
  platformVariant("platform-mossy-3",    "Mossy C",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  384,  0   ),
  platformVariant("platform-mossy-4",    "Mossy D",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  576,  0   ),
  platformVariant("platform-mossy-5",    "Mossy E",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  0,    192 ),
  platformVariant("platform-mossy-6",    "Mossy F",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  192,  192 ),
  platformVariant("platform-mossy-7",    "Mossy G",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  0,    384 ),
  platformVariant("platform-mossy-8",    "Mossy H",        "mossy-tileset-img",  `${MOSSY_BASE}/Mossy - TileSet.png`,  192,  384 ),
  // Plateformes flottantes (image dédiée)
  // Plateformes flottantes : 8 plateformes distinctes découpées du spritesheet 2048×2048
  floatingPlatform("fp-small-bush",  "Buisson S",   60,    20,  330,  410),
  floatingPlatform("fp-wide-top",    "Plat. large", 440,   30,  1080, 440),
  floatingPlatform("fp-tall-vert",   "Tour vert.",  1620,  40,  370,  820),
  floatingPlatform("fp-medium-bush", "Buisson M",   60,    510, 410,  380),
  floatingPlatform("fp-wide-mid",    "Plat. moy.",  510,   570, 940,  320),
  floatingPlatform("fp-small-low",   "Petite",      60,    1070,330,  280),
  floatingPlatform("fp-wide-bot",    "Plat. larg.", 450,   1070,1480, 320),
  floatingPlatform("fp-extra-wide",  "Plat. XL",    30,    1670,1980, 350),
  // ─── Hazards & Décorations Mossy (112 sprites du spritesheet 4096×4096) ─────
  // Auto-généré depuis Mossy - Decorations&Hazards.png, cellules 256×256, fill≥20%
  mossyDeco("mossy-deco-r0c13", "HZD 0,13", 3328, 0),
  mossyDeco("mossy-deco-r1c1", "HZD 1,1", 256, 256),
  mossyDeco("mossy-deco-r1c2", "HZD 1,2", 512, 256),
  mossyDeco("mossy-deco-r1c3", "HZD 1,3", 768, 256),
  mossyDeco("mossy-deco-r1c4", "HZD 1,4", 1024, 256),
  mossyDeco("mossy-deco-r1c7", "HZD 1,7", 1792, 256),
  mossyDeco("mossy-deco-r1c8", "HZD 1,8", 2048, 256),
  mossyDeco("mossy-deco-r1c9", "HZD 1,9", 2304, 256),
  mossyDeco("mossy-deco-r1c12", "HZD 1,12", 3072, 256),
  mossyDeco("mossy-deco-r1c13", "HZD 1,13", 3328, 256),
  mossyDeco("mossy-deco-r1c14", "HZD 1,14", 3584, 256),
  mossyDeco("mossy-deco-r2c1", "HZD 2,1", 256, 512),
  mossyDeco("mossy-deco-r2c2", "HZD 2,2", 512, 512),
  mossyDeco("mossy-deco-r2c3", "HZD 2,3", 768, 512),
  mossyDeco("mossy-deco-r2c4", "HZD 2,4", 1024, 512),
  mossyDeco("mossy-deco-r2c5", "HZD 2,5", 1280, 512),
  mossyDeco("mossy-deco-r2c6", "HZD 2,6", 1536, 512),
  mossyDeco("mossy-deco-r2c7", "HZD 2,7", 1792, 512),
  mossyDeco("mossy-deco-r2c8", "HZD 2,8", 2048, 512),
  mossyDeco("mossy-deco-r2c9", "HZD 2,9", 2304, 512),
  mossyDeco("mossy-deco-r2c10", "HZD 2,10", 2560, 512),
  mossyDeco("mossy-deco-r2c12", "HZD 2,12", 3072, 512),
  mossyDeco("mossy-deco-r2c13", "HZD 2,13", 3328, 512),
  mossyDeco("mossy-deco-r2c14", "HZD 2,14", 3584, 512),
  mossyDeco("mossy-deco-r3c1", "HZD 3,1", 256, 768),
  mossyDeco("mossy-deco-r3c2", "HZD 3,2", 512, 768),
  mossyDeco("mossy-deco-r3c3", "HZD 3,3", 768, 768),
  mossyDeco("mossy-deco-r3c4", "HZD 3,4", 1024, 768),
  mossyDeco("mossy-deco-r3c5", "HZD 3,5", 1280, 768),
  mossyDeco("mossy-deco-r3c6", "HZD 3,6", 1536, 768),
  mossyDeco("mossy-deco-r3c7", "HZD 3,7", 1792, 768),
  mossyDeco("mossy-deco-r3c8", "HZD 3,8", 2048, 768),
  mossyDeco("mossy-deco-r3c9", "HZD 3,9", 2304, 768),
  mossyDeco("mossy-deco-r3c10", "HZD 3,10", 2560, 768),
  mossyDeco("mossy-deco-r3c11", "HZD 3,11", 2816, 768),
  mossyDeco("mossy-deco-r3c12", "HZD 3,12", 3072, 768),
  mossyDeco("mossy-deco-r3c13", "HZD 3,13", 3328, 768),
  mossyDeco("mossy-deco-r3c14", "HZD 3,14", 3584, 768),
  mossyDeco("mossy-deco-r3c15", "HZD 3,15", 3840, 768),
  mossyDeco("mossy-deco-r4c2", "HZD 4,2", 512, 1024),
  mossyDeco("mossy-deco-r4c3", "HZD 4,3", 768, 1024),
  mossyDeco("mossy-deco-r4c4", "HZD 4,4", 1024, 1024),
  mossyDeco("mossy-deco-r4c10", "HZD 4,10", 2560, 1024),
  mossyDeco("mossy-deco-r4c11", "HZD 4,11", 2816, 1024),
  mossyDeco("mossy-deco-r5c1", "HZD 5,1", 256, 1280),
  mossyDeco("mossy-deco-r5c2", "HZD 5,2", 512, 1280),
  mossyDeco("mossy-deco-r5c4", "HZD 5,4", 1024, 1280),
  mossyDeco("mossy-deco-r5c5", "HZD 5,5", 1280, 1280),
  mossyDeco("mossy-deco-r5c8", "HZD 5,8", 2048, 1280),
  mossyDeco("mossy-deco-r5c9", "HZD 5,9", 2304, 1280),
  mossyDeco("mossy-deco-r5c10", "HZD 5,10", 2560, 1280),
  mossyDeco("mossy-deco-r5c11", "HZD 5,11", 2816, 1280),
  mossyDeco("mossy-deco-r5c12", "HZD 5,12", 3072, 1280),
  mossyDeco("mossy-deco-r6c3", "HZD 6,3", 768, 1536),
  mossyDeco("mossy-deco-r6c11", "HZD 6,11", 2816, 1536),
  mossyDeco("mossy-deco-r6c12", "HZD 6,12", 3072, 1536),
  mossyDeco("mossy-deco-r7c2", "HZD 7,2", 512, 1792),
  mossyDeco("mossy-deco-r7c3", "HZD 7,3", 768, 1792),
  mossyDeco("mossy-deco-r7c4", "HZD 7,4", 1024, 1792),
  mossyDeco("mossy-deco-r7c7", "HZD 7,7", 1792, 1792),
  mossyDeco("mossy-deco-r7c10", "HZD 7,10", 2560, 1792),
  mossyDeco("mossy-deco-r8c2", "HZD 8,2", 512, 2048),
  mossyDeco("mossy-deco-r8c4", "HZD 8,4", 1024, 2048),
  mossyDeco("mossy-deco-r8c7", "HZD 8,7", 1792, 2048),
  mossyDeco("mossy-deco-r8c9", "HZD 8,9", 2304, 2048),
  mossyDeco("mossy-deco-r8c10", "HZD 8,10", 2560, 2048),
  mossyDeco("mossy-deco-r8c11", "HZD 8,11", 2816, 2048),
  mossyDeco("mossy-deco-r8c13", "HZD 8,13", 3328, 2048),
  mossyDeco("mossy-deco-r8c14", "HZD 8,14", 3584, 2048),
  mossyDeco("mossy-deco-r9c2", "HZD 9,2", 512, 2304),
  mossyDeco("mossy-deco-r9c4", "HZD 9,4", 1024, 2304),
  mossyDeco("mossy-deco-r10c3", "HZD 10,3", 768, 2560),
  mossyDeco("mossy-deco-r10c8", "HZD 10,8", 2048, 2560),
  mossyDeco("mossy-deco-r10c10", "HZD 10,10", 2560, 2560),
  mossyDeco("mossy-deco-r10c11", "HZD 10,11", 2816, 2560),
  mossyDeco("mossy-deco-r10c13", "HZD 10,13", 3328, 2560),
  mossyDeco("mossy-deco-r10c14", "HZD 10,14", 3584, 2560),
  mossyDeco("mossy-deco-r10c15", "HZD 10,15", 3840, 2560),
  mossyDeco("mossy-deco-r11c5", "HZD 11,5", 1280, 2816),
  mossyDeco("mossy-deco-r11c6", "HZD 11,6", 1536, 2816),
  mossyDeco("mossy-deco-r11c7", "HZD 11,7", 1792, 2816),
  mossyDeco("mossy-deco-r11c8", "HZD 11,8", 2048, 2816),
  mossyDeco("mossy-deco-r11c10", "HZD 11,10", 2560, 2816),
  mossyDeco("mossy-deco-r11c12", "HZD 11,12", 3072, 2816),
  mossyDeco("mossy-deco-r11c14", "HZD 11,14", 3584, 2816),
  mossyDeco("mossy-deco-r11c15", "HZD 11,15", 3840, 2816),
  mossyDeco("mossy-deco-r12c6", "HZD 12,6", 1536, 3072),
  mossyDeco("mossy-deco-r12c7", "HZD 12,7", 1792, 3072),
  mossyDeco("mossy-deco-r12c8", "HZD 12,8", 2048, 3072),
  mossyDeco("mossy-deco-r12c9", "HZD 12,9", 2304, 3072),
  mossyDeco("mossy-deco-r12c11", "HZD 12,11", 2816, 3072),
  mossyDeco("mossy-deco-r12c12", "HZD 12,12", 3072, 3072),
  mossyDeco("mossy-deco-r12c14", "HZD 12,14", 3584, 3072),
  mossyDeco("mossy-deco-r12c15", "HZD 12,15", 3840, 3072),
  mossyDeco("mossy-deco-r13c6", "HZD 13,6", 1536, 3328),
  mossyDeco("mossy-deco-r13c7", "HZD 13,7", 1792, 3328),
  mossyDeco("mossy-deco-r13c9", "HZD 13,9", 2304, 3328),
  mossyDeco("mossy-deco-r13c11", "HZD 13,11", 2816, 3328),
  mossyDeco("mossy-deco-r13c13", "HZD 13,13", 3328, 3328),
  mossyDeco("mossy-deco-r13c14", "HZD 13,14", 3584, 3328),
  mossyDeco("mossy-deco-r13c15", "HZD 13,15", 3840, 3328),
  mossyDeco("mossy-deco-r14c9", "HZD 14,9", 2304, 3584),
  mossyDeco("mossy-deco-r14c10", "HZD 14,10", 2560, 3584),
  mossyDeco("mossy-deco-r14c13", "HZD 14,13", 3328, 3584),
  mossyDeco("mossy-deco-r14c14", "HZD 14,14", 3584, 3584),
  mossyDeco("mossy-deco-r14c15", "HZD 14,15", 3840, 3584),
  mossyDeco("mossy-deco-r15c6", "HZD 15,6", 1536, 3840),
  mossyDeco("mossy-deco-r15c7", "HZD 15,7", 1792, 3840),
  mossyDeco("mossy-deco-r15c9", "HZD 15,9", 2304, 3840),
  mossyDeco("mossy-deco-r15c10", "HZD 15,10", 2560, 3840),
  mossyDeco("mossy-deco-r15c12", "HZD 15,12", 3072, 3840),
  mossyDeco("mossy-deco-r15c14", "HZD 15,14", 3584, 3840),

  // ─── Décorations (plantes) ──────────────────────────────────────────────────
  // Frame "milieu" pour chaque plante
  plant("plant1",       "Plante 1",       "Plant 1",         "Plant1_00030.png",        0.18),
  plant("plant2",       "Plante 2",       "Plant 2",         "Plant2_00030.png",        0.18),
  plant("plant3",       "Plante 3",       "Plant 3",         "Plant3_00030.png",        0.18),
  plant("plant4",       "Plante 4",       "Plant 4",         "Plant4_00030.png",        0.18),
  plant("plant5",       "Plante 5",       "Plant 5",         "Plant5_00030.png",        0.18),
  plant("plant6",       "Plante 6",       "Plant 6",         "Plant6_00030.png",        0.18),
  plant("plant7",       "Plante 7",       "Plant 7",         "Plant7_00030.png",        0.18),
  plant("plant8poison", "Plante poison",  "Plant 8 Poison",  "PlantPosion_00010.png",   0.20),
  plant("plantWind",    "Plante vent",    "Plant Wind 1",    "Plant Wind 1_00010.png",  0.20),
  plant("plantJump",    "Plante saut",    "PlantJump",       "JumpPlant_00010.png",     0.20),
  plant("plantJump2",   "Plante saut 2",  "PlantJump2",      "JumpPlant 2_00010.png",   0.20),
  plant("blueFlower1",  "Fleur bleue",    "BlueFlower1",     "BlueFlower_00030.png",    0.14),
  plant("blueFlower2",  "Fleur fermée",   "BlueFlower2",     "BluePlantClosed_00030.png", 0.14),
  // Hanging plants : on utilise toute l'image (pas un dossier de frames) — origin haut-centre
  mossyHill("hill-small-left",  "Colline S gauche",  64,   1792, 191, 169),
  mossyHill("hill-small-mid",   "Colline S milieu",  256,  1792, 255, 169),
  mossyHill("hill-small-right", "Colline S droite",  1792, 1792, 197, 211),
  mossyHill("hill-tall-left",   "Colline haute G",   768,  256,  255, 255),
  mossyHill("hill-tall-mid",    "Colline haute M",   1024, 256,  255, 255),
  mossyHill("hill-tall-right",  "Colline haute D",   1536, 256,  255, 255),

  // ─── Ennemis ────────────────────────────────────────────────────────────────
  {
    id: "enemy-mushroom",
    label: "Champignon",
    category: "enemy",
    textureKey: "mush-run",
    sheetPath:  `${MUSH_BASE}/Mushroom-Run.png`,
    frameW: 80, frameH: 64, totalFrames: 8,
    defaultAnim: { key: "mush-walk-static", start: 0, end: 7, fps: 10, repeat: -1 },
    defaultScale: 1.5,
    originX: 0.5, originY: 1,
  },

  // ─── Spawn joueur ───────────────────────────────────────────────────────────
  {
    id: "spawn-player",
    label: "Spawn joueur",
    category: "spawn",
    textureKey: "skel-idle",
    sheetPath:  `assets/Skeleton_With_VFX/Skeleton_01_White_Idle.png`,
    frameW: 96, frameH: 64, totalFrames: 8,
    defaultAnim: { key: "skel-idle-static", start: 0, end: 7, fps: 8, repeat: -1 },
    defaultScale: 1.6,
    originX: 0.5, originY: 1,
  },

  // ─── System ───────────────────────────────────────────────────────────────

  {
    id: "checkpoint",
    label: "Checkpoint",
    category: "system",
    textureKey: "__DEFAULT",
    defaultScale: 1,
    defaultWidth: 48,
    defaultHeight: 48,
  },
  {
    id: "victory",
    label: "Victoire",
    category: "system",
    textureKey: "__DEFAULT",
    defaultScale: 1,
    defaultWidth: 96,
    defaultHeight: 96,
  },
];

export const CATALOG_BY_ID: Record<string, AssetDef> = Object.fromEntries(
  ASSET_CATALOG.map((a) => [a.id, a]),
);

export function preloadCatalog(scene: Phaser.Scene): void {
  for (const a of ASSET_CATALOG) {
    if (a.sheetPath && a.frameW && a.frameH) {
      scene.load.spritesheet(a.textureKey, a.sheetPath, {
        frameWidth: a.frameW, frameHeight: a.frameH,
      });
    } else if (a.imagePath) {
      scene.load.image(a.textureKey, a.imagePath);
    }
  }
}

export function ensureCatalogAnimations(scene: Phaser.Scene): void {
  for (const a of ASSET_CATALOG) {
    if (a.defaultAnim && !scene.anims.exists(a.defaultAnim.key)) {
      scene.anims.create({
        key:    a.defaultAnim.key,
        frames: scene.anims.generateFrameNumbers(a.textureKey, {
          start: a.defaultAnim.start, end: a.defaultAnim.end,
        }),
        frameRate: a.defaultAnim.fps,
        repeat:    a.defaultAnim.repeat,
      });
    }
  }
}

/** Crée les frames Phaser personnalisées pour les assets ayant un sourceFrame. */
export function ensureCatalogFrames(scene: Phaser.Scene): void {
  for (const a of ASSET_CATALOG) {
    if (!a.sourceFrame) continue;
    if (!scene.textures.exists(a.textureKey)) continue;
    const tex = scene.textures.get(a.textureKey);
    if (tex.has(a.id)) continue;
    tex.add(a.id, 0, a.sourceFrame.x, a.sourceFrame.y, a.sourceFrame.w, a.sourceFrame.h);
  }
}

export function getAssetDefaultSize(asset: AssetDef): { width: number; height: number } {
  return {
    width: asset.defaultWidth ?? asset.sourceFrame?.w ?? 192,
    height: asset.defaultHeight ?? asset.sourceFrame?.h ?? 96,
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────
// Clones d'assets (persistants via localStorage)
// ──────────────────────────────────────────────────────────────────────────────────────

const CLONE_STORAGE_KEY = "oakwoods-asset-clones";

let _cachedClones: AssetDef[] | null = null;

function _loadCloneDefs(): AssetDef[] {
  if (_cachedClones) return _cachedClones;
  try {
    const raw = localStorage.getItem(CLONE_STORAGE_KEY);
    if (raw) {
      _cachedClones = JSON.parse(raw) as AssetDef[];
      return _cachedClones;
    }
  } catch { /* ignore */ }
  _cachedClones = [];
  return _cachedClones;
}

function _saveCloneDefs(clones: AssetDef[]): void {
  _cachedClones = clones;
  try {
    localStorage.setItem(CLONE_STORAGE_KEY, JSON.stringify(clones));
  } catch { /* ignore */ }
}

/** Retourne le catalogue complet : assets natifs + clones persistés. */
export function getFullCatalog(): AssetDef[] {
  return [...ASSET_CATALOG, ..._loadCloneDefs()];
}

/** Retourne uniquement les clones. */
export function getClones(): AssetDef[] {
  return _loadCloneDefs();
}

/** Crée un clone d'un asset existant. L'image est stockée en base64 dans imagePath. */
export async function createClone(sourceId: string, newName: string): Promise<AssetDef | null> {
  const source = ASSET_CATALOG.find((a) => a.id === sourceId) ?? getClones().find((a) => a.id === sourceId);
  if (!source) return null;

  const newId = `${source.id}-clone-${Date.now()}`;
  const textureKey = `${source.textureKey}-clone-${Date.now()}`;

  // Charger l'image source et la convertir en base64
  const imgPath = source.imagePath ?? source.sheetPath;
  if (!imgPath) return null;

  const basePath = (window as any).__oakwoods_basePath ?? "";
  const fullPath = imgPath.startsWith("/") || imgPath.startsWith("http") || imgPath.startsWith("data:")
    ? imgPath
    : `${basePath}/${imgPath}`;

  try {
    const resp = await fetch(fullPath);
    const blob = await resp.blob();
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

    const clone: AssetDef = {
      ...source,
      id: newId,
      label: newName,
      textureKey,
      imagePath: dataUrl,
      sheetPath: undefined,
    };

    const clones = _loadCloneDefs();
    clones.push(clone);
    _saveCloneDefs(clones);
    return clone;
  } catch {
    return null;
  }
}

/** Supprime un clone par son ID. */
export function removeClone(cloneId: string): void {
  const clones = _loadCloneDefs().filter((c) => c.id !== cloneId);
  _saveCloneDefs(clones);
}

/** Précharge le catalogue complet (natifs + clones). */
export function preloadFullCatalog(scene: Phaser.Scene): void {
  for (const a of getFullCatalog()) {
    if (a.sheetPath && a.frameW && a.frameH) {
      scene.load.spritesheet(a.textureKey, a.sheetPath, {
        frameWidth: a.frameW, frameHeight: a.frameH,
      });
    } else if (a.imagePath) {
      scene.load.image(a.textureKey, a.imagePath);
    }
  }
}
