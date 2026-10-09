import React from "react";
import { ShieldCheck, PlusCircle, RefreshCw, Zap, ExternalLink } from "lucide-react";

interface HeaderProps {
  onSimulateClick: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onSimulateClick, onRefresh, loading }) => {
  return (
    <header className="glass-panel" style={{ margin: "20px 24px 0 24px", padding: "16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
        
        {/* Logo & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #0070ba 0%, #003087 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 15px rgba(0, 112, 186, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.2)"
          }}>
            <ShieldCheck size={26} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "20px", fontWeight: "800", letterSpacing: "-0.02em", color: "#f8fafc" }}>
                DisputeShield <span style={{ color: "#38bdf8" }}>AI</span>
              </h1>
              <span className="badge badge-fight" style={{ fontSize: "11px", padding: "2px 8px" }}>
                PayPal AI Hackathon 2026
              </span>
              <span className="badge badge-won" style={{ fontSize: "11px", padding: "2px 8px" }}>
                AG Grid Operations
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>
              Merchant-Side Autonomous Dispute Triage, Evidence Citation Engine & Financial EV Optimizer
            </p>
          </div>
        </div>

        {/* Sandbox Indicator & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            background: "rgba(15, 23, 42, 0.8)",
            borderRadius: "8px",
            border: "1px solid #334155",
            fontSize: "12px",
            color: "#94a3b8"
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#10b981",
              boxShadow: "0 0 8px #10b981"
            }} className="pulse-indicator"></span>
            <span>PayPal Sandbox: <strong style={{ color: "#e2e8f0" }}>Active</strong></span>
          </div>

          <button
            id="btn-refresh"
            onClick={onRefresh}
            className="btn-secondary"
            title="Refresh disputes"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "pulse-indicator" : ""} />
            <span>Refresh</span>
          </button>

          <button
            id="btn-simulate-webhook"
            onClick={onSimulateClick}
            className="btn-primary"
          >
            <Zap size={16} />
            <span>Simulate Inbound Dispute</span>
          </button>
        </div>

      </div>
    </header>
  );
};
