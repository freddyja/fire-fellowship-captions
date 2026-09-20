import {
  DEEPL_FREE_HOST,
  DEEPL_PRO_HOST,
  deeplSourceLang,
  deeplTargetLang,
  parseDeepLResponse,
  resolveDeepLApiUrl,
} from "../src/translate/deepl.ts";
import { detectLang } from "../src/translate/detect.ts";
import { parseMyMemoryResponse, createMyMemoryTranslator, isIdentityTranslation } from "../src/translate/mymemory.ts";
import { effectiveTranslateProvider, resolveTranslateProvider, translateCaption } from "../server/translate.ts";

const offline = process.argv.includes("--offline");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return await fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function checkMockOverride() {
  await withEnv({ TRANSLATE_PROVIDER: "mymemory", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" }, async () => {
    assert(resolveTranslateProvider() === "mymemory", "env still mymemory");
    assert(effectiveTranslateProvider("mock") === "mock", "request mock wins");
    assert(effectiveTranslateProvider("deepl") === "mymemory", "client cannot force deepl");
    const result = await translateCaption(
      "Welcome brothers. Thank you for coming tonight. Let us begin.",
      "en",
      ["es", "pt"],
      { provider: "mock" },
    );
    assert(result.provider === "mock", "translateCaption honors mock override");
    assert(String(result.text.es).toLowerCase().includes("bienvenidos"), "forced mock es");
    assert(String(result.text.pt).toLowerCase().includes("irm"), "forced mock pt");
  });
}

async function checkProviderDefaults() {
  await withEnv(
    { TRANSLATE_PROVIDER: "", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "mymemory", "no keys defaults to mymemory");
    },
  );
  await withEnv(
    { TRANSLATE_PROVIDER: "deepl", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "mymemory", "deepl without key uses mymemory");
    },
  );
  await withEnv(
    { TRANSLATE_PROVIDER: "deepl", DEEPL_AUTH_KEY: "not-a-real-key:fx", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "deepl", "deepl with a key is selected");
    },
  );
  await withEnv(
    { TRANSLATE_PROVIDER: "", DEEPL_AUTH_KEY: "not-a-real-key:fx", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "deepl", "unset provider uses deepl when key present");
    },
  );
  await withEnv({ TRANSLATE_PROVIDER: "mymemory", DEEPL_AUTH_KEY: "not-a-real-key:fx" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "explicit mymemory wins");
  });
  await withEnv({ TRANSLATE_PROVIDER: "mock", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mock", "explicit mock stays offline");
  });
  await withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "google without key uses mymemory");
  });
  await withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "not-a-real-key" }, () => {
    assert(resolveTranslateProvider() === "google", "google with a key is selected");
  });
}

function checkDeepLMapping() {
  assert(deeplSourceLang("en") === "EN", "source en");
  assert(deeplSourceLang("es") === "ES", "source es");
  assert(deeplSourceLang("pt") === "PT", "source pt");
  assert(deeplTargetLang("en") === "EN-US", "target en");
  assert(deeplTargetLang("es") === "ES", "target es");
  assert(deeplTargetLang("pt") === "PT-BR", "target pt is PT-BR");
  assert(resolveDeepLApiUrl("abc:fx") === DEEPL_FREE_HOST, "free key uses free host");
  assert(resolveDeepLApiUrl("abc") === DEEPL_PRO_HOST, "pro key uses pro host");
  assert(
    resolveDeepLApiUrl("abc", "https://api-free.deepl.com/") === DEEPL_FREE_HOST,
    "explicit url wins",
  );
  assert(
    parseDeepLResponse({ translations: [{ text: "  Buenas noches  " }] }) === "Buenas noches",
    "deepl parse",
  );
  let threw = false;
  try {
    parseDeepLResponse({ message: "Quota exceeded" });
  } catch (err) {
    threw = /quota/i.test(err instanceof Error ? err.message : String(err));
  }
  assert(threw, "deepl empty body is an error");
}

function checkDetectLang() {
  assert(detectLang("Bienvenidos hermanos. Gracias por venir esta noche.", "en") === "es", "spanish overrides en hint");
  assert(detectLang("Bem-vindos irmãos. Obrigado por vir esta noite.", "en") === "pt", "portuguese overrides en hint");
  assert(detectLang("Welcome brothers. Thank you for coming tonight.", "es") === "en", "english overrides es hint");
  assert(detectLang("Bienvenidos hermanos", "es") === "es", "keep es hint");
  assert(detectLang("Welcome brothers", "en") === "en", "keep en hint");
  assert(detectLang("Amen", "es") === "es", "short shared word keeps hint");
}

async function checkMockAnyDirection() {
  const samples = [
    {
      from: "es",
      text: "Bienvenidos hermanos",
      expect: { en: /welcome|brother/i, pt: /irm/i },
    },
    {
      from: "es",
      text: "Gracias por venir esta noche",
      expect: { en: /thank|coming|tonight/i, pt: /obrigado|noite/i },
    },
    {
      from: "es",
      text: "Buenos dias hermanos",
      expect: { en: /morning|brother/i, pt: /dia|irm/i },
    },
    {
      from: "pt",
      text: "Bem-vindos irmãos",
      expect: { en: /welcome|brother/i, es: /bienvenid|herman/i },
    },
    {
      from: "pt",
      text: "Obrigado por vir esta noite",
      expect: { en: /thank|coming|tonight/i, es: /gracias|noche/i },
    },
    {
      from: "en",
      text: "Welcome brothers. Thank you for coming tonight. Let us begin.",
      expect: { es: /bienvenid|gracias|comenc/i, pt: /bem-vind|obrigado|come[cç]/i },
    },
  ];

  for (const sample of samples) {
    const result = await translateCaption(sample.text, sample.from, ["en", "es", "pt"], { provider: "mock" });
    assert(result.provider === "mock", `${sample.from} mock provider`);
    assert(result.from === sample.from, `${sample.from} source kept (${result.from})`);
    assert(String(result.text[sample.from]).toLowerCase().includes(sample.text.slice(0, 8).toLowerCase()), `${sample.from} pane keeps source`);
    for (const [to, pattern] of Object.entries(sample.expect)) {
      const value = String(result.text[to] || "");
      assert(value.trim().length > 0, `mock ${sample.from}->${to} empty`);
      assert(value.trim() !== sample.text, `mock ${sample.from}->${to} unchanged: ${value}`);
      assert(pattern.test(value), `mock ${sample.from}->${to} unexpected: ${value}`);
    }
  }

  const rescued = await translateCaption(
    "Bienvenidos hermanos. Gracias por venir esta noche.",
    "en",
    ["en", "es", "pt"],
    { provider: "mock" },
  );
  assert(rescued.from === "es", `detect spanish when from=en (got ${rescued.from})`);
  assert(/welcome|thank/i.test(String(rescued.text.en)), `rescued EN pane: ${rescued.text.en}`);
  assert(/bienvenid|gracias/i.test(String(rescued.text.es)), "rescued ES pane stays Spanish");
  assert(/irm|obrigado/i.test(String(rescued.text.pt)), `rescued PT pane: ${rescued.text.pt}`);
}

function checkMyMemoryParser() {
  assert(
    parseMyMemoryResponse({
      responseStatus: 200,
      responseData: { translatedText: "Buenas noches &amp; paz" },
    }) === "Buenas noches & paz",
    "decode entities",
  );

  let threw = false;
  try {
    parseMyMemoryResponse({
      responseStatus: 200,
      responseData: {
        translatedText: "MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY",
      },
    });
  } catch {
    threw = true;
  }
  assert(threw, "quota warning is an error");
  assert(isIdentityTranslation("Bienvenidos hermanos", "Bienvenidos hermanos"), "identity two words");
  assert(!isIdentityTranslation("amen", "amen"), "short identity is allowed");
}

async function checkLivePairs() {
  const samples = [
    { from: "en", text: "Good evening brothers", expect: { es: /noche|herman/i, pt: /noite|irm/i } },
    { from: "es", text: "Buenas noches hermanos", expect: { en: /evening|night|brother/i, pt: /noite|irm/i } },
    { from: "pt", text: "Boa noite irmaos", expect: { en: /evening|night|brother/i, es: /noche|herman/i } },
  ];
  const translator = createMyMemoryTranslator({ timeoutMs: 12000 });

  for (const sample of samples) {
    for (const [to, pattern] of Object.entries(sample.expect)) {
      const translated = await translator.translate(sample.text, sample.from, to);
      assert(translated.trim().length > 0, `${sample.from}->${to} empty`);
      assert(translated.trim() !== sample.text, `${sample.from}->${to} unchanged`);
      assert(pattern.test(translated), `${sample.from}->${to} unexpected: ${translated}`);
      console.log(`  ${sample.from}->${to}: ${translated}`);
    }
  }
}

const checks = [
  ["provider defaults", checkProviderDefaults],
  ["DeepL mapping", checkDeepLMapping],
  ["source language detect", checkDetectLang],
  ["MyMemory response parser", checkMyMemoryParser],
  ["mock request override", checkMockOverride],
  ["mock any-direction EN/ES/PT", checkMockAnyDirection],
];

for (const [name, fn] of checks) {
  await fn();
  console.log(`OK ${name}`);
}

if (offline) {
  console.log("OK skipped live MyMemory (--offline)");
} else {
  console.log("Live MyMemory EN/ES/PT fallback…");
  await checkLivePairs();
  console.log("OK live MyMemory pairs");
}
