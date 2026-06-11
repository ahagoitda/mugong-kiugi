// 무공 키우기 — 실제 게임 수식 기반 진행 시뮬레이션
// (BattleScene/enemies.ts/skills.ts/UIScene 의 수식을 그대로 옮김)

const ENEMY_HP_MUL = 0.45, ENEMY_DMG_MUL = 0.12, BOSS_HP_MUL = 0.38, BOSS_DMG_MUL = 0.14;

// ── 적/보스 스탯 (enemies.ts) ──
function minionStats(wave) {
  const region = Math.min(50, Math.max(1, Math.floor((wave - 1) / 5) + 1));
  const baseRegion = ((region - 1) % 8) + 1;
  const n = (baseRegion - 1) * 3 + 2; // 풀 중간값 근사
  const hp = (28 + n * 8) * (1 + (wave - 1) * 0.015) * ENEMY_HP_MUL;
  const dmg = (4 + Math.floor(n * 1.2)) * (1 + (wave - 1) * 0.012) * ENEMY_DMG_MUL;
  const gold = 4 + n * 3;
  const exp = 6 + n * 4;
  const atkCd = 1500 - Math.min(650, n * 24);
  return { hp: Math.max(1, Math.round(hp)), dmg: Math.max(1, Math.round(dmg)), gold, exp, atkCd };
}
function bossStats(wave) {
  const stage = Math.min(50, Math.floor(wave / 5));
  let hpMul = 1, dmgMul = 1;
  if (wave > 50) {
    const cycles = Math.floor((wave - 50) / 40);
    hpMul = 1 + cycles * 0.8;
    dmgMul = 1 + cycles * 0.5;
  }
  const hp = (260 + (stage - 1) * 450 + Math.pow(stage - 1, 2) * 20) * hpMul * BOSS_HP_MUL;
  const dmg = (18 + (stage - 1) * 8 + Math.round(Math.pow(stage - 1, 1.2) * 2)) * dmgMul * BOSS_DMG_MUL;
  const idx = (stage - 1) % 8;
  return {
    stage, hp: Math.round(hp), dmg: Math.round(dmg),
    gold: 120 + stage * 200, exp: 180 + stage * 250,
    atkCd: 1700 - idx * 80, skillInterval: 3600,
  };
}

// ── 레벨 곡선 (skills.ts) ──
const expToNext = lv => Math.round(50 + (lv - 1) * 30 + Math.pow(lv, 1.5) * 10);

// ── 플레이어 데미지 (BattleScene.onPlayerHit) ──
function playerHitDamage({ dmgMult, flatAttack, charDmgMul, level, skillLv, attackMul, critChance }) {
  const levelBonus = 1 + (level - 1) * 0.05;
  const upBonus = 1 + skillLv * 0.08;
  const base = (dmgMult * 10 + flatAttack) * charDmgMul * levelBonus * upBonus * attackMul;
  return base * (1 + critChance); // 치명타 기대값 (x2)
}

// ── 시나리오 시뮬레이션 ──
// 웨이브를 순서대로 진행. 골드/경험치 누적, 정책에 따라 수련/강화/합성에 지출.
function simulate(policy) {
  let gold = 0, exp = 0, level = 1, next = expToNext(1);
  let trainingAtk = 0, trainingGold = 0, research = 0;
  let skillLv = 0;
  let timeSec = 0;
  const rows = [];

  // 스킬 로드아웃: 웨이브에 따라 단계적으로 상위 무공 확보 가정 (드랍+합성)
  // LOW(1.0) → wave8 MID(1.6 매화) → wave20 HIGH(3.0급) → wave40 ULT(5.0급)
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
    // 장비 flat attack: region×6×등급평균(1.5)×슬롯 6개 중 절반 무기효율 근사
    const region = Math.floor((wave - 1) / 5) + 1;
    const flatAttack = policy.equipment ? Math.round((8 + Math.min(region, 8) * 6) * 1.5 * 1.6) : 0;

    const dmg = playerHitDamage({
      dmgMult: sk.dmgMult, flatAttack, charDmgMul: 1.0, level, skillLv, attackMul, critChance,
    });
    // 시전 캐던스: max(쿨다운, 공격 시퀀스 ~0.65s) — 단일 스킬 가정
    const cadence = Math.max(sk.cooldown, 650) / 1000;
    const dps = dmg / cadence;

    if (isBoss) {
      const b = bossStats(wave);
      const ttk = b.hp / dps;
      // 보스가 플레이어를 죽이는 데 걸리는 시간 (회피/감소/재생 반영)
      const evade = Math.min(0.7, 0.18 + (level - 1) * 0.025);
      const hpMul = 1 + 0; // 체력수련 생략 보수적
      const playerHp = 100;
      const regen = playerHp * 0.004;
      // 보스 평타 + 스킬: 평균 초당 피해
      const rawDps = b.dmg / (b.atkCd / 1000) + (b.dmg * 1.1) / (b.skillInterval / 1000);
      const effDps = rawDps * (1 - evade) / hpMul - regen;
      const ttd = effDps > 0 ? playerHp / effDps : Infinity;
      rows.push({
        wave, type: 'BOSS', stage: b.stage, enemyHp: b.hp, dps: Math.round(dps),
        ttk: +ttk.toFixed(1), ttd: ttd === Infinity ? '∞' : +ttd.toFixed(0),
        level, gold: Math.round(gold), atkTrain: trainingAtk, skillLv,
      });
      timeSec += ttk + 6; // 컷씬 등
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

    // 레벨업
    while (exp >= next) { exp -= next; level++; next = expToNext(level); }

    // 지출 정책
    if (policy.spend) {
      // 1순위: 공격 수련 (base 100, cost 100×(lv+1), max 20)
      let guard = 0;
      while (trainingAtk < 20 && gold >= 100 * (trainingAtk + 1) && guard++ < 50) {
        gold -= 100 * (trainingAtk + 1); trainingAtk++;
      }
      // 2순위: 무공 강화 (대표 무공 1개, 재료는 충분하다고 가정)
      const upBase = wave >= 40 ? 700 : wave >= 20 ? 220 : wave >= 8 ? 80 : 25;
      while (skillLv < 30 && gold >= upBase * (1 + skillLv * 0.32) && guard++ < 80) {
        gold -= upBase * (1 + skillLv * 0.32); skillLv++;
      }
      // 3순위: 문파 연구 (+2.5%/lv)
      while (gold >= 220 * (research + 1) && research < 20 && guard++ < 120) {
        gold -= 220 * (research + 1); research++;
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

// 졸병 위협도: 적이 플레이어를 죽일 수 있는가
console.log('━━ 졸병 위협도 (wave별 졸병 1마리 DPS vs 플레이어 재생 0.4%/s) ━━');
for (const w of [1, 10, 30, 50, 80, 100]) {
  const m = minionStats(w);
  const lvGuess = Math.min(40, 1 + Math.floor(w * 0.8));
  const evade = Math.min(0.7, 0.18 + (lvGuess - 1) * 0.025);
  const dps = (m.dmg / (m.atkCd / 1000)) * (1 - evade);
  console.log(`wave ${w}: 졸병dmg=${m.dmg} 유효DPS=${dps.toFixed(2)}/s vs 재생 0.4/s → ${dps < 0.4 ? '죽음 불가능' : ((100 / (dps - 0.4)) / 60).toFixed(1) + '분 버팀'}`);
}
