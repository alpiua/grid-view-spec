import esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [outputPath] = process.argv.slice(2);
if (!outputPath) throw new Error("expected output bundle path");

await esbuild.build({
  entryPoints: [path.join(__dirname, "browser-contract-conformance-entry.ts")],
  outfile: path.resolve(outputPath),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["chrome100"],
  legalComments: "none",
});
