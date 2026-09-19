import { foldText } from "./dom";
import type { Lang, Localized, TopicContent } from "./types";

type TopicSeed = TopicContent & { keywords: string[] };

const CUSTOM_PROMPT: Localized = {
  en: "Talk this through together. What does Scripture say, and how do we live it this week?",
  es: "Háblenlo juntos. ¿Qué dice la Escritura, y cómo lo vivimos esta semana?",
  pt: "Conversem juntos. O que a Escritura diz, e como vivemos isso nesta semana?",
};

const TOPICS: TopicSeed[] = [
  {
    id: "brotherhood",
    keywords: ["iron", "friend", "friends", "brother", "brothers", "sharpen"],
    title: { en: "Brotherhood", es: "Hermandad", pt: "Irmandade" },
    reference: "Proverbs 27:17",
    verse: {
      en: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend.",
      es: "Hierro con hierro se aguza; y así el hombre aguza el rostro de su amigo.",
      pt: "Como o ferro com o ferro se aguça, assim o homem afia o rosto do seu amigo.",
    },
    prompt: {
      en: "Who is sharpening you — and whom are you sharpening?",
      es: "¿Quién te está aguzando, y a quién estás aguzando tú?",
      pt: "Quem está afiando você — e a quem você está afiando?",
    },
  },
  {
    id: "integrity",
    keywords: ["honest", "honesty", "character", "walk"],
    title: { en: "Integrity", es: "Integridad", pt: "Integridade" },
    reference: "Proverbs 10:9",
    verse: {
      en: "He that walketh uprightly walketh surely: but he that perverteth his ways shall be known.",
      es: "El que camina en integridad anda confiado; mas el que pervierte sus caminos será quebrantado.",
      pt: "Quem anda em integridade anda seguro, mas o que perverte os seus caminhos será conhecido.",
    },
    prompt: {
      en: "Where is it hardest this week to walk the same in private as in public?",
      es: "¿Dónde te cuesta más esta semana ser el mismo en privado que en público?",
      pt: "Onde está mais difícil nesta semana ser o mesmo em privado e em público?",
    },
  },
  {
    id: "courage",
    keywords: ["fear", "afraid", "strong", "joshua"],
    title: { en: "Courage", es: "Valor", pt: "Coragem" },
    reference: "Joshua 1:9",
    verse: {
      en: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the Lord thy God is with thee whithersoever thou goest.",
      es: "Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo en dondequiera que fueres.",
      pt: "Não to mandei eu? Esforça-te, e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor teu Deus é contigo, por onde quer que andares.",
    },
    prompt: {
      en: "What are you facing that needs courage instead of retreat?",
      es: "¿Qué estás enfrentando que pide valor en vez de retirarte?",
      pt: "O que você está enfrentando que pede coragem em vez de recuar?",
    },
  },
  {
    id: "work",
    keywords: ["job", "labor", "labour", "diligence", "workplace"],
    title: { en: "Work", es: "El trabajo", pt: "O trabalho" },
    reference: "Colossians 3:23",
    verse: {
      en: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men.",
      es: "Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres.",
      pt: "E tudo quanto fizerdes, fazei-o de todo o coração, como ao Senhor, e não aos homens.",
    },
    prompt: {
      en: "How would your work change if it were offered to the Lord first?",
      es: "¿Cómo cambiaría tu trabajo si primero se lo ofrecieras al Señor?",
      pt: "Como o seu trabalho mudaria se fosse oferecido primeiro ao Senhor?",
    },
  },
  {
    id: "self-control",
    keywords: ["anger", "temper", "patience", "slow"],
    title: { en: "Self-control", es: "Dominio propio", pt: "Domínio próprio" },
    reference: "Proverbs 16:32",
    verse: {
      en: "He that is slow to anger is better than the mighty; and he that ruleth his spirit than he that taketh a city.",
      es: "Mejor es el que tarda en airarse que el fuerte; y el que se enseñorea de su espíritu, que el que toma una ciudad.",
      pt: "Melhor é o longânimo do que o valente, e o que governa o seu espírito do que o que toma uma cidade.",
    },
    prompt: {
      en: "Where did your spirit run ahead of you this week?",
      es: "¿Dónde se te adelantó el genio esta semana?",
      pt: "Onde o seu espírito foi na frente nesta semana?",
    },
  },
  {
    id: "forgiveness",
    keywords: ["forgive", "mercy", "bitterness", "grace"],
    title: { en: "Forgiveness", es: "Perdón", pt: "Perdão" },
    reference: "Ephesians 4:32",
    verse: {
      en: "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you.",
      es: "Antes sed benignos unos con otros, misericordiosos, perdonándoos unos a otros, como Dios también os perdonó a vosotros en Cristo.",
      pt: "Antes sede uns para com os outros benignos, misericordiosos, perdoando-vos uns aos outros, como também Deus vos perdoou em Cristo.",
    },
    prompt: {
      en: "Who do you still need to release — and what would kindness look like?",
      es: "¿A quién todavía necesitas soltar, y cómo se vería la bondad?",
      pt: "A quem você ainda precisa soltar — e como seria a bondade?",
    },
  },
  {
    id: "humility",
    keywords: ["proud", "pride", "others", "lowly"],
    title: { en: "Humility", es: "Humildad", pt: "Humildade" },
    reference: "Philippians 2:3",
    verse: {
      en: "Let nothing be done through strife or vainglory; but in lowliness of mind let each esteem other better than themselves.",
      es: "Nada hagáis por contienda o por vanagloria; antes bien con humildad, estimando cada uno a los demás como superiores a él mismo.",
      pt: "Nada façais por contenda ou por vanglória, mas por humildade; cada um considere os outros superiores a si mesmo.",
    },
    prompt: {
      en: "Where can you put another man ahead of your own name this week?",
      es: "¿Dónde puedes poner a otro delante de tu propio nombre esta semana?",
      pt: "Onde você pode colocar outro homem à frente do seu próprio nome nesta semana?",
    },
  },
  {
    id: "accountability",
    keywords: ["alone", "together", "two", "ecclesiastes"],
    title: { en: "Accountability", es: "Rendición de cuentas", pt: "Prestação de contas" },
    reference: "Ecclesiastes 4:9-10",
    verse: {
      en: "Two are better than one; because they have a good reward for their labour. For if they fall, the one will lift up his fellow.",
      es: "Mejores son dos que uno; porque tienen mejor paga de su trabajo. Porque si cayeren, el uno levantará a su compañero.",
      pt: "Melhor é serem dois do que um, porque têm melhor paga do seu trabalho. Porque se um cair, o outro levanta o seu companheiro.",
    },
    prompt: {
      en: "Who is allowed to pick you up — and have you told him the truth?",
      es: "¿Quién tiene permiso de levantarte, y le has dicho la verdad?",
      pt: "Quem tem permissão de te levantar — e você já lhe disse a verdade?",
    },
  },
  {
    id: "servant-leadership",
    keywords: ["serve", "servant", "leader", "leadership", "great"],
    title: { en: "Servant leadership", es: "Liderazgo que sirve", pt: "Liderança que serve" },
    reference: "Mark 10:45",
    verse: {
      en: "For even the Son of man came not to be ministered unto, but to minister, and to give his life a ransom for many.",
      es: "Porque el Hijo del Hombre no vino para ser servido, sino para servir, y para dar su vida en rescate por muchos.",
      pt: "Porque o Filho do homem também não veio para ser servido, mas para servir e dar a sua vida em resgate de muitos.",
    },
    prompt: {
      en: "Where can you lead by serving, not by being seen?",
      es: "¿Dónde puedes liderar sirviendo, no buscando ser visto?",
      pt: "Onde você pode liderar servindo, e não buscando ser visto?",
    },
  },
  {
    id: "faith-trials",
    keywords: ["trial", "trials", "testing", "patience", "james"],
    title: { en: "Faith in trials", es: "Fe en las pruebas", pt: "Fé nas provações" },
    reference: "James 1:2-3",
    verse: {
      en: "My brethren, count it all joy when ye fall into divers temptations; knowing this, that the trying of your faith worketh patience.",
      es: "Hermanos míos, tened por sumo gozo cuando os halléis en diversas pruebas, sabiendo que la prueba de vuestra fe produce paciencia.",
      pt: "Meus irmãos, tende por motivo de grande gozo o passardes por várias provações, sabendo que a prova da vossa fé produz a paciência.",
    },
    prompt: {
      en: "What trial is training your faith right now — and where is the joy in it?",
      es: "¿Qué prueba está entrenando tu fe ahora, y dónde está el gozo en ella?",
      pt: "Que provação está treinando a sua fé agora — e onde está o gozo nisso?",
    },
  },
];

export const TOPIC_LIST: TopicContent[] = TOPICS.map((topic) => ({
  id: topic.id,
  title: topic.title,
  reference: topic.reference,
  verse: topic.verse,
  prompt: topic.prompt,
}));

export function topicById(id: string): TopicContent | undefined {
  return TOPIC_LIST.find((topic) => topic.id === id);
}

export function localized(value: Localized, lang: Lang): string {
  return value[lang]?.trim() || value.en;
}

export function customTopic(title: string): TopicContent {
  const trimmed = title.trim();
  return {
    id: "custom",
    title: { en: trimmed, es: trimmed, pt: trimmed },
    reference: "",
    verse: { en: "", es: "", pt: "" },
    prompt: CUSTOM_PROMPT,
  };
}

export function resolveTopic(input: string): TopicContent | null {
  const q = foldText(input);
  if (!q) return null;

  const scored = TOPICS.map((topic) => {
    const hay = foldText(
      [topic.id, topic.reference, ...Object.values(topic.title), ...topic.keywords].join(" "),
    );
    let score = 0;
    if (foldText(topic.reference) === q) score = 100;
    else if (Object.values(topic.title).some((title) => foldText(title) === q)) score = 90;
    else if (hay.includes(q)) score = 40 + Math.min(q.length, 20);
    else if (q.split(" ").every((word) => word.length > 2 && hay.includes(word))) score = 30;
    return { topic, score };
  }).filter((row) => row.score > 0);

  scored.sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score >= 30) {
    return topicById(scored[0].topic.id) ?? customTopic(input);
  }
  return customTopic(input);
}

export function hasTopicBody(topic: TopicContent | null | undefined): boolean {
  return Boolean(topic?.title.en?.trim());
}
