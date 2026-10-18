// Renders the PWA icons into public/. Re-run after changing the design: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import { ImageResponse } from "next/og.js";
import React from "react";

const h = React.createElement;

function icon(size, { maskable = false } = {}) {
  // Maskable icons keep the mark inside the central 80% safe zone.
  const mark = maskable ? size * 0.36 : size * 0.46;
  return new ImageResponse(
    h(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #065f46 100%)",
          borderRadius: maskable ? 0 : size * 0.22,
        },
      },
      h("div", { style: { fontSize: mark, fontWeight: 800, color: "#ecfdf5", letterSpacing: -mark * 0.06 } }, "HA"),
    ),
    { width: size, height: size },
  );
}

const outputs = [
  ["public/icons/icon-192.png", icon(192)],
  ["public/icons/icon-512.png", icon(512)],
  ["public/icons/maskable-512.png", icon(512, { maskable: true })],
  ["public/apple-touch-icon.png", icon(180, { maskable: true })],
];

for (const [path, response] of outputs) {
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
  console.log("wrote", path);
}
