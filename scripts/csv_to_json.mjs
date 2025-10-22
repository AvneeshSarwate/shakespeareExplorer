import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

function toSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function readCsv(filePath) {
  const rows = [];
  const parser = fs
    .createReadStream(filePath)
    .pipe(
      parse({
        relax_quotes: true,
        relax_column_count: true,
        bom: true,
        columns: false,
        trim: true,
      })
    );
  let isHeader = true;
  for await (const record of parser) {
    if (isHeader) {
      isHeader = false; // skip header row
      continue;
    }
    if (!record || record.length < 9) continue;
    const [idx, play_name, genre, character, act, scene, sentence, text, sex] = record;
    // Coerce and validate numerics; skip bad rows instead of throwing
    const numIdx = Number(idx);
    const numAct = Number(act);
    const numScene = Number(scene);
    const numSentence = Number(sentence);
    if (!Number.isFinite(numIdx) || !Number.isFinite(numAct) || !Number.isFinite(numScene) || !Number.isFinite(numSentence)) {
      continue;
    }
    rows.push({
      index: numIdx,
      play_name,
      genre,
      character,
      act: numAct,
      scene: numScene,
      sentence: numSentence,
      text,
      sex: sex ? sex : null,
    });
  }
  return rows;
}

function buildHierarchy(rows) {
  const playsMap = new Map();
  const playChars = new Map();
  for (const r of rows) {
    const playId = toSlug(r.play_name);
    if (!playsMap.has(playId)) {
      playsMap.set(playId, { id: playId, name: r.play_name, genre: r.genre, characters: [], acts: [] });
      playChars.set(playId, new Map());
    }
    const play = playsMap.get(playId);
    const chars = playChars.get(playId);
    if (!chars.has(r.character)) chars.set(r.character, r.sex ?? null);
    else if (r.sex && !chars.get(r.character)) chars.set(r.character, r.sex);
    let act = play.acts.find(a => a.number === r.act);
    if (!act) { act = { number: r.act, scenes: [] }; play.acts.push(act); }
    let scene = act.scenes.find(s => s.number === r.scene);
    if (!scene) { scene = { number: r.scene, lines: [] }; act.scenes.push(scene); }
    scene.lines.push({
      globalIndex: r.index,
      sentence: r.sentence,
      character: r.character,
      sex: r.sex ?? null,
      text: r.text,
    });
  }
  const plays = [];
  for (const play of playsMap.values()) {
    play.acts.sort((a, b) => a.number - b.number);
    for (const a of play.acts) {
      a.scenes.sort((s1, s2) => s1.number - s2.number);
      for (const s of a.scenes) s.lines.sort((l1, l2) => l1.sentence - l2.sentence);
    }
    const chars = playChars.get(play.id);
    play.characters = Array.from(chars.entries()).map(([name, sex]) => ({ name, sex })).sort((c1, c2) => c1.name.localeCompare(c2.name));
    plays.push(play);
  }
  plays.sort((p1, p2) => p1.name.localeCompare(p2.name));
  return { plays };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const csvPath = path.resolve(process.cwd(), 'shakespeare_plays.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found at', csvPath);
    process.exit(1);
  }
  const rows = await readCsv(csvPath);
  const output = buildHierarchy(rows);
  const targetDirs = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), 'public/data'),
  ];
  const payload = JSON.stringify(output, null, 2);
  for (const dir of targetDirs) {
    ensureDir(dir);
    const outPath = path.join(dir, 'plays.json');
    fs.writeFileSync(outPath, payload, 'utf8');
    console.log('Wrote', outPath);
  }
}

main();
