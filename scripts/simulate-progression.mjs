// 무공 키우기 — 실제 게임 수식 기반 진행 시뮬레이션
// (BattleScene/combatBalance.ts/skills.ts/UIScene 의 수식을 그대로 옮김)

const ENEMY_HP_MUL = 0.45, ENEMY_DMG_MUL = 0.25, BOSS_HP_MUL = 0.38, BOSS_DMG_MUL = 0.14;

function minionCycleDmgMul(wave) {
  return 1 + Math.floor((wave - 1) / 40) * 0.3;
}

function bossPost50Mul(wave) {
  if (wave <= 50) return { hpMul: 1, dmgMul: 1 };
  const extra = wave - 50;
  return { hpMul: 1 + extra * 0.02, dmgMul: 1 + extra * 0.01 };
}

function calculateEvade(level, trainingHp = 0, hasFullSet = false) {
  const baseEvade = Math.min(0.50, 0.18 + (level - 1) * 0.025);
  const trainingBonus = Math.min(0.20, trainingHp * 0.02);
  const equipmentBonus = hasFullSet ? 0.05 : 0;
  return Math.min(0.70, baseEvade + trainingBonus + equipmentBonus);
}

function trainingAttackCost(level) {
  const mul = level >= 20 ? 300 : 100;
  return mul * (level + 1);
}

function rebirthAttackMul(rebirthCount) {
  return 1 + Math.max(0, rebirthCount) * 0.10;
}

// ── 적/보스 스탯 ──
function minionStats(wave) {
  const region = Math.min(50, Math.max(1, Math.floor((wave - 1) / 5) + 1));
  const baseRegion = ((region - 1) % 8) + 1;
  const n = (baseRegion - 1) * 3 + 2;
  const hp = (28 + n * 8) * (1 + (wave - 1) * 0.015) * ENEMY_HP_MUL;
  const dmg = (4 + Math.floor(n * 1.2)) * (1 + (wave - 1) * 0.012) * ENEMY_DMG_MUL * minionCycleDmgMul(wave);
  const gold = 4 + n * 3;
  const exp = 6 + n * 4;
  const atkCd = 1500 - Math.min(650, n * 24);
  return { hp: Math.max(1, Math.round(hp)), dmg: Math.max(1, Math.round(dmg)), gold, exp, atkCd };
}

function bossStats(wave) {
  const stage = Math.min(50, Math.floor(wave / 5));
  const post50 = bossPost50Mul(wave);
  const hp = (260 + (stage - 1) * 450 + Math.pow(stage - 1, 2) * 20) * post50.hpMul * BOSS_HP_MUL;
  const dmg = (18 + (stage - 1) * 8 + Math.round(Math.pow(stage - 1, 1.2) * 2)) * post50.dmgMul * BOSS_DMG_MUL;
  const idx = (stage - 1) % 8;
  return {
    stage, hp: Math.round(hp), dmg: Math.round(dmg),
    gold: 120 + stage * 200, exp: 180 + stage * 250,
    atkCd: 1700 - idx * 80, skillInterval: 3600,
  };
}

const expToNext = lv => Math.round(50 + (lv - 1) * 30 + Math.pow(lv, 1.5) * 10);

function playerHitDamage({ dmgMult, flatAttack, charDmgMul, level, skillLv, attackMul, critChance, rebirthCount = 0 }) {
  const levelBonus = 1 + (level - 1) * 0.05;
  const upBonus = 1 + skillLv * 0.08;
  const base = (dmgMult * 10 + flatAttack) * charDmgMul * levelBonus * upBonus * attackMul * rebirthAttackMul(rebirthCount);
  return base * (1 + critChance);
}

function simulate(policy) {
  let gold = 0, exp = 0, level = 1, next = expToNext(1);
  let trainingAtk = 0, trainingHp = 0, trainingGold = 0, research = 0;
  let skillLv = 0;
  let timeSec = 0;
  const rows = [];

  function loadout(wave) {
    if (policy.skillProgression === 'none') return { dmgMult: 1.0, cooldown: 800 };
    if (wave >= 40) return { dmgMult: 5.0, cooldown: 5000 };
    if (wave >= 20) return { dmgMult: 3.0, cooldown: 2600 };
    if (wave >= 8) return { dmgMult: 1.6, cooldown: 1500 };
    return { dmgMult: 1.0, cooldown: 800 };
  }

  for (let wave = 1; wave <= 100; wave++) {
    const isBoss = wave % 5 === 0;
    const sk = loadout(wave);
    const attackMul = 1 + trainingAtk * 0.02 + research * 0.025;
    const critChance = Math.min(0.5, (policy.crit ? Math.min(10, Math.floor(trainingAtk / 2)) : 0) * 0.02);
    const region = Math.floor((wave - 1) / 5) + 1;
    const flatAttack = policy.equipment ? Math.round((8 + Math.min(region, 8) * 6) * 1.5 * 1.6) : 0;

    const dmg = playerHitDamage({
      dmgMult: sk.dmgMult, flatAttack, charDmgMul: 1.0, level, skillLv, attackMul, critChance,
    });
    const cadence = Math.max(sk.cooldown, 650) / 1000;
    const dps = dmg / cadence;

    if (isBoss) {
      const b = bossStats(wave);
      const ttk = b.hp / dps;
      const evade = calculateEvade(level, trainingHp, policy.equipment);
      const hpMul = 1 + trainingHp * 0.02;
      const playerHp = 100;
      const regen = playerHp * 0.004;
      const rawDps = b.dmg / (b.atkCd / 1000) + (b.dmg * 1.1) / (b.skillInterval / 1000);
      const effDps = rawDps * (1 - evade) / hpMul - regen;
      const ttd = effDps > 0 ? playerHp / effDps : Infinity;
      rows.push({
        wave, type: 'BOSS', stage: b.stage, enemyHp: b.hp, dps: Math.round(dps),
        ttk: +ttk.toFixed(1), ttd: ttd === Infinity ? '∞' : +ttd.toFixed(0),
        level, gold: Math.round(gold), atkTrain: trainingAtk, skillLv, evade: +(evade * 100).toFixed(0) + '%',
      });
      timeSec += ttk + 6;
      gold += b.gold * (1 + trainingGold * 0.02);
      exp += b.exp;
    } else {
      const m = minionStats(wave);
      const count = Math.min(8, 2 + Math.floor(wave * 0.7));
      const ttkOne = m.hp / dps;
      const waveTime = count * Math.max(ttkOne, 0.9) + count * 0.4 + 3;
      timeSec += waveTime;
      gold += count * m.gold * (1 + trainingGold * 0.02);
      exp += count * m.exp;
      if (wave % 10 === 0 || wave <= 3) {
        rows.push({
          wave, type: 'wave', enemyHp: m.hp, dps: Math.round(dps),
          ttk: +ttkOne.toFixed(2), level, gold: Math.round(gold),
          atkTrain: trainingAtk, skillLv, time: Math.round(timeSec / 60) + 'm',
        });
      }
    }

    while (exp >= next) { exp -= next; level++; next = expToNext(level); }

    if (policy.spend) {
      let guard = 0;
      while (trainingAtk < 50 && gold >= trainingAttackCost(trainingAtk) && guard++ < 80) {
        gold -= trainingAttackCost(trainingAtk); trainingAtk++;
      }
      const upBase = wave >= 40 ? 700 : wave >= 20 ? 220 : wave >= 8 ? 80 : 25;
      while (skillLv < 30 && gold >= upBase * (1 + skillLv * 0.32) && guard++ < 80) {
        gold -= upBase * (1 + skillLv * 0.32); skillLv++;
      }
      while (gold >= 220 * (research + 1) && research < 20 && guard++ < 120) {
        gold -= 220 * (research + 1); research++;
      }
      while (trainingHp < 10 && gold >= 100 * (trainingHp + 1) && guard++ < 40) {
        gold -= 100 * (trainingHp + 1); trainingHp++;
      }
    }
  }
  return rows;
}

console.log('━━ 시나리오 A: 순수 방치 (지출 없음, 시작 무공만, 장비 없음) ━━');
console.table(simulate({ spend: false, skillProgression: 'none', equipment: false }).filter(r => r.type === 'BOSS'));

console.log('━━ 시나리오 B: 적극 성장 (수련/강화/연구 + 무공 합성 진행 + 장비) ━━');
console.table(simulate({ spend: true, skillProgression: 'normal', equipment: true, crit: true }).filter(r => r.type === 'BOSS'));

console.log('━━ 시나리오 B: 일반 웨이브 샘플 ━━');
console.table(simulate({ spend: true, skillProgression: 'normal', equipment: true, crit: true }).filter(r => r.type === 'wave'));

console.log('━━ 졸병 위협도 (wave별 졸병 1마리 DPS vs 플레이어 재생 0.4%/s) ━━');
for (const w of [1, 10, 30, 50, 80, 100]) {
  const m = minionStats(w);
  const lvGuess = Math.min(50, 1 + Math.floor(w * 0.8));
  const evade = calculateEvade(lvGuess, Math.min(10, Math.floor(w / 10)));
  const dps = (m.dmg / (m.atkCd / 1000)) * (1 - evade);
  console.log(`wave ${w}: 졸병dmg=${m.dmg} 유효DPS=${dps.toFixed(2)}/s vs 재생 0.4/s → ${dps < 0.4 ? '죽음 불가능' : ((100 / (dps - 0.4)) / 60).toFixed(1) + '분 버팀'}`);
}