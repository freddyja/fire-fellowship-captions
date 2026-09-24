import { brandBlock } from "../brand";
import {
  canPromptInstall,
  isStandaloneDisplay,
  promptInstall,
  subscribeInstall,
  wasJustInstalled,
} from "../install";
import { bindLocalSetup, localSetupInnerHtml } from "../local-setup";
import { bindOfflineModeToggle } from "../offline-mode";
import { generateRoomCode, isRoomCode, normalizeRoomCode } from "../room";
import { goto } from "../router";
import { bindUiLangBar, t, uiLangBarHtml } from "../ui-lang";

export function mountHome(root: HTMLElement): () => void {
  root.innerHTML = `
    <section class="screen">
      ${brandBlock()}
      ${uiLangBarHtml("home-ui-lang-label")}
      <p class="lede" data-i18n="home.lede">
        Phone captures live speech. Pick today’s Bible topic on the phone; the TV shows the verse, a short handout, and English, Spanish, and Portuguese caption windows.
      </p>
      <div class="stack">
        <button class="primary" data-create type="button" data-i18n="home.create">Create room on this phone</button>
        <form class="stack" data-join>
          <label class="field">
            <span data-i18n="home.roomCode">Room code</span>
            <input name="room" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" />
          </label>
          <button class="secondary" type="submit" data-i18n="home.openTv">Open TV windows</button>
          <button class="secondary" data-join-phone type="button" data-i18n="home.joinPhone">Join on this phone</button>
        </form>
        <p class="hint" data-i18n="home.hostHint" data-i18n-mode="html">Host: <strong>Chrome</strong> on the Galaxy Z Fold (not Samsung Internet). Brothers: scan <strong>Join on phones</strong> in <strong>Chrome on Android</strong> or <strong>Safari / Chrome on iPhone</strong> — no app store install. <strong>Send to TV</strong> opens the caption page in the TV’s own browser. <strong>Smart View mode</strong> is Fold-only mirroring.</p>
        <div class="meeting-mode">
          <p class="control-label" data-i18n="home.meetingMode">Meeting mode</p>
          <button class="chip" data-offline-mode type="button" aria-pressed="false" data-i18n="home.offline" data-i18n-aria="home.offlineAria" aria-label="Offline / Local meeting — use the built-in dictionary, no MyMemory">
            Offline / Local meeting
          </button>
          <p class="offline-banner" data-offline-banner hidden>
            <span data-i18n="home.offlineLead">Offline translate (limited phrases). For full local setup see</span>
            <a href="#local-setup" data-i18n="home.laptopSteps">laptop steps</a>.
          </p>
          <p class="hint" data-i18n="home.offlineHint">On: built-in dictionary (no MyMemory). Off: hosted default (MyMemory, then MinT if the daily quota is gone).</p>
        </div>
      </div>
      <aside class="install-card" id="local-setup" data-local-setup>
        ${localSetupInnerHtml()}
      </aside>
      <aside class="install-card" data-install>
        <h2 data-i18n="home.installTitle">Install on this phone</h2>
        <p class="install-copy" data-install-copy></p>
        <button class="primary" data-install-btn type="button" data-i18n="home.installBtn" hidden>Install app</button>
        <ol class="install-steps" data-install-steps></ol>
      </aside>
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
  const offlineBtn = root.querySelector("[data-offline-mode]") as HTMLButtonElement;
  const offlineBanner = root.querySelector("[data-offline-banner]") as HTMLElement;
  const localSetup = root.querySelector("[data-local-setup]") as HTMLElement;

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
  const unbindOffline = bindOfflineModeToggle(offlineBtn, { banner: offlineBanner });
  const unbindSetup = bindLocalSetup(localSetup);
  const unbindLang = bindUiLangBar(root, paintInstall);

  return () => {
    create?.removeEventListener("click", onCreate);
    input.removeEventListener("input", onInput);
    form?.removeEventListener("submit", onJoin);
    joinPhone?.removeEventListener("click", onJoinPhone);
    installBtn.removeEventListener("click", onInstall);
    unsubscribe();
    unbindOffline();
    unbindSetup();
    unbindLang();
  };
}
