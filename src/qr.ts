import { renderSVG } from "uqr";

/** Large, high-contrast QR of the current room’s TV caption URL. */
export function tvQrSvg(url: string): string {
  return renderSVG(url, {
    border: 4,
    ecc: "M",
    pixelSize: 1,
    whiteColor: "#ffffff",
    blackColor: "#120c09",
  }).replace(
    "<svg ",
    '<svg role="img" aria-label="QR code for the TV caption page" shape-rendering="crispEdges" ',
  );
}

export const qrSvg = tvQrSvg;
