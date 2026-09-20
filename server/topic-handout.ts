import { foldText } from "../src/dom.ts";
import { resolveTopic } from "../src/topics.ts";
import type { TopicContent } from "../src/types.ts";
import {
  DEFAULT_SCRIPTURE,
  SCRIPTURE_CATALOG,
  type ScriptureEntry,
  type ScriptureTheme,
} from "./scripture-catalog.ts";

export type TopicProvider = "seed" | "openai" | "offline";

export function configuredTopicProvider(): "openai" | "offline" {
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "offline";
}

export function displayTitle(query: string): string {
  const small = new Set(["of", "the", "and", "a", "an", "in", "to", "for", "on", "at"]);
  return query
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && small.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function slug(query: string): string {
  return foldText(query).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "topic";
}

function enOnly(text: string) {
  return { en: text, es: "", pt: "" };
}

function scoreScripture(query: string, entry: ScriptureEntry): number {
  const q = foldText(query);
  const hay = foldText([entry.id, entry.reference, ...entry.keywords].join(" "));
  if (foldText(entry.reference) === q) return 100;
  if (hay.includes(q)) return 55 + Math.min(q.length, 20);
  const words = q.split(" ").filter((word) => word.length > 2 && word !== "the" && word !== "and");
  if (!words.length) return 0;
  const hits = words.filter((word) => hay.includes(word)).length;
  if (!hits) return 0;
  return (hits / words.length) * 40 + hits * 6;
}

export function pickScripture(query: string): ScriptureEntry {
  const ranked = SCRIPTURE_CATALOG.map((entry) => ({ entry, score: scoreScripture(query, entry) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score >= 18 ? ranked[0].entry : DEFAULT_SCRIPTURE;
}

function pickVariant<T>(items: T[], seed: string): T {
  let n = 0;
  for (const ch of seed) n = (n + ch.charCodeAt(0)) % 997;
  return items[n % items.length];
}

type Teaching = { hook: string; body: string; questions: [string, string] };

function teachingFor(title: string, entry: ScriptureEntry): Teaching {
  const { reference, theme } = entry;
  const bank = TEMPLATES[theme];
  return pickVariant(bank, title + reference)(title, reference);
}

const TEMPLATES: Record<ScriptureTheme, Array<(topic: string, ref: string) => Teaching>> = {
  home: [
    (topic, ref) => ({
      hook: "Head of the house is not a throne. It is a towel.",
      body: `${ref} does not hand a man a louder voice. It hands him Christ's pattern: love that spends itself.\n\nBrothers, ${topic.toLowerCase()} is weight before it is title. The house already knows whether you lead by serving or by being served.\n\nPrivilege without the cross turns a living room into a courtroom. Love that looks like Jesus will cost you the last word, the extra hour, and the right to stay bitter.\n\nYou do not have to wait until the house is easy to start leading it well. Start where you are actually walking tonight.`,
      questions: [
        `Where have you been claiming ${topic.toLowerCase()} as rank instead of as a charge to love?`,
        "Who in your house would say you looked like Christ this month — and who would hesitate?",
      ],
    }),
    (topic, ref) => ({
      hook: "Your house will follow the god you actually serve, not the one you name on Sunday.",
      body: `${ref} puts the choice on the table. ${topic} is not a mood in the hallway. It is a decision the people under your roof can see.\n\nMost of us want the fruit of a faithful house without the daily yes. We outsource the altar to a sermon and keep our own habits.\n\nBrothers, nobody drifts into a house that serves the Lord. Drift goes the other way.\n\nName the small obedience this week — a word, a pause, a prayer at the table — and do it where they can watch.`,
      questions: [
        `What does your house already know you serve, besides what you say about ${topic.toLowerCase()}?`,
        "What is one concrete yes you can put on the calendar before you leave this room?",
      ],
    }),
  ],
  mercy: [
    (topic, ref) => ({
      hook: "You do not forgive because they earned it. You forgive because you didn't.",
      body: `${ref} will not let ${topic.toLowerCase()} stay theoretical. The Father has already closed your case in Christ.\n\nBitterness feels like justice we get to keep. It is a prison we carry. Releasing a man does not rewrite what he did. It refuses to let his sin be the lord of your spirit.\n\nBrothers, some of us have been rehearsing a case for years. Kindness is not weakness. It is the overflow of being forgiven.\n\nWhat would mercy look like in the room you cannot avoid this week?`,
      questions: [
        `Who do you still need to release as you talk about ${topic.toLowerCase()}?`,
        "Where has bitterness been posing as wisdom in your house?",
      ],
    }),
  ],
  character: [
    (topic, ref) => ({
      hook: "The safest walk is the one that does not need a cover story.",
      body: `${ref} is not a brand. ${topic} is the same man in the hallway, in the truck, and on the phone when nobody from church is listening.\n\nA split life feels clever until it is known. Scripture says it will be. The cover costs more than the confession ever would.\n\nBrothers, the Lord already sees the side road. Walking uprightly is not about looking clean. It is about being one man.\n\nName the place this week where the private walk and the public walk do not match.`,
      questions: [
        `Where is ${topic.toLowerCase()} hardest for you when nobody is watching?`,
        "What would it cost you — and what would it free — to tell the truth there?",
      ],
    }),
    (topic, ref) => ({
      hook: "Courage is not the absence of fear. It is obedience with your knees shaking.",
      body: `${ref} does not wait for a better feeling. ${topic} is often an order from the God who is already on the other side of what you are avoiding.\n\nFear still talks. It always will. The question is whether fear gets the last word.\n\nBrothers, retreat can look like wisdom when it is just unbelief with a plan.\n\nWhere is God sending you that you keep postponing?`,
      questions: [
        `What are you facing that needs ${topic.toLowerCase()} instead of retreat?`,
        "Where have you been calling fear a plan?",
      ],
    }),
  ],
  trial: [
    (topic, ref) => ({
      hook: "Joy is not the trial. Joy is knowing what the trial is making.",
      body: `${ref} does not say the pain is fun. It says do the math. ${topic} is often the workshop where God finishes a man's patience.\n\nWe want the lesson without the weight. He often trains the man by the thing he would have scheduled last.\n\nBrothers, the weight in front of you is not proof that God left.\n\nAsk what this is producing that comfort never could.`,
      questions: [
        `What about ${topic.toLowerCase()} is training your faith right now?`,
        "What is this test trying to produce in you that an easy week never could?",
      ],
    }),
  ],
  work: [
    (topic, ref) => ({
      hook: "Your real boss is not on the org chart.",
      body: `${ref} was written to men whose work was often unseen or owned by someone else. ${topic} does not wait for a better job before it becomes worship.\n\nHeartily does not mean louder. It means the whole man — the email, the wrench, the night shift — offered to the Lord first.\n\nBrothers, a half-hearted job can hide a half-hearted faith.\n\nIf Jesus signed the timesheet, what would change on Monday?`,
      questions: [
        `How would ${topic.toLowerCase()} change if it were offered to the Lord first?`,
        "Where have you been working for applause instead of for Christ?",
      ],
    }),
  ],
  holiness: [
    (topic, ref) => ({
      hook: "Holiness is not a vibe. It is a direction you flee and a people you run with.",
      body: `${ref} will not let ${topic.toLowerCase()} stay private. The will of God has a body, a screen, and a history.\n\nBrothers, you do not negotiate with lust. You leave the room, you tell a brother, and you fill the space with something that can live in the light.\n\nSecret strength is usually just unconfessed weakness.\n\nPurity is not the absence of desire. It is a man who has a Master besides his appetite.`,
      questions: [
        `Where is ${topic.toLowerCase()} still living in the dark?`,
        "Who already has permission to ask you the real question this week?",
      ],
    }),
  ],
  faith: [
    (topic, ref) => ({
      hook: "Peace is not the prize at the end of the checklist. It is a Person you tell the truth to.",
      body: `${ref} will not let ${topic.toLowerCase()} stay in your head. Prayer is how a man stops carrying what was never his to finish.\n\nMost of us live on a condition. When the money lands. When the house quiets. We put our peace on layaway.\n\nBrothers, God is not waiting for your circumstances to improve before He keeps you.\n\nName the care you are still clutching, and put it where ${ref} said to put it.`,
      questions: [
        `Where are you waiting on circumstances before ${topic.toLowerCase()} can be real?`,
        "What care are you still carrying that you have not actually handed over?",
      ],
    }),
  ],
  brotherhood: [
    (topic, ref) => ({
      hook: "A dull man is usually a lonely man.",
      body: `${ref} does not happen from across the room. ${topic} needs friction — honest words, shared prayer, a brother who will not let you stay soft.\n\nA compliment is easy. A true word that sends you back to the Lord is costly, and it is a gift.\n\nBrothers, secrecy is not strength. If no one knows where you are actually walking, you are already alone.\n\nWho has permission to grind on you — and whose blade are you willing to take?`,
      questions: [
        `Who is walking ${topic.toLowerCase()} with you — and whom are you sharpening?`,
        "What honest word have you been avoiding because it would cost you comfort?",
      ],
    }),
  ],
  speech: [
    (topic, ref) => ({
      hook: "Your mouth is not a release valve. It is a ministry.",
      body: `${ref} will not let ${topic.toLowerCase()} be “just how I talk.” Words build a house or tear one down, and the people nearest you already know which.\n\nSlow to speak is not soft. It is a man who has a master besides his mood.\n\nBrothers, the next ten seconds after you are provoked may be the whole sermon your son hears this week.\n\nAsk whether grace could use your mouth before you fill the silence.`,
      questions: [
        `Where did ${topic.toLowerCase()} run ahead of you this week?`,
        "What would a grace-giving sentence sound like in the room you usually scorch?",
      ],
    }),
  ],
  wisdom: [
    (topic, ref) => ({
      hook: "Hearing without doing is a way to lie to yourself.",
      body: `${ref} will not let ${topic.toLowerCase()} stay in the notes app. A man can love a verse and never let it touch Tuesday.\n\nWe lean on our own understanding because it is faster. Then we call the wreck “complicated.”\n\nBrothers, the Word is already a lamp. The question is whether your feet will move.\n\nPick one obedience you already know, and do it before you ask for a new word.`,
      questions: [
        `What part of ${topic.toLowerCase()} do you already know and still have not done?`,
        "Where have you been leaning on your own understanding this month?",
      ],
    }),
  ],
};

function toTopic(query: string, entry: ScriptureEntry, teaching: Teaching, titleOverride?: string): TopicContent {
  const title = titleOverride?.trim() || displayTitle(query);
  return {
    id: `asked-${slug(query)}`,
    title: enOnly(title),
    reference: entry.reference,
    verse: enOnly(entry.kjv),
    hook: enOnly(teaching.hook),
    body: enOnly(teaching.body),
    discussionQuestions: teaching.questions.map((item) => enOnly(item)),
    prompt: enOnly(teaching.questions[0]),
  };
}

export function generateOffline(query: string): TopicContent {
  const entry = pickScripture(query);
  return toTopic(query, entry, teachingFor(displayTitle(query), entry));
}

function catalogById(id: string): ScriptureEntry | undefined {
  return SCRIPTURE_CATALOG.find((entry) => entry.id === id);
}

type ModelSheet = {
  verseId?: unknown;
  title?: unknown;
  hook?: unknown;
  body?: unknown;
  questions?: unknown;
};

async function generateWithOpenAI(query: string): Promise<TopicContent | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  const catalog = SCRIPTURE_CATALOG.map(
    (entry) => `${entry.id} | ${entry.reference} | ${entry.kjv} | ${entry.keywords.slice(0, 6).join(", ")}`,
  ).join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write short men's fellowship handouts. Faithful, practical, not preachy. Return JSON only: verseId (must be from the catalog), title, hook (one punchy sentence), body (3-4 short paragraphs separated by blank lines), questions (array of exactly 2). Never invent or rewrite verse text. Never mention being an AI.",
          },
          {
            role: "user",
            content: `Topic request: ${query}\n\nPick one verseId from this KJV catalog:\n${catalog}`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = payload.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ModelSheet;
    const entry = typeof parsed.verseId === "string" ? catalogById(parsed.verseId) : undefined;
    const picked = entry ?? pickScripture(query);
    const title = typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : displayTitle(query);
    const hook = typeof parsed.hook === "string" ? parsed.hook.trim() : "";
    const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 3)
      : [];
    if (!hook || !body || questions.length < 2) return null;
    return toTopic(query, picked, { hook, body, questions: [questions[0], questions[1]] }, title);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function generateTopicHandout(
  query: string,
): Promise<{ topic: TopicContent; provider: TopicProvider }> {
  const trimmed = query.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!trimmed) {
    throw Object.assign(new Error("query required"), { status: 400 });
  }

  const seed = resolveTopic(trimmed);
  if (seed && seed.id !== "custom" && seed.reference) {
    return { topic: seed, provider: "seed" };
  }

  if (configuredTopicProvider() === "openai") {
    const topic = await generateWithOpenAI(trimmed);
    if (topic) return { topic, provider: "openai" };
  }

  return { topic: generateOffline(trimmed), provider: "offline" };
}
