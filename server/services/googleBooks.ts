import { getBooks } from "../db.js";

interface GoogleVolumeInfo {
  title?: string;
  authors?: string[];
  pageCount?: number;
  publishedDate?: string;
  description?: string;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: { type: string; identifier: string }[];
}

interface GoogleAccessInfo {
  publicDomain?: boolean;
  webReaderLink?: string;
  pdf?: { isAvailable?: boolean; downloadLink?: string };
  epub?: { isAvailable?: boolean; downloadLink?: string };
}

interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
  accessInfo?: GoogleAccessInfo;
}

export interface BookSearchResult {
  googleBooksId: string;
  title: string;
  author: string;
  pageCount: number | null;
  publishedDate: string | null;
  description: string | null;
  coverImageUrl: string | null;
  isbn: string | null;
  isRead: boolean;
  // Availability info coming straight from Google Books; a downloadLink is
  // only ever populated by Google for public-domain / freely downloadable
  // titles, so we surface exactly what the API gives us rather than
  // fabricating a download for copyrighted books.
  pdfAvailable: boolean;
  pdfDownloadLink: string | null;
  webReaderLink: string | null;
  previewLink: string | null;
  clubInfo: {
    title: string;
    pageCount: number | null;
    partsCount: number | null;
    completedAt: string | null;
    articleId: number | null;
    summary: string | null;
    clubRating: number | null;
    genre: string | null;
  } | null;
}

type ClubBookForSearch = {
  googleBooksId: string | null;
  title: string;
  pageCount: number | null;
  partsCount: number | null;
  completedAt: string | null;
  articleId: number | null;
  summary: string | null;
  clubRating: number | null;
  genre: string | null;
};

function mapVolume(item: GoogleVolume, clubBook?: ClubBookForSearch) {
  const info = item.volumeInfo ?? {};
  const access = item.accessInfo ?? {};
  const isbn =
    info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
    null;

  return {
    googleBooksId: item.id,
    title: info.title ?? "بدون عنوان",
    author: info.authors?.join("، ") ?? "غير معروف",
    pageCount: info.pageCount ?? null,
    publishedDate: info.publishedDate ?? null,
    description: info.description ?? null,
    coverImageUrl: info.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
    isbn,
    isRead: !!clubBook,
    pdfAvailable: !!access.pdf?.isAvailable && !!access.pdf?.downloadLink,
    pdfDownloadLink: access.pdf?.isAvailable ? access.pdf?.downloadLink ?? null : null,
    webReaderLink: access.webReaderLink ?? null,
    previewLink: `https://books.google.com/books?id=${item.id}`,
    clubInfo: clubBook
      ? {
          title: clubBook.title,
          pageCount: clubBook.pageCount,
          partsCount: clubBook.partsCount,
          completedAt: clubBook.completedAt,
          articleId: clubBook.articleId,
          summary: clubBook.summary,
          clubRating: clubBook.clubRating,
          genre: clubBook.genre,
        }
      : null,
  } satisfies BookSearchResult;
}

function buildClubIndex(clubBooks: ClubBookForSearch[]) {
  return new Map(
    clubBooks.filter((b) => b.googleBooksId).map((b) => [b.googleBooksId as string, b])
  );
}

/**
 * Searches the Google Books API and cross-references each result against
 * the club's own "books read" table (matched by googleBooksId) so the
 * search page can show a "تمت قراءته" badge with the club's own notes,
 * or "-" placeholders + "لم تتم قراءته" when the club hasn't read it yet.
 */
export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "20");
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Google Books API error: ${res.status}`);
  }
  const data = (await res.json()) as { items?: GoogleVolume[] };
  const items = data.items ?? [];

  const clubBooks = await getBooks();
  const byGoogleId = buildClubIndex(clubBooks);

  return items.map((item) => mapVolume(item, byGoogleId.get(item.id)));
}

/**
 * Fetches a single Google Books volume by id. Used by the book detail page
 * so that a shared link (/books/google/:id) resolves to the book's info
 * and download/read links independently of any prior search.
 */
export async function getGoogleBookById(id: string): Promise<BookSearchResult | null> {
  const url = new URL(`https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(id)}`);
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (apiKey) url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Google Books API error: ${res.status}`);
  }
  const item = (await res.json()) as GoogleVolume;
  if (!item?.id) return null;

  const clubBooks = await getBooks();
  const byGoogleId = buildClubIndex(clubBooks);

  return mapVolume(item, byGoogleId.get(item.id));
}
