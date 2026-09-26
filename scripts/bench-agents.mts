// Dev tool: run agents directly against a photo and print latency + output.
//   npm run bench -- <photo.jpg> [spotter|explainer|researcher|all] [searchTool] [thinking] [effort] [strict|nostrict]
import { readFileSync } from "node:fs";

process.loadEnvFile(".env.local");

const { runSpotter } = await import("../lib/agents/spotter");
const { runExplainer } = await import("../lib/agents/explainer");
const { runResearcher } = await import("../lib/agents/researcher");
type Opts = import("../lib/agents/researcher").ResearcherOptions;

const [photo, which = "all", searchTool, thinking, effort, strictArg] = process.argv.slice(2);
const image = { base64: readFileSync(photo).toString("base64"), mediaType: "image/jpeg" as const };
const signal = AbortSignal.timeout(120_000);

async function time<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    const out = await fn();
    console.log(`\n=== ${label}: ${((Date.now() - t) / 1000).toFixed(1)}s`);
    console.log(JSON.stringify(out, null, 2));
    return out;
  } catch (err) {
    console.log(`\n=== ${label}: FAILED after ${((Date.now() - t) / 1000).toFixed(1)}s`, err);
    throw err;
  }
}

const spotter = await time("spotter", () => runSpotter(image, signal));
if (which === "spotter") process.exit(0);

const researcherOpts: Opts = {
  searchTool: searchTool as Opts["searchTool"],
  thinking: thinking as Opts["thinking"],
  effort: effort as Opts["effort"],
  strict: strictArg ? strictArg === "strict" : undefined,
  onLog: (m) => console.log(`  · ${m}`),
  onPreview: (p) => console.log(`  · PREVIEW ${JSON.stringify(p)}`),
};
for (const k of Object.keys(researcherOpts) as (keyof Opts)[]) if (researcherOpts[k] === undefined) delete researcherOpts[k];

await Promise.all([
  which === "all" || which === "explainer" ? time("explainer", () => runExplainer(image, spotter, signal)) : null,
  which === "all" || which === "researcher"
    ? time(`researcher ${JSON.stringify({ ...researcherOpts, onLog: undefined, onPreview: undefined })}`, () =>
        runResearcher(spotter, signal, researcherOpts),
      )
    : null,
]);
