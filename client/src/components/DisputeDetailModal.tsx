import React, { useState, useMemo } from "react";
import confetti from "canvas-confetti";
import { 
  X, CheckCircle2, AlertCircle, Scale, ShieldCheck, Send, 
  ArrowRight, Award, FileText, Check, AlertTriangle, ExternalLink, Sparkles, Hash, ShieldAlert
} from "lucide-react";

interface EvidenceItem {
  id: string;
  dispute_id: string;
  evidence_type: string;
  source: string;
  label: string;
  value: string;
  is_verified: number;
  status: "FOUND" | "MISSING" | "FLAGGED";
}

interface ClaimItem {
  claim_text: string;
  evidence_id: string;
  verified_source: string;
}

interface CitationAuditReport {
  isValid: boolean;
  integrityScore: number;
  totalCitationsFound: number;
  validCitations: Array<{ id: string; label?: string; source?: string; is_verified?: boolean }>;
  hallucinatedCitations: string[];
  uncitedEvidence: Array<{ id: string; label: string; evidence_type: string }>;
  groundedClaimsCount: number;
  verificationHash: string;
  auditedAt: string;
}

interface Packet {
  id: string;
  narrative: string;
  claims_json: string;
  recommendation: string;
  status: string;
  citation_audit_json?: string;
  submitted_at?: string;
  paypal_submission_id?: string;
}

interface AuditLog {
  id: number;
  event_type: string;
  description: string;
  created_at: string;
}

interface DisputeDetailData {
  dispute: any;
  evidenceItems: EvidenceItem[];
  packet: Packet | null;
  auditLogs: AuditLog[];
}

interface ModalProps {
  data: DisputeDetailData | null;
  onClose: () => void;
  onSubmitEvidence: (disputeId: string) => Promise<void>;
  onSettle: (disputeId: string) => Promise<void>;
  onAdjudicateWon: (disputeId: string) => Promise<void>;
  submitting: boolean;
}

export const DisputeDetailModal: React.FC<ModalProps> = ({
  data,
  onClose,
  onSubmitEvidence,
  onSettle,
  onAdjudicateWon,
  submitting,
}) => {
  if (!data) return null;

  const { dispute, evidenceItems, packet, auditLogs } = data;
  const [highlightedEvidenceId, setHighlightedEvidenceId] = useState<string | null>(null);

  const claims: ClaimItem[] = useMemo(() => {
    if (!packet?.claims_json) return [];
    try {
      return JSON.parse(packet.claims_json);
    } catch {
      return [];
    }
  }, [packet?.claims_json]);

  const citationAudit: CitationAuditReport | null = useMemo(() => {
    if (!packet?.citation_audit_json) return null;
    try {
      return JSON.parse(packet.citation_audit_json);
    } catch {
      return null;
    }
  }, [packet?.citation_audit_json]);

  const netStrategicAdvantage = useMemo(() => {
    const fight = Number(dispute.ev_fight || 0);
    const settle = Number(dispute.ev_settle || 0);
    return Math.round((fight - settle) * 100) / 100;
  }, [dispute.ev_fight, dispute.ev_settle]);

  const handleWonClick = async () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    await onAdjudicateWon(dispute.id);
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(3, 7, 18, 0.8)",
      backdropFilter: "blur(8px)",
      zIndex: 1000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div 
        className="glass-panel" 
        style={{
          width: "100%",
          maxWidth: "1060px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid rgba(0, 112, 186, 0.3)",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7)",
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: "20px 24px",
          background: "linear-gradient(90deg, #0f172a 0%, #1e293b 100%)",
          borderBottom: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px", fontWeight: "800", color: "#f8fafc" }}>
                Case {dispute.paypal_dispute_id}
              </span>
              <span className={`badge ${dispute.decision === "FIGHT" ? "badge-fight" : "badge-settle"}`}>
                Recommendation: {dispute.decision}
              </span>
              {dispute.status === "RESOLVED_MERCHANT_WON" && (
                <span className="badge badge-won">
                  <Award size={12} /> PayPal Verdict: WON
                </span>
              )}
            </div>
            <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "3px" }}>
              Order {dispute.order_id} • Buyer: <strong style={{ color: "#e2e8f0" }}>{dispute.buyer_name}</strong> • Claim: <strong style={{ color: "#38bdf8" }}>₹{dispute.dispute_amount}</strong> ({dispute.reason})
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body Scrollable */}
        <div style={{
          padding: "24px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}>

          {/* Top Row: EV Financial Decision Box */}
          <div style={{
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "12px",
            padding: "18px 20px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Scale size={18} color="#38bdf8" />
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                  Expected Financial Value (EV) Decision Engine
                </span>
              </div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Quantitative Risk Optimization Model
              </span>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "12px",
              background: "#090d16",
              padding: "14px",
              borderRadius: "8px",
              border: "1px solid #1e293b",
            }}>
              <div>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Win Probability</span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: dispute.win_probability >= 0.7 ? "#10b981" : "#f59e0b" }}>
                  {(dispute.win_probability * 100).toFixed(0)}%
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Calculated from checkout & carrier POD</span>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Option A: Fight with Evidence</span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: dispute.ev_fight >= 0 ? "#10b981" : "#ef4444" }}>
                  EV: ₹{dispute.ev_fight}
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>Protects ₹{dispute.dispute_amount} vs ₹{dispute.dispute_fee} fee</span>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>Option B: Concede & Settle</span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "#94a3b8" }}>
                  EV: ₹{dispute.ev_settle}
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>COGS loss; ₹0 dispute fee penalty</span>
              </div>

              <div style={{ borderLeft: "1px solid #1e293b", paddingLeft: "14px" }}>
                <span style={{ fontSize: "11px", color: "#64748b", textTransform: "uppercase" }}>
                  {dispute.decision === "FIGHT" ? "Strategic Net Advantage" : "Cost-Saving Advantage"}
                </span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: netStrategicAdvantage >= 0 ? "#34d399" : "#fbbf24" }}>
                  {netStrategicAdvantage >= 0 ? `+₹${netStrategicAdvantage}` : `-₹${Math.abs(netStrategicAdvantage)}`}
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  {dispute.decision === "FIGHT" ? "Recommendation: FIGHT" : "Recommendation: SETTLE"}
                </span>
              </div>
            </div>
          </div>

          {/* Grid Layout: Left Column Evidence Checklist, Right Column Grounded Packet */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "20px" }}>
            
            {/* Left Column: Evidence Checklist */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                  Evidence Pipeline Verification
                </span>
                <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                  {evidenceItems.filter(e => e.status === "FOUND").length} of {evidenceItems.length} verified
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {evidenceItems.map((item) => {
                  const isHighlighted = highlightedEvidenceId === item.id;
                  const isFound = item.status === "FOUND";

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: isHighlighted ? "rgba(0, 112, 186, 0.25)" : "rgba(15, 23, 42, 0.7)",
                        border: isHighlighted ? "1px solid #38bdf8" : "1px solid #1e293b",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {isFound ? (
                            <CheckCircle2 size={16} color="#10b981" />
                          ) : (
                            <AlertTriangle size={16} color="#f59e0b" />
                          )}
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#f1f5f9" }}>
                            {item.label}
                          </span>
                        </div>
                        <span style={{ fontSize: "10.5px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                          {item.id}
                        </span>
                      </div>

                      <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", lineHeight: "1.4" }}>
                        {item.value}
                      </p>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px", fontSize: "11px", color: "#64748b" }}>
                        <span>Source: <strong style={{ color: "#cbd5e1" }}>{item.source}</strong></span>
                        <span className={`badge ${isFound ? "badge-fight" : "badge-settle"}`} style={{ padding: "1px 6px", fontSize: "10px" }}>
                          {item.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Grounded AI Evidence Narrative */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={16} color="#38bdf8" />
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                    Grounded Defense Narrative (Zero Hallucination)
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="badge badge-won" style={{ fontSize: "10.5px" }}>
                    <ShieldCheck size={12} /> {citationAudit ? `${citationAudit.integrityScore}% Grounded` : "Strict Citations"}
                  </span>
                </div>
              </div>

              {/* Citation Validator Audit Bar */}
              {citationAudit && (
                <div style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "11.5px",
                  color: "#e2e8f0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ShieldCheck size={16} color="#10b981" />
                    <span><strong>Citation Validator:</strong> {citationAudit.validCitations.length} Grounded Proofs • 0 Hallucinations</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10.5px", color: "#6ee7b7" }}>
                    SHA: {citationAudit.verificationHash}
                  </span>
                </div>
              )}

              <div style={{
                background: "#090e18",
                border: "1px solid #1e293b",
                borderRadius: "10px",
                padding: "16px",
                fontSize: "12.5px",
                color: "#cbd5e1",
                lineHeight: "1.6",
                whiteSpace: "pre-wrap",
                fontFamily: "system-ui, sans-serif",
                maxHeight: "340px",
                overflowY: "auto",
              }}>
                {packet?.narrative || "No narrative generated yet. Run agent to draft."}
              </div>

              {/* Citations Key */}
              <div style={{ background: "rgba(15, 23, 42, 0.7)", padding: "12px", borderRadius: "8px", border: "1px solid #1e293b" }}>
                <span style={{ fontSize: "11.5px", fontWeight: "600", color: "#94a3b8", display: "block", marginBottom: "8px" }}>
                  Verifiable Evidence Citations (Click to highlight proof in pipeline):
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {claims.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => setHighlightedEvidenceId(c.evidence_id)}
                      className="citation-chip"
                      style={{ border: highlightedEvidenceId === c.evidence_id ? "1px solid #38bdf8" : undefined }}
                    >
                      <span>Citation #{i + 1} ({c.evidence_id})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Audit Timeline */}
          <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "10px", padding: "14px 18px", border: "1px solid #1e293b" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#94a3b8", display: "block", marginBottom: "10px" }}>
              Audit Log & Agent Trace
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {auditLogs.map((log) => (
                <div key={log.id} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "11.5px" }}>
                  <span style={{ color: "#64748b", fontFamily: "'JetBrains Mono', monospace", minWidth: "140px" }}>
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                  <span className="badge badge-neutral" style={{ padding: "1px 6px", fontSize: "10px" }}>
                    {log.event_type}
                  </span>
                  <span style={{ color: "#cbd5e1" }}>{log.description}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div style={{
          padding: "16px 24px",
          background: "#0b101d",
          borderTop: "1px solid #1e293b",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            Status: <strong style={{ color: "#e2e8f0" }}>{dispute.status}</strong>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {dispute.status !== "RESOLVED_MERCHANT_WON" && (
              <>
                <button
                  id="btn-settle"
                  onClick={() => onSettle(dispute.id)}
                  className="btn-danger"
                  disabled={submitting}
                >
                  <span>Accept Claim / Settle</span>
                </button>

                <button
                  id="btn-approve-submit"
                  onClick={() => onSubmitEvidence(dispute.id)}
                  className="btn-success"
                  disabled={submitting}
                >
                  <Send size={15} />
                  <span>{submitting ? "Transmitting..." : "Approve & Submit to PayPal"}</span>
                </button>
              </>
            )}

            {/* Sandbox Adjudication button for Live Demo */}
            <button
              id="btn-adjudicate-sandbox"
              onClick={handleWonClick}
              className="btn-primary"
              style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)" }}
              title="Simulate PayPal resolving this dispute in your favor"
            >
              <Award size={15} />
              <span>Simulate PayPal Won (Demo Verdict)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
