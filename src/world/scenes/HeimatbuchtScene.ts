import Phaser from 'phaser';
import {
  gameStore,
  npcArrivedOf,
  npcDialogIdOf,
  questIndicatorOf,
  questNodeVisibleOf,
} from '../../shared/store';
import { strings } from '../../shared/strings';
import { isZoneId, zoneAt, type ZoneRect } from '../../core/world/zones';
import { heimatbuchtHarvestNodes, type HarvestNodeType } from '../../data/resources';
import { heimatbuchtStations, stationInteractRange } from '../../data/stations';
import { buildings, buildSlotInteractRange, type BuildingDef } from '../../data/buildings';
import { marketSlot } from '../../data/market';
import { fishingConfig } from '../../data/fishing';
import { npcInteractRange } from '../../data/dialogs';
import {
  npcPlacements,
  npcs,
  questCollectNodes,
  type NpcDef,
  type QuestCollectNode,
} from '../../data/npcs';
import {
  crops,
  farmInteractRange,
  FARM_CROP_IDS,
  heimatbuchtFarmPlots,
  heimatbuchtTent,
  isCropId,
  type CropId,
} from '../../data/farming';
import { isRipe } from '../../core/economy/farming';
import type { WorldStationId } from '../../data/stations';
import {
  heimatbuchtShrines,
  shrineDiscoverRange,
  type ShrinePlacement,
} from '../../data/exploration';
import {
  dungeonEntranceInteractRange,
  dungeonsById,
  heimatbuchtDungeonEntrances,
  type DungeonEntrancePlacement,
} from '../../data/dungeons/verwachseneHoehle';
import {
  creatureContactRange,
  creatureIdleMs,
  creatureWanderRadius,
  creatureWanderSpeed,
  encounterGraceMs,
  heimatbuchtCreatureSpawns,
  type CreatureSpawn,
} from '../../data/creatures';

const PLAYER_SPEED = 140;
const TILE = 16;
/** Max distance (px) at which a harvest node can be interacted with. */
const HARVEST_RANGE = 26;
/** Orange = actionable (docs/04 color rule) — highlight + prompt border. */
const ACTION_TINT = 0xff9a4a;

interface WorldCreature {
  spawn: CreatureSpawn;
  sprite: Phaser.GameObjects.Sprite;
  moveTween: Phaser.Tweens.Tween | null;
  idleTimer: Phaser.Time.TimerEvent | null;
}

interface WorldStation {
  station: WorldStationId;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldBuildSlot {
  def: BuildingDef;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldDialogNpc {
  npc: NpcDef;
  sprite: Phaser.GameObjects.Sprite;
  /** Quest symbol over the head (docs/13: ! neue Quest · ? abschlussbereit). */
  indicator: Phaser.GameObjects.Text;
}

interface WorldQuestNode {
  node: QuestCollectNode;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldFarmPlot {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldDungeonEntrance {
  placement: DungeonEntrancePlacement;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldShrine {
  placement: ShrinePlacement;
  sprite: Phaser.GameObjects.Sprite;
}

interface WorldHarvestNode {
  id: string;
  type: HarvestNodeType;
  sprite: Phaser.GameObjects.Sprite;
  harvested: boolean;
}

/**
 * Heimatbucht — first island area (M2): Tiled-JSON tilemap with the three
 * zones Strand / Wiese / Waldrand, arcade-physics player movement and
 * collision against water/rocks/trees.
 *
 * No game logic here: zone lookup is pure core logic, zone/position state
 * goes to the shared Zustand store for other layers (encounter tables etc.).
 */
export class HeimatbuchtScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private zones: ZoneRect[] = [];
  private lastTile = { x: -1, y: -1 };
  private harvestNodes: WorldHarvestNode[] = [];
  private interactKey!: Phaser.Input.Keyboard.Key;
  private harvestPrompt!: Phaser.GameObjects.Text;
  private focusedNode: WorldHarvestNode | null = null;
  private stations: WorldStation[] = [];
  private focusedStation: WorldStation | null = null;
  private buildSlots: WorldBuildSlot[] = [];
  private focusedBuildSlot: WorldBuildSlot | null = null;
  private dialogNpcs: WorldDialogNpc[] = [];
  private focusedNpc: WorldDialogNpc | null = null;
  private questNodes: WorldQuestNode[] = [];
  private focusedQuestNode: WorldQuestNode | null = null;
  private farmPlots: WorldFarmPlot[] = [];
  private focusedPlot: WorldFarmPlot | null = null;
  private tentSprite: Phaser.GameObjects.Sprite | null = null;
  private tentFocused = false;
  private plantKeys: Phaser.Input.Keyboard.Key[] = [];
  private shrines: WorldShrine[] = [];
  private dungeonEntrances: WorldDungeonEntrance[] = [];
  private focusedEntrance: WorldDungeonEntrance | null = null;
  private discoveryToast: Phaser.GameObjects.Text | null = null;
  private creatures: WorldCreature[] = [];
  /** Creature that triggered the running combat — despawned on victory. */
  private engagedCreature: WorldCreature | null = null;
  /** Timestamp until which creature contact is ignored (post-combat grace). */
  private contactGraceUntil = 0;
  /**
   * Grace must be stamped on the first update AFTER resume: while the scene
   * is paused, this.time.now is frozen at combat start, so stamping it in
   * onCombatEnded would already be expired for any combat longer than the
   * grace period (bug M2-1).
   */
  private gracePending = false;
  private unsubscribeStore: (() => void) | null = null;

  constructor() {
    super('heimatbucht');
  }

  init(): void {
    this.zones = [];
    this.lastTile = { x: -1, y: -1 };
    this.harvestNodes = [];
    this.focusedNode = null;
    this.stations = [];
    this.focusedStation = null;
    this.buildSlots = [];
    this.focusedBuildSlot = null;
    this.dialogNpcs = [];
    this.focusedNpc = null;
    this.questNodes = [];
    this.focusedQuestNode = null;
    this.farmPlots = [];
    this.focusedPlot = null;
    this.tentSprite = null;
    this.tentFocused = false;
    this.plantKeys = [];
    this.shrines = [];
    this.dungeonEntrances = [];
    this.focusedEntrance = null;
    this.discoveryToast = null;
    this.creatures = [];
    this.engagedCreature = null;
    this.contactGraceUntil = 0;
    this.gracePending = false;
  }

  preload(): void {
    this.load.image('tiles-heimatbucht', 'assets/tilesets/heimatbucht.png');
    this.load.tilemapTiledJSON('map-heimatbucht', 'assets/maps/heimatbucht.json');
  }

  create(): void {
    const map = this.make.tilemap({ key: 'map-heimatbucht' });
    const tileset = map.addTilesetImage('heimatbucht', 'tiles-heimatbucht');
    if (!tileset) throw new Error('Tileset "heimatbucht" missing in map');
    const ground = map.createLayer('ground', tileset);
    if (!ground) throw new Error('Layer "ground" missing in map');
    ground.setCollisionByProperty({ collides: true });

    this.zones = this.readZones(map);

    this.spawnHarvestNodes();
    this.spawnStations();
    this.spawnBuildSlots();
    this.spawnDialogNpcs();
    this.spawnQuestNodes();
    this.spawnFarm();
    this.spawnShrines();
    this.spawnDungeonEntrances();
    this.spawnCreatures();

    // Saved position wins (save V1); fresh games start at the map center.
    const savedPosition = gameStore.getState().playerPosition;
    this.player = this.createPlayer(
      savedPosition?.x ?? map.widthInPixels / 2,
      savedPosition?.y ?? map.heightInPixels / 2,
    );
    this.physics.add.collider(this.player, ground);

    this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.player.setCollideWorldBounds(true);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    cam.startFollow(this.player, true, 0.12, 0.12);
    cam.setZoom(2);

    if (!this.input.keyboard) throw new Error('Keyboard input unavailable');
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    }) as typeof this.wasd;
    this.interactKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    // 1/2/3 pick the crop while an empty plot is focused (order = FARM_CROP_IDS).
    this.plantKeys = [
      Phaser.Input.Keyboard.KeyCodes.ONE,
      Phaser.Input.Keyboard.KeyCodes.TWO,
      Phaser.Input.Keyboard.KeyCodes.THREE,
    ].map((code) => this.input.keyboard!.addKey(code));

    // Prompt text follows the focused node; key label in text — information
    // is never color-only (docs/11 accessibility rule).
    this.harvestPrompt = this.add
      .text(0, 0, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#3a2e28',
        backgroundColor: '#ff9a4a',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20)
      .setVisible(false);

    // Combat lifecycle: the React overlay owns the fight; this scene pauses
    // on start and resumes on end (loop island → combat → island, docs/12 M2).
    this.unsubscribeStore = gameStore.subscribe((state, prev) => {
      // Discovery feedback (M4 Task 2): discoverMarker sets markers + XP in
      // one atomic transition, so the XP delta belongs to the new marker.
      if (state.discoveredMarkers !== prev.discoveredMarkers) {
        const newMarker = state.discoveredMarkers.find(
          (id) => !prev.discoveredMarkers.includes(id),
        );
        if (newMarker) this.onMarkerDiscovered(newMarker, state.xp - prev.xp);
      }
      if (prev.combat === null && state.combat !== null) {
        this.scene.pause();
      } else if (prev.combat !== null && state.combat === null) {
        // Dungeon room won: the run continues in the React panel — the
        // world stays frozen until the run ends (no creature involved).
        if (state.currentDungeonRun === null) this.onCombatEnded(state.lastCombatOutcome);
      } else if (prev.currentDungeonRun === null && state.currentDungeonRun !== null) {
        // Dungeon panel open (React overlay) → freeze the world, like combat.
        this.scene.pause();
      } else if (
        prev.currentDungeonRun !== null &&
        state.currentDungeonRun === null &&
        state.combat === null
      ) {
        // Run over (abandon, defeat/retreat handled above, boss victory).
        this.scene.resume();
      } else if (prev.activeStation === null && state.activeStation !== null) {
        // Workshop UI open (React overlay) → freeze the world, like combat.
        this.scene.pause();
      } else if (prev.activeStation !== null && state.activeStation === null) {
        this.scene.resume();
      } else if (prev.activeBuildSlot === null && state.activeBuildSlot !== null) {
        // Build UI open (React overlay) → freeze the world, like stations.
        this.scene.pause();
      } else if (prev.activeBuildSlot !== null && state.activeBuildSlot === null) {
        this.scene.resume();
      } else if (prev.activeDialog === null && state.activeDialog !== null) {
        // Dialog open (React overlay, docs/13) → freeze the world.
        this.scene.pause();
      } else if (prev.activeDialog !== null && state.activeDialog === null) {
        this.scene.resume();
      } else if (!prev.marketOpen && state.marketOpen) {
        // Markt-Panel open (React overlay, M5 Task 4b) → freeze the world.
        this.scene.pause();
      } else if (prev.marketOpen && !state.marketOpen) {
        this.scene.resume();
      }
      // Built stage changed (build panel) → mirror onto the world sprites.
      if (state.builtBuildings !== prev.builtBuildings) this.refreshBuildSlotSprites();
      // NPC arrival, quest indicators and quest pickups derive from these
      // slices (M5 Task 3, core/quests) — mirror onto the world sprites.
      if (
        state.builtBuildings !== prev.builtBuildings ||
        state.rescuedNpcs !== prev.rescuedNpcs ||
        state.completedDungeons !== prev.completedDungeons ||
        state.storyFlags !== prev.storyFlags ||
        state.activeQuests !== prev.activeQuests ||
        state.completedQuests !== prev.completedQuests ||
        state.inventory !== prev.inventory
      ) {
        this.refreshNpcPresence();
        this.refreshQuestNodes();
      }
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribeStore?.();
      this.unsubscribeStore = null;
    });

    this.publishLocation(); // initial zone before first movement
    gameStore.getState().setWorldReady(true);
  }

  update(): void {
    const body = this.player.body;
    const left = this.cursors.left.isDown || this.wasd.left.isDown;
    const right = this.cursors.right.isDown || this.wasd.right.isDown;
    const up = this.cursors.up.isDown || this.wasd.up.isDown;
    const down = this.cursors.down.isDown || this.wasd.down.isDown;

    body.setVelocity(0);
    if (left) body.setVelocityX(-PLAYER_SPEED);
    else if (right) body.setVelocityX(PLAYER_SPEED);
    if (up) body.setVelocityY(-PLAYER_SPEED);
    else if (down) body.setVelocityY(PLAYER_SPEED);
    body.velocity.normalize().scale(PLAYER_SPEED);

    // Publish zone/position only when the player enters a new tile.
    const tileX = Math.floor(this.player.x / TILE);
    const tileY = Math.floor(this.player.y / TILE);
    if (tileX !== this.lastTile.x || tileY !== this.lastTile.y) {
      this.lastTile = { x: tileX, y: tileY };
      this.publishLocation();
    }

    this.updateStationFocus();
    this.updateBuildSlotFocus();
    this.updateDungeonEntranceFocus();
    this.updateFarmFocus();
    this.updateHarvestFocus();
    this.updateQuestNodeFocus();
    this.updateNpcFocus();
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      // Priority when several are in range:
      // station > build slot > entrance > tent > plot > node > quest node > npc.
      if (this.focusedNpc) {
        // Dialog flow runs in the React overlay (store-driven, docs/13);
        // WHICH dialog opens is quest-state-driven (core/quests).
        const dialogId = npcDialogIdOf(gameStore.getState(), this.focusedNpc.npc.id);
        if (dialogId) gameStore.getState().startDialog(dialogId);
      } else if (this.focusedQuestNode) {
        this.tryCollectQuestNode(this.focusedQuestNode);
      } else if (this.focusedStation) {
        gameStore.getState().openStation(this.focusedStation.station);
      } else if (this.focusedBuildSlot) {
        this.interactWithBuildSlot(this.focusedBuildSlot.def);
      } else if (this.focusedEntrance) {
        // Dungeon flow runs in the React overlay (store-driven, M4).
        gameStore.getState().enterDungeon(this.focusedEntrance.placement.dungeonId);
      } else if (this.tentFocused) {
        this.doSleep();
      } else if (this.focusedPlot) {
        this.tryHarvestPlot(this.focusedPlot);
      } else if (this.focusedNode) {
        this.tryHarvest(this.focusedNode);
      }
    }
    if (this.focusedPlot && !gameStore.getState().farmPlots[this.focusedPlot.id]) {
      // Empty plot focused: 1/2/3 plant a crop (see plantPrompt string).
      this.plantKeys.forEach((key, index) => {
        const crop = FARM_CROP_IDS[index];
        if (isCropId(crop) && Phaser.Input.Keyboard.JustDown(key)) {
          this.tryPlant(this.focusedPlot!, crop);
        }
      });
    }

    this.checkShrineDiscovery();
    this.checkCreatureContact();
  }

  // ── Exploration (M4 Task 2, docs/02 Schattendichte) ─────────────────────

  /** Spawns shrine/secret sprites; already discovered ones lose their glow. */
  private spawnShrines(): void {
    this.createShrineTextures();
    const discovered = new Set(gameStore.getState().discoveredMarkers);
    for (const placement of heimatbuchtShrines) {
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const key = `shrine-${placement.kind}${discovered.has(placement.markerId) ? '-found' : ''}`;
      const sprite = this.add.sprite(x, y, key).setDepth(5);
      this.shrines.push({ placement, sprite });
    }
  }

  /**
   * Approaching a shrine/secret discovers it (docs/02: 40 XP): the store
   * derives exploration % and shadow density; zone markers are discovered
   * store-side on first entry (setPlayerLocation). Feedback for BOTH marker
   * types comes from the store subscription below (onMarkerDiscovered).
   */
  private checkShrineDiscovery(): void {
    const store = gameStore.getState();
    if (store.combat) return;
    for (const shrine of this.shrines) {
      if (store.discoveredMarkers.includes(shrine.placement.markerId)) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        shrine.sprite.x,
        shrine.sprite.y,
      );
      if (dist > shrineDiscoverRange) continue;
      if (gameStore.getState().discoverMarker(shrine.placement.markerId)) {
        shrine.sprite.setTexture(`shrine-${shrine.placement.kind}-found`);
      }
    }
  }

  /** Discovery feedback: floating text over the player (text, never color-only). */
  private onMarkerDiscovered(markerId: string, xpGained: number): void {
    const xp = String(xpGained);
    let text: string;
    if (markerId.startsWith('zone:')) {
      const zone = markerId.slice('zone:'.length);
      const zoneName = isZoneId(zone) ? strings.exploration.zoneNames[zone] : zone;
      text = strings.exploration.areaDiscovered.replace('{zone}', zoneName).replace('{xp}', xp);
    } else if (markerId.startsWith('secret:')) {
      text = strings.exploration.secretDiscovered.replace('{xp}', xp);
    } else {
      text = strings.exploration.shrineDiscovered.replace('{xp}', xp);
    }
    this.discoveryToast?.destroy();
    const toast = this.add
      .text(this.player.x, this.player.y - 18, text, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#3a2e28',
        backgroundColor: '#ecd9a3',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(21);
    this.discoveryToast = toast;
    this.tweens.add({
      targets: toast,
      y: toast.y - 10,
      alpha: 0,
      delay: 1600,
      duration: 500,
      onComplete: () => {
        toast.destroy();
        if (this.discoveryToast === toast) this.discoveryToast = null;
      },
    });
  }

  /**
   * Placeholder shrine/secret textures (grade 1 "Funktional", docs/04):
   * crystal violet marks magic (docs/04 color rule); the "found" variant
   * loses the glow so discovered spots read as resolved.
   */
  private createShrineTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 16, 18);
      g.destroy();
    };
    const shrineBase = (g: Phaser.GameObjects.Graphics, crystal: number): void => {
      g.fillStyle(0x8d8d94); // stone plinth
      g.fillRect(3, 12, 10, 5);
      g.fillStyle(crystal);
      g.fillTriangle(8, 1, 4, 12, 12, 12);
    };
    make('shrine-shrine', (g) => shrineBase(g, 0x9668d8)); // magic violet (docs/04)
    make('shrine-shrine-found', (g) => shrineBase(g, 0xcdb7f0)); // calmed, pale
    const secretBase = (g: Phaser.GameObjects.Graphics, lid: number): void => {
      g.fillStyle(0x6b4a2f); // washed-up crate
      g.fillRect(2, 8, 12, 8);
      g.fillStyle(lid);
      g.fillRect(2, 6, 12, 3);
    };
    make('shrine-secret', (g) => secretBase(g, 0x9668d8)); // faint magic shimmer
    make('shrine-secret-found', (g) => secretBase(g, 0x8d6a45)); // plain wood
  }

  // ── Dungeon entrance (M4 Task 3, docs/03) ───────────────────────────────

  /** Spawns cave-mouth sprites from data placements (src/data/dungeons). */
  private spawnDungeonEntrances(): void {
    this.createDungeonEntranceTexture();
    for (const placement of heimatbuchtDungeonEntrances) {
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, 'dungeon-entrance').setDepth(5);
      this.dungeonEntrances.push({ placement, sprite });
    }
  }

  /** Nearest entrance in range gets highlight + prompt; stations keep priority. */
  private updateDungeonEntranceFocus(): void {
    let nearest: WorldDungeonEntrance | null = null;
    let nearestDist = dungeonEntranceInteractRange;
    if (!this.focusedStation && !this.focusedBuildSlot) {
      for (const entrance of this.dungeonEntrances) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          entrance.sprite.x,
          entrance.sprite.y,
        );
        if (dist <= nearestDist) {
          nearest = entrance;
          nearestDist = dist;
        }
      }
    }
    if (nearest === this.focusedEntrance) return;

    this.focusedEntrance?.sprite.clearTint();
    this.focusedEntrance = nearest;
    if (!nearest) {
      if (
        !this.focusedStation &&
        !this.focusedBuildSlot &&
        !this.focusedNode &&
        !this.focusedPlot &&
        !this.tentFocused
      ) {
        this.harvestPrompt.setVisible(false);
      }
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    const dungeonName = dungeonsById[nearest.placement.dungeonId]?.name ?? '';
    this.harvestPrompt
      .setText(strings.dungeonRun.enterPrompt.replace('{dungeon}', dungeonName))
      .setPosition(nearest.sprite.x, nearest.sprite.y - 14)
      .setVisible(true);
  }

  /**
   * Placeholder cave mouth (grade 1 "Funktional", docs/04): dark opening in
   * grey rock; the overgrowth crystal in corruption violet marks the
   * corrupted dungeon (violet = Korruption/Magie only, docs/04).
   */
  private createDungeonEntranceTexture(): void {
    if (this.textures.exists('dungeon-entrance')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x8d8d94); // rock face
    g.fillRect(0, 4, 20, 14);
    g.fillTriangle(0, 4, 10, 0, 20, 4);
    g.fillStyle(0x1c1720); // cave opening (near-black)
    g.fillTriangle(4, 18, 10, 6, 16, 18);
    g.fillStyle(0x9668d8); // corruption crystal (docs/04 violet)
    g.fillTriangle(15, 6, 18, 1, 19, 7);
    g.fillStyle(0x4f7d3a); // overgrowth vines
    g.fillRect(2, 4, 2, 6);
    g.fillRect(17, 8, 2, 5);
    g.generateTexture('dungeon-entrance', 20, 18);
    g.destroy();
  }

  // ── Creatures (M2 encounter triggers) ───────────────────────────────────

  /** Spawns shadow-creature sprites from data placements and starts wandering. */
  private spawnCreatures(): void {
    this.createCreatureTexture();
    for (const spawn of heimatbuchtCreatureSpawns) {
      const x = spawn.tileX * TILE + TILE / 2;
      const y = spawn.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, 'creature-shadow').setDepth(6);
      const creature: WorldCreature = { spawn, sprite, moveTween: null, idleTimer: null };
      this.creatures.push(creature);
      this.scheduleWander(creature);
    }
  }

  /**
   * Simple idle/wander: pause, then drift to a random point around the spawn
   * (no pathfinding — creatures are ambience + trigger, docs/02: avoidable).
   */
  private scheduleWander(creature: WorldCreature): void {
    const delay = Phaser.Math.Between(creatureIdleMs.min, creatureIdleMs.max);
    creature.idleTimer = this.time.delayedCall(delay, () => {
      const homeX = creature.spawn.tileX * TILE + TILE / 2;
      const homeY = creature.spawn.tileY * TILE + TILE / 2;
      const targetX = homeX + Phaser.Math.Between(-creatureWanderRadius, creatureWanderRadius);
      const targetY = homeY + Phaser.Math.Between(-creatureWanderRadius, creatureWanderRadius);
      const dist = Phaser.Math.Distance.Between(
        creature.sprite.x,
        creature.sprite.y,
        targetX,
        targetY,
      );
      creature.moveTween = this.tweens.add({
        targets: creature.sprite,
        x: targetX,
        y: targetY,
        duration: (dist / creatureWanderSpeed) * 1000,
        ease: 'Sine.easeInOut',
        onComplete: () => this.scheduleWander(creature),
      });
    });
  }

  /** Player touches a creature → encounter roll for the current zone (store). */
  private checkCreatureContact(): void {
    if (this.gracePending) {
      this.gracePending = false;
      this.contactGraceUntil = this.time.now + encounterGraceMs;
    }
    if (this.time.now < this.contactGraceUntil) return;
    const store = gameStore.getState();
    if (store.combat) return;
    for (const creature of this.creatures) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        creature.sprite.x,
        creature.sprite.y,
      );
      if (dist > creatureContactRange) continue;
      // Zone of the player decides the table (docs/07); creature zone is the
      // fallback if the player stands outside all zone rects.
      const zone = store.playerZone ?? creature.spawn.zone;
      if (store.startEncounter(zone)) {
        this.engagedCreature = creature;
      }
      return;
    }
  }

  /** Back from combat: despawn on victory, wake up at the tent on defeat. */
  private onCombatEnded(outcome: string | null): void {
    const creature = this.engagedCreature;
    this.engagedCreature = null;
    if (outcome === 'victory' && creature) {
      creature.idleTimer?.remove();
      creature.moveTween?.stop();
      creature.sprite.destroy();
      this.creatures = this.creatures.filter((c) => c !== creature);
    } else if (outcome === 'defeat') {
      // Defeat flow (M4 Task 5, docs/03): wake up at the tent. The store
      // already applied heal, loot penalty and the sleep cycle in endCombat;
      // the world mirrors it (position + respawned nodes + grown crops).
      this.wakeUpAtTent();
      this.gracePending = true; // creature stays — grace against re-trigger
    } else {
      // Retreat: creature stays; grace so it does not instantly re-trigger.
      this.gracePending = true;
    }
    this.scene.resume();
  }

  /** Moves the player to the tent and mirrors the wake-up sleep cycle. */
  private wakeUpAtTent(): void {
    // One tile below the tent so the sprite does not overlap it.
    this.player.setPosition(
      heimatbuchtTent.tileX * TILE + TILE / 2,
      (heimatbuchtTent.tileY + 1) * TILE + TILE / 2,
    );
    this.lastTile = {
      x: Math.floor(this.player.x / TILE),
      y: Math.floor(this.player.y / TILE),
    };
    this.publishLocation();
    // The wake-up counted as a sleep in the store: crops advanced, harvest
    // nodes respawned — mirror both onto the world sprites (like doSleep).
    this.refreshFarmSprites();
    for (const node of this.harvestNodes) {
      node.harvested = false;
      node.sprite.setTexture(this.nodeTextureKey(node.type, false));
    }
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.fadeIn(400, 0, 0, 0);
    });
  }

  /**
   * Placeholder shadow creature (grade 1 "Funktional", docs/04): dark body
   * on the corruption palette with a crystal outgrowth in #9668D8 — violet
   * marks corruption/magic only (docs/04 color rule).
   */
  private createCreatureTexture(): void {
    if (this.textures.exists('creature-shadow')) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x2b2338); // shadow body (dark corruption tone)
    g.fillCircle(7, 9, 6);
    g.fillStyle(0x9668d8); // crystal outgrowth (docs/04 corruption violet)
    g.fillTriangle(9, 5, 12, 0, 13, 6);
    g.fillStyle(0xcdb7f0); // eyes — light, readable silhouette
    g.fillRect(4, 8, 2, 2);
    g.fillRect(8, 8, 2, 2);
    g.generateTexture('creature-shadow', 14, 16);
    g.destroy();
  }

  /** Spawns harvest-node sprites from data placements; depleted state comes from the store. */
  private spawnHarvestNodes(): void {
    this.createHarvestTextures();
    const harvested = new Set(gameStore.getState().harvestedNodeIds);
    for (const placement of heimatbuchtHarvestNodes) {
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const isHarvested = harvested.has(placement.id);
      const sprite = this.add
        .sprite(x, y, this.nodeTextureKey(placement.type, isHarvested))
        .setDepth(5);
      this.harvestNodes.push({
        id: placement.id,
        type: placement.type,
        sprite,
        harvested: isHarvested,
      });
    }
  }

  // ── Workshop stations (M3) ──────────────────────────────────────────────

  /** Spawns smithy/kitchen sprites from data placements (src/data/stations). */
  private spawnStations(): void {
    this.createStationTextures();
    for (const placement of heimatbuchtStations) {
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, `station-${placement.station}`).setDepth(5);
      this.stations.push({ station: placement.station, sprite });
    }
  }

  /** Nearest station in range gets highlight + prompt; wins over harvest nodes. */
  private updateStationFocus(): void {
    let nearest: WorldStation | null = null;
    let nearestDist = stationInteractRange;
    for (const station of this.stations) {
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        station.sprite.x,
        station.sprite.y,
      );
      if (dist <= nearestDist) {
        nearest = station;
        nearestDist = dist;
      }
    }
    if (nearest === this.focusedStation) return;

    this.focusedStation?.sprite.clearTint();
    this.focusedStation = nearest;
    if (!nearest) {
      if (!this.focusedNode && !this.focusedBuildSlot && !this.focusedEntrance) {
        this.harvestPrompt.setVisible(false);
      }
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    this.harvestPrompt
      .setText(strings.workshop.openPrompt.replace('{station}', strings.stations[nearest.station]))
      .setPosition(nearest.sprite.x, nearest.sprite.y - 14)
      .setVisible(true);
  }

  /**
   * Placeholder station sprites (grade 1 "Funktional", docs/04): neutral
   * material tones — orange appears only as focus tint.
   */
  private createStationTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 18, 18);
      g.destroy();
    };
    make('station-smithy', (g) => {
      g.fillStyle(0x8d8d94); // stone base
      g.fillRect(2, 12, 14, 5);
      g.fillStyle(0x4a4a52); // anvil
      g.fillRect(4, 7, 10, 4);
      g.fillRect(7, 10, 4, 3);
      g.fillStyle(0xb87333); // copper glow on the horn (material tone)
      g.fillRect(13, 7, 2, 2);
    });
    make('station-deck_chest', (g) => {
      g.fillStyle(0x6b4a2f); // wooden chest body
      g.fillRect(3, 8, 12, 8);
      g.fillStyle(0x8d6a45); // lid
      g.fillRect(3, 6, 12, 3);
      g.fillStyle(0xb87333); // copper clasp (material tone)
      g.fillRect(8, 9, 2, 3);
    });
    make('station-kitchen', (g) => {
      g.fillStyle(0x6b4a2f); // fire pit logs
      g.fillRect(3, 13, 12, 4);
      g.fillStyle(0x4a4a52); // cook pot
      g.fillCircle(9, 9, 5);
      g.fillStyle(0x8fbf6f); // stew (herb green)
      g.fillCircle(9, 8, 3);
    });
  }

  // ── Building slots (M5 Task 1, docs/09 B1–B9) ───────────────────────────

  /**
   * Spawns a marker per building slot (src/data/buildings). B1–B3 already
   * have a world counterpart (tent, kitchen, smithy) — their marker is an
   * upgrade sign next to it; pure slots switch to a built placeholder once
   * their first stage stands.
   */
  private spawnBuildSlots(): void {
    this.createBuildSlotTextures();
    for (const def of buildings) {
      const x = def.tileX * TILE + TILE / 2;
      const y = def.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, this.buildSlotTextureKey(def)).setDepth(5);
      this.buildSlots.push({ def, sprite });
    }
  }

  /** Sign while nothing stands; built placeholder for pure slots (B4–B9). */
  private buildSlotTextureKey(def: BuildingDef): string {
    const stage = gameStore.getState().builtBuildings[def.id] ?? 0;
    // B1–B3 keep the sign: tent/station sprites already show the building.
    const hasWorldCounterpart = def.station !== undefined || def.id === 'b1';
    return stage > 0 && !hasWorldCounterpart ? 'build-slot-built' : 'build-slot-sign';
  }

  /** Mirrors store build state onto the slot sprites (after a build). */
  private refreshBuildSlotSprites(): void {
    for (const slot of this.buildSlots) {
      slot.sprite.setTexture(this.buildSlotTextureKey(slot.def));
    }
  }

  /** Nearest build slot in range gets highlight + prompt; stations win. */
  private updateBuildSlotFocus(): void {
    let nearest: WorldBuildSlot | null = null;
    let nearestDist = buildSlotInteractRange;
    if (!this.focusedStation) {
      for (const slot of this.buildSlots) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          slot.sprite.x,
          slot.sprite.y,
        );
        if (dist <= nearestDist) {
          nearest = slot;
          nearestDist = dist;
        }
      }
    }
    if (nearest === this.focusedBuildSlot) {
      // Pier prompt flips after fishing (fishedSinceSleep) — keep it fresh.
      if (nearest) this.refreshBuildSlotPrompt();
      return;
    }

    this.focusedBuildSlot?.sprite.clearTint();
    this.focusedBuildSlot = nearest;
    if (!nearest) {
      if (
        !this.focusedStation &&
        !this.focusedEntrance &&
        !this.focusedNode &&
        !this.focusedPlot &&
        !this.tentFocused
      ) {
        this.harvestPrompt.setVisible(false);
      }
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    this.refreshBuildSlotPrompt();
  }

  /** Prompt of the focused slot (position + current text). */
  private refreshBuildSlotPrompt(): void {
    const slot = this.focusedBuildSlot;
    if (!slot) return;
    this.harvestPrompt
      .setText(this.buildSlotPromptText(slot.def))
      .setPosition(slot.sprite.x, slot.sprite.y - 14)
      .setVisible(true);
  }

  /**
   * Prompt text for a build slot (M5 Task 4b): the BUILT Markt (B8) and
   * Steg (B5) switch from the build prompt to their use — Markt öffnen bzw.
   * Angeln; an exhausted pier says so AS TEXT (docs/09: 1 Fang pro
   * Schlafphase; docs/11: Zustand nie nur über Farbe).
   */
  private buildSlotPromptText(def: BuildingDef): string {
    const state = gameStore.getState();
    const stage = state.builtBuildings[def.id] ?? 0;
    if (def.id === marketSlot && stage >= 1) return strings.market.openPrompt;
    if (def.id === fishingConfig.pierSlot && stage >= 1) {
      return state.fishedSinceSleep ? strings.fishing.nothingBiting : strings.fishing.prompt;
    }
    return strings.build.slotPrompt.replace('{name}', strings.buildings[def.id].name);
  }

  /**
   * [E] on a build slot: the built Markt opens the trade panel, the built
   * Steg casts the line (fishAtPier — feedback via lastFishCatch toast);
   * everything else opens the build panel. All rules live in core/store —
   * the scene only routes the interaction.
   */
  private interactWithBuildSlot(def: BuildingDef): void {
    const state = gameStore.getState();
    const stage = state.builtBuildings[def.id] ?? 0;
    if (def.id === marketSlot && stage >= 1) {
      state.openMarket();
      return;
    }
    if (def.id === fishingConfig.pierSlot && stage >= 1) {
      // false = nothing biting today — the prompt text already says so.
      state.fishAtPier();
      this.refreshBuildSlotPrompt();
      return;
    }
    state.openBuildSlot(def.id);
  }

  /**
   * Placeholder build-slot textures (grade 1 "Funktional", docs/04):
   * neutral wood tones — orange appears only as focus tint.
   */
  private createBuildSlotTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 16, 18);
      g.destroy();
    };
    make('build-slot-sign', (g) => {
      g.fillStyle(0x6b4a2f); // post
      g.fillRect(7, 8, 2, 9);
      g.fillStyle(0x8d6a45); // board
      g.fillRect(2, 3, 12, 6);
      g.fillStyle(0x3a2e28); // hammer glyph (icon, not color-only)
      g.fillRect(4, 5, 5, 2);
      g.fillRect(9, 4, 2, 4);
    });
    make('build-slot-built', (g) => {
      g.fillStyle(0x8d6a45); // walls
      g.fillRect(2, 8, 12, 9);
      g.fillStyle(0x7a4a35); // roof
      g.fillTriangle(0, 8, 8, 1, 16, 8);
      g.fillStyle(0x3a2e28); // door
      g.fillRect(6, 11, 4, 6);
    });
  }

  // ── Dialog-NPCs (M5, docs/13 + docs/09 Ankunft) ─────────────────────────

  /**
   * Spawns all roster NPCs (data/npcs) with a quest-symbol slot over the
   * head; visibility mirrors the DERIVED arrival state (core/quests via
   * refreshNpcPresence) — arrived NPCs stand in the Heimatbucht.
   */
  private spawnDialogNpcs(): void {
    this.createNpcTextures();
    for (const npc of npcs) {
      const placement = npcPlacements[npc.id];
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, `npc-${npc.id}`).setDepth(6);
      // Symbol as TEXT over the head (docs/13: ! / ? — nie nur Farbe).
      const indicator = this.add
        .text(x, y - 14, '', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#3a2e28',
          backgroundColor: '#ecd9a3',
          padding: { x: 2, y: 0 },
        })
        .setOrigin(0.5, 1)
        .setDepth(7)
        .setVisible(false);
      this.dialogNpcs.push({ npc, sprite, indicator });
    }
    this.refreshNpcPresence();
  }

  /** Mirrors arrival + quest symbols onto the NPC sprites (store-derived). */
  private refreshNpcPresence(): void {
    const state = gameStore.getState();
    for (const npc of this.dialogNpcs) {
      const arrived = npcArrivedOf(state, npc.npc.id);
      npc.sprite.setVisible(arrived);
      const symbol = arrived ? questIndicatorOf(state, npc.npc.id) : null;
      npc.indicator.setText(symbol ?? '').setVisible(symbol !== null);
      if (!arrived && this.focusedNpc === npc) {
        npc.sprite.clearTint();
        this.focusedNpc = null;
        this.harvestPrompt.setVisible(false);
      }
    }
  }

  // ── Quest-Sammelpunkte (M5 Task 3, docs/09 Honig / Maros Kiste) ─────────

  /** Spawns quest-gated pickups; visibility mirrors quest state. */
  private spawnQuestNodes(): void {
    this.createQuestNodeTextures();
    for (const node of questCollectNodes) {
      const x = node.tileX * TILE + TILE / 2;
      const y = node.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, `quest-node-${node.id}`).setDepth(5);
      this.questNodes.push({ node, sprite });
    }
    this.refreshQuestNodes();
  }

  /** Visible only while the quest is active and the item missing (core/quests). */
  private refreshQuestNodes(): void {
    const state = gameStore.getState();
    for (const questNode of this.questNodes) {
      const visible = questNodeVisibleOf(state, questNode.node.id);
      questNode.sprite.setVisible(visible);
      if (!visible && this.focusedQuestNode === questNode) {
        questNode.sprite.clearTint();
        this.focusedQuestNode = null;
        this.harvestPrompt.setVisible(false);
      }
    }
  }

  /** Nearest visible quest pickup gets highlight + prompt; others win. */
  private updateQuestNodeFocus(): void {
    if (
      this.focusedStation ||
      this.focusedBuildSlot ||
      this.focusedEntrance ||
      this.focusedPlot ||
      this.tentFocused ||
      this.focusedNode
    ) {
      if (this.focusedQuestNode) {
        this.focusedQuestNode.sprite.clearTint();
        this.focusedQuestNode = null;
      }
      return;
    }
    let nearest: WorldQuestNode | null = null;
    let nearestDist = HARVEST_RANGE;
    for (const questNode of this.questNodes) {
      if (!questNode.sprite.visible) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        questNode.sprite.x,
        questNode.sprite.y,
      );
      if (dist <= nearestDist) {
        nearest = questNode;
        nearestDist = dist;
      }
    }
    if (nearest === this.focusedQuestNode) return;

    this.focusedQuestNode?.sprite.clearTint();
    this.focusedQuestNode = nearest;
    if (!nearest) {
      if (!this.focusedNpc) this.harvestPrompt.setVisible(false);
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    const nodeNames = strings.world.questNodes as Readonly<Record<string, string>>;
    this.harvestPrompt
      .setText(
        strings.world.questCollectPrompt.replace(
          '{node}',
          nodeNames[nearest.node.id] ?? nearest.node.id,
        ),
      )
      .setPosition(nearest.sprite.x, nearest.sprite.y - 12)
      .setVisible(true);
  }

  /** Dispatches the pickup to the store; refreshQuestNodes despawns it. */
  private tryCollectQuestNode(questNode: WorldQuestNode): void {
    if (!gameStore.getState().collectQuestNode(questNode.node.id)) return;
    // Visibility refresh happens via the store subscription (inventory
    // changed); clear the local focus immediately for snappy feedback.
    if (this.focusedQuestNode === questNode) {
      this.focusedQuestNode = null;
      this.harvestPrompt.setVisible(false);
    }
  }

  /**
   * Placeholder quest-pickup textures (grade 1 "Funktional", docs/04):
   * washed-up toolbox and a beehive — material tones, orange only as tint.
   */
  private createQuestNodeTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };
    make('quest-node-quest-maro-toolbox', (g) => {
      g.fillStyle(0x6b4a2f); // wooden chest
      g.fillRect(2, 7, 12, 8);
      g.fillStyle(0x8d6a45); // lid
      g.fillRect(2, 5, 12, 3);
      g.fillStyle(0xb87333); // copper clasp
      g.fillRect(7, 8, 2, 3);
    });
    make('quest-node-quest-tilda-honey', (g) => {
      g.fillStyle(0xd9a94a); // beehive gold
      g.fillEllipse(8, 9, 11, 10);
      g.fillStyle(0xb8863b); // rings
      g.fillRect(3, 7, 10, 1);
      g.fillRect(3, 10, 10, 1);
      g.fillStyle(0x3a2e28); // entrance
      g.fillRect(7, 11, 2, 2);
    });
  }

  /**
   * Nearest NPC in range gets highlight + prompt. NPCs yield to every other
   * interactable (they stand apart in the world; keeps the focus chain flat).
   * Runs LAST in update() so a cleared earlier focus hands the prompt over
   * within the same frame.
   */
  private updateNpcFocus(): void {
    if (
      this.focusedStation ||
      this.focusedBuildSlot ||
      this.focusedEntrance ||
      this.focusedPlot ||
      this.tentFocused ||
      this.focusedNode ||
      this.focusedQuestNode
    ) {
      if (this.focusedNpc) {
        this.focusedNpc.sprite.clearTint();
        this.focusedNpc = null;
      }
      return;
    }
    let nearest: WorldDialogNpc | null = null;
    let nearestDist = npcInteractRange;
    for (const npc of this.dialogNpcs) {
      if (!npc.sprite.visible) continue; // not arrived yet (docs/09)
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        npc.sprite.x,
        npc.sprite.y,
      );
      if (dist <= nearestDist) {
        nearest = npc;
        nearestDist = dist;
      }
    }
    if (nearest === this.focusedNpc) return;

    this.focusedNpc?.sprite.clearTint();
    this.focusedNpc = nearest;
    if (!nearest) {
      this.harvestPrompt.setVisible(false);
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    const npcNames = strings.npcs as Readonly<Record<string, string>>;
    this.harvestPrompt
      .setText(
        strings.world.npcTalkPrompt.replace('{npc}', npcNames[nearest.npc.id] ?? nearest.npc.id),
      )
      .setPosition(nearest.sprite.x, nearest.sprite.y - 14)
      .setVisible(true);
  }

  /**
   * Placeholder NPC textures (grade 1 "Funktional", docs/04): Lumen is a
   * crystal fox (docs/06) — crystal violet = magic (docs/04 color rule);
   * villagers share a silhouette with distinct garment colors (material
   * tones; orange appears only as focus tint, violet stays Orin/magic).
   */
  private createNpcTextures(): void {
    if (!this.textures.exists('npc-lumen')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x9668d8); // crystal violet body
      g.fillEllipse(8, 12, 12, 8); // body
      g.fillTriangle(4, 8, 6, 3, 8, 8); // left ear
      g.fillTriangle(8, 8, 10, 3, 12, 8); // right ear
      g.fillEllipse(8, 8, 8, 6); // head
      g.fillTriangle(13, 12, 17, 8, 15, 15); // tail
      g.fillStyle(0xd8c8f0); // pale crystal glow accents
      g.fillRect(6, 7, 1, 1);
      g.fillRect(10, 7, 1, 1);
      g.generateTexture('npc-lumen', 18, 18);
      g.destroy();
    }
    const villagerColors: Record<string, number> = {
      maro: 0x8d5a3b, // smith leather-brown
      tilda: 0xc4534f, // cook warm red
      bruna: 0x4a7d8c, // fisher sea-blue
      orin: 0x9668d8, // magician — crystal violet (docs/04: Magie)
      piya: 0x5a8f46, // trader herb-green
    };
    for (const [npcId, color] of Object.entries(villagerColors)) {
      const key = `npc-${npcId}`;
      if (this.textures.exists(key)) continue;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x3a2e28); // outline (UI warm brown)
      g.fillRect(3, 0, 10, 15);
      g.fillStyle(0xecd9a3); // face (cream)
      g.fillRect(4, 1, 8, 6);
      g.fillStyle(color); // garment
      g.fillRect(4, 7, 8, 7);
      g.fillStyle(0x3a2e28); // eyes
      g.fillRect(6, 3, 1, 2);
      g.fillRect(9, 3, 1, 2);
      g.generateTexture(key, 16, 15);
      g.destroy();
    }
  }

  // ── Farming (M3, docs/10 Farming & Zeit) ────────────────────────────────

  /** Spawns farm-plot sprites (state from the store) and the tent. */
  private spawnFarm(): void {
    this.createFarmTextures();
    for (const placement of heimatbuchtFarmPlots) {
      const x = placement.tileX * TILE + TILE / 2;
      const y = placement.tileY * TILE + TILE / 2;
      const sprite = this.add.sprite(x, y, 'plot-empty').setDepth(4);
      this.farmPlots.push({ id: placement.id, sprite });
    }
    this.refreshFarmSprites();
    this.tentSprite = this.add
      .sprite(
        heimatbuchtTent.tileX * TILE + TILE / 2,
        heimatbuchtTent.tileY * TILE + TILE / 2,
        'tent',
      )
      .setDepth(5);
  }

  /** Mirrors store farm state onto plot textures (empty/sprout/ripe). */
  private refreshFarmSprites(): void {
    const plots = gameStore.getState().farmPlots;
    for (const plot of this.farmPlots) {
      const planted = plots[plot.id];
      const key = !planted
        ? 'plot-empty'
        : isRipe(planted, crops)
          ? `plot-ripe-${planted.crop}`
          : 'plot-sprout';
      plot.sprite.setTexture(key);
    }
  }

  /** Tent or nearest plot in range gets focus; stations keep priority. */
  private updateFarmFocus(): void {
    if (this.focusedStation || this.focusedBuildSlot || this.focusedEntrance) {
      this.clearFarmFocus();
      return;
    }
    // Tent first — it sits apart from the plots, so overlap is rare.
    const tentDist = this.tentSprite
      ? Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          this.tentSprite.x,
          this.tentSprite.y,
        )
      : Infinity;
    const tentFocused = tentDist <= farmInteractRange;

    let nearest: WorldFarmPlot | null = null;
    let nearestDist = farmInteractRange;
    if (!tentFocused) {
      for (const plot of this.farmPlots) {
        const dist = Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          plot.sprite.x,
          plot.sprite.y,
        );
        if (dist <= nearestDist) {
          nearest = plot;
          nearestDist = dist;
        }
      }
    }

    if (tentFocused === this.tentFocused && nearest === this.focusedPlot) {
      if (this.focusedPlot) this.refreshFarmPrompt(); // growth state may have changed
      return;
    }
    this.clearFarmFocus();
    this.tentFocused = tentFocused;
    this.focusedPlot = nearest;
    if (tentFocused && this.tentSprite) {
      this.tentSprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
      this.harvestPrompt
        .setText(strings.world.sleepPrompt)
        .setPosition(this.tentSprite.x, this.tentSprite.y - 14)
        .setVisible(true);
    } else if (nearest) {
      nearest.sprite.setTint(ACTION_TINT);
      this.refreshFarmPrompt();
    }
  }

  private clearFarmFocus(): void {
    if (this.tentFocused) {
      this.tentSprite?.clearTint();
      this.tentFocused = false;
    }
    if (this.focusedPlot) {
      this.focusedPlot.sprite.clearTint();
      this.focusedPlot = null;
      this.harvestPrompt.setVisible(false);
    }
  }

  /** Prompt for the focused plot: plant options, growth progress or harvest. */
  private refreshFarmPrompt(): void {
    const plot = this.focusedPlot;
    if (!plot) return;
    const planted = gameStore.getState().farmPlots[plot.id];
    const text = !planted
      ? strings.world.plantPrompt
      : isRipe(planted, crops)
        ? strings.world.ripePrompt.replace('{crop}', strings.world.cropNames[planted.crop])
        : strings.world.growingPrompt
            .replace('{crop}', strings.world.cropNames[planted.crop])
            .replace('{left}', String(crops[planted.crop].growthSleeps - planted.sleeps));
    this.harvestPrompt
      .setText(text)
      .setPosition(plot.sprite.x, plot.sprite.y - 12)
      .setVisible(true);
  }

  private tryPlant(plot: WorldFarmPlot, crop: CropId): void {
    if (!gameStore.getState().plantCrop(plot.id, crop)) return;
    this.refreshFarmSprites();
    this.refreshFarmPrompt();
  }

  private tryHarvestPlot(plot: WorldFarmPlot): void {
    if (!gameStore.getState().harvestFarmPlot(plot.id)) return;
    this.refreshFarmSprites();
    this.refreshFarmPrompt();
  }

  /** Sleep at the tent: growth ticks, harvest nodes respawn (docs/10). */
  private doSleep(): void {
    gameStore.getState().sleep();
    this.refreshFarmSprites();
    // Harvest nodes respawned in the store — mirror onto the world sprites.
    for (const node of this.harvestNodes) {
      node.harvested = false;
      node.sprite.setTexture(this.nodeTextureKey(node.type, false));
    }
    // Brief feedback: fade to black and back (cozy sleep transition).
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.fadeIn(400, 0, 0, 0);
    });
  }

  /**
   * Placeholder farm textures (grade 1 "Funktional", docs/04): soil browns,
   * crop colors as material tones — orange appears only as focus tint.
   */
  private createFarmTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };
    const soil = (g: Phaser.GameObjects.Graphics): void => {
      g.fillStyle(0x5c4433); // tilled soil
      g.fillRect(1, 3, 14, 11);
      g.fillStyle(0x4a3628); // furrows
      g.fillRect(2, 6, 12, 1);
      g.fillRect(2, 10, 12, 1);
    };
    make('plot-empty', soil);
    make('plot-sprout', (g) => {
      soil(g);
      g.fillStyle(0x8fbf6f); // young sprout green
      g.fillRect(7, 5, 2, 4);
      g.fillRect(5, 5, 2, 2);
      g.fillRect(9, 6, 2, 2);
    });
    make('plot-ripe-berry', (g) => {
      soil(g);
      g.fillStyle(0x5a8f46);
      g.fillCircle(8, 7, 4);
      g.fillStyle(0xc4534f); // warm red berries (violet stays corruption-only)
      g.fillCircle(6, 6, 1.5);
      g.fillCircle(10, 7, 1.5);
    });
    make('plot-ripe-pumpkin', (g) => {
      soil(g);
      g.fillStyle(0xc47a2e); // pumpkin (material tone, not action-orange)
      g.fillCircle(8, 8, 4);
      g.fillStyle(0x4f7d3a); // stem
      g.fillRect(7, 3, 2, 2);
    });
    make('plot-ripe-chili', (g) => {
      soil(g);
      g.fillStyle(0x5a8f46);
      g.fillRect(7, 4, 2, 4);
      g.fillStyle(0xb03a30); // chili red
      g.fillRect(5, 7, 2, 5);
      g.fillRect(9, 7, 2, 5);
    });
    make('tent', (g) => {
      g.fillStyle(0x7a6047); // canvas
      g.fillTriangle(1, 14, 8, 2, 15, 14);
      g.fillStyle(0x3a2e28); // entrance
      g.fillTriangle(5, 14, 8, 7, 11, 14);
    });
  }

  /** Finds the nearest harvestable node in range and moves highlight + prompt onto it. */
  private updateHarvestFocus(): void {
    if (
      this.focusedStation ||
      this.focusedBuildSlot ||
      this.focusedEntrance ||
      this.focusedPlot ||
      this.tentFocused
    ) {
      // Station/build/entrance/farm prompt has priority — drop any node focus while it is shown.
      if (this.focusedNode) {
        this.focusedNode.sprite.clearTint();
        this.focusedNode = null;
      }
      return;
    }
    let nearest: WorldHarvestNode | null = null;
    let nearestDist = HARVEST_RANGE;
    for (const node of this.harvestNodes) {
      if (node.harvested) continue;
      const dist = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        node.sprite.x,
        node.sprite.y,
      );
      if (dist <= nearestDist) {
        nearest = node;
        nearestDist = dist;
      }
    }
    if (nearest === this.focusedNode) return;

    this.focusedNode?.sprite.clearTint();
    this.focusedNode = nearest;
    if (!nearest) {
      this.harvestPrompt.setVisible(false);
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    this.harvestPrompt
      .setText(
        strings.world.harvestPrompt.replace('{node}', strings.world.harvestNodes[nearest.type]),
      )
      .setPosition(nearest.sprite.x, nearest.sprite.y - 12)
      .setVisible(true);
  }

  /** Dispatches the harvest to the store (logic lives in core) and mirrors the result. */
  private tryHarvest(node: WorldHarvestNode): void {
    if (!gameStore.getState().harvestNode(node.id)) return;
    node.harvested = true;
    node.sprite.clearTint();
    node.sprite.setTexture(this.nodeTextureKey(node.type, true));
    if (this.focusedNode === node) {
      this.focusedNode = null;
      this.harvestPrompt.setVisible(false);
    }
  }

  private nodeTextureKey(type: HarvestNodeType, harvested: boolean): string {
    return `node-${type}-${harvested ? 'depleted' : 'full'}`;
  }

  /**
   * Placeholder textures for harvest nodes (grade 1 "Funktional", docs/04).
   * Neutral biome tones — orange appears only as focus tint on the
   * currently actionable node.
   */
  private createHarvestTextures(): void {
    const make = (key: string, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      draw(g);
      g.generateTexture(key, 16, 16);
      g.destroy();
    };
    make('node-tree-full', (g) => {
      g.fillStyle(0x6b4a2f); // trunk
      g.fillRect(6, 9, 4, 7);
      g.fillStyle(0x4f7d3a); // crown (darker than meadow green for silhouette)
      g.fillCircle(8, 6, 6);
    });
    make('node-tree-depleted', (g) => {
      g.fillStyle(0x6b4a2f); // stump
      g.fillRect(5, 10, 6, 6);
      g.fillStyle(0x8a6a4a);
      g.fillRect(6, 11, 4, 2);
    });
    make('node-rock-full', (g) => {
      g.fillStyle(0x8d8d94);
      g.fillCircle(8, 10, 6);
      g.fillStyle(0xb0b0b8);
      g.fillRect(5, 6, 5, 4);
    });
    make('node-rock-depleted', (g) => {
      g.fillStyle(0x8d8d94);
      g.fillRect(4, 12, 3, 3);
      g.fillRect(10, 13, 3, 2);
    });
    make('node-copper_vein-full', (g) => {
      g.fillStyle(0x8d8d94); // host rock
      g.fillCircle(8, 10, 6);
      g.fillStyle(0xb87333); // copper seams (material color, not action-orange)
      g.fillRect(5, 8, 3, 2);
      g.fillRect(9, 11, 3, 2);
    });
    make('node-copper_vein-depleted', (g) => {
      g.fillStyle(0x8d8d94);
      g.fillRect(4, 12, 4, 3);
      g.fillRect(10, 12, 3, 3);
    });
    make('node-berry_bush-full', (g) => {
      g.fillStyle(0x5a8f46); // bush
      g.fillCircle(8, 9, 6);
      g.fillStyle(0xc4534f); // berries — warm red (purple is reserved for magic/corruption, docs/04)
      g.fillCircle(5, 8, 1.5);
      g.fillCircle(10, 7, 1.5);
      g.fillCircle(8, 11, 1.5);
    });
    make('node-berry_bush-depleted', (g) => {
      g.fillStyle(0x5a8f46);
      g.fillCircle(8, 10, 5);
    });
  }

  /** Parse zone rectangles from the Tiled "zones" object layer. */
  private readZones(map: Phaser.Tilemaps.Tilemap): ZoneRect[] {
    const layer = map.getObjectLayer('zones');
    if (!layer) throw new Error('Object layer "zones" missing in map');
    const zones: ZoneRect[] = [];
    for (const obj of layer.objects) {
      if (
        obj.name !== undefined &&
        isZoneId(obj.name) &&
        obj.x !== undefined &&
        obj.y !== undefined &&
        obj.width !== undefined &&
        obj.height !== undefined
      ) {
        zones.push({ id: obj.name, x: obj.x, y: obj.y, width: obj.width, height: obj.height });
      }
    }
    return zones;
  }

  private publishLocation(): void {
    const zone = zoneAt(this.zones, this.player.x, this.player.y);
    gameStore
      .getState()
      .setPlayerLocation({ x: Math.round(this.player.x), y: Math.round(this.player.y) }, zone);
  }

  /** Placeholder player: generated texture (neutral tones — orange is reserved for interactables, docs/04). */
  private createPlayer(x: number, y: number): Phaser.Types.Physics.Arcade.SpriteWithDynamicBody {
    if (!this.textures.exists('player-placeholder')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0x3a2e28); // outline (UI warm brown)
      g.fillRect(0, 0, 12, 14);
      g.fillStyle(0xecd9a3); // body (cream)
      g.fillRect(1, 1, 10, 12);
      g.fillStyle(0x3a2e28); // eyes
      g.fillRect(3, 4, 2, 2);
      g.fillRect(7, 4, 2, 2);
      g.generateTexture('player-placeholder', 12, 14);
      g.destroy();
    }
    const player = this.physics.add.sprite(x, y, 'player-placeholder');
    player.body.setSize(10, 8).setOffset(1, 6); // feet-area hitbox for top-down feel
    return player;
  }
}
