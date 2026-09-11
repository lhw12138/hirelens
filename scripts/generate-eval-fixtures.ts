import { mkdir,writeFile } from "node:fs/promises";
import { buildSyntheticEvalDataset,EVAL_DATASET } from "../src/lib/eval-fixtures";
async function main(){
  await mkdir(new URL("../data/",import.meta.url),{recursive:true});
  const cases=buildSyntheticEvalDataset();
  await writeFile(new URL("../data/eval-dataset-v1.json",import.meta.url),JSON.stringify({...EVAL_DATASET,cases},null,2));
  console.info(`Generated ${cases.length} synthetic evaluation cases.`);
}
main().catch((error)=>{console.error(error);process.exit(1)});
