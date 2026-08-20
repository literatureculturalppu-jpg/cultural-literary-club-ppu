import { useEffect } from "react";

const SITE_ORIGIN = "https://cultural-literary-club-ppu.vercel.app";
const SHARE_IMAGE = `${SITE_ORIGIN}/club-share-card-1200x630.png?v=1`;

function setMeta(attribute: "name" | "property", value: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${value}"]`);
  if (!tag) { tag = document.createElement("meta"); tag.setAttribute(attribute, value); document.head.appendChild(tag); }
  tag.content = content;
}

export function ContentDetailSeo({ title, description, path, structuredData }: {
  title: string; description: string; path: string; structuredData: Record<string, unknown>;
}) {
  useEffect(() => {
    const url = `${SITE_ORIGIN}${path}`;
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", "index, follow, max-image-preview:large, max-snippet:-1");
    setMeta("property", "og:title", title); setMeta("property", "og:description", description);
    setMeta("property", "og:url", url); setMeta("property", "og:image", SHARE_IMAGE);
    setMeta("name", "twitter:title", title); setMeta("name", "twitter:description", description);
    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; document.head.appendChild(canonical); }
    canonical.href = url;
    const script = document.createElement("script");
    script.type = "application/ld+json"; script.dataset.contentSeo = "true";
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
    return () => script.remove();
  }, [title, description, path, structuredData]);
  return null;
}
