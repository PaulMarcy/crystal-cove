import Phaser from 'phaser';
import { gameStore } from '../../shared/store';
import { strings } from '../../shared/strings';
import { isZoneId, zoneAt, type ZoneRect } from '../../core/world/zones';
import { heimatbuchtHarvestNodes, type HarvestNodeType } from '../../data/resources';
import { heimatbuchtStations, stationInteractRange } from '../../data/stations';
import type { StationId } from '../../data/recipes';
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
  station: StationId;
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
      if (prev.combat === null && state.combat !== null) {
        this.scene.pause();
      } else if (prev.combat !== null && state.combat === null) {
        this.onCombatEnded(state.lastCombatOutcome);
      } else if (prev.activeStation === null && state.activeStation !== null) {
        // Workshop UI open (React overlay) → freeze the world, like combat.
        this.scene.pause();
      } else if (prev.activeStation !== null && state.activeStation === null) {
        this.scene.resume();
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
    this.updateHarvestFocus();
    if (Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      // Station wins over harvest node when both are in range.
      if (this.focusedStation) {
        gameStore.getState().openStation(this.focusedStation.station);
      } else if (this.focusedNode) {
        this.tryHarvest(this.focusedNode);
      }
    }

    this.checkCreatureContact();
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

  /** Back from combat: despawn on victory, otherwise grant a contact grace. */
  private onCombatEnded(outcome: string | null): void {
    const creature = this.engagedCreature;
    this.engagedCreature = null;
    if (outcome === 'victory' && creature) {
      creature.idleTimer?.remove();
      creature.moveTween?.stop();
      creature.sprite.destroy();
      this.creatures = this.creatures.filter((c) => c !== creature);
    } else {
      // Defeat/retreat: creature stays; grace so it does not instantly re-trigger.
      // TODO(M4): richtiger Niederlage-Fluss (Aufwachen im Bett, Malus).
      this.gracePending = true;
    }
    this.scene.resume();
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
      if (!this.focusedNode) this.harvestPrompt.setVisible(false);
      return;
    }
    nearest.sprite.setTint(ACTION_TINT); // orange = actionable (docs/04)
    this.harvestPrompt
      .setText(
        strings.workshop.openPrompt.replace('{station}', strings.stations[nearest.station]),
      )
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
    make('station-kitchen', (g) => {
      g.fillStyle(0x6b4a2f); // fire pit logs
      g.fillRect(3, 13, 12, 4);
      g.fillStyle(0x4a4a52); // cook pot
      g.fillCircle(9, 9, 5);
      g.fillStyle(0x8fbf6f); // stew (herb green)
      g.fillCircle(9, 8, 3);
    });
  }

  /** Finds the nearest harvestable node in range and moves highlight + prompt onto it. */
  private updateHarvestFocus(): void {
    if (this.focusedStation) {
      // Station prompt has priority — drop any node focus while it is shown.
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
