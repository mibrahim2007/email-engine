// @repo/email — parse, sanitize, thread, render. Epics 2 and 6.
//
// The pure half only so far: subject normalisation and the threading-header
// arithmetic. Parsing and sanitisation need `mailparser` and DOMPurify plus the
// fixture corpora Stories 2.5 and 2.6 specify, which is real work rather than a
// stub, so they are absent rather than sketched.

export {
  normaliseSubject,
  isGenericSubject,
  canFallbackOnSubject,
  MIN_SUBJECT_LENGTH,
} from "./thread/subject";
export {
  buildReplyHeaders,
  truncateReferences,
  replyParent,
  MAX_REFERENCES,
  type MessageId,
  type ReplyHeaders,
} from "./thread/references";
