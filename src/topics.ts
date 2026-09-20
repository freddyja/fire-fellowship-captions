import { foldText } from "./dom.ts";
import type { Lang, Localized, TopicContent } from "./types.ts";

type TopicSeed = TopicContent & { keywords: string[] };

const CUSTOM_PROMPT: Localized = {
  en: "Talk this through together. What does Scripture say, and how do we live it this week?",
  es: "Háblenlo juntos. ¿Qué dice la Escritura, y cómo lo vivimos esta semana?",
  pt: "Conversem juntos. O que a Escritura diz, e como vivemos isso nesta semana?",
};

function en(text: string): Localized {
  return { en: text, es: "", pt: "" };
}

function copy(enText: string, es: string, pt: string): Localized {
  return { en: enText, es, pt };
}

const EMPTY: Localized = { en: "", es: "", pt: "" };

const TOPICS: TopicSeed[] = [
  {
    id: "contentment",
    keywords: ["content", "contentment", "philippians", "plenty", "hunger", "prison"],
    title: { en: "Contentment", es: "Contentamiento", pt: "Contentamento" },
    reference: "Philippians 4:11-12",
    verse: copy(
      "I am not saying this because I am in need, for I have learned, in whatever state I am, to be content. I know how to be brought low, and I know how to abound. In any and every circumstance, I have learned the secret of facing plenty and hunger, abundance and need.",
      "No lo digo porque tenga escasez, pues he aprendido a contentarme, cualquiera que sea mi situación. Sé vivir humildemente, y sé tener abundancia; en todo y por todo estoy enseñado, así para estar saciado como para tener hambre, así para tener abundancia como para padecer necesidad.",
      "Não digo isto como por necessidade, porque já aprendi a contentar-me com o que tenho. Sei estar abatido e sei também ter abundância; em toda a maneira e em todas as coisas estou instruído, tanto a ter fartura como a ter fome, tanto a ter abundância como a padecer necessidade.",
    ),
    hook: copy(
      "Paul didn't wake up content. He got there.",
      "Pablo no se despertó contento. Llegó ahí.",
      "Paulo não acordou contente. Ele chegou lá.",
    ),
    body: copy(
      "Paul wrote these words from prison. He'd been shipwrecked, beaten, left for dead, and abandoned by people he trusted. He knew what it felt like to have nothing. He also knew what it felt like to have more than enough. And he found God faithful in both.\n\nMost of us live on a condition. When I get the raise. When the marriage heals. When my kids straighten out. We put our peace on layaway. But God doesn't work that way, and Paul proves it.\n\nBrothers, what prison are you in right now? A financial one. A relational one. A health one. Maybe one nobody knows about.\n\nPaul's message is direct: God is enough inside that cell. You don't have to wait to get out to start living.",
      "Pablo escribió estas palabras desde la cárcel. Había naufragado, sido golpeado, dejado por muerto y abandonado por gente en la que confiaba. Supo lo que es no tener nada. También supo lo que es tener de más. Y halló a Dios fiel en ambas.\n\nLa mayoría de nosotros vive condicionado. Cuando me den el aumento. Cuando el matrimonio sane. Cuando los hijos se enderecen. Ponemos la paz en abonos. Pero Dios no trabaja así, y Pablo lo demuestra.\n\nHermanos, ¿en qué cárcel están ahora? Una financiera. Una relacional. Una de salud. Tal vez una que nadie conoce.\n\nEl mensaje de Pablo es directo: Dios basta dentro de esa celda. No tienen que esperar a salir para empezar a vivir.",
      "Paulo escreveu essas palavras da prisão. Tinha naufragado, sido espancado, deixado por morto e abandonado por gente em quem confiava. Sabia o que era não ter nada. Também sabia o que era ter de sobra. E achou Deus fiel nos dois.\n\nA maioria de nós vive sob uma condição. Quando eu ganhar o aumento. Quando o casamento sarar. Quando os filhos se endireitarem. Colocamos a paz no crediário. Mas Deus não trabalha assim, e Paulo prova isso.\n\nIrmãos, em que prisão vocês estão agora? Uma financeira. Uma relacional. Uma de saúde. Talvez uma que ninguém conhece.\n\nA mensagem de Paulo é direta: Deus basta dentro daquela cela. Vocês não precisam esperar sair para começar a viver.",
    ),
    discussionQuestions: [
      copy(
        "Where in your life are you waiting on your circumstances to change before you feel at peace?",
        "¿En qué parte de tu vida estás esperando que las circunstancias cambien antes de sentir paz?",
        "Onde na sua vida você está esperando as circunstâncias mudarem antes de sentir paz?",
      ),
      copy(
        "Who in your life models contentment under pressure? What do you see in them?",
        "¿Quién en tu vida modela contentamiento bajo presión? ¿Qué ves en esa persona?",
        "Quem na sua vida modela contentamento sob pressão? O que você vê nela?",
      ),
    ],
    prompt: copy(
      "Where in your life are you waiting on your circumstances to change before you feel at peace?",
      "¿En qué parte de tu vida estás esperando que las circunstancias cambien antes de sentir paz?",
      "Onde na sua vida você está esperando as circunstâncias mudarem antes de sentir paz?",
    ),
  },
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
    hook: copy(
      "A dull man is usually a lonely man.",
      "Un hombre desafilado suele ser un hombre solo.",
      "Um homem sem fio costuma ser um homem só.",
    ),
    body: copy(
      "Iron does not sharpen iron from across the room. Sparks fly when two edges meet — honest words, shared prayer, a brother who will not let you stay soft.\n\nWe get sharp in the friction we would rather avoid. A compliment is easy. A true word that sends you back to the Lord is costly, and it is a gift.\n\nBrothers, who has permission to grind on you? And whose blade are you willing to take in your own hands this week?",
      "El hierro no aguzá al hierro desde el otro lado del cuarto. Las chispas vuelan cuando dos filos se encuentran: palabras honestas, oración compartida, un hermano que no te deja quedarte suave.\n\nNos aguzamos en la fricción que preferiríamos evitar. Un cumplido es fácil. Una palabra verdadera que te devuelve al Señor cuesta, y es un regalo.\n\nHermanos, ¿quién tiene permiso de lijarte? ¿Y de quién estás dispuesto a tomar el filo en tus propias manos esta semana?",
      "O ferro não afia o ferro do outro lado da sala. As faíscas voam quando dois fios se encontram — palavras honestas, oração compartilhada, um irmão que não deixa você ficar mole.\n\nFicamos afiados no atrito que preferiríamos evitar. Um elogio é fácil. Uma palavra verdadeira que te devolve ao Senhor custa, e é um presente.\n\nIrmãos, quem tem permissão de lixar vocês? E de quem vocês estão dispostos a tomar o fio nas próprias mãos nesta semana?",
    ),
    discussionQuestions: [
      copy(
        "Who is sharpening you — and whom are you sharpening?",
        "¿Quién te está aguzando, y a quién estás aguzando tú?",
        "Quem está afiando você — e a quem você está afiando?",
      ),
      copy(
        "What honest word have you been avoiding because it would cost you comfort?",
        "¿Qué palabra honesta has evitado porque te costaría la comodidad?",
        "Que palavra honesta você tem evitado porque custaria o seu conforto?",
      ),
    ],
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
    hook: en("The safest walk is the one that does not need a cover story."),
    body: en(
      "Integrity is not a brand. It is the same man in the hallway, in the truck, and on the phone when nobody from church is listening.\n\nA split life feels clever until it is known. Scripture says it will be. The cover costs more than the confession ever would.\n\nBrothers, the Lord already sees the side road. Walking uprightly is not about looking clean. It is about being one man.",
    ),
    discussionQuestions: [
      en("Where is it hardest this week to walk the same in private as in public?"),
      en("What would it cost you — and what would it free — to tell the truth there?"),
    ],
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
    hook: en("Courage is not the absence of fear. It is obedience with your knees shaking."),
    body: en(
      "Joshua was not pep-talked into the Jordan. He was commanded. Strength and courage were not a mood; they were an order from the God who was already on the other side.\n\nFear still talks. It always will. The question is whether fear gets the last word, or the Lord who said He would go with you.\n\nBrothers, retreat can look like wisdom when it is just unbelief with a plan. Where is God sending you that you keep postponing?",
    ),
    discussionQuestions: [
      en("What are you facing that needs courage instead of retreat?"),
      en("Where have you been calling fear a plan?"),
    ],
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
    hook: en("Your real boss is not on the org chart."),
    body: en(
      "Paul was writing to men whose work was often unseen, unfair, or owned by someone else. He did not tell them to wait for a better job before they worked like worship.\n\nHeartily does not mean louder. It means the whole man — the email, the wrench, the night shift — offered to the Lord first.\n\nBrothers, a half-hearted job can hide a half-hearted faith. If Jesus signed the timesheet, what would change on Monday?",
    ),
    discussionQuestions: [
      en("How would your work change if it were offered to the Lord first?"),
      en("Where have you been working for applause instead of for Christ?"),
    ],
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
    hook: en("Winning the room is cheap. Ruling your spirit is the real city."),
    body: en(
      "A man can take a hill at work and lose the kitchen the same night. Strength that cannot wait is not strength. It is a fuse.\n\nSlow to anger is not soft. It is a man who has a master besides his mood. The Spirit produces that fruit; willpower only delays the blast.\n\nBrothers, the city you need to take this week may be the next ten seconds after you are provoked.",
    ),
    discussionQuestions: [
      en("Where did your spirit run ahead of you this week?"),
      en("What would ruling your spirit look like the next time that fuse is lit?"),
    ],
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
    hook: en("You do not forgive because they earned it. You forgive because you didn't."),
    body: en(
      "Paul does not start with the size of the wound. He starts with the size of the cross. Kindness and a tender heart are not personality types. They are the overflow of being forgiven in Christ.\n\nBitterness feels like justice we get to keep. It is a prison we carry. Releasing a man does not rewrite what he did. It refuses to let his sin be the lord of your spirit.\n\nBrothers, some of us have been rehearsing a case for years. The Father already closed yours. What would kindness look like if that were finally true in the room you cannot avoid?",
    ),
    discussionQuestions: [
      en("Who do you still need to release — and what would kindness look like?"),
      en("Where has bitterness been posing as wisdom in your house?"),
    ],
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
    hook: en("Pride needs a stage. Humility needs a brother."),
    body: en(
      "Paul is not asking you to lie about your gifts. He is asking you to stop using them as a scoreboard. Strife and empty glory both need someone to beat.\n\nLowliness of mind is a choice to put another man's name, need, and good ahead of your own highlight. That is how Christ walked into the room.\n\nBrothers, someone in your circle is carrying a load you could take if your name were not so important this week.",
    ),
    discussionQuestions: [
      en("Where can you put another man ahead of your own name this week?"),
      en("What would change if you stopped needing to win the room?"),
    ],
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
    hook: en("A man who cannot be picked up has already chosen the fall."),
    body: en(
      "Two are better than one is not a slogan for teamwork posters. It is a warning. Isolated men fall in private and stay down because nobody was close enough to grab a wrist.\n\nAccountability is not a report. It is a brother with permission — the truth before the crash, and a hand after it.\n\nBrothers, secrecy is not strength. If no one knows where you are actually walking, you are already alone in the ditch.",
    ),
    discussionQuestions: [
      en("Who is allowed to pick you up — and have you told him the truth?"),
      en("What are you still carrying alone that a brother could help you lift?"),
    ],
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
    hook: en("The greatest Man in the room picked up a towel."),
    body: en(
      "The disciples wanted seats. Jesus talked about a ransom. Leadership in His kingdom is not a platform you climb. It is a life you spend.\n\nIf the Son of Man did not come to be served, we do not get to demand a staff, a title, or a thank-you before we move.\n\nBrothers, someone near you needs ministry, not a meeting. Lead where it costs you and does not photograph well.",
    ),
    discussionQuestions: [
      en("Where can you lead by serving, not by being seen?"),
      en("Whose burden could you pick up this week without announcing it?"),
    ],
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
    hook: en("Joy is not the trial. Joy is knowing what the trial is making."),
    body: en(
      "James does not say the pain is fun. He says count it joy — do the math — because the test is producing something you cannot get on easy street: a faith that can wait.\n\nWe want the lesson without the weight. God often trains the man by the thing he would have scheduled last.\n\nBrothers, the trial in front of you is not proof that God left. It may be the workshop where He is finishing your patience.",
    ),
    discussionQuestions: [
      en("What trial is training your faith right now — and where is the joy in it?"),
      en("What is this test trying to produce in you that comfort never could?"),
    ],
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
  hook: topic.hook,
  body: topic.body,
  discussionQuestions: topic.discussionQuestions,
  prompt: topic.prompt,
}));

export function topicById(id: string): TopicContent | undefined {
  return TOPIC_LIST.find((topic) => topic.id === id);
}

export function localized(value: Partial<Localized> | undefined, lang: Lang): string {
  if (!value) return "";
  return value[lang]?.trim() || value.en?.trim() || "";
}

export function customTopic(title: string): TopicContent {
  const trimmed = title.trim();
  return {
    id: "custom",
    title: { en: trimmed, es: trimmed, pt: trimmed },
    reference: "",
    verse: EMPTY,
    hook: EMPTY,
    body: EMPTY,
    discussionQuestions: [CUSTOM_PROMPT],
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

export function normalizeTopic(topic: TopicContent | null | undefined): TopicContent | null {
  if (!topic || !hasTopicBody(topic)) return topic ?? null;
  return {
    id: topic.id,
    title: topic.title,
    reference: topic.reference ?? "",
    verse: topic.verse ?? EMPTY,
    hook: topic.hook ?? EMPTY,
    body: topic.body ?? EMPTY,
    discussionQuestions: topic.discussionQuestions?.length
      ? topic.discussionQuestions
      : topic.prompt
        ? [topic.prompt]
        : [CUSTOM_PROMPT],
    prompt: topic.prompt ?? CUSTOM_PROMPT,
  };
}
