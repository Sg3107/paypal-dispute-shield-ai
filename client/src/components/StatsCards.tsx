import React from "react";
import { AlertTriangle, ShieldCheck, DollarSign, TrendingUp, Percent } from "lucide-react";

interface StatsProps {
  stats: {
    totalDisputes: number;
    actionRequired: number;
    wonDisputes: number;
    atRiskCapital: number;
    savedCapital: number;
    winRate: number;
  };
}

export const StatsCards: React.FC<StatsProps> = ({ stats }) => {
  const cards = [
    {
      title: "At-Risk Capital",
      value: `₹${(stats.atRiskCapital || 0).toLocaleString("en-IN")}`,
      subtitle: `${stats.actionRequired} claims currently held in escrow`,
      icon: AlertTriangle,
      color: "#f59e0b",
      badgeText: "PayPal Hold",
      badgeClass: "badge-settle",
    },
    {
      title: "Capital Protected & Won",
      value: `₹${(stats.savedCapital || 0).toLocaleString("en-IN")}`,
      subtitle: `${stats.wonDisputes} disputes won via grounded evidence`,
      icon: ShieldCheck,
      color: "#10b981",
      badgeText: "+88% vs manual",
      badgeClass: "badge-fight",
    },
    {
      title: "AI Defense Win Rate",
      value: `${stats.winRate || 85}%`,
      subtitle: "Deterministic EV & Citation Rebuttals",
      icon: TrendingUp,
      color: "#38bdf8",
      badgeText: "High Precision",
      badgeClass: "badge-won",
    },
    {
      title: "Open Action Items",
      value: `${stats.actionRequired}`,
      subtitle: "Packets ready for merchant 1-click review",
      icon: DollarSign,
      color: "#a855f7",
      badgeText: "Autopilot Ready",
      badgeClass: "badge-neutral",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: "16px",
      margin: "18px 24px 0 24px",
    }}>
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div key={i} className="glass-panel" style={{ padding: "18px 20px", position: "relative" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {c.title}
              </span>
              <span className={`badge ${c.badgeClass}`} style={{ fontSize: "11px", padding: "2px 7px" }}>
                {c.badgeText}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px" }}>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "#f8fafc", letterSpacing: "-0.03em" }}>
                {c.value}
              </div>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: `rgba(${c.color === "#f59e0b" ? "245, 158, 11" : c.color === "#10b981" ? "16, 185, 129" : c.color === "#38bdf8" ? "56, 189, 248" : "168, 85, 247"}, 0.12)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: `1px solid rgba(${c.color === "#f59e0b" ? "245, 158, 11" : c.color === "#10b981" ? "16, 185, 129" : c.color === "#38bdf8" ? "56, 189, 248" : "168, 85, 247"}, 0.3)`
              }}>
                <Icon size={20} color={c.color} />
              </div>
            </div>

            <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
              {c.subtitle}
            </div>
          </div>
        );
      })}
    </div>
  );
};
