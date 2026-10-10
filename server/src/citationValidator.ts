import crypto from "crypto";
import { EvidenceItemRecord, ClaimItem } from "./agent";

export interface CitationReference {
  id: string;
  label?: string;
  source?: string;
  is_verified?: boolean;
}

export interface CitationValidationReport {
  isValid: boolean;
  integrityScore: number; // 0 - 100%
  totalCitationsFound: number;
  validCitations: CitationReference[];
  hallucinatedCitations: string[];
  uncitedEvidence: Array<{ id: string; label: string; evidence_type: string }>;
  groundedClaimsCount: number;
  verificationHash: string;
  auditedAt: string;
}

/**
 * Validates that all evidence citations inside the rebuttal narrative are 
 * strictly grounded in the database, with zero fabricated or hallucinated citations.
 */
export function validateCitations(
  narrative: string,
  evidenceRecords: EvidenceItemRecord[],
  claims: ClaimItem[]
): CitationValidationReport {
  const auditedAt = new Date().toISOString();
  const evidenceMap = new Map<string, EvidenceItemRecord>();
  evidenceRecords.forEach((e) => evidenceMap.set(e.id, e));

  // Regular expression to capture all bracketed citations e.g. [Citation: ev-12345] or [Citation: ev-12345-1]
  const citationRegex = /\[Citation:\s*([^\]]+)\]/gi;
  const foundCitationIds = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = citationRegex.exec(narrative)) !== null) {
    const rawId = match[1].trim();
    foundCitationIds.add(rawId);
  }

  const validCitations: CitationReference[] = [];
  const hallucinatedCitations: string[] = [];

  for (const id of foundCitationIds) {
    const ev = evidenceMap.get(id);
    if (ev) {
      validCitations.push({
        id: ev.id,
        label: ev.label,
        source: ev.source,
        is_verified: ev.is_verified === 1,
      });
    } else {
      hallucinatedCitations.push(id);
    }
  }

  // Find verified evidence records that were not cited
  const uncitedEvidence = evidenceRecords
    .filter((e) => !foundCitationIds.has(e.id) && e.status === "FOUND")
    .map((e) => ({
      id: e.id,
      label: e.label,
      evidence_type: e.evidence_type,
    }));

  const totalCitations = foundCitationIds.size;
  let integrityScore = 100;

  if (totalCitations > 0) {
    const validCount = validCitations.length;
    // Deduct heavily for any hallucinated citations
    const penalty = hallucinatedCitations.length * 30;
    integrityScore = Math.max(0, Math.min(100, Math.round((validCount / totalCitations) * 100) - penalty));
  } else if (evidenceRecords.length > 0) {
    integrityScore = 0; // Narrative failed to cite any evidence
  }

  const isValid = hallucinatedCitations.length === 0 && validCitations.length > 0;

  // Generate deterministic cryptographic verification digest for audit trails
  const hashPayload = `${narrative}|${validCitations.map(v => v.id).sort().join(",")}`;
  const verificationHash = crypto.createHash("sha256").update(hashPayload).digest("hex").slice(0, 16);

  return {
    isValid,
    integrityScore,
    totalCitationsFound: totalCitations,
    validCitations,
    hallucinatedCitations,
    uncitedEvidence,
    groundedClaimsCount: claims.length,
    verificationHash,
    auditedAt,
  };
}
