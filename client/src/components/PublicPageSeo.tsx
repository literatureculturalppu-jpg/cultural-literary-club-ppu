import { useEffect } from "react";
import { useLocation } from "wouter";

const SITE_ORIGIN = "https://cultural-literary-club-ppu.vercel.app";
const CLUB_SHARE_IMAGE = `${SITE_ORIGIN}/club-icon-512.png`;

type PublicPageMeta = {
  title: string;
  description: string;
  keywords: string;
};

const PUBLIC_PAGE_META: Record<string, PublicPageMeta> = {
  "/": {
    title: "النادي الثقافي الأدبي | جامعة بوليتكنك فلسطين",
    description:
      "النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين: أنشطة ثقافية وأدبية، مقالات، كتب، إنجازات وفعاليات طلابية.",
    keywords:
      "النادي الثقافي الأدبي, النادي الثقافي الأدبي جامعة بوليتكنك فلسطين, PPU, أنشطة ثقافية, فعاليات طلابية",
  },
  "/about": {
    title: "عن النادي الثقافي الأدبي | جامعة بوليتكنك فلسطين",
    description:
      "تعرف على تاريخ النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين ورؤيته وأهدافه وهيئته الإدارية.",
    keywords:
      "عن النادي الثقافي الأدبي, أهداف النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين, ثقافة وأدب",
  },
  "/activities": {
    title: "الأنشطة والفعاليات | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "استكشف الأنشطة والفعاليات الثقافية والأدبية وورش العمل التي يقدمها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "أنشطة ثقافية جامعة بوليتكنك فلسطين, فعاليات أدبية, ورش كتابة إبداعية, النادي الثقافي الأدبي",
  },
  "/articles": {
    title: "المقالات والمحتوى الثقافي | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "اقرأ مقالات وقراءات أدبية وثقافية ينشرها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "مقالات أدبية, محتوى ثقافي, أدب عربي, النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين",
  },
  "/achievements": {
    title: "الإنجازات والجوائز | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "تعرّف على أبرز إنجازات وجوائز النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "إنجازات النادي الثقافي الأدبي, جوائز طلابية, جامعة بوليتكنك فلسطين",
  },
  "/books": {
    title: "الكتب والقراءات | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "تصفح كتبًا وقراءات مقترحة من النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "كتب أدبية, قراءات ثقافية, النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين",
  },
  "/teams": {
    title: "فرق النادي | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "تعرّف على فرق ومبادرات النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "فرق النادي الثقافي الأدبي, مبادرات طلابية, جامعة بوليتكنك فلسطين",
  },
  "/quick-links": {
    title: "روابط مفيدة | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "روابط ومصادر مفيدة يقدمها النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords:
      "روابط ثقافية, مصادر أدبية, النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين",
  },
  "/privacy-policy": {
    title: "سياسة الخصوصية | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "سياسة الخصوصية الخاصة بموقع النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords: "سياسة الخصوصية, النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين",
  },
  "/terms-of-use": {
    title: "شروط الاستخدام | النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين",
    description:
      "شروط استخدام موقع النادي الثقافي الأدبي في جامعة بوليتكنك فلسطين.",
    keywords: "شروط الاستخدام, النادي الثقافي الأدبي, جامعة بوليتكنك فلسطين",
  },
};

function setMeta(attribute: "name" | "property", value: string, content: string) {
  const selector = `meta[${attribute}="${value}"]`;
  let tag = document.head.querySelector<HTMLMetaElement>(selector);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

/**
 * Keeps browser navigation within the SPA aligned with the static SEO pages
 * emitted at build time. Search crawlers receive the static tags immediately,
 * while visitors who navigate between routes receive the same metadata.
 */
export default function PublicPageSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const meta = PUBLIC_PAGE_META[location];
    if (!meta) return;

    const canonicalUrl = `${SITE_ORIGIN}${location === "/" ? "/" : location}`;
    document.title = meta.title;

    setMeta("name", "description", meta.description);
    setMeta("name", "keywords", meta.keywords);
    setMeta("property", "og:title", meta.title);
    setMeta("property", "og:description", meta.description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", CLUB_SHARE_IMAGE);
    setMeta("property", "og:image:alt", "شعار النادي الثقافي الأدبي - جامعة بوليتكنك فلسطين");
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", meta.title);
    setMeta("name", "twitter:description", meta.description);
    setMeta("name", "twitter:image", CLUB_SHARE_IMAGE);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);
  }, [location]);

  return null;
}
