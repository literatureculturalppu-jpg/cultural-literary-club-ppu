import { Streamdown } from "streamdown";
import { BasirReferenceChip, type BasirRefType } from "@/components/BasirReferenceChip";
import { BasirNavChip, isAllowedNavPath } from "@/components/BasirNavChip";
import { BasirImageGenChip } from "@/components/BasirImageGenChip";
import { BasirPdfExportChip } from "@/components/BasirPdfExportChip";

// Matches the "[[REF|type|id|title]]" tokens the Basir system prompt
// instructs the model to emit when pointing at real club content, the
// "[[NAV|path|label]]" tokens it uses to suggest moving the user to
// another page of the site, and the "[[IMGGEN|prompt]]" / "[[PDFGEN|title]]"
// tokens it uses to offer on-device image generation / PDF export.
const TOKEN_REGEX = /\[\[(REF|NAV|GOTO|IMGGEN|PDFGEN)\|([^\]]+)\]\]/g;

/**
 * Strips every recognized Basir token from a message, leaving only the
 * plain text — used as the printable body when exporting a message to PDF,
 * so the exported file doesn't contain raw "[[...]]" syntax.
 */
function stripTokens(content: string): string {
  return content.replace(TOKEN_REGEX, "").trim();
}

/**
 * Splits an assistant message into markdown text segments (rendered via
 * Streamdown, same as before) and special reference/navigation/action
 * tokens (rendered as clickable chip cards instead of plain link text).
 */
export function renderBasirContent(content: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  const plainText = stripTokens(content);

  while ((match = TOKEN_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index);
      if (textChunk.trim()) {
        parts.push(<Streamdown key={`t-${key++}`}>{textChunk}</Streamdown>);
      }
    }

    const [full, kind, rest] = match;
    if (kind === "REF") {
      const [type, id, title] = rest.split("|");
      if (type && id && title) {
        parts.push(
          <BasirReferenceChip
            key={`r-${key++}`}
            type={type as BasirRefType}
            id={id.trim()}
            title={title.trim()}
          />
        );
      }
    } else if (kind === "NAV") {
      const [path, label] = rest.split("|");
      if (path && label && isAllowedNavPath(path.trim())) {
        parts.push(<BasirNavChip key={`n-${key++}`} path={path.trim()} label={label.trim()} />);
      } else {
        // Disallowed/malformed path: fall back to plain text rather than
        // silently dropping it, so nothing is ever hidden from the user.
        parts.push(<Streamdown key={`t-${key++}`}>{full}</Streamdown>);
      }
    } else if (kind === "GOTO") {
      // Normally stripped and acted upon already in useBasirChat before the
      // message is stored; if one ever slips through unstripped, render
      // nothing rather than leaking raw "[[GOTO|...]]" syntax to the user.
    } else if (kind === "IMGGEN") {
      const prompt = rest.trim();
      if (prompt) {
        parts.push(<BasirImageGenChip key={`i-${key++}`} prompt={prompt} />);
      }
    } else if (kind === "PDFGEN") {
      const title = rest.trim();
      parts.push(
        <BasirPdfExportChip key={`p-${key++}`} title={title} content={plainText} />
      );
    }

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  if (lastIndex < content.length) {
    const textChunk = content.slice(lastIndex);
    if (textChunk.trim()) {
      parts.push(<Streamdown key={`t-${key++}`}>{textChunk}</Streamdown>);
    }
  }

  if (parts.length === 0) {
    parts.push(<Streamdown key="only">{content}</Streamdown>);
  }

  return <>{parts}</>;
}

