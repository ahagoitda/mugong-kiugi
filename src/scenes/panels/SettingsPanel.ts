import Phaser from 'phaser';
import { loadGame } from '../../systems/SaveSystem';
import { soundSystem } from '../../systems/SoundSystem';
import { bgmSystem } from '../../systems/BgmSystem';
import { fmtNum as fmtGold } from '../../utils/format';
import type { UIScene } from '../UIScene';

const W = 540;
const GOLD = 0xd4a74e;

export function buildSettings(scene: UIScene, items: Phaser.GameObjects.GameObject[]): void {
  const save = loadGame();
  let bgmVol = bgmSystem.volume;
  let sfxVol = soundSystem.volume;

  const training = save.trainingLevels ?? {};
  const rebirthMul = 1 + (save.rebirthCount ?? 0) * 0.15;
  const atkMul = rebirthMul * (1 + (training.attack ?? 0) * 0.02);
  const hpMul  = rebirthMul * (1 + (training.hp ?? 0) * 0.02);
  const lv = save.level;
  const approxAtk = Math.round((10 + (lv - 1) * 0.5) * atkMul * 10);
  const approxHp  = Math.round(100 * hpMul * (1 + (lv - 1) * 0.05));
  const powerScore = Math.round(approxAtk * 0.7 + approxHp * 0.3 + (save.stageCleared ?? 0) * 8 + lv * 25);
  items.push(
    scene.add.rectangle(W / 2, 100, W - 60, 48, 0x1a1206).setStrokeStyle(1, 0x8b6932).setDepth(703),
    scene.add.text(W / 2, 92, '전투력', scene.textStyle(13, '#a08060')).setOrigin(0.5).setDepth(704),
    scene.add.text(W / 2, 112, fmtGold(powerScore), scene.titleStyle(22)).setOrigin(0.5).setDepth(704),
  );

  const row = (y: number, label: string, value: number, onMinus: () => void, onPlus: () => void) => {
    items.push(scene.add.text(55, y, label, scene.titleStyle(18)).setDepth(703));
    const valText = scene.add.text(W / 2, y + 2, `${Math.round(value * 100)}%`,
      scene.textStyle(17, '#e8c36a')).setOrigin(0.5).setDepth(703);
    items.push(valText);
    const minus = scene.add.text(W / 2 - 70, y, '◀', scene.titleStyle(20)).setOrigin(0.5).setInteractive().setDepth(703);
    const plus  = scene.add.text(W / 2 + 70, y, '▶', scene.titleStyle(20)).setOrigin(0.5).setInteractive().setDepth(703);
    minus.on('pointerdown', () => { onMinus(); });
    plus.on('pointerdown', () => { onPlus(); });
    items.push(minus, plus);
    return valText;
  };

  const bgmText = row(175, '배경음악', bgmVol,
    () => { bgmVol = Math.max(0, bgmVol - 0.1); bgmSystem.setVolume(bgmVol); bgmText.setText(`${Math.round(bgmVol * 100)}%`); },
    () => { bgmVol = Math.min(1, bgmVol + 0.1); bgmSystem.setVolume(bgmVol); bgmText.setText(`${Math.round(bgmVol * 100)}%`); },
  );
  const sfxText = row(240, '효과음', sfxVol,
    () => { sfxVol = Math.max(0, sfxVol - 0.1); soundSystem.setVolume(sfxVol); sfxText.setText(`${Math.round(sfxVol * 100)}%`); },
    () => { sfxVol = Math.min(1, sfxVol + 0.1); soundSystem.setVolume(sfxVol); sfxText.setText(`${Math.round(sfxVol * 100)}%`); },
  );

  items.push(scene.add.rectangle(W / 2, 305, W - 60, 1, 0x60451f).setDepth(703));

  const tutBtn = scene.add.rectangle(W / 2, 355, 300, 48, 0x2a1f0e).setStrokeStyle(1, GOLD).setInteractive().setDepth(703);
  const tutLabel = scene.add.text(W / 2, 355, '튜토리얼 다시 보기', scene.textStyle(16, '#e8c36a')).setOrigin(0.5).setDepth(704);
  tutBtn.on('pointerdown', () => {
    scene.closePanel();
    scene.time.delayedCall(100, () => scene.showTutorial(0));
  });
  items.push(tutBtn, tutLabel);

  const resetBtn = scene.add.rectangle(W / 2, 435, 300, 48, 0x2a1f0e).setStrokeStyle(1, 0x9c3b28).setInteractive().setDepth(703);
  const resetLabel = scene.add.text(W / 2, 435, '세이브 초기화', scene.textStyle(16, '#e05050')).setOrigin(0.5).setDepth(704);
  resetBtn.on('pointerdown', () => scene.confirmReset(items));
  items.push(resetBtn, resetLabel);

  const totalSec = save.totalPlayTime ?? 0;
  const hours = Math.floor(totalSec / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const playTimeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
  items.push(
    scene.add.text(W / 2, 503, `총 플레이: ${playTimeStr}`, scene.textStyle(14, '#a0a090')).setOrigin(0.5).setDepth(703),
    scene.add.text(W / 2, 528, '무공키우기 v1.0.0', scene.textStyle(11, '#5a4a38')).setOrigin(0.5).setDepth(703),
  );

  items.push(
    scene.add.rectangle(W / 2, 566, W - 60, 1, 0x60451f).setDepth(703),
    scene.add.text(W / 2, 586, '무림 기록', scene.titleStyle(17)).setOrigin(0.5).setDepth(703),
  );
  const statsLeft = 55;
  const statsRight = W / 2 + 20;
  const missionOngoing = (save.discipleMissionEnd ?? 0) > Date.now();
  const statEntries: [number, number, string, string][] = [
    [statsLeft,  616, '최고 웨이브', `${save.stageCleared}웨이브`],
    [statsRight, 616, '총 처치',     `${fmtGold(save.totalKills ?? 0)}명`],
    [statsLeft,  652, '보스 격파',   `${save.defeatedBosses?.length ?? 0} / 8`],
    [statsRight, 652, '환생',        `${save.rebirthCount ?? 0}회`],
    [statsLeft,  688, '해금 스킬',   `${save.unlockedSkills?.length ?? 0}종`],
    [statsRight, 688, '장비 보유',   `${save.equipmentInventory?.length ?? 0}개`],
    [statsLeft,  724, '강화석',      `🔮 ${save.enhanceStones ?? 0}개`],
    [statsRight, 724, '제자 파견',   missionOngoing ? '파견 중' : `${save.disciples?.length ?? 0}명 대기`],
  ];
  for (const [x, y, label, val] of statEntries) {
    items.push(
      scene.add.text(x, y, label, scene.textStyle(13, '#7a6a50')).setDepth(703),
      scene.add.text(x, y + 20, val, scene.textStyle(15, '#e8c36a')).setDepth(703),
    );
  }
}
