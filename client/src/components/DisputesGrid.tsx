import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { 
  ShieldAlert, CheckCircle2, Clock, Scale, Search, Eye, 
  LayoutGrid, Table, ArrowUpDown, Download, Copy, Check, 
  Package, Lock, AlertTriangle, Sparkles, Truck, ArrowRight, X
} from "lucide-react";

export interface DisputeRow {
  id: string;
  paypal_dispute_id: string;
  order_id: string;
  buyer_name: string;
  reason: string;
  reason_code: string;
  dispute_amount: number;
  currency: string;
  status: string;
  respond_by: string;
  decision: "FIGHT" | "SETTLE";
  win_probability: number;
  ev_fight: number;
  ev_settle: number;
  outcome?: string;
  carrier_name?: string;
  tracking_number?: string;
  item_title?: string;
  shipping_status?: string;
  packet_status?: string;
  created_at: string;
}

interface DisputesGridProps {
  disputes: DisputeRow[];
  onSelectDispute: (id: string) => void;
  selectedDisputeId: string | null;
}

// Helper to generate consistent avatar gradient based on name
const getAvatarGradient = (name: string) => {
  const gradients = [
    "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
    "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
    "linear-gradient(135deg, #ec4899 0%, #be185d 100%)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return gradients[Math.abs(hash) % gradients.length];
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
};

export const DisputesGrid: React.FC<DisputesGridProps> = ({
  disputes,
  onSelectDispute,
  selectedDisputeId,
}) => {
  const [filterTab, setFilterTab] = useState<string>("ALL");
  const [quickFilterText, setQuickFilterText] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [sortBy, setSortBy] = useState<"urgent" | "amount" | "win_prob" | "newest">("urgent");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Copy helper
  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Filter and sort
  const processedData = useMemo(() => {
    let result = disputes.filter((item) => {
      if (filterTab === "ACTION_REQUIRED") return item.status === "ACTION_REQUIRED";
      if (filterTab === "UNDER_REVIEW") return item.status === "UNDER_REVIEW";
      if (filterTab === "WON") return item.status === "RESOLVED_MERCHANT_WON";
      return true;
    });

    if (quickFilterText.trim()) {
      const q = quickFilterText.toLowerCase();
      result = result.filter(
        (d) =>
          d.buyer_name.toLowerCase().includes(q) ||
          d.paypal_dispute_id.toLowerCase().includes(q) ||
          d.order_id.toLowerCase().includes(q) ||
          (d.item_title && d.item_title.toLowerCase().includes(q)) ||
          (d.carrier_name && d.carrier_name.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      if (sortBy === "urgent") {
        return new Date(a.respond_by).getTime() - new Date(b.respond_by).getTime();
      }
      if (sortBy === "amount") {
        return b.dispute_amount - a.dispute_amount;
      }
      if (sortBy === "win_prob") {
        return (b.win_probability || 0) - (a.win_probability || 0);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [disputes, filterTab, quickFilterText, sortBy]);

  // Total metrics in current view
  const currentEscrow = useMemo(() => {
    return processedData.reduce((acc, curr) => acc + (curr.dispute_amount || 0), 0);
  }, [processedData]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ["PayPal Dispute ID", "Order ID", "Buyer Name", "Item", "Amount (INR)", "Reason", "Status", "Decision", "Win Probability", "Carrier", "Tracking"];
    const rows = processedData.map((d) => [
      d.paypal_dispute_id,
      d.order_id,
      `"${d.buyer_name}"`,
      `"${d.item_title || ''}"`,
      d.dispute_amount,
      `"${d.reason}"`,
      d.status,
      d.decision,
      `${Math.round((d.win_probability || 0) * 100)}%`,
      d.carrier_name || "",
      d.tracking_number || ""
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `DisputeShield_Ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // AG Grid Column Definitions
  const columnDefs = useMemo<ColDef<DisputeRow>[]>(() => [
    {
      headerName: "Customer & Case ID",
      field: "buyer_name",
      minWidth: 260,
      flex: 1.3,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const initials = getInitials(params.data.buyer_name);
        const gradient = getAvatarGradient(params.data.buyer_name);
        const isCopied = copiedId === params.data.paypal_dispute_id;

        return (
          <div 
            title={params.data.item_title ? `${params.data.buyer_name} • ${params.data.item_title}` : params.data.buyer_name}
            style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}
          >
            <div className="avatar-circle" style={{ background: gradient, width: "34px", height: "34px", flexShrink: 0 }}>
              {initials}
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 0, flex: 1, gap: "2px", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {params.data.buyer_name}
                </span>
                <span style={{ 
                  fontSize: "10px", 
                  color: "#94a3b8", 
                  fontFamily: "'JetBrains Mono', monospace", 
                  background: "rgba(30, 41, 59, 0.7)", 
                  padding: "1px 5px", 
                  borderRadius: "4px", 
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  flexShrink: 0,
                  fontWeight: "500" 
                }}>
                  {params.data.order_id}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "5px", overflow: "hidden", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace", fontWeight: "600", flexShrink: 0 }}>
                  {params.data.paypal_dispute_id}
                </span>
                <button
                  onClick={(e) => handleCopy(params.data!.paypal_dispute_id, e)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: isCopied ? "#10b981" : "#64748b",
                    cursor: "pointer",
                    padding: "2px",
                    display: "flex",
                    alignItems: "center",
                    flexShrink: 0,
                  }}
                  title="Copy Case ID"
                >
                  {isCopied ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>
        );
      },
    },
    {
      headerName: "Claim Reason",
      field: "reason",
      minWidth: 175,
      flex: 1,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const isINR = params.data.reason_code === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
        const isAuth = params.data.reason_code === "UNAUTHORISED";

        return (
          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
            <span 
              className="badge badge-neutral" 
              title={params.data.reason}
              style={{ 
                fontSize: "11.5px", 
                padding: "3px 8px",
                background: "rgba(30, 41, 59, 0.7)", 
                border: "1px solid #334155",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}
            >
              {isINR ? (
                <Package size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
              ) : isAuth ? (
                <Lock size={12} color="#a855f7" style={{ flexShrink: 0 }} />
              ) : (
                <AlertTriangle size={12} color="#38bdf8" style={{ flexShrink: 0 }} />
              )}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {params.data.reason}
              </span>
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Escrow Held",
      field: "dispute_amount",
      width: 130,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", width: "100%", maxWidth: "100%", gap: "2px", overflow: "hidden" }}>
            <span style={{ fontWeight: "800", color: "#f8fafc", fontSize: "14px", letterSpacing: "-0.02em" }}>
              ₹{params.data.dispute_amount.toLocaleString("en-IN")}
            </span>
            <span style={{ fontSize: "10px", color: "#f59e0b", textTransform: "uppercase", fontWeight: "600", letterSpacing: "0.03em" }}>
              In Escrow
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Deadline",
      field: "respond_by",
      width: 140,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const diffMs = new Date(params.data.respond_by).getTime() - Date.now();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isUrgent = daysLeft <= 3 && params.data.status === "ACTION_REQUIRED";

        return (
          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 8px",
              borderRadius: "6px",
              background: isUrgent ? "rgba(244, 63, 94, 0.15)" : "rgba(30, 41, 59, 0.6)",
              border: isUrgent ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid rgba(255, 255, 255, 0.08)",
              color: isUrgent ? "#fb7185" : "#cbd5e1",
              fontSize: "11.5px",
              fontWeight: "600",
              whiteSpace: "nowrap",
              overflow: "hidden"
            }}>
              <Clock size={12} className={isUrgent ? "pulse-indicator" : ""} style={{ flexShrink: 0 }} />
              <span>{daysLeft > 0 ? `${daysLeft}d left` : "Expired"}</span>
            </div>
          </div>
        );
      },
    },
    {
      headerName: "AI Win Prob",
      field: "win_probability",
      width: 145,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const pct = Math.round((params.data.win_probability || 0) * 100);
        const color = pct >= 75 ? "#10b981" : pct >= 45 ? "#f59e0b" : "#ef4444";
        const breakdown = pct >= 75 
          ? "Carrier POD (+45%), Address Match (+20%), OMS (+15%)" 
          : "Delayed in transit (-35%), Lacks signature POD";

        return (
          <div 
            title={breakdown}
            style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", width: "100%", maxWidth: "120px", gap: "3px", overflow: "hidden", cursor: "help" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", fontWeight: "700" }}>
              <span style={{ color }}>{pct}%</span>
              <span style={{ fontSize: "9.5px", color: "#64748b", textTransform: "uppercase" }}>Rule Score</span>
            </div>
            <div style={{ width: "100%", maxWidth: "100%", height: "5px", background: "#1a2438", borderRadius: "9999px", overflow: "hidden" }}>
              <div
                style={{ 
                  height: "100%",
                  borderRadius: "9999px",
                  width: `${pct}%`, 
                  background: pct >= 75 ? "linear-gradient(90deg, #10b981, #34d399)" : pct >= 45 ? "linear-gradient(90deg, #f59e0b, #fbbf24)" : "#ef4444" 
                }}
              ></div>
            </div>
          </div>
        );
      },
    },
    {
      headerName: "EV Financial Rec.",
      field: "decision",
      width: 165,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const isFight = params.data.decision === "FIGHT";
        return (
          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
            <span 
              className={`badge ${isFight ? "badge-fight" : "badge-settle"}`} 
              style={{ fontSize: "11px", padding: "4px 8px", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              <Scale size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isFight ? `FIGHT (+₹${params.data.ev_fight})` : `SETTLE`}
              </span>
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Status",
      field: "status",
      width: 145,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        if (params.data.status === "RESOLVED_MERCHANT_WON") {
          return (
            <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
              <span className="badge badge-won" style={{ fontSize: "11px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                <CheckCircle2 size={12} style={{ flexShrink: 0 }} /> WON
              </span>
            </div>
          );
        }
        if (params.data.status === "UNDER_REVIEW") {
          return (
            <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
              <span className="badge badge-settle" style={{ fontSize: "11px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                <Clock size={12} style={{ flexShrink: 0 }} /> Review
              </span>
            </div>
          );
        }
        if (params.data.status === "SETTLED") {
          return (
            <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
              <span className="badge badge-neutral" style={{ fontSize: "11px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                Settled
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
            <span className="badge badge-urgent" style={{ fontSize: "11px", padding: "3px 8px", whiteSpace: "nowrap" }}>
              Action Needed
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Action",
      width: 135,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const isSelected = params.data.id === selectedDisputeId;
        return (
          <div style={{ display: "flex", alignItems: "center", width: "100%", maxWidth: "100%", height: "100%", overflow: "hidden" }}>
            <button
              onClick={() => onSelectDispute(params.data!.id)}
              className={isSelected ? "btn-success" : "btn-primary"}
              style={{
                padding: "5px 10px",
                fontSize: "11.5px",
                borderRadius: "6px",
                width: "100%",
                maxWidth: "115px",
                justifyContent: "center",
                whiteSpace: "nowrap"
              }}
            >
              <Eye size={12} />
              <span>{params.data.status === "RESOLVED_MERCHANT_WON" ? "Audit" : "Inspect"}</span>
            </button>
          </div>
        );
      },
    },
  ], [selectedDisputeId, copiedId, onSelectDispute]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

  return (
    <div className="glass-panel" style={{ margin: "20px 24px 0 24px", padding: "20px 24px" }}>
      
      {/* Top Header & View Controls Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "16px" }}>
        
        {/* Title & Live Status Counter */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#f8fafc", letterSpacing: "-0.02em" }}>
              Dispute Operations Command Center
            </h2>
            <span className="badge badge-fight" style={{ fontSize: "11px", padding: "2px 8px" }}>
              Live AG Grid
            </span>
          </div>
          <p style={{ fontSize: "12.5px", color: "#94a3b8", marginTop: "2px" }}>
            Autonomous multi-source evidence triage, financial risk evaluation, and 1-click PayPal defense
          </p>
        </div>

        {/* View Toggle & Export */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          
          {/* Segmented View Switcher */}
          <div style={{
            display: "flex",
            background: "#0b1220",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            padding: "3px",
            gap: "2px"
          }}>
            <button
              onClick={() => setViewMode("table")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                background: viewMode === "table" ? "rgba(0, 112, 186, 0.3)" : "transparent",
                color: viewMode === "table" ? "#38bdf8" : "#94a3b8",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Table size={14} />
              <span>AG Grid</span>
            </button>

            <button
              onClick={() => setViewMode("cards")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 12px",
                borderRadius: "6px",
                border: "none",
                background: viewMode === "cards" ? "rgba(0, 112, 186, 0.3)" : "transparent",
                color: viewMode === "cards" ? "#38bdf8" : "#94a3b8",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <LayoutGrid size={14} />
              <span>Card Deck</span>
            </button>
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="btn-secondary"
            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
            title="Download dispute evidence report as CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>

      </div>

      {/* Filter Tabs & Quick Search Ribbon */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        paddingBottom: "14px",
        borderBottom: "1px solid #1e293b",
        marginBottom: "16px",
      }}>
        
        {/* Filter Pills with Glowing Status Dots */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {[
            { id: "ALL", label: "All Cases", count: disputes.length, color: "#38bdf8" },
            { id: "ACTION_REQUIRED", label: "Action Needed", count: disputes.filter(d => d.status === "ACTION_REQUIRED").length, color: "#f59e0b" },
            { id: "UNDER_REVIEW", label: "Under Review", count: disputes.filter(d => d.status === "UNDER_REVIEW").length, color: "#38bdf8" },
            { id: "WON", label: "Won & Released", count: disputes.filter(d => d.status === "RESOLVED_MERCHANT_WON").length, color: "#10b981" },
          ].map((tab) => {
            const isActive = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  background: isActive ? "rgba(0, 112, 186, 0.22)" : "rgba(15, 23, 42, 0.6)",
                  border: isActive ? "1px solid #0070ba" : "1px solid rgba(255, 255, 255, 0.08)",
                  color: isActive ? "#f8fafc" : "#94a3b8",
                  padding: "6px 14px",
                  borderRadius: "9999px",
                  fontSize: "12.5px",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: tab.color,
                  boxShadow: isActive ? `0 0 8px ${tab.color}` : "none",
                }}></span>
                <span>{tab.label}</span>
                <span style={{
                  fontSize: "11px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: isActive ? "rgba(0, 112, 186, 0.4)" : "rgba(30, 41, 59, 0.8)",
                  color: isActive ? "#38bdf8" : "#64748b",
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort & Search Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          
          {/* Sort Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <ArrowUpDown size={14} color="#64748b" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "6px 10px",
                color: "#e2e8f0",
                fontSize: "12px",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="urgent">Sort: Urgent Deadline</option>
              <option value="amount">Sort: Amount (High to Low)</option>
              <option value="win_prob">Sort: Win Probability</option>
              <option value="newest">Sort: Newest Added</option>
            </select>
          </div>

          {/* Search Field */}
          <div style={{ position: "relative", minWidth: "240px" }}>
            <Search size={14} color="#64748b" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              type="text"
              placeholder="Filter customer, order, tracking..."
              value={quickFilterText}
              onChange={(e) => setQuickFilterText(e.target.value)}
              style={{
                width: "100%",
                background: "rgba(15, 23, 42, 0.8)",
                border: "1px solid #334155",
                borderRadius: "8px",
                padding: "6px 28px 6px 30px",
                color: "#f8fafc",
                fontSize: "12px",
                outline: "none",
              }}
            />
            {quickFilterText && (
              <button
                onClick={() => setQuickFilterText("")}
                style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

        </div>

      </div>

      {/* Live Context Ribbon */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 14px",
        background: "rgba(11, 17, 32, 0.6)",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        marginBottom: "14px",
        fontSize: "12px",
        color: "#94a3b8",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span>Showing <strong style={{ color: "#f8fafc" }}>{processedData.length}</strong> of {disputes.length} disputes</span>
          <span>•</span>
          <span>Escrow in view: <strong style={{ color: "#f59e0b" }}>₹{currentEscrow.toLocaleString("en-IN")}</strong></span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#38bdf8" }}>
          <Sparkles size={13} />
          <span>PayPal Sandbox Autopilot Active</span>
        </div>
      </div>

      {/* VIEW MODE 1: AG GRID VIEW */}
      {viewMode === "table" ? (
        <div className="ag-theme-quartz-dark" style={{ height: "460px", width: "100%" }}>
          <AgGridReact<DisputeRow>
            rowData={processedData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={68}
            headerHeight={48}
            pagination={true}
            paginationPageSize={10}
            animateRows={true}
            rowSelection="single"
            onRowClicked={(e) => {
              if (e.data) onSelectDispute(e.data.id);
            }}
          />
        </div>
      ) : (
        /* VIEW MODE 2: INTERACTIVE MATRIX CARDS VIEW */
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
          marginTop: "6px",
        }}>
          {processedData.map((item) => {
            const initials = getInitials(item.buyer_name);
            const gradient = getAvatarGradient(item.buyer_name);
            const winPct = Math.round((item.win_probability || 0) * 100);
            const isFight = item.decision === "FIGHT";
            const diffMs = new Date(item.respond_by).getTime() - Date.now();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            const isUrgent = daysLeft <= 3 && item.status === "ACTION_REQUIRED";

            return (
              <div key={item.id} className="dispute-card">
                
                {/* Card Top: Customer Avatar, Name, Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="avatar-circle" style={{ background: gradient }}>
                      {initials}
                    </div>
                    <div>
                      <div style={{ fontWeight: "700", color: "#f8fafc", fontSize: "14px" }}>
                        {item.buyer_name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>
                        {item.paypal_dispute_id}
                      </div>
                    </div>
                  </div>

                  <span className={`badge ${item.status === 'RESOLVED_MERCHANT_WON' ? 'badge-won' : item.status === 'UNDER_REVIEW' ? 'badge-settle' : 'badge-urgent'}`}>
                    {item.status === "RESOLVED_MERCHANT_WON" ? "WON" : item.status === "UNDER_REVIEW" ? "IN REVIEW" : "ACTION"}
                  </span>
                </div>

                {/* Card Middle: Product Title & Carrier info */}
                <div style={{
                  background: "rgba(11, 17, 32, 0.7)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid #1e293b",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#e2e8f0" }}>
                    {item.item_title || "Disputed Order Item"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#94a3b8" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Truck size={12} color="#38bdf8" />
                      {item.carrier_name || "Logistics"} ({item.shipping_status || "Dispatched"})
                    </span>
                    <span style={{ color: isUrgent ? "#fb7185" : "#94a3b8" }}>
                      ⏳ {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                    </span>
                  </div>
                </div>

                {/* Card Metrics Grid: Escrow Amount, Win Rate, EV Decision */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase" }}>Escrow Amount</span>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: "#f8fafc" }}>
                      ₹{item.dispute_amount.toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div style={{ background: "rgba(15, 23, 42, 0.6)", padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                    <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase" }}>AI Win Prob</span>
                    <div style={{ fontSize: "16px", fontWeight: "800", color: winPct >= 75 ? "#10b981" : winPct >= 45 ? "#f59e0b" : "#ef4444" }}>
                      {winPct}%
                    </div>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                  <span className={`badge ${isFight ? "badge-fight" : "badge-settle"}`} style={{ fontSize: "11.5px" }}>
                    {isFight ? `FIGHT (+₹${item.ev_fight})` : `SETTLE`}
                  </span>

                  <button
                    onClick={() => onSelectDispute(item.id)}
                    className="btn-primary"
                    style={{ padding: "6px 14px", fontSize: "12px", borderRadius: "8px" }}
                  >
                    <span>Inspect Evidence</span>
                    <ArrowRight size={13} />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
