import { brandBlock } from "../brand";
import { generateRoomCode, isRoomCode, normalizeRoomCode } from "../room";
import { goto } from "../router";

export function mountHome(root: HTMLElement): () => void {
  root.innerHTML = `
    <section class="screen">
      ${brandBlock()}
      <p class="lede">
        Phone captures live speech. Pick today’s Bible topic on the phone; the TV shows the verse, a short handout, and English, Spanish, and Portuguese caption windows.
      </p>
      <div class="stack">
        <button class="primary" data-create type="button">Create room on this phone</button>
        <form class="stack" data-join>
          <label class="field">
            <span>Join TV with room code</span>
            <input name="room" maxlength="4" autocomplete="off" spellcheck="false" placeholder="ABCD" />
          </label>
          <button class="secondary" type="submit">Open TV windows</button>
        </form>
        <p class="hint">Use <strong>Chrome</strong> on the phone (Galaxy Z Fold 7: Chrome, not Samsung Internet). The TV can be any browser on the same network.</p>
      </div>
    </section>
  `;

  const create = root.querySelector("[data-create]");
  const form = root.querySelector("[data-join]");
  const input = root.querySelector("input[name='room']") as HTMLInputElement;

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

  create?.addEventListener("click", onCreate);
  input.addEventListener("input", onInput);
  form?.addEventListener("submit", onJoin);

  return () => {
    create?.removeEventListener("click", onCreate);
    input.removeEventListener("input", onInput);
    form?.removeEventListener("submit", onJoin);
  };
}
