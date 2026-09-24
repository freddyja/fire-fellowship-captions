import type { Lang } from "./types";

/**
 * App chrome language (home, join prompts, host labels).
 * This is not Spoken (mic) and not Watch (caption panes).
 */
export type UiLang = Lang;

const STORAGE_KEY = "ff-ui-lang";
const EVENT = "ff-ui-lang-change";

export const UI_LANGS: UiLang[] = ["en", "es", "pt"];

/** Endonyms. The bar always shows these, in every UI language. */
export const UI_LANG_ENDONYM: Record<UiLang, string> = {
  en: "English",
  es: "Español",
  pt: "Português",
};

type Copy = Record<UiLang, string>;

const STRINGS = {
  "chrome.language": { en: "Choose your language", es: "Elige tu idioma", pt: "Escolha seu idioma" },
  "chrome.room": { en: "Room", es: "Sala", pt: "Sala" },
  "chrome.leave": { en: "Leave", es: "Salir", pt: "Sair" },
  "chrome.send": { en: "Send", es: "Enviar", pt: "Enviar" },
  "chrome.start": { en: "Start", es: "Iniciar", pt: "Iniciar" },
  "chrome.stop": { en: "Stop", es: "Detener", pt: "Parar" },
  "chrome.wait": { en: "Wait", es: "Espera", pt: "Aguarde" },
  "chrome.copied": { en: "Copied", es: "Copiado", pt: "Copiado" },
  "chrome.close": { en: "Close", es: "Cerrar", pt: "Fechar" },
  "chrome.cancel": { en: "Cancel", es: "Cancelar", pt: "Cancelar" },
  "chrome.connecting": { en: "Connecting\u2026", es: "Conectando\u2026", pt: "Conectando\u2026" },
  "chrome.reconnecting": { en: "Reconnecting\u2026", es: "Reconectando\u2026", pt: "Reconectando\u2026" },
  "chrome.listening": { en: "Listening", es: "Escuchando", pt: "Ouvindo" },
  "chrome.listeningEllipsis": { en: "Listening\u2026", es: "Escuchando\u2026", pt: "Ouvindo\u2026" },
  "chrome.offlineLimited": {
    en: "Offline translate (limited phrases).",
    es: "Traducci\u00f3n sin conexi\u00f3n (frases limitadas).",
    pt: "Tradu\u00e7\u00e3o offline (frases limitadas).",
  },

  "brand.tagline": {
    en: "Men's Fellowship",
    es: "Compa\u00f1erismo de hombres",
    pt: "Comunh\u00e3o de homens",
  },
  "brand.subline": {
    en: "Break language barriers in your small groups. No equipment needed - works on any device.",
    es: "Rompe las barreras del idioma en tus grupos peque\u00f1os. No hace falta equipo: funciona en cualquier dispositivo.",
    pt: "Quebre as barreiras do idioma nos seus grupos pequenos. N\u00e3o precisa de equipamento \u2014 funciona em qualquer aparelho.",
  },

  "home.lede": {
    en: "Phone captures live speech. Pick today\u2019s Bible topic on the phone; the TV shows the verse, a short handout, and English, Spanish, and Portuguese caption windows.",
    es: "El tel\u00e9fono captura la voz en vivo. Elige el tema b\u00edblico de hoy en el tel\u00e9fono; la TV muestra el vers\u00edculo, una hoja breve y ventanas de subt\u00edtulos en ingl\u00e9s, espa\u00f1ol y portugu\u00e9s.",
    pt: "O celular captura a fala ao vivo. Escolha o tema b\u00edblico de hoje no celular; a TV mostra o vers\u00edculo, um folheto breve e janelas de legendas em ingl\u00eas, espanhol e portugu\u00eas.",
  },
  "home.create": {
    en: "Create room",
    es: "Crear sala",
    pt: "Criar sala",
  },
  "home.createHelp": {
    en: "Start the meeting on this phone.",
    es: "Empieza la reuni\u00f3n en este tel\u00e9fono.",
    pt: "Comece a reuni\u00e3o neste celular.",
  },
  "home.roomCode": { en: "Room code", es: "C\u00f3digo de la sala", pt: "C\u00f3digo da sala" },
  "home.openTv": { en: "Open TV windows", es: "Abrir ventanas de la TV", pt: "Abrir janelas da TV" },
  "home.joinPhone": {
    en: "Join",
    es: "Unirse",
    pt: "Entrar",
  },
  "home.joinHelp": {
    en: "Enter the room code, then join on this phone.",
    es: "Escribe el c\u00f3digo y \u00fanete en este tel\u00e9fono.",
    pt: "Digite o c\u00f3digo e entre neste celular.",
  },
  "home.hostHint": {
    en: "Host: <strong>Chrome</strong> on the Galaxy Z Fold (not Samsung Internet). Brothers: scan <strong>Join on phones</strong> in <strong>Chrome on Android</strong> or <strong>Safari / Chrome on iPhone</strong> \u2014 no app store install. <strong>Send to TV</strong> opens the caption page in the TV\u2019s own browser. <strong>Smart View mode</strong> is Fold-only mirroring.",
    es: "Anfitri\u00f3n: <strong>Chrome</strong> en el Galaxy Z Fold (no Samsung Internet). Hermanos: escaneen <strong>Unirse en tel\u00e9fonos</strong> con <strong>Chrome en Android</strong> o <strong>Safari / Chrome en el iPhone</strong> \u2014 sin instalar desde la tienda. <strong>Enviar a la TV</strong> abre la p\u00e1gina de subt\u00edtulos en el navegador de la TV. <strong>Modo Smart View</strong> solo refleja la pantalla del Fold.",
    pt: "Anfitri\u00e3o: <strong>Chrome</strong> no Galaxy Z Fold (n\u00e3o o Samsung Internet). Irm\u00e3os: escaneiem <strong>Entrar nos celulares</strong> no <strong>Chrome no Android</strong> ou no <strong>Safari / Chrome no iPhone</strong> \u2014 sem instalar pela loja. <strong>Enviar para a TV</strong> abre a p\u00e1gina de legendas no navegador da TV. <strong>Modo Smart View</strong> s\u00f3 espelha a tela do Fold.",
  },
  "home.meetingMode": { en: "Meeting mode", es: "Modo de reuni\u00f3n", pt: "Modo da reuni\u00e3o" },
  "home.offline": {
    en: "Offline / Local meeting",
    es: "Reuni\u00f3n sin conexi\u00f3n / local",
    pt: "Reuni\u00e3o offline / local",
  },
  "home.offlineAria": {
    en: "Offline / Local meeting \u2014 use the built-in dictionary, no MyMemory",
    es: "Reuni\u00f3n sin conexi\u00f3n / local \u2014 usa el diccionario incluido, sin MyMemory",
    pt: "Reuni\u00e3o offline / local \u2014 usa o dicion\u00e1rio inclu\u00eddo, sem MyMemory",
  },
  "home.offlineLead": {
    en: "Offline translate (limited phrases). For full local setup see",
    es: "Traducci\u00f3n sin conexi\u00f3n (frases limitadas). Para la configuraci\u00f3n local completa, ve",
    pt: "Tradu\u00e7\u00e3o offline (frases limitadas). Para a configura\u00e7\u00e3o local completa, veja",
  },
  "home.laptopSteps": { en: "laptop steps", es: "los pasos en la laptop", pt: "os passos no laptop" },
  "home.offlineHint": {
    en: "On: built-in dictionary (no MyMemory). Off: hosted default (MyMemory, then MinT if the daily quota is gone).",
    es: "Activado: diccionario incluido (sin MyMemory). Desactivado: servicio en l\u00ednea (MyMemory y luego MinT si se acaba la cuota diaria).",
    pt: "Ligado: dicion\u00e1rio inclu\u00eddo (sem MyMemory). Desligado: padr\u00e3o online (MyMemory e depois MinT se a cota di\u00e1ria acabar).",
  },
  "home.installTitle": {
    en: "Install on this phone",
    es: "Instalar en este tel\u00e9fono",
    pt: "Instalar neste celular",
  },
  "home.installBtn": { en: "Install app", es: "Instalar app", pt: "Instalar app" },
  "home.installStandalone": {
    en: "This is the installed Fire and Fellowship app. Create a room here, then open the TV link on the meeting TV.",
    es: "Esta es la app instalada de Fire and Fellowship. Crea una sala aqu\u00ed y luego abre el enlace de la TV en el televisor de la reuni\u00f3n.",
    pt: "Este \u00e9 o app instalado Fire and Fellowship. Crie uma sala aqui e depois abra o link da TV na televis\u00e3o da reuni\u00e3o.",
  },
  "home.installStandaloneSteps": {
    en: "<li>Tap <strong>Create room</strong>.</li><li>Pick the topic of the day. Use <strong>Send to TV</strong> (QR / TV browser) or <strong>Smart View mode</strong> (mirror captions from the Fold quick panel).</li><li>Keep the Fold on this app while you speak. Exit Smart View mode to return to mic controls.</li>",
    es: "<li>Toca <strong>Crear sala</strong>.</li><li>Elige el tema del d\u00eda. Usa <strong>Enviar a la TV</strong> (QR / navegador de la TV) o <strong>Modo Smart View</strong> (refleja los subt\u00edtulos desde el panel r\u00e1pido del Fold).</li><li>Deja el Fold en esta app mientras hablas. Sal del modo Smart View para volver a los controles del micr\u00f3fono.</li>",
    pt: "<li>Toque em <strong>Criar sala</strong>.</li><li>Escolha o tema do dia. Use <strong>Enviar para a TV</strong> (QR / navegador da TV) ou <strong>Modo Smart View</strong> (espelha as legendas pelo painel r\u00e1pido do Fold).</li><li>Deixe o Fold neste app enquanto fala. Saia do modo Smart View para voltar aos controles do microfone.</li>",
  },
  "home.installJust": {
    en: "Installed. Open Fire and Fellowship from your home screen for meeting night.",
    es: "Instalada. Abre Fire and Fellowship desde la pantalla de inicio la noche de la reuni\u00f3n.",
    pt: "Instalado. Abra Fire and Fellowship pela tela inicial na noite da reuni\u00e3o.",
  },
  "home.installJustSteps": {
    en: "<li>Find the <strong>Fire and Fellowship</strong> icon on the Fold home screen.</li><li>Launch it \u2014 you should see this app without the Chrome address bar.</li><li>Create a room, then open the TV link on the TV.</li>",
    es: "<li>Busca el icono de <strong>Fire and Fellowship</strong> en la pantalla de inicio del Fold.</li><li>Abr\u00e9lo \u2014 debes ver esta app sin la barra de direcciones de Chrome.</li><li>Crea una sala y luego abre el enlace de la TV en el televisor.</li>",
    pt: "<li>Ache o \u00edcone <strong>Fire and Fellowship</strong> na tela inicial do Fold.</li><li>Abra \u2014 voc\u00ea deve ver este app sem a barra de endere\u00e7o do Chrome.</li><li>Crie uma sala e depois abra o link da TV na televis\u00e3o.</li>",
  },
  "home.installGuide": {
    en: "Add Fire and Fellowship to the Fold home screen like a normal app. Meeting night is then a tap \u2014 no git or npm.",
    es: "Agrega Fire and Fellowship a la pantalla de inicio del Fold como una app normal. La noche de la reuni\u00f3n es un toque \u2014 sin git ni npm.",
    pt: "Adicione Fire and Fellowship \u00e0 tela inicial do Fold como um app normal. A noite da reuni\u00e3o fica a um toque \u2014 sem git nem npm.",
  },
  "home.installReadySteps": {
    en: "<li>Tap <strong>Install app</strong> above and confirm.</li><li>Open <strong>Fire and Fellowship</strong> from the home screen (standalone, no address bar).</li><li>Create the room on the Fold, then open the TV link on the TV.</li>",
    es: "<li>Toca <strong>Instalar app</strong> arriba y confirma.</li><li>Abre <strong>Fire and Fellowship</strong> desde la pantalla de inicio (sola, sin barra de direcciones).</li><li>Crea la sala en el Fold y luego abre el enlace de la TV en el televisor.</li>",
    pt: "<li>Toque em <strong>Instalar app</strong> acima e confirme.</li><li>Abra <strong>Fire and Fellowship</strong> pela tela inicial (sozinho, sem barra de endere\u00e7o).</li><li>Crie a sala no Fold e depois abra o link da TV na televis\u00e3o.</li>",
  },
  "home.installManualSteps": {
    en: "<li>Stay in <strong>Chrome</strong> (not Samsung Internet).</li><li>Tap Chrome\u2019s menu (\u22ee) \u2192 <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Open <strong>Fire and Fellowship</strong> from the home screen, then create a room.</li>",
    es: "<li>Qu\u00e9date en <strong>Chrome</strong> (no Samsung Internet).</li><li>Toca el men\u00fa de Chrome (\u22ee) \u2192 <strong>Instalar app</strong> o <strong>A\u00f1adir a la pantalla de inicio</strong>.</li><li>Abre <strong>Fire and Fellowship</strong> desde la pantalla de inicio y crea una sala.</li>",
    pt: "<li>Fique no <strong>Chrome</strong> (n\u00e3o no Samsung Internet).</li><li>Toque no menu do Chrome (\u22ee) \u2192 <strong>Instalar app</strong> ou <strong>Adicionar \u00e0 tela inicial</strong>.</li><li>Abra <strong>Fire and Fellowship</strong> pela tela inicial e crie uma sala.</li>",
  },

  "setup.title": { en: "Laptop LAN / hotspot", es: "Laptop en la red / hotspot", pt: "Laptop na rede / hotspot" },
  "setup.intro": {
    en: "No public internet? Run the app on a laptop. Fold and TV open that laptop on the same Wi\u2011Fi or phone hotspot.",
    es: "\u00bfSin internet p\u00fablico? Ejecuta la app en una laptop. El Fold y la TV abren esa laptop en el mismo Wi\u2011Fi o hotspot del tel\u00e9fono.",
    pt: "Sem internet p\u00fablica? Rode o app num laptop. O Fold e a TV abrem esse laptop no mesmo Wi\u2011Fi ou hotspot do celular.",
  },
  "setup.copy": { en: "Copy commands", es: "Copiar comandos", pt: "Copiar comandos" },
  "setup.step1": {
    en: "On the laptop, in this repo, paste those three commands. <code>npm start</code> listens on port <strong>8080</strong> (<code>HOST=0.0.0.0</code>).",
    es: "En la laptop, en este repositorio, pega esos tres comandos. <code>npm start</code> escucha en el puerto <strong>8080</strong> (<code>HOST=0.0.0.0</code>).",
    pt: "No laptop, neste reposit\u00f3rio, cole esses tr\u00eas comandos. <code>npm start</code> escuta na porta <strong>8080</strong> (<code>HOST=0.0.0.0</code>).",
  },
  "setup.step2": {
    en: "Find the laptop\u2019s LAN IP (macOS: System Settings \u2192 Wi\u2011Fi \u2192 Details; Windows: <code>ipconfig</code>; Linux: <code>ip addr</code>).",
    es: "Busca la IP de la laptop en la red (macOS: Ajustes del Sistema \u2192 Wi\u2011Fi \u2192 Detalles; Windows: <code>ipconfig</code>; Linux: <code>ip addr</code>).",
    pt: "Ache o IP do laptop na rede (macOS: Ajustes do Sistema \u2192 Wi\u2011Fi \u2192 Detalhes; Windows: <code>ipconfig</code>; Linux: <code>ip addr</code>).",
  },
  "setup.step3": {
    en: "On the Fold and the TV, open <code>http://LAPTOP-LAN-IP:PORT</code> \u2014 usually <code>http://192.168.x.x:8080</code> \u2014 while they share that Wi\u2011Fi or hotspot.",
    es: "En el Fold y la TV, abre <code>http://LAPTOP-LAN-IP:PORT</code> \u2014 normalmente <code>http://192.168.x.x:8080</code> \u2014 mientras compartan ese Wi\u2011Fi o hotspot.",
    pt: "No Fold e na TV, abra <code>http://LAPTOP-LAN-IP:PORT</code> \u2014 em geral <code>http://192.168.x.x:8080</code> \u2014 enquanto eles compartilham esse Wi\u2011Fi ou hotspot.",
  },
  "setup.originBefore": {
    en: "This device is already on",
    es: "Este dispositivo ya est\u00e1 en",
    pt: "Este aparelho j\u00e1 est\u00e1 em",
  },
  "setup.originAfter": {
    en: " \u2014 use that URL on the Fold and TV if they share this network.",
    es: " \u2014 usa esa URL en el Fold y la TV si comparten esta red.",
    pt: " \u2014 use esse URL no Fold e na TV se eles compartilham esta rede.",
  },
  "setup.micHint": {
    en: "Use <strong>Chrome</strong> for the mic. Speech recognition may still need a network path to the device\u2019s speech service (Chrome / Google), depending on the phone. That is not fully offline. <strong>Type a caption</strong> and Send if the mic cannot reach a recognizer.",
    es: "Usa <strong>Chrome</strong> para el micr\u00f3fono. El reconocimiento de voz puede seguir necesitando una ruta de red al servicio de voz del dispositivo (Chrome / Google), seg\u00fan el tel\u00e9fono. Eso no es del todo sin conexi\u00f3n. <strong>Escribe un subt\u00edtulo</strong> y Enviar si el micr\u00f3fono no llega a un reconocedor.",
    pt: "Use <strong>Chrome</strong> para o microfone. O reconhecimento de fala ainda pode precisar de um caminho de rede at\u00e9 o servi\u00e7o de voz do aparelho (Chrome / Google), conforme o celular. Isso n\u00e3o \u00e9 totalmente offline. <strong>Digite uma legenda</strong> e Enviar se o microfone n\u00e3o alcan\u00e7ar um reconhecedor.",
  },
  "setup.offlineHint": {
    en: "Turn on <strong>Offline / Local meeting</strong> so captions use the built-in dictionary (no MyMemory). Optional laptop env: <code>TRANSLATE_PROVIDER=mock</code>.",
    es: "Activa <strong>Reuni\u00f3n sin conexi\u00f3n / local</strong> para que los subt\u00edtulos usen el diccionario incluido (sin MyMemory). Variable opcional en la laptop: <code>TRANSLATE_PROVIDER=mock</code>.",
    pt: "Ative <strong>Reuni\u00e3o offline / local</strong> para as legendas usarem o dicion\u00e1rio inclu\u00eddo (sem MyMemory). Vari\u00e1vel opcional no laptop: <code>TRANSLATE_PROVIDER=mock</code>.",
  },

  "join.roomWord": { en: "Room", es: "Sala", pt: "Sala" },
  "join.leadTail": {
    en: ". Answer two questions, then join.",
    es: ". Responde dos preguntas y luego \u00fanete.",
    pt: ". Responda a duas perguntas e depois entre.",
  },
  "join.spokenQ": {
    en: "What language are you speaking?",
    es: "\u00bfEn qu\u00e9 idioma vas a hablar?",
    pt: "Em que idioma voc\u00ea vai falar?",
  },
  "join.watchQ": {
    en: "What language do you want to watch?",
    es: "\u00bfQu\u00e9 idioma quieres ver?",
    pt: "Que idioma voc\u00ea quer acompanhar?",
  },
  "join.watchNoteLong": {
    en: "This phone only. It does not change the host, the TV, or other phones.",
    es: "Solo este tel\u00e9fono. No cambia al anfitri\u00f3n, la TV ni los dem\u00e1s tel\u00e9fonos.",
    pt: "S\u00f3 este celular. N\u00e3o muda o anfitri\u00e3o, a TV nem os outros celulares.",
  },
  "join.hint": {
    en: "Spoken is for your mic and Type + Send. Watch is the caption language on this phone only.",
    es: "Hablado es el idioma del micr\u00f3fono y de Escribir y enviar. Ver es el idioma de los subt\u00edtulos solo en este tel\u00e9fono.",
    pt: "Falado \u00e9 o idioma do microfone e de Digitar e enviar. Assistir \u00e9 o idioma das legendas s\u00f3 neste celular.",
  },
  "join.yourName": { en: "Your name", es: "Tu nombre", pt: "Seu nome" },
  "join.guestPlaceholder": { en: "Guest", es: "Invitado", pt: "Convidado" },
  "join.join": { en: "Join", es: "Unirse", pt: "Entrar" },
  "join.phoneOnly": { en: "This phone only", es: "Solo este tel\u00e9fono", pt: "S\u00f3 este celular" },
  "join.spoken": { en: "Spoken", es: "Hablado", pt: "Falado" },
  "join.watch": { en: "Watch", es: "Ver", pt: "Assistir" },
  "join.enOnly": { en: "EN only", es: "Solo EN", pt: "S\u00f3 EN" },
  "join.esOnly": { en: "ES only", es: "Solo ES", pt: "S\u00f3 ES" },
  "join.ptOnly": { en: "PT only", es: "Solo PT", pt: "S\u00f3 PT" },
  "join.allThree": { en: "All three", es: "Los tres", pt: "Os tr\u00eas" },
  "join.captionsOnly": { en: "Captions only", es: "Solo subt\u00edtulos", pt: "S\u00f3 legendas" },
  "join.captionsOnlyAria": {
    en: "Captions only \u2014 hide the topic handout on this mirrored view",
    es: "Solo subt\u00edtulos \u2014 oculta la hoja del tema en esta vista reflejada",
    pt: "S\u00f3 legendas \u2014 esconde o folheto do tema nesta vista espelhada",
  },
  "join.typeCaption": { en: "Type a caption", es: "Escribe un subt\u00edtulo", pt: "Digite uma legenda" },
  "join.orTypeCaption": {
    en: "Or type a caption",
    es: "O escribe un subt\u00edtulo",
    pt: "Ou digite uma legenda",
  },
  "join.waitPlaceholder": {
    en: "Wait \u2014 someone else is speaking",
    es: "Espera \u2014 otra persona est\u00e1 hablando",
    pt: "Aguarde \u2014 outra pessoa est\u00e1 falando",
  },
  "join.httpsHint": {
    en: "This join link must be HTTPS for the microphone. You can still watch captions and type to send.",
    es: "Este enlace para unirse debe ser HTTPS para el micr\u00f3fono. A\u00fan puedes ver subt\u00edtulos y escribir para enviar.",
    pt: "Este link para entrar precisa ser HTTPS para o microfone. Voc\u00ea ainda pode ver legendas e digitar para enviar.",
  },
  "join.chromeAndroidHint": {
    en: "Live mic needs Chrome on Android. On iPhone you can always watch \u2014 type a caption to speak.",
    es: "El micr\u00f3fono en vivo necesita Chrome en Android. En iPhone siempre puedes ver \u2014 escribe un subt\u00edtulo para hablar.",
    pt: "O microfone ao vivo precisa do Chrome no Android. No iPhone voc\u00ea sempre pode acompanhar \u2014 digite uma legenda para falar.",
  },
  "join.iphoneTypeHint": {
    en: "If the mic does not start (common on iPhone Safari), type a caption instead. One brother at a time.",
    es: "Si el micr\u00f3fono no arranca (com\u00fan en Safari del iPhone), escribe un subt\u00edtulo. Un hermano a la vez.",
    pt: "Se o microfone n\u00e3o iniciar (comum no Safari do iPhone), digite uma legenda. Um irm\u00e3o de cada vez.",
  },
  "join.sameMeetingHint": {
    en: "Same meeting as the host phone and the TV. One brother speaks at a time.",
    es: "La misma reuni\u00f3n que el tel\u00e9fono del anfitri\u00f3n y la TV. Un hermano habla a la vez.",
    pt: "A mesma reuni\u00e3o do celular do anfitri\u00e3o e da TV. Um irm\u00e3o fala de cada vez.",
  },
  "join.joined": { en: "Joined", es: "Conectado", pt: "Conectado" },
  "join.floorType": {
    en: "You have the floor \u2014 speak if the mic works, or type a caption.",
    es: "Tienes la palabra \u2014 habla si el micr\u00f3fono funciona, o escribe un subt\u00edtulo.",
    pt: "Voc\u00ea tem a palavra \u2014 fale se o microfone funcionar, ou digite uma legenda.",
  },
  "join.floorSpeaking": {
    en: "You're speaking \u2014 captions go to every phone and the TV.",
    es: "Est\u00e1s hablando \u2014 los subt\u00edtulos van a cada tel\u00e9fono y a la TV.",
    pt: "Voc\u00ea est\u00e1 falando \u2014 as legendas v\u00e3o para cada celular e para a TV.",
  },
  "join.floorHolding": {
    en: "You have the mic. Type a caption, or Stop to free the floor.",
    es: "Tienes el micr\u00f3fono. Escribe un subt\u00edtulo, o Detener para soltar la palabra.",
    pt: "Voc\u00ea tem o microfone. Digite uma legenda, ou Parar para liberar a palavra.",
  },
  "join.floorTypeOnly": {
    en: "Mic is free. Type a caption to send it to every phone and the TV.",
    es: "El micr\u00f3fono est\u00e1 libre. Escribe un subt\u00edtulo para enviarlo a cada tel\u00e9fono y a la TV.",
    pt: "O microfone est\u00e1 livre. Digite uma legenda para envi\u00e1-la a cada celular e \u00e0 TV.",
  },
  "join.floorFree": {
    en: "Mic is free. Pick a spoken language, then Start \u2014 or type a caption.",
    es: "El micr\u00f3fono est\u00e1 libre. Elige el idioma hablado y luego Iniciar \u2014 o escribe un subt\u00edtulo.",
    pt: "O microfone est\u00e1 livre. Escolha o idioma falado e depois Iniciar \u2014 ou digite uma legenda.",
  },
  "join.spokenAria": { en: "Spoken language", es: "Idioma hablado", pt: "Idioma falado" },
  "join.watchAria": { en: "Watch", es: "Ver", pt: "Assistir" },

  "host.topic": { en: "Topic of the day", es: "Tema del d\u00eda", pt: "Tema do dia" },
  "host.clear": { en: "Clear", es: "Quitar", pt: "Limpar" },
  "host.askPlaceholder": {
    en: "head of household, contentment, forgiveness\u2026",
    es: "cabeza del hogar, contentamiento, perd\u00f3n\u2026",
    pt: "cabe\u00e7a do lar, contentamento, perd\u00e3o\u2026",
  },
  "host.ask": { en: "Ask for topic", es: "Pedir tema", pt: "Pedir tema" },
  "host.set": { en: "Set", es: "Fijar", pt: "Definir" },
  "host.askStatus": {
    en: "Type a theme and tap <strong>Ask for topic</strong> \u2014 or tap a chip.",
    es: "Escribe un tema y toca <strong>Pedir tema</strong> \u2014 o toca una opci\u00f3n.",
    pt: "Digite um tema e toque em <strong>Pedir tema</strong> \u2014 ou toque numa op\u00e7\u00e3o.",
  },
  "host.writing": { en: "Writing\u2026", es: "Escribiendo\u2026", pt: "Escrevendo\u2026" },
  "host.writingFor": {
    en: "Writing a handout for \u201c{query}\u201d\u2026",
    es: "Escribiendo una hoja para \u201c{query}\u201d\u2026",
    pt: "Escrevendo um folheto para \u201c{query}\u201d\u2026",
  },
  "host.hangOn": {
    en: "Hang on \u2014 verse, hook, teaching, and discussion questions are coming.",
    es: "Un momento \u2014 vienen el vers\u00edculo, el gancho, la ense\u00f1anza y las preguntas.",
    pt: "Um instante \u2014 v\u00eam o vers\u00edculo, o gancho, o ensino e as perguntas.",
  },
  "host.topicEmpty": {
    en: "Tap a chip, or type a theme and Ask for topic. The verse and teaching go to the TV.",
    es: "Toca una opci\u00f3n, o escribe un tema y Pedir tema. El vers\u00edculo y la ense\u00f1anza van a la TV.",
    pt: "Toque numa op\u00e7\u00e3o, ou digite um tema e Pedir tema. O vers\u00edculo e o ensino v\u00e3o para a TV.",
  },
  "host.noVerse": {
    en: "No built-in verse for this custom topic.",
    es: "No hay un vers\u00edculo incluido para este tema personalizado.",
    pt: "N\u00e3o h\u00e1 um vers\u00edculo inclu\u00eddo para este tema personalizado.",
  },
  "host.couldNotWrite": {
    en: "Could not write that handout.",
    es: "No se pudo escribir esa hoja.",
    pt: "N\u00e3o foi poss\u00edvel escrever esse folheto.",
  },
  "host.spokenLanguage": { en: "Spoken language", es: "Idioma hablado", pt: "Idioma falado" },
  "host.tvLayout": { en: "Watch language", es: "Idioma a ver", pt: "Idioma para assistir" },
  "host.layoutEn": { en: "English", es: "Ingl\u00e9s", pt: "Ingl\u00eas" },
  "host.layoutEs": { en: "Spanish", es: "Espa\u00f1ol", pt: "Espanhol" },
  "host.layoutPt": { en: "Portuguese", es: "Portugu\u00e9s", pt: "Portugu\u00eas" },
  "host.layoutAll": { en: "EN/ES/PT", es: "EN/ES/PT", pt: "EN/ES/PT" },
  "host.sendToTv": { en: "Send to TV", es: "Enviar a la TV", pt: "Enviar para a TV" },
  "host.sendToTvAria": {
    en: "Send to TV \u2014 show QR and TV caption link",
    es: "Enviar a la TV \u2014 muestra el QR y el enlace de subt\u00edtulos",
    pt: "Enviar para a TV \u2014 mostra o QR e o link das legendas",
  },
  "host.smartView": { en: "Smart View mode", es: "Modo Smart View", pt: "Modo Smart View" },
  "host.smartViewAria": {
    en: "Smart View mode \u2014 show caption layout for system mirroring",
    es: "Modo Smart View \u2014 muestra el dise\u00f1o de subt\u00edtulos para el espejo del sistema",
    pt: "Modo Smart View \u2014 mostra o layout das legendas para o espelhamento do sistema",
  },
  "host.joinPhones": { en: "Join on phones", es: "Unirse en tel\u00e9fonos", pt: "Entrar nos celulares" },
  "host.joinPhonesAria": {
    en: "Join on phones \u2014 show QR so brothers can watch and speak",
    es: "Unirse en tel\u00e9fonos \u2014 muestra el QR para que los hermanos vean y hablen",
    pt: "Entrar nos celulares \u2014 mostra o QR para os irm\u00e3os acompanharem e falarem",
  },
  "host.micHint": {
    en: "Keep Chrome in the foreground while you speak.",
    es: "Deja Chrome en primer plano mientras hablas.",
    pt: "Deixe o Chrome em primeiro plano enquanto fala.",
  },
  "host.onThisPhone": { en: "On this phone", es: "En este tel\u00e9fono", pt: "Neste celular" },
  "host.captionsHere": {
    en: "Captions will appear here and on the TV.",
    es: "Los subt\u00edtulos aparecer\u00e1n aqu\u00ed y en la TV.",
    pt: "As legendas v\u00e3o aparecer aqui e na TV.",
  },
  "host.clearWindows": { en: "Clear windows", es: "Limpiar ventanas", pt: "Limpar janelas" },
  "host.youSpeaking": { en: "You're speaking", es: "Est\u00e1s hablando", pt: "Voc\u00ea est\u00e1 falando" },
  "host.micFree": {
    en: "Mic is free. Brothers can take a turn from their phones.",
    es: "El micr\u00f3fono est\u00e1 libre. Los hermanos pueden hablar desde sus tel\u00e9fonos.",
    pt: "O microfone est\u00e1 livre. Os irm\u00e3os podem falar pelos celulares.",
  },
  "host.tvConnected": { en: "TV connected", es: "TV conectada", pt: "TV conectada" },
  "host.waitingForTv": { en: "Waiting for TV", es: "Esperando la TV", pt: "Aguardando a TV" },
  "host.onPhones": { en: "on phones", es: "en tel\u00e9fonos", pt: "nos celulares" },
  "host.copyTv": { en: "Copy TV link", es: "Copiar enlace de TV", pt: "Copiar link da TV" },
  "host.copyJoin": { en: "Copy join link", es: "Copiar enlace para unirse", pt: "Copiar link para entrar" },
  "host.joinCopied": { en: "Join link copied.", es: "Enlace para unirse copiado.", pt: "Link para entrar copiado." },
  "host.tvCopied": { en: "TV link copied.", es: "Enlace de TV copiado.", pt: "Link da TV copiado." },
  "host.langCopied": {
    en: "{lang} TV link copied.",
    es: "Enlace de TV {lang} copiado.",
    pt: "Link da TV {lang} copiado.",
  },
  "host.copyLangLink": {
    en: "Copy {lang} link",
    es: "Copiar enlace {lang}",
    pt: "Copiar link {lang}",
  },
  "host.open": { en: "Open", es: "Abrir", pt: "Abrir" },
  "host.sendTitle": { en: "Send to TV", es: "Enviar a la TV", pt: "Enviar para a TV" },
  "host.joinTitle": { en: "Join on phones", es: "Unirse en tel\u00e9fonos", pt: "Entrar nos celulares" },
  "host.brothersScan": {
    en: "Brothers scan to watch & speak",
    es: "Los hermanos escanean para ver y hablar",
    pt: "Os irm\u00e3os escaneiam para acompanhar e falar",
  },
  "host.sendStep1": {
    en: "On the TV browser, open this link or scan the QR.",
    es: "En el navegador de la TV, abre este enlace o escanea el QR.",
    pt: "No navegador da TV, abra este link ou escaneie o QR.",
  },
  "host.sendStep2": {
    en: "Keep the Fold on the mic page.",
    es: "Deja el Fold en la p\u00e1gina del micr\u00f3fono.",
    pt: "Deixe o Fold na p\u00e1gina do microfone.",
  },
  "host.sendStep3": {
    en: "Optional: three Chrome windows, one language per monitor \u2014 use the EN / ES / PT links below. That does not change other TVs in this room.",
    es: "Opcional: tres ventanas de Chrome, un idioma por monitor \u2014 usa los enlaces EN / ES / PT de abajo. Eso no cambia las otras TV de esta sala.",
    pt: "Opcional: tr\u00eas janelas do Chrome, um idioma por monitor \u2014 use os links EN / ES / PT abaixo. Isso n\u00e3o muda as outras TVs desta sala.",
  },
  "host.openTv": { en: "Open TV view", es: "Abrir vista de TV", pt: "Abrir vista da TV" },
  "host.openTvAria": {
    en: "Open TV view on this device for testing",
    es: "Abrir la vista de TV en este dispositivo para probar",
    pt: "Abrir a vista da TV neste aparelho para testar",
  },
  "host.oneLanguage": {
    en: "One language per monitor",
    es: "Un idioma por monitor",
    pt: "Um idioma por monitor",
  },
  "host.oneLanguageHint": {
    en: "Same room. Each window shows only that language, full-screen captions. Other TVs and Smart View still follow the layout chips.",
    es: "La misma sala. Cada ventana muestra solo ese idioma, subt\u00edtulos a pantalla completa. Las otras TV y Smart View siguen los chips de dise\u00f1o.",
    pt: "A mesma sala. Cada janela mostra s\u00f3 esse idioma, legendas em tela cheia. As outras TVs e o Smart View continuam seguindo os chips de layout.",
  },
  "host.joinStep1": {
    en: "Each brother scans this QR (camera app or Chrome) \u2014 Android or iPhone.",
    es: "Cada hermano escanea este QR (app de c\u00e1mara o Chrome) \u2014 Android o iPhone.",
    pt: "Cada irm\u00e3o escaneia este QR (app de c\u00e2mera ou Chrome) \u2014 Android ou iPhone.",
  },
  "host.joinStep2": {
    en: "Before the captions, they answer what language they are speaking and what language they want to watch, then tap Join. Watch stays on that phone. The TV still follows this room\u2019s layout.",
    es: "Antes de los subt\u00edtulos, responden qu\u00e9 idioma hablan y qu\u00e9 idioma quieren ver, y tocan Unirse. Ver se queda en ese tel\u00e9fono. La TV sigue el dise\u00f1o de esta sala.",
    pt: "Antes das legendas, eles respondem que idioma falam e que idioma querem acompanhar, e tocam Entrar. Assistir fica naquele celular. A TV continua no layout desta sala.",
  },
  "host.joinStep3": {
    en: "One speaker at a time. Chrome on Android is best for live speech; iPhone can always watch, and type a caption if the mic is not available.",
    es: "Un hablante a la vez. Chrome en Android es lo mejor para la voz en vivo; el iPhone siempre puede ver, y escribir un subt\u00edtulo si no hay micr\u00f3fono.",
    pt: "Um falante de cada vez. Chrome no Android \u00e9 o melhor para a fala ao vivo; o iPhone sempre pode acompanhar e digitar uma legenda se o microfone n\u00e3o estiver dispon\u00edvel.",
  },
  "host.smartTip": {
    en: "Now open system Smart View \u2192 My TV. TV will mirror these captions.",
    es: "Ahora abre el Smart View del sistema \u2192 My TV. La TV reflejar\u00e1 estos subt\u00edtulos.",
    pt: "Agora abra o Smart View do sistema \u2192 My TV. A TV vai espelhar estas legendas.",
  },
  "host.exitSmart": { en: "Exit Smart View mode", es: "Salir del modo Smart View", pt: "Sair do modo Smart View" },
  "host.reclaim": { en: "Reclaim mic", es: "Recuperar micr\u00f3fono", pt: "Recuperar microfone" },

  "tv.speaking": { en: "speaking", es: "hablando", pt: "falando" },
  "tv.phonesConnected": { en: "Phones connected", es: "Tel\u00e9fonos conectados", pt: "Celulares conectados" },
  "tv.phoneConnected": { en: "Phone connected", es: "Tel\u00e9fono conectado", pt: "Celular conectado" },
  "tv.waiting": { en: "Waiting for phone", es: "Esperando el tel\u00e9fono", pt: "Aguardando o celular" },
  "tv.live": { en: "Live", es: "En vivo", pt: "Ao vivo" },
} satisfies Record<string, Copy>;

export type UiStringKey = keyof typeof STRINGS;

let memory: UiLang | null = null;

export function isUiLang(value: unknown): value is UiLang {
  return value === "en" || value === "es" || value === "pt";
}

function storedUiLang(): UiLang {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (isUiLang(value)) return value;
  } catch {
    /* private mode / blocked storage */
  }
  return "en";
}

export function readUiLang(): UiLang {
  if (memory) return memory;
  memory = storedUiLang();
  return memory;
}

export function writeUiLang(lang: UiLang): void {
  if (!isUiLang(lang) || lang === readUiLang()) return;
  memory = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* private mode / blocked storage */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function subscribeUiLang(cb: () => void): () => void {
  const onEvent = () => cb();
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    memory = isUiLang(event.newValue) ? event.newValue : "en";
    cb();
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}

export function t(key: UiStringKey, vars?: Record<string, string | number>): string {
  const lang = readUiLang();
  let text: string = STRINGS[key][lang] || STRINGS[key].en;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function uiLangBarHtml(labelId = "ui-lang-label"): string {
  const chips = UI_LANGS.map(
    (lang) =>
      `<button class="chip" type="button" data-ui-lang="${lang}" aria-pressed="false">${UI_LANG_ENDONYM[lang]}</button>`,
  ).join("");
  return `
    <div class="ui-lang-bar" data-ui-lang-bar>
      <p class="control-label" id="${labelId}" data-i18n="chrome.language">Choose your language</p>
      <div class="chips" role="group" aria-labelledby="${labelId}">
        ${chips}
      </div>
    </div>
  `;
}

function paintUiLangBar(root: ParentNode): void {
  const lang = readUiLang();
  root.querySelectorAll<HTMLButtonElement>("[data-ui-lang]").forEach((btn) => {
    const on = btn.dataset.uiLang === lang;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
  });
}

/** Fill data-i18n nodes and the brand tagline. Safe to call again after a language change. */
export function applyI18n(root: ParentNode): void {
  const lang = readUiLang();
  if (typeof document !== "undefined") {
    document.documentElement.dataset.appLang = lang;
    const current = document.documentElement.getAttribute("lang") || "";
    if (!current.includes("-")) document.documentElement.lang = lang;
    root.querySelectorAll<HTMLElement>(".screen").forEach((screen) => {
      screen.lang = lang;
    });
  }
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key || !(key in STRINGS)) return;
    const value = t(key as UiStringKey);
    if (el.dataset.i18nMode === "html") el.innerHTML = value;
    else el.textContent = value;
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (!key || !(key in STRINGS) || !("placeholder" in el)) return;
    (el as HTMLInputElement).placeholder = t(key as UiStringKey);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((el) => {
    const key = el.dataset.i18nAria;
    if (!key || !(key in STRINGS)) return;
    el.setAttribute("aria-label", t(key as UiStringKey));
  });
  root.querySelectorAll<HTMLElement>(".brand-tagline").forEach((el) => {
    el.textContent = t("brand.tagline");
  });
  root.querySelectorAll<HTMLElement>(".brand-subline").forEach((el) => {
    el.textContent = t("brand.subline");
  });
  paintUiLangBar(root);
}

/** Language bar click handler. Calls onChange after the chrome has been repainted. */
export function bindUiLangBar(root: ParentNode, onChange?: () => void): () => void {
  const bar = root.querySelector<HTMLElement>("[data-ui-lang-bar]");
  const refresh = () => {
    applyI18n(root);
    onChange?.();
  };
  const onClick = (event: Event) => {
    const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-ui-lang]");
    if (!btn || !isUiLang(btn.dataset.uiLang)) return;
    writeUiLang(btn.dataset.uiLang);
  };
  bar?.addEventListener("click", onClick);
  const unsub = subscribeUiLang(refresh);
  refresh();
  return () => {
    bar?.removeEventListener("click", onClick);
    unsub();
  };
}
