import { trSeedRows } from "./tr";
import { enSeedRows } from "./en";
import { deSeedRows } from "./de";
import { ruSeedRows } from "./ru";
import { frSeedRows } from "./fr";
import { esSeedRows } from "./es";
import { itSeedRows } from "./it";
import { ptSeedRows } from "./pt";
import { nlSeedRows } from "./nl";
import { plSeedRows } from "./pl";
import { arSeedRows } from "./ar";
import { jaSeedRows } from "./ja";
import { koSeedRows } from "./ko";
import { zhCNSeedRows } from "./zh-CN";
import type { CardSeedModule } from "./types";

export const CARD_SEED_MODULES = [
  { language: "tr", rows: trSeedRows },
  { language: "en", rows: enSeedRows },
  { language: "de", rows: deSeedRows },
  { language: "ru", rows: ruSeedRows },
  { language: "fr", rows: frSeedRows },
  { language: "es", rows: esSeedRows },
  { language: "it", rows: itSeedRows },
  { language: "pt", rows: ptSeedRows },
  { language: "nl", rows: nlSeedRows },
  { language: "pl", rows: plSeedRows },
  { language: "ar", rows: arSeedRows },
  { language: "ja", rows: jaSeedRows },
  { language: "ko", rows: koSeedRows },
  { language: "zh-CN", rows: zhCNSeedRows },
] as const satisfies readonly CardSeedModule[];
