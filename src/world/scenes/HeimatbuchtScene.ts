import Phaser from 'phaser';
import { gameStore } from '../../shared/store';
import { isZoneId, zoneAt, type ZoneRect } from '../../core/world/zones';

const PLAYER_SPEED = 140;
const TILE = 16;

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

  constructor() {
    super('heimatbucht');
  }

  init(): void {
    this.zones = [];
    this.lastTile = { x: -1, y: -1 };
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

    this.player = this.createPlayer(map.widthInPixels / 2, map.heightInPixels / 2);
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
