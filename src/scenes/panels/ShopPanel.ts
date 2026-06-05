import Phaser from 'phaser';
import { SKILL_DATABASE } from '../../data/skills';
import { loadGame, saveGame } from '../../systems/SaveSystem';
import { soundSystem } from '../../systems/SoundSystem';
import type { SkillData } from '../../data/types';
import type { UIScene } from '../UIScene';

const W = 540;
const GOLD = 0xd4a74e;

export function buildShop(scene: UIScene, items: Phaser.GameObjects.GameObject[]): void {
  const save = loadGame();
  const today = new Date().toLocaleDateString('en-CA');
  const TABS: ['DAILY' | 'SKILLS' | 'GEMS', string][] = [['DAILY', '일일상점'], ['SKILLS', '무공구매'], ['GEMS', '원보']];

  TABS.forEach(([tab, label], i) => {
    const x = 90 + i * 130;
    const btn = scene.add.rectangle(x, 115, 115, 36, scene.shopTab === tab ? 0x4a3520 : 0x1e1409)
      .setStrokeStyle(1, scene.shopTab === tab ? GOLD : 0x60451f).setInteractive().setDepth(703);
    const txt = scene.add.text(x, 115, label, scene.textStyle(14, scene.shopTab === tab ? '#e8c36a' : '#8a7a60'))
      .setOrigin(0.5).setDepth(704);
    btn.on('pointerdown', () => {
      scene.shopTab = tab;
      scene.closePanel();
      scene.openPanel('SHOP');
    });
    items.push(btn, txt);
  });

  const contentY = 150;

  if (scene.shopTab === 'DAILY') {
    const purchased = save.shopLastReset === today ? (save.shopDailyPurchased ?? []) : [];
    const dailyItems: Array<{ id: string; name: string; cost: number; reward: string }> = [
      { id: 'daily_gold_sm',      name: '소 금괴',      cost: 10, reward: '금화 500'      },
      { id: 'daily_gold_lg',      name: '대 금괴',      cost: 50, reward: '금화 3000'     },
      { id: 'daily_exp_sm',       name: '수련서 (소)',  cost: 15, reward: 'EXP 2000'      },
      { id: 'daily_exp_lg',       name: '수련서 (대)',  cost: 80, reward: 'EXP 15000'     },
      { id: 'daily_skill_scroll', name: '무공 비급',    cost: 30, reward: '무공 해금 1회' },
    ];

    items.push(scene.add.text(W / 2, contentY + 10, `일일 초기화: ${today}`, scene.textStyle(12, '#7a6a50')).setOrigin(0.5).setDepth(703));

    dailyItems.forEach((item, i) => {
      const y = contentY + 55 + i * 100;
      const bought = purchased.includes(item.id);
      const card = scene.add.rectangle(W / 2, y, W - 60, 86, bought ? 0x111111 : 0x1e1409)
        .setStrokeStyle(1, bought ? 0x333333 : 0x60451f).setDepth(703);
      const name = scene.add.text(80, y - 20, item.name, scene.titleStyle(16)).setDepth(704);
      const reward = scene.add.text(80, y + 5, item.reward, scene.textStyle(13, '#a0e080')).setDepth(704);
      const costTxt = scene.add.text(W - 120, y - 20, `💎 ${item.cost}`, scene.textStyle(14, '#a0c8ff')).setDepth(704);
      const buyBtn = scene.add.rectangle(W - 100, y + 15, 90, 30, bought ? 0x333333 : 0x2d4d1e)
        .setStrokeStyle(1, bought ? 0x444444 : 0x5a9d2f).setInteractive().setDepth(703);
      const buyTxt = scene.add.text(W - 100, y + 15, bought ? '구매완료' : '구매', scene.textStyle(13, bought ? '#555555' : '#a0e080'))
        .setOrigin(0.5).setDepth(704);
      if (!bought) {
        buyBtn.on('pointerdown', () => {
          const gems = save.gems ?? 0;
          if (gems < item.cost) { scene.showNotice('원보가 부족합니다'); return; }
          save.gems = gems - item.cost;
          if (item.id === 'daily_gold_sm') save.gold += 500;
          else if (item.id === 'daily_gold_lg') save.gold += 3000;
          else if (item.id === 'daily_exp_sm') save.exp += 2000;
          else if (item.id === 'daily_exp_lg') save.exp += 15000;
          else if (item.id === 'daily_skill_scroll') {
            const locked = [...SKILL_DATABASE.values()].filter(s => !save.unlockedSkills.includes(s.id));
            if (locked.length > 0) {
              const random = locked[Math.floor(Math.random() * locked.length)];
              save.unlockedSkills.push(random.id);
              save.inventory[random.id] = (save.inventory[random.id] ?? 0) + 1;
            }
          }
          save.shopLastReset = today;
          save.shopDailyPurchased = [...purchased, item.id];
          saveGame(save);
          soundSystem.play('synth_ok');
          scene.closePanel();
          scene.openPanel('SHOP');
        });
      }
      items.push(card, name, reward, costTxt, buyBtn, buyTxt);
    });
  } else if (scene.shopTab === 'SKILLS') {
    const grades: Array<{ grade: string; label: string; cost: number }> = [
      { grade: 'LOW',      label: '하급 무공 비급',  cost: 20  },
      { grade: 'MID',      label: '중급 무공 비급',  cost: 80  },
      { grade: 'HIGH',     label: '상급 무공 비급',  cost: 250 },
      { grade: 'ULTIMATE', label: '절기 무공 비급',  cost: 800 },
    ];
    items.push(scene.add.text(W / 2, contentY + 10, '원보로 무공 비급 구매', scene.textStyle(14, '#a0a090')).setOrigin(0.5).setDepth(703));
    grades.forEach((g, i) => {
      const y = contentY + 70 + i * 110;
      const color = scene.skillGradeColor(g.grade as SkillData['grade']);
      const colorHex = `#${color.toString(16).padStart(6, '0')}`;
      const card = scene.add.rectangle(W / 2, y, W - 60, 94, 0x1e1409).setStrokeStyle(2, color).setDepth(703);
      const lbl = scene.add.text(80, y - 22, g.label, { ...scene.titleStyle(17), color: colorHex }).setDepth(704);
      const sub = scene.add.text(80, y + 4, '무작위 해당 등급 무공 해금', scene.textStyle(13, '#a0a090')).setDepth(704);
      const cost = scene.add.text(W - 115, y - 22, `💎 ${g.cost}`, scene.textStyle(14, '#a0c8ff')).setDepth(704);
      const btn = scene.add.rectangle(W - 100, y + 18, 90, 30, 0x2d4d1e).setStrokeStyle(1, 0x5a9d2f).setInteractive().setDepth(703);
      const btnTxt = scene.add.text(W - 100, y + 18, '구매', scene.textStyle(13, '#a0e080')).setOrigin(0.5).setDepth(704);
      btn.on('pointerdown', () => {
        const gems = save.gems ?? 0;
        if (gems < g.cost) { scene.showNotice('원보가 부족합니다'); return; }
        const pool = [...SKILL_DATABASE.values()].filter(s => s.grade === g.grade && !save.unlockedSkills.includes(s.id));
        if (pool.length === 0) { scene.showNotice('해금할 무공이 없습니다'); return; }
        const skill = pool[Math.floor(Math.random() * pool.length)];
        save.gems = gems - g.cost;
        save.unlockedSkills.push(skill.id);
        save.inventory[skill.id] = (save.inventory[skill.id] ?? 0) + 1;
        saveGame(save);
        soundSystem.play('synth_ok');
        scene.showNotice(`${skill.nameKo} 획득!`);
        scene.closePanel();
        scene.openPanel('SHOP');
      });
      items.push(card, lbl, sub, cost, btn, btnTxt);
    });
  } else {
    const gems = save.gems ?? 0;
    items.push(
      scene.add.text(W / 2, contentY + 10, `보유 원보: 💎 ${gems}`, scene.titleStyle(18)).setOrigin(0.5).setDepth(703),
      scene.add.text(W / 2, contentY + 46, '(매일 무료 원보 지급 예정)', scene.textStyle(13, '#7a6a50')).setOrigin(0.5).setDepth(703),
    );
    const freeKey = `gem_free_${today}`;
    const gotFree = (save.shopDailyPurchased ?? []).includes(freeKey);
    const freeBtn = scene.add.rectangle(W / 2, contentY + 100, 260, 52, gotFree ? 0x111111 : 0x1a2d0e)
      .setStrokeStyle(1, gotFree ? 0x333333 : GOLD).setInteractive().setDepth(703);
    const freeTxt = scene.add.text(W / 2, contentY + 100, gotFree ? '오늘 이미 수령함' : '💎 무료 원보 10개 받기', scene.textStyle(15, gotFree ? '#555' : '#a0c8ff'))
      .setOrigin(0.5).setDepth(704);
    if (!gotFree) {
      freeBtn.on('pointerdown', () => {
        save.gems = (save.gems ?? 0) + 10;
        save.shopLastReset = today;
        save.shopDailyPurchased = [...(save.shopDailyPurchased ?? []), freeKey];
        saveGame(save);
        soundSystem.play('synth_ok');
        scene.showNotice('💎 원보 10개 획득!');
        scene.closePanel();
        scene.openPanel('SHOP');
      });
    }
    items.push(freeBtn, freeTxt);
    items.push(scene.add.text(W / 2, contentY + 160, '시간 제한 버프', scene.titleStyle(16)).setOrigin(0.5).setDepth(703));
    const now = Date.now();
    const BUFF_DEFS = [
      { type: 'ATK_BOOST',  label: '⚔ 공격력 ×1.5', desc: '30분간 공격력 1.5배',    cost: 30, color: '#ff9070' },
      { type: 'GOLD_BOOST', label: '💰 금화 ×1.5',   desc: '30분간 금화 획득 1.5배', cost: 20, color: '#ffd740' },
      { type: 'EXP_BOOST',  label: '✦ 경험치 ×1.5', desc: '30분간 경험치 1.5배',    cost: 20, color: '#88ddff' },
    ] as const;
    BUFF_DEFS.forEach(({ type, label, desc, cost: bCost, color }) => {
      const by = contentY + 200 + ['ATK_BOOST', 'GOLD_BOOST', 'EXP_BOOST'].indexOf(type) * 88;
      const active = (save.activeBuffs ?? []).some(b => b.type === type && b.expiresAt > now);
      const canBuy = (save.gems ?? 0) >= bCost && !active;
      const card = scene.add.rectangle(W / 2, by, W - 80, 72, active ? 0x1a2d1a : 0x17120d)
        .setStrokeStyle(1, active ? 0x66cc66 : GOLD).setDepth(703);
      items.push(card,
        scene.add.text(80, by - 14, label, scene.textStyle(16, color)).setDepth(704),
        scene.add.text(80, by + 10, active ? '✓ 활성 중' : desc, scene.textStyle(12, active ? '#66cc66' : '#7a6a50')).setDepth(704));
      if (!active) {
        const bBtn = scene.add.rectangle(W - 90, by, 80, 38, canBuy ? 0x3a2a10 : 0x1a1209)
          .setStrokeStyle(1, canBuy ? GOLD : 0x333333).setInteractive().setDepth(704);
        bBtn.on('pointerdown', () => scene.activateBuff(type, 30 * 60 * 1000, bCost));
        items.push(bBtn, scene.add.text(W - 90, by, `💎${bCost}`, scene.textStyle(14, canBuy ? '#e8c36a' : '#555')).setOrigin(0.5).setDepth(705));
      }
    });
  }
}
