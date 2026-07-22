import { Streamdown } from "streamdown";
import { BasirReferenceChip, type BasirRefType } from "@/components/BasirReferenceChip";

// Matches the "[[REF|type|id|title]]" tokens the Basir system prompt
// instructs the model to emit when pointing at real club content.
const REF_REGEX = /\[\[REF\|(activity|article|achievement|book)\|([^|]+)\|([^\]]+)\]\]/g;

/**
 * Splits an assistant message into markdown text segments (rendered via
 * Streamdown, same as before) and special reference tokens (rendered as
 * clickable BasirReferenceChip cards instead of plain link text).
 */
export function renderBasirContent(content: string) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  REF_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = REF_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textChunk = content.slice(lastIndex, match.index);
      if (textChunk.trim()) {
        parts.push(<Streamdown key={`t-${key++}`}>{textChunk}</Streamdown>);
      }
    }
    const [, type, id, title] = match;
    parts.push(
      <BasirReferenceChip
        key={`r-${key++}`}
        type={type as BasirRefType}
        id={id.trim()}
        title={title.trim()}
      />
    );
    lastIndex = REF_REGEX.lastIndex;
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
