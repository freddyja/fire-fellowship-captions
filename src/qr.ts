import { renderSVG } from "uqr";

/** Large QR of the TV caption URL so the meeting TV can open it without typing. */
export function tvQrSvg(url: string): string {
  return renderSVG(url, {
    ecc: "M",
    border: 2,
    pixelSize: 8,
    whiteColor: "#f4ead8",
    blackColor: "#120c09",
  });
}
