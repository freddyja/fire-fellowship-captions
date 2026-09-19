import {
  DEEPL_FREE_HOST,
  DEEPL_PRO_HOST,
  deeplSourceLang,
  deeplTargetLang,
  parseDeepLResponse,
  resolveDeepLApiUrl,
} from "../src/translate/deepl.ts";
import { parseMyMemoryResponse, createMyMemoryTranslator } from "../src/translate/mymemory.ts";
import { resolveTranslateProvider } from "../server/translate.ts";

const offline = process.argv.includes("--offline");

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

function withEnv(overrides, fn) {
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function checkProviderDefaults() {
  withEnv(
    { TRANSLATE_PROVIDER: "", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "mymemory", "no keys defaults to mymemory");
    },
  );
  withEnv(
    { TRANSLATE_PROVIDER: "deepl", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "mymemory", "deepl without key uses mymemory");
    },
  );
  withEnv(
    { TRANSLATE_PROVIDER: "deepl", DEEPL_AUTH_KEY: "not-a-real-key:fx", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "deepl", "deepl with a key is selected");
    },
  );
  withEnv(
    { TRANSLATE_PROVIDER: "", DEEPL_AUTH_KEY: "not-a-real-key:fx", GOOGLE_TRANSLATE_API_KEY: "" },
    () => {
      assert(resolveTranslateProvider() === "deepl", "unset provider uses deepl when key present");
    },
  );
  withEnv({ TRANSLATE_PROVIDER: "mymemory", DEEPL_AUTH_KEY: "not-a-real-key:fx" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "explicit mymemory wins");
  });
  withEnv({ TRANSLATE_PROVIDER: "mock", DEEPL_AUTH_KEY: "", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mock", "explicit mock stays offline");
  });
  withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "google without key uses mymemory");
  });
  withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "not-a-real-key" }, () => {
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
  ["MyMemory response parser", checkMyMemoryParser],
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
