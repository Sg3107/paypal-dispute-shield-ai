import React, { useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams } from "ag-grid-community";
import { ShieldAlert, CheckCircle2, Clock, ArrowUpRight, Scale, Search, Eye } from "lucide-react";

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

export const DisputesGrid: React.FC<DisputesGridProps> = ({
  disputes,
  onSelectDispute,
  selectedDisputeId,
}) => {
  const [filterTab, setFilterTab] = useState<string>("ALL");
  const [quickFilterText, setQuickFilterText] = useState<string>("");

  const filteredData = useMemo(() => {
    return disputes.filter((item) => {
      if (filterTab === "ACTION_REQUIRED") return item.status === "ACTION_REQUIRED";
      if (filterTab === "UNDER_REVIEW") return item.status === "UNDER_REVIEW";
      if (filterTab === "WON") return item.status === "RESOLVED_MERCHANT_WON";
      return true;
    });
  }, [disputes, filterTab]);

  const columnDefs = useMemo<ColDef<DisputeRow>[]>(() => [
    {
      headerName: "Case & Customer",
      field: "paypal_dispute_id",
      minWidth: 220,
      flex: 1.2,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontWeight: "700", color: "#f8fafc", fontSize: "13px" }}>
                {params.data.buyer_name}
              </span>
              <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "'JetBrains Mono', monospace" }}>
                ({params.data.order_id})
              </span>
            </div>
            <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "'JetBrains Mono', monospace" }}>
              {params.data.paypal_dispute_id}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Dispute Reason",
      field: "reason",
      minWidth: 180,
      flex: 1,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "6px" }}>
            <span className="badge badge-neutral" style={{ fontSize: "12px", gap: "4px" }}>
              <ShieldAlert size={12} color="#f59e0b" />
              {params.data.reason}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Dispute Amount",
      field: "dispute_amount",
      width: 140,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
            <span style={{ fontWeight: "700", color: "#f1f5f9", fontSize: "14px" }}>
              ₹{params.data.dispute_amount.toLocaleString("en-IN")}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Response Deadline",
      field: "respond_by",
      width: 155,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const diffMs = new Date(params.data.respond_by).getTime() - Date.now();
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const isUrgent = daysLeft <= 3 && params.data.status === "ACTION_REQUIRED";

        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
            <span className={`badge ${isUrgent ? "badge-urgent" : "badge-neutral"}`} style={{ fontSize: "11.5px" }}>
              <Clock size={12} />
              {daysLeft > 0 ? `${daysLeft} days left` : "Expired"}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Win Probability",
      field: "win_probability",
      width: 160,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const pct = Math.round((params.data.win_probability || 0) * 100);
        const color = pct >= 75 ? "#10b981" : pct >= 45 ? "#f59e0b" : "#ef4444";

        return (
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%", gap: "4px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", color }}>
              <span>{pct}%</span>
              <span style={{ fontSize: "10.5px", color: "#64748b" }}>Rule Score</span>
            </div>
            <div className="progress-track" style={{ height: "5px" }}>
              <div
                className="progress-fill"
                style={{ width: `${pct}%`, background: color }}
              ></div>
            </div>
          </div>
        );
      },
    },
    {
      headerName: "EV Financial Rec.",
      field: "decision",
      width: 180,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const isFight = params.data.decision === "FIGHT";
        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%", gap: "6px" }}>
            <span className={`badge ${isFight ? "badge-fight" : "badge-settle"}`} style={{ fontSize: "12px" }}>
              <Scale size={12} />
              {isFight ? `FIGHT (+₹${params.data.ev_fight})` : `SETTLE (-₹${Math.abs(params.data.ev_settle)})`}
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Status",
      field: "status",
      width: 160,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        if (params.data.status === "RESOLVED_MERCHANT_WON") {
          return (
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span className="badge badge-won" style={{ fontSize: "11.5px" }}>
                <CheckCircle2 size={13} /> WON (Released)
              </span>
            </div>
          );
        }
        if (params.data.status === "UNDER_REVIEW") {
          return (
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span className="badge badge-settle" style={{ fontSize: "11.5px" }}>
                <Clock size={13} /> PayPal Review
              </span>
            </div>
          );
        }
        if (params.data.status === "SETTLED") {
          return (
            <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
              <span className="badge badge-neutral" style={{ fontSize: "11.5px" }}>
                Refund Settled
              </span>
            </div>
          );
        }
        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
            <span className="badge badge-urgent" style={{ fontSize: "11.5px" }}>
              Action Required
            </span>
          </div>
        );
      },
    },
    {
      headerName: "Autopilot Action",
      width: 150,
      sortable: false,
      filter: false,
      cellRenderer: (params: ICellRendererParams<DisputeRow>) => {
        if (!params.data) return null;
        const isSelected = params.data.id === selectedDisputeId;
        return (
          <div style={{ display: "flex", alignItems: "center", height: "100%" }}>
            <button
              onClick={() => onSelectDispute(params.data!.id)}
              className={isSelected ? "btn-success" : "btn-secondary"}
              style={{ padding: "5px 12px", fontSize: "12px", borderRadius: "6px" }}
            >
              <Eye size={13} />
              <span>{params.data.status === "RESOLVED_MERCHANT_WON" ? "View Audit" : "Review Packet"}</span>
            </button>
          </div>
        );
      },
    },
  ], [selectedDisputeId, onSelectDispute]);

  const defaultColDef = useMemo<ColDef>(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

  return (
    <div className="glass-panel" style={{ margin: "20px 24px 0 24px", padding: "18px 20px" }}>
      
      {/* Controls Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        
        {/* Filter Pills */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {[
            { id: "ALL", label: `All Disputes (${disputes.length})` },
            { id: "ACTION_REQUIRED", label: `Action Needed (${disputes.filter(d => d.status === 'ACTION_REQUIRED').length})` },
            { id: "UNDER_REVIEW", label: `In Review (${disputes.filter(d => d.status === 'UNDER_REVIEW').length})` },
            { id: "WON", label: `Won (${disputes.filter(d => d.status === 'RESOLVED_MERCHANT_WON').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                background: filterTab === tab.id ? "rgba(0, 112, 186, 0.25)" : "rgba(30, 41, 59, 0.6)",
                border: filterTab === tab.id ? "1px solid #0070ba" : "1px solid rgba(255, 255, 255, 0.08)",
                color: filterTab === tab.id ? "#38bdf8" : "#94a3b8",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Quick Search */}
        <div style={{ position: "relative", minWidth: "260px" }}>
          <Search size={15} color="#64748b" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
          <input
            type="text"
            placeholder="Search by buyer, order, or tracking..."
            value={quickFilterText}
            onChange={(e) => setQuickFilterText(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "7px 12px 7px 34px",
              color: "#f8fafc",
              fontSize: "12.5px",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* AG Grid Table Container */}
      <div className="ag-theme-quartz-dark" style={{ height: "380px", width: "100%" }}>
        <AgGridReact<DisputeRow>
          rowData={filteredData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          quickFilterText={quickFilterText}
          pagination={true}
          paginationPageSize={10}
          animateRows={true}
          rowSelection="single"
          onRowClicked={(e) => {
            if (e.data) onSelectDispute(e.data.id);
          }}
        />
      </div>

    </div>
  );
};
