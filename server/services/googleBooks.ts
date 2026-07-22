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

interface GoogleVolume {
  id: string;
  volumeInfo?: GoogleVolumeInfo;
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
  const byGoogleId = new Map(
    clubBooks.filter((b) => b.googleBooksId).map((b) => [b.googleBooksId as string, b])
  );

  return items.map((item) => {
    const info = item.volumeInfo ?? {};
    const isbn =
      info.industryIdentifiers?.find((i) => i.type === "ISBN_13")?.identifier ??
      info.industryIdentifiers?.find((i) => i.type === "ISBN_10")?.identifier ??
      null;
    const clubBook = byGoogleId.get(item.id);

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
    };
  });
}
