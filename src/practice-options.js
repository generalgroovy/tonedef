import {
  clone, defaultPracticeOptions, SCHEMA, stringsOf, validateProject,
} from "./model.js";
import { generate, seededRandom } from "./generator.js";
import { maskFor, mod, pcsFor, SCALE_DEFS } from "./theory.js";

export { defaultPracticeOptions, practiceOptionsProblem } from "./model.js";

const integer = (random, min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (values, random) => values[integer(random, 0, values.length - 1)];
function subset(values, count, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = integer(random, 0, index);
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result.slice(0, count).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
}

/** Generate a new practice pattern without randomizing instrument or display.
 * Fixed key/shape, count, string pool and grouping are never relaxed to make a
 * candidate succeed. Failed choices are atomic. Set advanceSeed:false to replay.
 */
export function practiceGenerate(project, { advanceSeed = true } = {}) {
  validateProject(project);
  if (typeof advanceSeed !== "boolean") throw Error("advanceSeed must be on or off.");
  const practice = project.practice ?? defaultPracticeOptions();
  const seed = advanceSeed ? project.settings.seed % 2147483646 + 1 : project.settings.seed;
  const random = seededRandom(seed);
  const eligible = stringsOf(project.settings)
    .filter(string => string.enabled && practice.stringIds.includes(string.id))
    .map(string => string.id);
  if (!eligible.length)
    throw Error("Choose at least one enabled practice string on this instrument. Nothing changed.");
  if (practice.stringsRandom && practice.stringsMin > eligible.length)
    throw Error("The random string minimum exceeds the selected enabled strings. Select more strings or lower the minimum. Nothing changed.");
  const relativeKey = pcsFor(project.settings.keyMask).map(pitch => mod(pitch - project.settings.tonic));
  const randomized = ["keyRandom", "modeRandom", "countRandom", "stringsRandom", "notesPerStringRandom"]
    .some(key => practice[key]);
  const attempts = randomized ? 32 : 1;
  let lastIssue = "";
  for (let attempt = 0; attempt < attempts; attempt++) {
    const next = clone(project), settings = next.settings;
    next.practice = clone(practice);
    settings.seed = seed;
    if (practice.keyRandom) {
      settings.tonic = integer(random, 0, 11);
      if (settings.tonic !== project.settings.tonic) settings.tonicSpelling = "auto";
    }
    if (practice.modeRandom || practice.keyRandom) {
      const intervals = practice.modeRandom ? pick(SCALE_DEFS, random).intervals : relativeKey;
      settings.keyMask = maskFor(settings.tonic, intervals);
    }
    if (practice.countRandom) settings.eventCount = integer(random, practice.countMin, practice.countMax);
    const stringIds = practice.stringsRandom
      ? subset(eligible, integer(random, practice.stringsMin, Math.min(practice.stringsMax, eligible.length)), random)
      : [...eligible];
    const notesPerString = practice.notesPerStringRandom
      ? integer(random, practice.notesPerStringMin, practice.notesPerStringMax)
      : practice.notesPerString;
    try {
      const generated = generate(next, { stringIds, notesPerString });
      return {
        project: generated,
        changed: Object.keys(SCHEMA).filter(key => generated.settings[key] !== project.settings[key]),
        choices: { tonic: settings.tonic, keyMask: settings.keyMask, eventCount: settings.eventCount, stringIds, notesPerString },
      };
    } catch (error) {
      lastIssue = error.message;
    }
  }
  if (!randomized) throw Error(lastIssue);
  throw Error(`No practice pattern fits after ${attempts} bounded random choices. ${lastIssue} Keep more choices fixed or widen the allowed ranges. Nothing changed.`);
}
