import { brandBlock } from "../brand";
import {
  canPromptInstall,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstall,
  wasJustInstalled,
} from "../install";
import { generateRoomCode, isRoomCode, normalizeRoomCode } from "../room";
import { goto } from "../router";
import { bindUiLangBar, t, uiLangBarHtml } from "../ui-lang";

export function mountHome(root: HTMLElement): () => void {
  root.innerHTML = `
    <section class="screen home-screen entry-scene scene-bg">
      ${brandBlock()}
      ${uiLangBarHtml("home-ui-lang-label")}
      <p class="lede" data-i18n="home.lede">
        Live speech on this phone. Pick today’s Bible topic; the TV shows the verse, a short handout, and captions.
      </p>
      <button class="primary home-create" data-create type="button" data-i18n="home.create">Create room</button>
      <details class="home-fold">
        <summary data-i18n="home.haveCode">Have a room code?</summary>
        <form class="home-code" data-join>
          <label class="field">
            <span data-i18n="home.roomCode">Room code</span>
            <input name="room" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" />
          </label>
          <button class="secondary" type="submit" data-i18n="home.openTv">Open TV windows</button>
          <button class="secondary" data-join-phone type="button" data-i18n="home.joinPhone">Join on this phone</button>
        </form>
      </details>
      <details class="home-fold">
        <summary data-i18n="home.installTitle">Install on this phone</summary>
        <div class="home-fold-body">
          <p class="hint" data-i18n="home.hostHint" data-i18n-mode="html">Host: <strong>Chrome</strong> on the Galaxy Z Fold (not Samsung Internet). Brothers: scan <strong>Join on phones</strong> in <strong>Chrome on Android</strong> or <strong>Safari / Chrome on iPhone</strong> — no app store install. <strong>Send to TV</strong> opens the caption page in the TV’s own browser. <strong>Smart View mode</strong> is Fold-only mirroring.</p>
          <aside class="install-card" data-install>
            <p class="install-copy" data-install-copy></p>
            <button class="primary" data-install-btn type="button" data-i18n="home.installBtn" hidden>Install app</button>
            <ol class="install-steps" data-install-steps></ol>
          </aside>
        </div>
      </details>
    </section>
  `;

  const create = root.querySelector("[data-create]");
  const form = root.querySelector("[data-join]");
  const joinPhone = root.querySelector("[data-join-phone]");
  const input = root.querySelector("input[name='room']") as HTMLInputElement;
  const installCard = root.querySelector("[data-install]") as HTMLElement;
  const installCopy = root.querySelector("[data-install-copy]") as HTMLElement;
  const installBtn = root.querySelector("[data-install-btn]") as HTMLButtonElement;
  const installSteps = root.querySelector("[data-install-steps]") as HTMLOListElement;

  const paintInstall = () => {
    const standalone = isStandaloneDisplay();
    installCard.dataset.state = standalone ? "standalone" : canPromptInstall() ? "ready" : "guide";
    installBtn.hidden = standalone || !canPromptInstall();

    if (standalone) {
      installCopy.textContent = t("home.installStandalone");
      installSteps.innerHTML = t("home.installStandaloneSteps");
      return;
    }

    if (wasJustInstalled()) {
      installCopy.textContent = t("home.installJust");
      installSteps.innerHTML = t("home.installJustSteps");
      return;
    }

    installCopy.textContent = t("home.installGuide");
    installSteps.innerHTML = canPromptInstall() ? t("home.installReadySteps") : t("home.installManualSteps");
  };

  const onCreate = () => goto("phone", generateRoomCode());
  const onInput = () => {
    input.value = normalizeRoomCode(input.value);
  };
  const onJoin = (event: Event) => {
    event.preventDefault();
    const room = normalizeRoomCode(input.value);
    if (!isRoomCode(room)) {
      input.focus();
      return;
    }
    goto("tv", room);
  };
  const onJoinPhone = () => {
    const room = normalizeRoomCode(input.value);
    if (!isRoomCode(room)) {
      input.focus();
      return;
    }
    goto("join", room);
  };
  const onInstall = () => {
    void promptInstall().then(paintInstall);
  };

  create?.addEventListener("click", onCreate);
  input.addEventListener("input", onInput);
  form?.addEventListener("submit", onJoin);
  joinPhone?.addEventListener("click", onJoinPhone);
  installBtn.addEventListener("click", onInstall);
  const unsubscribe = subscribeInstall(paintInstall);
  const unbindLang = bindUiLangBar(root, paintInstall);

  return () => {
    create?.removeEventListener("click", onCreate);
    input.removeEventListener("input", onInput);
    form?.removeEventListener("submit", onJoin);
    joinPhone?.removeEventListener("click", onJoinPhone);
    installBtn.removeEventListener("click", onInstall);
    unsubscribe();
    unbindLang();
  };
}
