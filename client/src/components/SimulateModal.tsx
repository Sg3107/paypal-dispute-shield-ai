import React, { useState } from "react";
import { X, Zap, ShieldAlert, ShoppingBag, Truck, Check } from "lucide-react";

interface SimulateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulate: (scenario: string) => Promise<void>;
  loading: boolean;
}

export const SimulateModal: React.FC<SimulateModalProps> = ({
  isOpen,
  onClose,
  onSimulate,
  loading,
}) => {
  const [selectedScenario, setSelectedScenario] = useState<string>("HIGH_VALUE_FIGHT");

  if (!isOpen) return null;

  const scenarios = [
    {
      id: "HIGH_VALUE_FIGHT",
      title: "Scenario A: Urban Windbreaker Jacket (₹2,899)",
      reason: "Item Not Received (Buyer Claim)",
      carrier: "Delhivery (Delivered 2 days ago)",
      expectedOutcome: "Agent Recommendation: FIGHT",
      evExplanation: "Win probability 88%. Positive EV (+₹1,740). Grounded packet drafted with carrier POD.",
      badge: "High EV Defense",
      badgeClass: "badge-fight",
    },
    {
      id: "LOW_VALUE_SETTLE",
      title: "Scenario B: Magnetic Cable Clip (₹199)",
      reason: "Item Not Received (Buyer Claim)",
      carrier: "IndiaPost (Delayed / In-Transit)",
      expectedOutcome: "Agent Recommendation: SETTLE",
      evExplanation: "Win probability 25%. Negative EV (-₹195 vs ₹50 refund). Auto-settle saves dispute fees and NPS.",
      badge: "Smart Cost Settlement",
      badgeClass: "badge-settle",
    },
    {
      id: "UNAUTHORISED_3DS",
      title: "Scenario C: Bose QuietComfort 45 (₹18,990)",
      reason: "Unauthorized Transaction (Fraud Claim)",
      carrier: "BlueDart (Delivered yesterday)",
      expectedOutcome: "Agent Recommendation: FIGHT",
      evExplanation: "Win probability 92%. Positive EV (+₹17,351). 3DS 2.0 liability shift & Seller Protection address match.",
      badge: "3DS Auth Defense",
      badgeClass: "badge-fight",
    },
    {
      id: "SNAD_RETURN_POLICY",
      title: "Scenario D: Handcrafted Leather Tote (₹4,499)",
      reason: "Significantly Not As Described (SNAD)",
      carrier: "Delhivery (Delivered 3 days ago)",
      expectedOutcome: "Agent Recommendation: FIGHT",
      evExplanation: "Win probability 84%. Positive EV (+₹3,659). Verified catalog specs & 7-day return policy condition audit.",
      badge: "SNAD Policy Defense",
      badgeClass: "badge-fight",
    },
  ];

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(3, 7, 18, 0.8)",
      backdropFilter: "blur(6px)",
      zIndex: 1100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
    }}>
      <div className="glass-panel" style={{ width: "100%", maxWidth: "600px", padding: "24px", borderRadius: "16px", border: "1px solid rgba(0, 112, 186, 0.4)" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "rgba(0, 112, 186, 0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={20} color="#38bdf8" />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#f8fafc" }}>
                Simulate Inbound PayPal Dispute
              </h2>
              <p style={{ fontSize: "12px", color: "#94a3b8" }}>
                Fires a synthetic PayPal Webhook and watches the AI Agent triage in real-time
              </p>
            </div>
          </div>

          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* Scenarios Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "18px 0" }}>
          {scenarios.map((s) => {
            const isSelected = selectedScenario === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedScenario(s.id)}
                style={{
                  background: isSelected ? "rgba(0, 112, 186, 0.18)" : "rgba(15, 23, 42, 0.6)",
                  border: isSelected ? "1px solid #38bdf8" : "1px solid #1e293b",
                  borderRadius: "12px",
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13.5px", fontWeight: "700", color: "#f8fafc" }}>
                    {s.title}
                  </span>
                  <span className={`badge ${s.badgeClass}`} style={{ fontSize: "11px" }}>
                    {s.badge}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "14px", marginTop: "8px", fontSize: "12px", color: "#94a3b8" }}>
                  <span>Claim: <strong style={{ color: "#e2e8f0" }}>{s.reason}</strong></span>
                  <span>•</span>
                  <span>Logistics: <strong style={{ color: "#cbd5e1" }}>{s.carrier}</strong></span>
                </div>

                <p style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                  {s.evExplanation}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            id="btn-confirm-simulate"
            onClick={() => onSimulate(selectedScenario)}
            className="btn-primary"
            disabled={loading}
          >
            <Zap size={15} />
            <span>{loading ? "Simulating Webhook..." : "Trigger Dispute Webhook"}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
