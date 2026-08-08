// @repo/ai — agent, tools, retrieval, prompts, evals. Epics 4 and 5.
//
// What is here so far is the pure half: the functions §14 lists in the unit
// tier ("parsers, chunkers, RRF, prompt assembly") plus the groundedness
// computation PRD Q10 settled. None of it touches a database, a tenant, or a
// network, which is why it could be built before Neon exists.

export { fuse, trimToBudget, RRF_K, type Ranked, type Fused } from "./retrieval/rrf";
export { chunk, approximateTokens, type Section, type Chunk, type ChunkOptions } from "./chunking/chunk";
export {
  normalise,
  contentHash,
  isEffectivelyEmpty,
  MIN_EXTRACTED_CHARS,
} from "./chunking/normalise";
export {
  computeGroundedness,
  meetsThreshold,
  splitSentences,
  type Citation,
  type Groundedness,
  type GroundednessInput,
} from "./grounding/confidence";
