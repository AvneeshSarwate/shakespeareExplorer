import fs from 'fs';
import path from 'path';

type CsvRow = {
  index: number;
  play_name: string;
  genre: string;
  character: string;
  act: number;
  scene: number;
  sentence: number;
  text: string;
  sex: string | null;
};

type Line = {
  globalIndex: number;
  sentence: number;
  character: string;
  sex: string | null;
  text: string;
};

type Scene = { number: number; lines: Line[] };
type Act = { number: number; scenes: Scene[] };
type CharacterSummary = { name: string; sex: string | null };
type Play = {
  id: string;
  name: string;
  genre: string;
  characters: CharacterSummary[];
  acts: Act[];
};

type Output = { plays: Play[] };

// Minimal CSV parser that handles quoted fields with commas.
function parseCsvLine(line: string): string[] {
  const res: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        res.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  res.push(current);
  return res;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function readCsv(filePath: string): CsvRow[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return [];
  // Header appears to start with an empty first header for the index column
  const header = parseCsvLine(lines[0]);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 9) continue; // skip malformed
    const [idx, play_name, genre, character, act, scene, sentence, text, sex] = cols;
    const row: CsvRow = {
      index: Number(idx),
      play_name,
      genre,
      character,
      act: Number(act),
      scene: Number(scene),
      sentence: Number(sentence),
      text,
      sex: sex ? sex : null,
    };
    rows.push(row);
  }
  return rows;
}

function buildHierarchy(rows: CsvRow[]): Output {
  // Group by play
  const playsMap = new Map<string, Play>();
  // Track characters and last-seen sex per play
  const playChars = new Map<string, Map<string, string | null>>();

  for (const r of rows) {
    const playId = toSlug(r.play_name);
    if (!playsMap.has(playId)) {
      playsMap.set(playId, {
        id: playId,
        name: r.play_name,
        genre: r.genre,
        characters: [],
        acts: [],
      });
      playChars.set(playId, new Map());
    }
    const play = playsMap.get(playId)!;
    const chars = playChars.get(playId)!;

    // Character registry
    if (!chars.has(r.character)) {
      chars.set(r.character, r.sex ?? null);
    } else if (r.sex && !chars.get(r.character)) {
      chars.set(r.character, r.sex);
    }

    // Find or create act
    let act = play.acts.find(a => a.number === r.act);
    if (!act) {
      act = { number: r.act, scenes: [] };
      play.acts.push(act);
    }
    // Find or create scene
    let scene = act.scenes.find(s => s.number === r.scene);
    if (!scene) {
      scene = { number: r.scene, lines: [] };
      act.scenes.push(scene);
    }
    // Push line
    scene.lines.push({
      globalIndex: r.index,
      sentence: r.sentence,
      character: r.character,
      sex: r.sex ?? null,
      text: r.text,
    });
  }

  // Sort acts, scenes, lines, and populate characters
  const plays: Play[] = [];
  for (const play of playsMap.values()) {
    play.acts.sort((a, b) => a.number - b.number);
    for (const a of play.acts) {
      a.scenes.sort((s1, s2) => s1.number - s2.number);
      for (const s of a.scenes) {
        s.lines.sort((l1, l2) => l1.sentence - l2.sentence);
      }
    }
    const chars = playChars.get(play.id)!;
    play.characters = Array.from(chars.entries())
      .map(([name, sex]) => ({ name, sex }))
      .sort((c1, c2) => c1.name.localeCompare(c2.name));
    plays.push(play);
  }

  // Sort plays by name
  plays.sort((p1, p2) => p1.name.localeCompare(p2.name));
  return { plays };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  const csvPath = path.resolve(process.cwd(), 'shakespeare_plays.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found at', csvPath);
    process.exit(1);
  }
  const rows = readCsv(csvPath);
  const output = buildHierarchy(rows);
  const outDir = path.resolve(process.cwd(), 'data');
  ensureDir(outDir);
  const outPath = path.join(outDir, 'plays.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log('Wrote', outPath);
}

main();

