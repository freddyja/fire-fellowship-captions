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
  withEnv({ TRANSLATE_PROVIDER: "", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "unset defaults to mymemory");
  });
  withEnv({ TRANSLATE_PROVIDER: "mymemory", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "explicit mymemory");
  });
  withEnv({ TRANSLATE_PROVIDER: "mock", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mock", "explicit mock stays offline");
  });
  withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "" }, () => {
    assert(resolveTranslateProvider() === "mymemory", "google without key uses mymemory");
  });
  withEnv({ TRANSLATE_PROVIDER: "google", GOOGLE_TRANSLATE_API_KEY: "not-a-real-key" }, () => {
    assert(resolveTranslateProvider() === "google", "google with a key is selected");
  });
}

function checkParser() {
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

  threw = false;
  try {
    parseMyMemoryResponse({ responseStatus: 403, quotaFinished: true, responseDetails: "quota" });
  } catch (err) {
    threw = /quota/i.test(err instanceof Error ? err.message : String(err));
  }
  assert(threw, "quotaFinished is an error");
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
  ["MyMemory response parser", checkParser],
];

for (const [name, fn] of checks) {
  await fn();
  console.log(`OK ${name}`);
}

if (offline) {
  console.log("OK skipped live MyMemory (--offline)");
} else {
  console.log("Live MyMemory EN/ES/PT…");
  await checkLivePairs();
  console.log("OK live MyMemory pairs");
}
