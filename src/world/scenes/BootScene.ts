import Phaser from 'phaser';
import { strings } from '../../shared/strings';
import { gameStore } from '../../shared/store';

/** Empty starter scene — proves the Phaser layer renders (M0 "Hello Island"). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, strings.game.helloIsland, {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#e8f4f8',
      })
      .setOrigin(0.5);
    gameStore.getState().setWorldReady(true);
  }
}
