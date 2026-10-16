type ExportOptions = { title: string; description: string; source: string; filename: string };

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function exportChartPng(svg: SVGSVGElement, options: ExportOptions): Promise<number> {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originalNodes = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const clonedNodes = [copy, ...Array.from(copy.querySelectorAll("*"))];
  const properties = ["fill", "stroke", "stroke-width", "stroke-dasharray", "opacity", "font-family", "font-size", "font-weight", "paint-order", "text-anchor", "visibility"];
  originalNodes.forEach((node, index) => {
    const computed = getComputedStyle(node);
    const target = clonedNodes[index] as SVGElement;
    properties.forEach(property => target.style.setProperty(property, computed.getPropertyValue(property)));
  });
  copy.querySelectorAll(".chart-tooltip").forEach(node => node.remove());
  // Export uses the full SVG canvas, so mobile screen compensation would crop the axis title.
  copy.querySelectorAll<SVGElement>(".chart-tick").forEach(node => node.style.setProperty("font-size", "14px"));
  copy.querySelectorAll<SVGElement>(".chart-axis-label").forEach(node => node.style.setProperty("font-size", "16px"));
  copy.querySelectorAll(".chart-jersey-dot").forEach(node => node.classList.remove("chart-dot-active"));
  const images = Array.from(copy.querySelectorAll("image"));
  const urls = [...new Set(images.map(image => image.getAttribute("href") ?? "").filter(Boolean))];
  const embedded = new Map<string, string>();
  // Bound parallel downloads; tolerate blocked cross-origin crests without losing any point.
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const response = await fetch(url, { mode: "cors", signal: AbortSignal.timeout(6000) });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) continue;
        embedded.set(url, await blobDataUrl(blob));
      } catch { /* text fallback below preserves the point */ }
    }
  }));
  let missing = 0;
  const namespace = "http://www.w3.org/2000/svg";
  for (const image of images) {
    const data = embedded.get(image.getAttribute("href") ?? "");
    if (data) { image.setAttribute("href", data); continue; }
    missing++;
    const fallback = document.createElementNS(namespace, "text");
    fallback.setAttribute("x", String(Number(image.getAttribute("x")) + Number(image.getAttribute("width")) / 2));
    fallback.setAttribute("y", String(Number(image.getAttribute("y")) + Number(image.getAttribute("height")) / 2 + 3));
    fallback.setAttribute("text-anchor", "middle");
    fallback.setAttribute("style", "fill:#003153;font:700 8px Arial");
    const name = image.parentElement?.getAttribute("aria-label")?.split("，")[0] ?? "";
    fallback.textContent = name.split(/\s+/).map(part => part[0]).join("").slice(0, 3);
    image.replaceWith(fallback);
  }
  copy.removeAttribute("class");
  copy.setAttribute("xmlns", namespace);
  copy.setAttribute("viewBox", "0 -82 820 944");
  copy.setAttribute("width", "1640");
  copy.setAttribute("height", "1888");
  copy.setAttribute("style", "background:white;font-family:Arial,'Microsoft YaHei',sans-serif");
  const background = document.createElementNS(namespace, "rect");
  for (const [key, value] of Object.entries({x:"0", y:"-82", width:"820", height:"944", fill:"white"})) background.setAttribute(key, value);
  copy.insertBefore(background, copy.firstChild);
  const line = (text: string, y: number, size: number, weight: number) => {
    const element = document.createElementNS(namespace, "text");
    element.setAttribute("x", "30"); element.setAttribute("y", String(y));
    element.setAttribute("style", `fill:#003153;font-size:${size}px;font-weight:${weight};font-family:Arial,'Microsoft YaHei',sans-serif`);
    element.textContent = text; copy.appendChild(element);
  };
  line(options.title, -50, 18, 700);
  line(options.description, -22, 11, 400);
  line(options.source, 836, 10, 400);
  const serialized = new XMLSerializer().serializeToString(copy);
  const svgUrl = URL.createObjectURL(new Blob([serialized], {type:"image/svg+xml;charset=utf-8"}));
  try {
    const raster = new Image();
    await new Promise<void>((resolve, reject) => { raster.onload = () => resolve(); raster.onerror = reject; raster.src = svgUrl; });
    const canvas = document.createElement("canvas"); canvas.width = 1640; canvas.height = 1888;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(raster, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG conversion failed")), "image/png"));
    const pngUrl = URL.createObjectURL(png);
    const download = document.createElement("a"); download.href = pngUrl; download.download = options.filename;
    document.body.appendChild(download); download.click(); download.remove();
    window.setTimeout(() => URL.revokeObjectURL(pngUrl), 30000);
    return missing;
  } finally { URL.revokeObjectURL(svgUrl); }
}
