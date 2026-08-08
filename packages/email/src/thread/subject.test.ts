import { describe, expect, it } from "vitest";
import {
  normaliseSubject,
  isGenericSubject,
  canFallbackOnSubject,
  MIN_SUBJECT_LENGTH,
} from "./subject";

describe("normaliseSubject — Story 2.6 AC2", () => {
  it("strips the English prefixes", () => {
    expect(normaliseSubject("Re: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
    expect(normaliseSubject("Fwd: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
    expect(normaliseSubject("FW: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
  });

  it.each([
    ["AW: Rechnung 4021 überfällig", "rechnung 4021 überfällig"],
    ["SV: Faktura 4021 forfalder", "faktura 4021 forfalder"],
    ["TR: Facture 4021 en retard", "facture 4021 en retard"],
    ["VS: Lasku 4021 myöhässä", "lasku 4021 myöhässä"],
    ["ODP: Faktura 4021 zaległa", "faktura 4021 zaległa"],
    ["YNT: Fatura 4021 gecikmiş", "fatura 4021 gecikmiş"],
    ["WG: Rechnung 4021 überfällig", "rechnung 4021 überfällig"],
  ])("strips the localised prefix in %s", (input, expected) => {
    // Story 2.6 Task 2 calls these "the common miss" — a developer testing
    // against their own client sees Re:/Fwd: and everything appears to work.
    expect(normaliseSubject(input)).toBe(expected);
  });

  it("collapses a long chain in one pass", () => {
    expect(normaliseSubject("Re: Fwd: RE: AW: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
  });

  it("handles Outlook's bracketed counter", () => {
    expect(normaliseSubject("Re[2]: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
    expect(normaliseSubject("RE[10]: Invoice 4021 overdue")).toBe("invoice 4021 overdue");
  });

  it("collapses whitespace and lowercases", () => {
    expect(normaliseSubject("  Re:   Invoice   4021  ")).toBe("invoice 4021");
  });

  it("does not eat a subject that merely starts with those letters", () => {
    // "Reminder" begins with "re" and is not a prefix. Stripping it would
    // merge unrelated threads, which is the failure this whole module avoids.
    expect(normaliseSubject("Reminder: your invoice is overdue")).toBe(
      "reminder: your invoice is overdue",
    );
    expect(normaliseSubject("Refund request for order 88")).toBe("refund request for order 88");
  });

  it("survives an empty or whitespace subject", () => {
    expect(normaliseSubject("")).toBe("");
    expect(normaliseSubject("   ")).toBe("");
    expect(normaliseSubject("Re:")).toBe("");
  });
});

describe("isGenericSubject — refusing the fallback is the safe failure", () => {
  it("refuses short subjects", () => {
    expect(isGenericSubject("hello")).toBe(true);
    expect(isGenericSubject("invoice")).toBe(true);
    expect(isGenericSubject("x".repeat(MIN_SUBJECT_LENGTH - 1))).toBe(true);
  });

  it("refuses a long subject made only of common words", () => {
    // Length alone is not enough: these are long and say nothing.
    expect(isGenericSubject("question about the order")).toBe(true);
    expect(isGenericSubject("follow up on my request")).toBe(true);
    expect(isGenericSubject("please update my account")).toBe(true);
  });

  it("requires positive evidence, so an unlisted short word does not make a subject distinctive", () => {
    // The regression that changed the rule. The first version asked whether
    // *every* word was common, so one word missing from the list — "on" — made
    // "follow up on my request" look distinctive and PERMITTED a merge. That is
    // the unsafe direction; Story 2.6's ruling is "when in doubt, split".
    expect(isGenericSubject("follow up on my order")).toBe(true);
    expect(isGenericSubject("a question re the invoice")).toBe(true);
  });

  it("accepts a subject with an identifier", () => {
    expect(isGenericSubject("invoice 4021 overdue")).toBe(false);
    expect(isGenericSubject("rechnung 4021 überfällig")).toBe(false);
  });

  it("accepts a subject with a distinctive word and no digits", () => {
    expect(isGenericSubject("reminder your subscription lapsed")).toBe(false);
    expect(isGenericSubject("shipment damaged on arrival")).toBe(false);
  });
});

describe("canFallbackOnSubject — Story 2.6's ruling", () => {
  it("THE NEGATIVE CONTROL — two customers sharing a generic subject cannot merge", () => {
    // A wrong merge shows one customer's mail inside another's conversation,
    // and RLS cannot prevent it because both belong to the same tenant.
    // Splitting looks disorganised; merging is a disclosure.
    expect(canFallbackOnSubject("Re: Question")).toBe(false);
    expect(canFallbackOnSubject("Hello")).toBe(false);
    expect(canFallbackOnSubject("Fwd: Invoice")).toBe(false);
  });

  it("permits the fallback for a distinctive subject", () => {
    expect(canFallbackOnSubject("Re: Invoice 4021 overdue")).toBe(true);
  });

  it("refuses when the subject is only a prefix", () => {
    expect(canFallbackOnSubject("Re:")).toBe(false);
  });
});
