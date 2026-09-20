import { foldText } from "./dom.ts";
import type { Lang, Localized, TopicContent } from "./types.ts";

type TopicSeed = TopicContent & { keywords: string[] };

const CUSTOM_PROMPT: Localized = {
  en: "Talk this through together. What does Scripture say, and how do we live it this week?",
  es: "Háblenlo juntos. ¿Qué dice la Escritura, y cómo lo vivimos esta semana?",
  pt: "Conversem juntos. O que a Escritura diz, e como vivemos isso nesta semana?",
};

function copy(enText: string, es: string, pt: string): Localized {
  return { en: enText, es, pt };
}

const EMPTY: Localized = { en: "", es: "", pt: "" };
const STOP_WORDS = new Set(["of", "the", "and", "a", "an", "in", "to", "for", "on", "at"]);

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
    id: "head-of-household",
    keywords: [
      "head of household",
      "head of the household",
      "head of the house",
      "headship",
      "spiritual head",
      "husband",
      "husbands",
      "household",
      "house",
      "home",
      "family",
      "marriage",
      "ephesians",
    ],
    title: { en: "Head of the household", es: "Cabeza del hogar", pt: "Cabeça do lar" },
    reference: "Ephesians 5:23",
    verse: copy(
      "For the husband is the head of the wife, even as Christ is the head of the church: and he is the saviour of the body.",
      "Porque el marido es cabeza de la mujer, así como Cristo es cabeza de la iglesia, la cual es su cuerpo, y él es su Salvador.",
      "Porque o marido é a cabeça da mulher, como também Cristo é a cabeça da igreja, sendo ele próprio o salvador do corpo.",
    ),
    hook: copy(
      "Head of the house is not a throne. It is a towel.",
      "Cabeza del hogar no es un trono. Es una toalla.",
      "Cabeça do lar não é um trono. É uma toalha.",
    ),
    body: copy(
      "Paul does not hand a man a louder voice. He hands him Christ's pattern: the husband is head *even as Christ is head of the church* — and Christ is the Saviour of the body. Headship looks like a cross before it looks like a title.\n\nBrothers, **head of the household** is weight. The house already knows whether you lead by serving or by being served. Privilege without the cross turns a living room into a courtroom.\n\nLove that looks like Jesus will cost you the last word, the extra hour, and the right to stay bitter. You do not wait until the house is easy to start leading it well.\n\nStart where you are actually walking tonight. The Saviour of the body did not wait for a grateful church.",
      "Pablo no le entrega al hombre una voz más alta. Le entrega el patrón de Cristo: el marido es cabeza *así como Cristo es cabeza de la iglesia* — y Cristo es el Salvador del cuerpo. El liderazgo se parece a una cruz antes que a un título.\n\nHermanos, **cabeza del hogar** es peso. La casa ya sabe si lideras sirviendo o siendo servido. El privilegio sin la cruz convierte la sala en un tribunal.\n\nEl amor que se parece a Jesús te costará la última palabra, la hora extra y el derecho a quedarte amargado. No esperas a que la casa esté fácil para liderarla bien.\n\nEmpieza donde realmente estás caminando esta noche. El Salvador del cuerpo no esperó a una iglesia agradecida.",
      "Paulo não entrega ao homem uma voz mais alta. Entrega o padrão de Cristo: o marido é cabeça *como Cristo é cabeça da igreja* — e Cristo é o Salvador do corpo. Liderança parece cruz antes de parecer título.\n\nIrmãos, **cabeça do lar** é peso. A casa já sabe se você lidera servindo ou sendo servido. Privilégio sem cruz transforma a sala num tribunal.\n\nO amor que parece com Jesus vai custar a última palavra, a hora extra e o direito de ficar amargurado. Você não espera a casa ficar fácil para liderá-la bem.\n\nComece onde você realmente está andando esta noite. O Salvador do corpo não esperou uma igreja grata.",
    ),
    discussionQuestions: [
      copy(
        "Where have you been claiming head of the household as rank instead of as a charge to love?",
        "¿Dónde has reclamado ser cabeza del hogar como rango en vez de como un encargo de amar?",
        "Onde você tem reivindicado ser cabeça do lar como patente em vez de como um encargo de amar?",
      ),
      copy(
        "Who in your house would say you looked like Christ this month — and who would hesitate?",
        "¿Quién en tu casa diría que te pareciste a Cristo este mes, y quién dudaría?",
        "Quem na sua casa diria que você se pareceu com Cristo neste mês — e quem hesitaria?",
      ),
    ],
    prompt: copy(
      "Where have you been claiming head of the household as rank instead of as a charge to love?",
      "¿Dónde has reclamado ser cabeza del hogar como rango en vez de como un encargo de amar?",
      "Onde você tem reivindicado ser cabeça do lar como patente em vez de como um encargo de amar?",
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
    hook: copy(
      "The safest walk is the one that does not need a cover story.",
      "El caminar más seguro es el que no necesita una historia de tapadera.",
      "O caminho mais seguro é o que não precisa de uma história de cobertura.",
    ),
    body: copy(
      "Integrity is not a brand. It is the same man in the hallway, in the truck, and on the phone when nobody from church is listening.\n\nA split life feels clever until it is known. Scripture says it will be. The cover costs more than the confession ever would.\n\nBrothers, the Lord already sees the side road. Walking uprightly is not about looking clean. It is about being one man.",
      "La integridad no es una marca. Es el mismo hombre en el pasillo, en el camión y al teléfono cuando nadie de la iglesia está oyendo.\n\nUna vida partida se siente lista hasta que se sabe. La Escritura dice que se sabrá. La tapadera cuesta más de lo que costaría la confesión.\n\nHermanos, el Señor ya ve el desvío. Andar en integridad no es parecer limpio. Es ser un solo hombre.",
      "Integridade não é marca. É o mesmo homem no corredor, no caminhão e no telefone quando ninguém da igreja está ouvindo.\n\nUma vida partida parece esperta até ser conhecida. A Escritura diz que será. A cobertura custa mais do que a confissão jamais custaria.\n\nIrmãos, o Senhor já vê o desvio. Andar com integridade não é parecer limpo. É ser um só homem.",
    ),
    discussionQuestions: [
      copy(
        "Where is it hardest this week to walk the same in private as in public?",
        "¿Dónde te cuesta más esta semana ser el mismo en privado que en público?",
        "Onde está mais difícil nesta semana ser o mesmo em privado e em público?",
      ),
      copy(
        "What would it cost you — and what would it free — to tell the truth there?",
        "¿Qué te costaría, y qué te liberaría, decir la verdad ahí?",
        "O que isso lhe custaria — e o que libertaria — dizer a verdade ali?",
      ),
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
    hook: copy(
      "Courage is not the absence of fear. It is obedience with your knees shaking.",
      "El valor no es la ausencia de miedo. Es obediencia con las rodillas temblando.",
      "Coragem não é a ausência de medo. É obediência com os joelhos tremendo.",
    ),
    body: copy(
      "Joshua was not pep-talked into the Jordan. He was commanded. Strength and courage were not a mood; they were an order from the God who was already on the other side.\n\nFear still talks. It always will. The question is whether fear gets the last word, or the Lord who said He would go with you.\n\nBrothers, retreat can look like wisdom when it is just unbelief with a plan. Where is God sending you that you keep postponing?",
      "A Josué no lo metieron al Jordán con un discurso motivacional. Fue mandado. La fuerza y el valor no eran un ánimo; eran una orden del Dios que ya estaba al otro lado.\n\nEl miedo sigue hablando. Siempre lo hará. La pregunta es si el miedo se queda con la última palabra, o el Señor que dijo que iría contigo.\n\nHermanos, retirarse puede parecer sabiduría cuando solo es incredulidad con un plan. ¿Adónde te está enviando Dios y tú lo sigues posponiendo?",
      "Josué não foi empurrado ao Jordão com um discurso motivacional. Foi mandado. Força e coragem não eram um humor; eram uma ordem do Deus que já estava do outro lado.\n\nO medo ainda fala. Sempre vai falar. A pergunta é se o medo fica com a última palavra, ou o Senhor que disse que iria com você.\n\nIrmãos, recuar pode parecer sabedoria quando é só incredulidade com um plano. Para onde Deus está enviando você e você continua adiando?",
    ),
    discussionQuestions: [
      copy(
        "What are you facing that needs courage instead of retreat?",
        "¿Qué estás enfrentando que pide valor en vez de retirarte?",
        "O que você está enfrentando que pede coragem em vez de recuar?",
      ),
      copy(
        "Where have you been calling fear a plan?",
        "¿Dónde has estado llamando plan al miedo?",
        "Onde você tem chamado o medo de plano?",
      ),
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
    hook: copy(
      "Your real boss is not on the org chart.",
      "Tu jefe de verdad no está en el organigrama.",
      "O seu chefe de verdade não está no organograma.",
    ),
    body: copy(
      "Paul was writing to men whose work was often unseen, unfair, or owned by someone else. He did not tell them to wait for a better job before they worked like worship.\n\nHeartily does not mean louder. It means the whole man — the email, the wrench, the night shift — offered to the Lord first.\n\nBrothers, a half-hearted job can hide a half-hearted faith. If Jesus signed the timesheet, what would change on Monday?",
      "Pablo escribía a hombres cuyo trabajo a menudo no se veía, era injusto o pertenecía a otro. No les dijo que esperaran un mejor empleo para trabajar como adoración.\n\nDe corazón no significa más fuerte. Significa el hombre entero — el correo, la llave, el turno de noche — ofrecido primero al Señor.\n\nHermanos, un trabajo a medias puede esconder una fe a medias. Si Jesús firmara la hoja de horas, ¿qué cambiaría el lunes?",
      "Paulo escrevia a homens cujo trabalho muitas vezes era invisível, injusto ou pertencia a outro. Ele não disse para esperarem um emprego melhor antes de trabalhar como adoração.\n\nDe todo o coração não significa mais alto. Significa o homem inteiro — o e-mail, a chave, o turno da noite — oferecido primeiro ao Senhor.\n\nIrmãos, um trabalho morno pode esconder uma fé morna. Se Jesus assinasse a folha de ponto, o que mudaria na segunda?",
    ),
    discussionQuestions: [
      copy(
        "How would your work change if it were offered to the Lord first?",
        "¿Cómo cambiaría tu trabajo si primero se lo ofrecieras al Señor?",
        "Como o seu trabalho mudaria se fosse oferecido primeiro ao Senhor?",
      ),
      copy(
        "Where have you been working for applause instead of for Christ?",
        "¿Dónde has estado trabajando por el aplauso en vez de por Cristo?",
        "Onde você tem trabalhado pelo aplauso em vez de por Cristo?",
      ),
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
    hook: copy(
      "Winning the room is cheap. Ruling your spirit is the real city.",
      "Ganarse el cuarto es barato. Gobernar tu espíritu es la ciudad de verdad.",
      "Ganhar a sala é barato. Governar o seu espírito é a cidade de verdade.",
    ),
    body: copy(
      "A man can take a hill at work and lose the kitchen the same night. Strength that cannot wait is not strength. It is a fuse.\n\nSlow to anger is not soft. It is a man who has a master besides his mood. The Spirit produces that fruit; willpower only delays the blast.\n\nBrothers, the city you need to take this week may be the next ten seconds after you are provoked.",
      "Un hombre puede tomar una loma en el trabajo y perder la cocina esa misma noche. La fuerza que no puede esperar no es fuerza. Es una mecha.\n\nTardar en airarse no es blandura. Es un hombre que tiene un Señor además de su humor. El Espíritu produce ese fruto; la fuerza de voluntad solo atrasa la explosión.\n\nHermanos, la ciudad que necesitan tomar esta semana puede ser los próximos diez segundos después de que los provoquen.",
      "Um homem pode tomar um morro no trabalho e perder a cozinha na mesma noite. Força que não sabe esperar não é força. É um pavio.\n\nTardio para a ira não é moleza. É um homem que tem um Senhor além do humor. O Espírito produz esse fruto; força de vontade só atrasa a explosão.\n\nIrmãos, a cidade que vocês precisam tomar nesta semana pode ser os próximos dez segundos depois de serem provocados.",
    ),
    discussionQuestions: [
      copy(
        "Where did your spirit run ahead of you this week?",
        "¿Dónde se te adelantó el genio esta semana?",
        "Onde o seu espírito foi na frente nesta semana?",
      ),
      copy(
        "What would ruling your spirit look like the next time that fuse is lit?",
        "¿Cómo se vería gobernar tu espíritu la próxima vez que se encienda esa mecha?",
        "Como seria governar o seu espírito da próxima vez que esse pavio acender?",
      ),
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
    hook: copy(
      "You do not forgive because they earned it. You forgive because you didn't.",
      "No perdonas porque ellos lo merecieron. Perdonas porque tú no lo mereciste.",
      "Você não perdoa porque eles mereceram. Perdoa porque você não mereceu.",
    ),
    body: copy(
      "Paul does not start with the size of the wound. He starts with the size of the cross. Kindness and a tender heart are not personality types. They are the overflow of being forgiven in Christ.\n\nBitterness feels like justice we get to keep. It is a prison we carry. Releasing a man does not rewrite what he did. It refuses to let his sin be the lord of your spirit.\n\nBrothers, some of us have been rehearsing a case for years. The Father already closed yours. What would kindness look like if that were finally true in the room you cannot avoid?",
      "Pablo no empieza por el tamaño de la herida. Empieza por el tamaño de la cruz. La bondad y el corazón tierno no son tipos de personalidad. Son el desborde de haber sido perdonados en Cristo.\n\nLa amargura se siente como una justicia que nos podemos quedar. Es una cárcel que cargamos. Soltar a un hombre no reescribe lo que hizo. Se niega a dejar que su pecado sea el señor de tu espíritu.\n\nHermanos, algunos llevamos años ensayando un caso. El Padre ya cerró el tuyo. ¿Cómo se vería la bondad si eso fuera por fin verdad en el cuarto que no puedes evitar?",
      "Paulo não começa pelo tamanho da ferida. Começa pelo tamanho da cruz. Bondade e coração terno não são tipos de personalidade. São o transbordo de ter sido perdoado em Cristo.\n\nAmargura parece justiça que podemos guardar. É uma prisão que carregamos. Soltar um homem não reescreve o que ele fez. Recusa deixar que o pecado dele seja o senhor do seu espírito.\n\nIrmãos, alguns de nós ensaiamos um processo há anos. O Pai já fechou o seu. Como seria a bondade se isso fosse enfim verdade na sala que você não pode evitar?",
    ),
    discussionQuestions: [
      copy(
        "Who do you still need to release — and what would kindness look like?",
        "¿A quién todavía necesitas soltar, y cómo se vería la bondad?",
        "A quem você ainda precisa soltar — e como seria a bondade?",
      ),
      copy(
        "Where has bitterness been posing as wisdom in your house?",
        "¿Dónde se ha disfrazado la amargura de sabiduría en tu casa?",
        "Onde a amargura tem se passado por sabedoria na sua casa?",
      ),
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
    hook: copy(
      "Pride needs a stage. Humility needs a brother.",
      "El orgullo necesita un escenario. La humildad necesita un hermano.",
      "O orgulho precisa de um palco. A humildade precisa de um irmão.",
    ),
    body: copy(
      "Paul is not asking you to lie about your gifts. He is asking you to stop using them as a scoreboard. Strife and empty glory both need someone to beat.\n\nLowliness of mind is a choice to put another man's name, need, and good ahead of your own highlight. That is how Christ walked into the room.\n\nBrothers, someone in your circle is carrying a load you could take if your name were not so important this week.",
      "Pablo no te pide que mientas sobre tus dones. Te pide que dejes de usarlos como marcador. La contienda y la vanagloria necesitan a alguien a quien vencer.\n\nLa humildad de mente es elegir poner el nombre, la necesidad y el bien de otro delante de tu propio brillo. Así entró Cristo al cuarto.\n\nHermanos, alguien en su círculo carga un peso que ustedes podrían tomar si su nombre no fuera tan importante esta semana.",
      "Paulo não pede que você minta sobre os seus dons. Pede que pare de usá-los como placar. Contenda e vanglória precisam de alguém para vencer.\n\nHumildade de mente é escolher colocar o nome, a necessidade e o bem de outro à frente do seu próprio destaque. Foi assim que Cristo entrou na sala.\n\nIrmãos, alguém no seu círculo carrega um peso que vocês poderiam tomar se o seu nome não fosse tão importante nesta semana.",
    ),
    discussionQuestions: [
      copy(
        "Where can you put another man ahead of your own name this week?",
        "¿Dónde puedes poner a otro delante de tu propio nombre esta semana?",
        "Onde você pode colocar outro homem à frente do seu próprio nome nesta semana?",
      ),
      copy(
        "What would change if you stopped needing to win the room?",
        "¿Qué cambiaría si dejaras de necesitar ganarte el cuarto?",
        "O que mudaria se você parasse de precisar ganhar a sala?",
      ),
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
    hook: copy(
      "A man who cannot be picked up has already chosen the fall.",
      "El hombre que no se deja levantar ya eligió la caída.",
      "O homem que não pode ser levantado já escolheu a queda.",
    ),
    body: copy(
      "Two are better than one is not a slogan for teamwork posters. It is a warning. Isolated men fall in private and stay down because nobody was close enough to grab a wrist.\n\nAccountability is not a report. It is a brother with permission — the truth before the crash, and a hand after it.\n\nBrothers, secrecy is not strength. If no one knows where you are actually walking, you are already alone in the ditch.",
      "Mejores son dos que uno no es un lema para carteles de equipo. Es una advertencia. Los hombres aislados caen en privado y se quedan abajo porque nadie estuvo lo bastante cerca para agarrar una muñeca.\n\nLa rendición de cuentas no es un informe. Es un hermano con permiso: la verdad antes del choque, y una mano después.\n\nHermanos, el secreto no es fuerza. Si nadie sabe por dónde realmente caminas, ya estás solo en la zanja.",
      "Melhor é serem dois do que um não é slogan de cartaz de equipe. É um aviso. Homens isolados caem em privado e ficam no chão porque ninguém estava perto o bastante para pegar um pulso.\n\nPrestação de contas não é um relatório. É um irmão com permissão — a verdade antes da queda, e uma mão depois.\n\nIrmãos, segredo não é força. Se ninguém sabe por onde você realmente anda, você já está sozinho no fosso.",
    ),
    discussionQuestions: [
      copy(
        "Who is allowed to pick you up — and have you told him the truth?",
        "¿Quién tiene permiso de levantarte, y le has dicho la verdad?",
        "Quem tem permissão de te levantar — e você já lhe disse a verdade?",
      ),
      copy(
        "What are you still carrying alone that a brother could help you lift?",
        "¿Qué sigues cargando solo que un hermano podría ayudarte a levantar?",
        "O que você ainda carrega sozinho que um irmão poderia ajudar a levantar?",
      ),
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
    hook: copy(
      "The greatest Man in the room picked up a towel.",
      "El Hombre más grande del cuarto tomó una toalla.",
      "O maior Homem da sala pegou uma toalha.",
    ),
    body: copy(
      "The disciples wanted seats. Jesus talked about a ransom. Leadership in His kingdom is not a platform you climb. It is a life you spend.\n\nIf the Son of Man did not come to be served, we do not get to demand a staff, a title, or a thank-you before we move.\n\nBrothers, someone near you needs ministry, not a meeting. Lead where it costs you and does not photograph well.",
      "Los discípulos querían asientos. Jesús habló de un rescate. El liderazgo en Su reino no es una plataforma que se escala. Es una vida que se gasta.\n\nSi el Hijo del Hombre no vino para ser servido, no nos toca exigir un equipo, un título o un gracias antes de movernos.\n\nHermanos, alguien cerca de ustedes necesita ministerio, no una reunión. Lideren donde les cueste y no salga bien en la foto.",
      "Os discípulos queriam assentos. Jesus falou de um resgate. Liderança no reino dEle não é um palco que se sobe. É uma vida que se gasta.\n\nSe o Filho do homem não veio para ser servido, nós não podemos exigir equipe, título ou um obrigado antes de nos mover.\n\nIrmãos, alguém perto de vocês precisa de ministério, não de uma reunião. Liderem onde custa e não fotografa bem.",
    ),
    discussionQuestions: [
      copy(
        "Where can you lead by serving, not by being seen?",
        "¿Dónde puedes liderar sirviendo, no buscando ser visto?",
        "Onde você pode liderar servindo, e não buscando ser visto?",
      ),
      copy(
        "Whose burden could you pick up this week without announcing it?",
        "¿De quién podrías tomar la carga esta semana sin anunciarlo?",
        "De quem você poderia tomar o fardo nesta semana sem anunciar?",
      ),
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
    hook: copy(
      "Joy is not the trial. Joy is knowing what the trial is making.",
      "El gozo no es la prueba. El gozo es saber lo que la prueba está formando.",
      "O gozo não é a provação. O gozo é saber o que a provação está formando.",
    ),
    body: copy(
      "James does not say the pain is fun. He says count it joy — do the math — because the test is producing something you cannot get on easy street: a faith that can wait.\n\nWe want the lesson without the weight. God often trains the man by the thing he would have scheduled last.\n\nBrothers, the trial in front of you is not proof that God left. It may be the workshop where He is finishing your patience.",
      "Santiago no dice que el dolor sea divertido. Dice tenedlo por gozo — hagan la cuenta — porque la prueba produce algo que no se consigue en la calle fácil: una fe que sabe esperar.\n\nQueremos la lección sin el peso. Dios a menudo forma al hombre con lo que él habría puesto al final del calendario.\n\nHermanos, la prueba delante de ustedes no es prueba de que Dios se fue. Puede ser el taller donde Él está terminando su paciencia.",
      "Tiago não diz que a dor é divertida. Diz tende por gozo — façam a conta — porque a prova produz algo que não se compra na rua fácil: uma fé que sabe esperar.\n\nQueremos a lição sem o peso. Deus muitas vezes forma o homem com a coisa que ele teria marcado por último.\n\nIrmãos, a provação à frente de vocês não é prova de que Deus saiu. Pode ser a oficina onde Ele está terminando a vossa paciência.",
    ),
    discussionQuestions: [
      copy(
        "What trial is training your faith right now — and where is the joy in it?",
        "¿Qué prueba está entrenando tu fe ahora, y dónde está el gozo en ella?",
        "Que provação está treinando a sua fé agora — e onde está o gozo nisso?",
      ),
      copy(
        "What is this test trying to produce in you that comfort never could?",
        "¿Qué está tratando de producir esta prueba en ti que la comodidad nunca podría?",
        "O que este teste está tentando produzir em você que o conforto nunca poderia?",
      ),
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

  const words = q.split(" ").filter((word) => word.length > 2 && !STOP_WORDS.has(word));

  const scored = TOPICS.map((topic) => {
    const hay = foldText(
      [topic.id, topic.reference, ...Object.values(topic.title), ...topic.keywords].join(" "),
    );
    let score = 0;
    if (foldText(topic.reference) === q) score = 100;
    else if (Object.values(topic.title).some((title) => foldText(title) === q)) score = 90;
    else if (hay.includes(q)) score = 50 + Math.min(q.length, 20);
    else if (words.length && words.every((word) => hay.includes(word))) score = 30 + words.length * 4;
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
