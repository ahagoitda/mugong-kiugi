import Phaser from 'phaser';
import { loadGame } from '../../systems/SaveSystem';
import type { UIScene } from '../UIScene';

const W = 540;
const GOLD = 0xd4a74e;

export function buildMissions(scene: UIScene, items: Phaser.GameObjects.GameObject[]): void {
  const save = loadGame();
  scene.ensureDailyMission(save);
  const mp = save.missionProgress ?? {};
  const claims = save.missionClaims ?? [];

  const TABS: [typeof scene.missionsTab, string][] = [['DAILY', '일일 임무'], ['ACHIEVEMENT', '업적']];
  TABS.forEach(([tab, label], i) => {
    const x = 135 + i * 178;
    const isActive = scene.missionsTab === tab;
    const btn = scene.add.rectangle(x, 103, 158, 38, isActive ? 0x5a3d18 : 0x17120d)
      .setStrokeStyle(isActive ? 2 : 1, isActive ? GOLD : 0x60451f).setInteractive().setDepth(702);
    btn.on('pointerdown', () => { scene.missionsTab = tab; scene.openPanel('MISSIONS'); });
    items.push(btn, scene.add.text(x, 103, label, scene.textStyle(15, isActive ? '#f3d992' : '#b7aa92')).setOrigin(0.5).setDepth(703));
  });

  if (scene.missionsTab === 'DAILY') {
    items.push(scene.add.text(W / 2, 137, `자정에 초기화 · ${save.dailyMissionDate ?? '오늘'}`, scene.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

    const daily = [
      { id: 'daily_kill',      name: '적 30명 처치',       prog: mp.daily_kill ?? 0,      target: 30,  reward: 500  },
      { id: 'daily_waves',     name: '웨이브 5회 클리어',  prog: mp.daily_waves ?? 0,     target: 5,   reward: 400  },
      { id: 'daily_boss',      name: '보스 1회 처치',       prog: mp.daily_boss ?? 0,      target: 1,   reward: 800  },
      { id: 'daily_gold',      name: '금화 500개 수집',     prog: mp.daily_gold ?? 0,      target: 500, reward: 300  },
      { id: 'daily_synthesis', name: '합성 1회 성공',       prog: mp.daily_synthesis ?? 0, target: 1,   reward: 400  },
    ];

    daily.forEach(({ id, name, prog, target, reward }, i) => {
      const y = 158 + i * 128;
      const claimed = claims.includes(id);
      const done = prog >= target;
      const canClaim = done && !claimed;
      const ratio = Math.min(1, prog / target);
      const cardColor = claimed ? 0x131e0e : canClaim ? 0x1e2010 : 0x110f0c;
      const borderColor = claimed ? 0x3a6a2a : canClaim ? GOLD : 0x3a3528;
      items.push(
        scene.add.rectangle(W / 2, y + 46, W - 52, 110, cardColor, 1)
          .setStrokeStyle(2, borderColor, claimed ? 0.7 : canClaim ? 1 : 0.4).setDepth(702),
        scene.add.text(56, y + 18, name, scene.titleStyle(18)).setDepth(703),
        scene.add.text(56, y + 44, `보상  ${reward}G`, scene.textStyle(13, '#d4a74e')).setDepth(703),
        scene.add.rectangle(56, y + 68, W - 108, 10, 0x1e1a13, 1).setOrigin(0, 0.5).setDepth(703),
        scene.add.rectangle(56, y + 68, Math.max(4, (W - 108) * ratio), 10, canClaim || claimed ? 0x83d68a : GOLD, 0.85).setOrigin(0, 0.5).setDepth(704),
        scene.add.text(56, y + 87, `${Math.min(prog, target)} / ${target}`, scene.textStyle(12, '#8a7d6a')).setDepth(703),
      );
      const btn = scene.add.rectangle(W - 95, y + 65, 120, 38, canClaim ? 0x4a3215 : 0x17120d)
        .setStrokeStyle(1, canClaim ? GOLD : 0x3a3528).setInteractive().setDepth(703);
      btn.on('pointerdown', () => scene.claimMission(id, canClaim));
      items.push(btn, scene.add.text(W - 95, y + 65, claimed ? '수령 완료' : canClaim ? '보상 수령' : '진행 중',
        scene.textStyle(13, claimed ? '#83d68a' : canClaim ? '#f0d493' : '#666666')).setOrigin(0.5).setDepth(704));
    });
  } else {
    items.push(scene.add.text(W / 2, 137, '영구적으로 달성되는 업적입니다', scene.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

    const totalKills = save.totalKills ?? 0;
    const bossCount = save.defeatedBosses?.length ?? 0;
    const skillCount = save.unlockedSkills.length;
    const eqCount = save.equipmentInventory?.length ?? 0;
    const waveMax = save.stageCleared ?? 0;
    const rebirths = save.rebirthCount ?? 0;

    type AchDef = { id: string; name: string; desc: string; prog: number; target: number; reward: number; gems: number };
    const achievements: AchDef[] = [
      { id: 'ach_kill100',   name: '첫 번째 백인도',  desc: '적 100명 처치',    prog: totalKills, target: 100,   reward: 1000,  gems: 2  },
      { id: 'ach_kill500',   name: '오백인도',        desc: '적 500명 처치',    prog: totalKills, target: 500,   reward: 2500,  gems: 5  },
      { id: 'ach_kill2000',  name: '이천인도',        desc: '적 2000명 처치',   prog: totalKills, target: 2000,  reward: 5000,  gems: 10 },
      { id: 'ach_kill10000', name: '만인지적(萬人之敵)',desc: '적 10000명 처치', prog: totalKills, target: 10000, reward: 20000, gems: 30 },
      { id: 'ach_boss1',     name: '혈교 첫 타도',   desc: '보스 1회 격파',    prog: bossCount,  target: 1,     reward: 1500,  gems: 5  },
      { id: 'ach_boss4',     name: '사악한 사천왕',  desc: '보스 4회 격파',    prog: bossCount,  target: 4,     reward: 3000,  gems: 10 },
      { id: 'ach_boss8',     name: '혈교 완전 소탕', desc: '보스 8회 모두 격파',prog: bossCount,  target: 8,     reward: 10000, gems: 50 },
      { id: 'ach_wave10',    name: '초보 도전자',    desc: '10웨이브 돌파',    prog: waveMax,    target: 10,    reward: 800,   gems: 2  },
      { id: 'ach_wave30',    name: '혈교 정예',      desc: '30웨이브 돌파',    prog: waveMax,    target: 30,    reward: 3000,  gems: 8  },
      { id: 'ach_wave50',    name: '혈교 중견',      desc: '50웨이브 돌파',    prog: waveMax,    target: 50,    reward: 8000,  gems: 20 },
      { id: 'ach_lvl10',     name: '초입 경지',      desc: '레벨 10 달성',    prog: save.level, target: 10,    reward: 1000,  gems: 3  },
      { id: 'ach_lvl30',     name: '화경(化境) 돌입',desc: '레벨 30 달성',    prog: save.level, target: 30,    reward: 5000,  gems: 10 },
      { id: 'ach_lvl50',     name: '고수 입문',      desc: '레벨 50 달성',    prog: save.level, target: 50,    reward: 10000, gems: 20 },
      { id: 'ach_lvl100',    name: '초절정 경지',    desc: '레벨 100 달성',   prog: save.level, target: 100,   reward: 30000, gems: 50 },
      { id: 'ach_rebirth1',  name: '환생자',         desc: '환생 1회',         prog: rebirths,   target: 1,     reward: 5000,  gems: 15 },
      { id: 'ach_rebirth3',  name: '삼생삼세',       desc: '환생 3회',         prog: rebirths,   target: 3,     reward: 15000, gems: 40 },
      { id: 'ach_skill8',    name: '팔방진인',       desc: '무공 8개 습득',   prog: skillCount, target: 8,     reward: 2000,  gems: 5  },
      { id: 'ach_skill16',   name: '무공 종사',      desc: '무공 16개 습득',  prog: skillCount, target: 16,    reward: 6000,  gems: 15 },
      { id: 'ach_equip10',   name: '무장 강화',      desc: '장비 10개 수집',  prog: eqCount,    target: 10,    reward: 1500,  gems: 3  },
      { id: 'ach_equip30',   name: '병기 수집가',    desc: '장비 30개 수집',  prog: eqCount,    target: 30,    reward: 4000,  gems: 8  },
    ];

    const claimedCount = achievements.filter(a => claims.includes(a.id)).length;
    items.push(scene.add.text(W / 2, 137, `달성: ${claimedCount} / ${achievements.length}`, scene.textStyle(11, '#4a4438')).setOrigin(0.5).setDepth(702));

    achievements.forEach(({ id, name, desc, prog, target, reward, gems: gemReward }, i) => {
      const y = 152 + i * 78;
      const claimed = claims.includes(id);
      const canClaim = prog >= target && !claimed;
      const ratio = Math.min(1, prog / target);
      const rewardStr = gemReward > 0 ? `${reward}G + ${gemReward}💎` : `${reward}G`;
      items.push(
        scene.add.rectangle(W / 2, y + 30, W - 52, 64, claimed ? 0x131e0e : 0x110f0c, 1)
          .setStrokeStyle(1, claimed ? 0x3a6a2a : canClaim ? GOLD : 0x3a3528, claimed ? 0.7 : canClaim ? 1 : 0.4).setDepth(702),
        scene.add.text(56, y + 14, name, scene.textStyle(14, claimed ? '#83d68a' : canClaim ? '#e8c36a' : '#8a7d6a')).setDepth(703),
        scene.add.text(56, y + 34, `${desc}  ·  ${rewardStr}`, scene.textStyle(11, '#7a6e58')).setDepth(703),
        scene.add.rectangle(56, y + 52, 240, 5, 0x1e1a13, 1).setOrigin(0, 0.5).setDepth(703),
        scene.add.rectangle(56, y + 52, Math.max(3, 240 * ratio), 5, canClaim || claimed ? 0x83d68a : GOLD, 0.8).setOrigin(0, 0.5).setDepth(704),
        scene.add.text(304, y + 52, `${Math.min(prog, target)}/${target}`, scene.textStyle(10, '#5a5048')).setOrigin(0, 0.5).setDepth(703),
      );
      const btn = scene.add.rectangle(W - 88, y + 30, 110, 34, canClaim ? 0x4a3215 : 0x17120d)
        .setStrokeStyle(1, canClaim ? GOLD : 0x3a3528).setInteractive().setDepth(703);
      btn.on('pointerdown', () => scene.claimMission(id, canClaim, gemReward));
      items.push(btn, scene.add.text(W - 88, y + 30, claimed ? '달성 ✓' : canClaim ? '수령' : `${Math.floor(ratio * 100)}%`,
        scene.textStyle(12, claimed ? '#83d68a' : canClaim ? '#f0d493' : '#555555')).setOrigin(0.5).setDepth(704));
    });
  }
}
