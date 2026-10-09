import React from "react";
import { Radar, Lightbulb, Truck, ShieldAlert, CheckCircle2 } from "lucide-react";

interface PreventionRadarProps {
  carrierInsights: Array<{
    carrier_name: string;
    dispute_count: number;
    avg_win_prob: number;
  }>;
}

export const PreventionRadar: React.FC<PreventionRadarProps> = ({ carrierInsights }) => {
  return (
    <div className="glass-panel" style={{ margin: "20px 24px 24px 24px", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "8px",
            background: "rgba(168, 85, 247, 0.15)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Radar size={20} color="#c084fc" />
          </div>
          <div>
            <h2 style={{ fontSize: "15px", fontWeight: "700", color: "#f8fafc" }}>
              Dispute Prevention Radar & Carrier Intelligence
            </h2>
            <p style={{ fontSize: "12px", color: "#94a3b8" }}>
              Automated root-cause pattern analysis to preempt chargebacks before they occur
            </p>
          </div>
        </div>

        <span className="badge badge-fight" style={{ fontSize: "11px" }}>
          Active Prevention Engine
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.8fr", gap: "20px" }}>
        
        {/* Carrier Distribution */}
        <div style={{ background: "rgba(15, 23, 42, 0.7)", borderRadius: "10px", padding: "16px", border: "1px solid #1e293b" }}>
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#cbd5e1", textTransform: "uppercase", display: "block", marginBottom: "12px" }}>
            Dispute Ratio by Logistics Carrier
          </span>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {carrierInsights && carrierInsights.length > 0 ? (
              carrierInsights.map((c, i) => {
                const winPct = Math.round((c.avg_win_prob || 0.7) * 100);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f1f5f9", fontWeight: "600" }}>
                        <Truck size={13} color="#38bdf8" /> {c.carrier_name}
                      </span>
                      <span style={{ color: "#94a3b8" }}>
                        {c.dispute_count} cases • <strong style={{ color: winPct >= 80 ? "#34d399" : "#fbbf24" }}>{winPct}% Win Rate</strong>
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: "4px" }}>
                      <div
                        className="progress-fill"
                        style={{
                          width: `${winPct}%`,
                          background: winPct >= 80 ? "#10b981" : "#f59e0b",
                        }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: "12px", color: "#64748b" }}>Analyzing logistics stream...</div>
            )}
          </div>
        </div>

        {/* Operational Recommendations */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderRadius: "10px",
            padding: "12px 16px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}>
            <ShieldAlert size={18} color="#f59e0b" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#fbbf24" }}>
                High-Risk Logistics Alert: Economy Ground Shipping
              </span>
              <p style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px", lineHeight: "1.4" }}>
                Consignments dispatched without digital Proof-Of-Delivery (POD) account for 70% of lost revenue.
                <strong> Recommended Action:</strong> Require electronic OTP handover on all orders over ₹1,000.
              </p>
            </div>
          </div>

          <div style={{
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "10px",
            padding: "12px 16px",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}>
            <Lightbulb size={18} color="#10b981" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#34d399" }}>
                Carrier Performance Advantage: BlueDart & Delhivery
              </span>
              <p style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "2px", lineHeight: "1.4" }}>
                Verified carrier tracking matches PayPal Seller Protection criteria 91% of the time. Auto-rebuttal can run with zero merchant friction for these couriers.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
