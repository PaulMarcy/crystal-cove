import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: 960,
    height: 540,
    backgroundColor: '#1a3c4d',
    pixelArt: true,
    scene: [BootScene],
  });
}
