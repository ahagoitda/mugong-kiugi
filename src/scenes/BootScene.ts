import Phaser from 'phaser';
import { generatePlaceholderSprites } from '../utils/spriteGenerator';

/**
 * BootScene - 게임 부팅 및 에셋 로딩 씬
 *
 * 역할:
 * 1. 플레이스홀더 스프라이트를 프로그래밍 방식으로 생성합니다.
 *    (추후 실제 도트 에셋으로 교체 가능)
 * 2. 로딩 진행률을 표시합니다.
 * 3. 로딩 완료 후 BattleScene + UIScene으로 전환합니다.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 로딩 바 UI
    const { width, height } = this.scale;
    const barW = width * 0.6;
    const barH = 12;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.rectangle(barX + barW / 2, barY, barW, barH, 0x333333);
    const fill = this.add.rectangle(barX + 1, barY, 0, barH - 2, 0x4fc3f7);
    fill.setOrigin(0, 0.5);

    const label = this.add.text(width / 2, barY - 24, '무공키우기', {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 2) * value;
    });

    this.load.on('complete', () => {
      bg.destroy();
      fill.destroy();
      label.destroy();
    });

    // 플레이스홀더 스프라이트 생성 (Canvas 기반)
    generatePlaceholderSprites(this);
  }

  create(): void {
    // BattleScene과 UIScene을 동시에 실행 (UIScene은 오버레이)
    this.scene.start('BattleScene');
    this.scene.start('UIScene');
  }
}
