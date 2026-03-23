"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { motion, type PanInfo } from "framer-motion";
import { ArrowRight, Battery, Cpu, Sun, TrendingUp } from "lucide-react";
import { Badge as ShadBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const NODE_WIDTH = 200;
const NODE_HEIGHT = 118;
const HORIZONTAL_SPACING = 270;
const VERTICAL_SPACING = 140;

type Point = {
  x: number;
  y: number;
};

export type WorkflowNodeItem = {
  id: string;
  name: string;
  href: string;
  phaseId: string;
  phaseLabel: string;
  phaseShortLabel: string;
  calculated: boolean;
  selected: boolean;
  statusLine: string;
};

type WorkflowCanvasProps = {
  nodes: WorkflowNodeItem[];
  selectedCount: number;
  onToggle: (toolId: string, checked: boolean) => void;
};

type PhasePresentation = {
  badgeClass: string;
  borderClass: string;
  iconClass: string;
  labelClass: string;
  Icon: typeof Sun;
};

const phasePresentationMap: Record<string, PhasePresentation> = {
  phase1: {
    badgeClass: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
    borderClass: "border-emerald-400/30",
    iconClass: "bg-emerald-400/10 text-emerald-400",
    labelClass: "text-emerald-300",
    Icon: Sun,
  },
  phase2: {
    badgeClass: "border-blue-400/40 bg-blue-400/10 text-blue-400",
    borderClass: "border-blue-400/30",
    iconClass: "bg-blue-400/10 text-blue-400",
    labelClass: "text-blue-300",
    Icon: Cpu,
  },
  phase3: {
    badgeClass: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    borderClass: "border-amber-400/30",
    iconClass: "bg-amber-400/10 text-amber-400",
    labelClass: "text-amber-300",
    Icon: Battery,
  },
  phase4: {
    badgeClass: "border-purple-400/40 bg-purple-400/10 text-purple-400",
    borderClass: "border-purple-400/30",
    iconClass: "bg-purple-400/10 text-purple-400",
    labelClass: "text-purple-300",
    Icon: TrendingUp,
  },
};

function buildInitialPositions(nodes: WorkflowNodeItem[]) {
  const positions: Record<string, Point> = {};
  let currentRow = 0;
  let currentPhase = "";
  let phaseIndex = 0;

  nodes.forEach((node) => {
    if (node.phaseId !== currentPhase) {
      if (currentPhase) {
        currentRow += Math.max(1, Math.ceil(phaseIndex / 3));
      }

      currentPhase = node.phaseId;
      phaseIndex = 0;
    }

    const rowOffset = Math.floor(phaseIndex / 3);
    const colOffset = phaseIndex % 3;

    positions[node.id] = {
      x: 30 + colOffset * HORIZONTAL_SPACING,
      y: 30 + (currentRow + rowOffset) * VERTICAL_SPACING,
    };

    phaseIndex += 1;
  });

  return positions;
}

function buildConnectionPath(start: Point, end: Point) {
  const startX = start.x + NODE_WIDTH;
  const startY = start.y + NODE_HEIGHT / 2;
  const endX = end.x;
  const endY = end.y + NODE_HEIGHT / 2;
  const cp1X = startX + (endX - startX) * 0.5;
  const cp2X = endX - (endX - startX) * 0.5;

  return `M${startX},${startY} C${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;
}

export default function ReportWorkflowCanvas({
  nodes,
  selectedCount,
  onToggle,
}: WorkflowCanvasProps) {
  const layoutKey = useMemo(() => nodes.map((node) => node.id).join("|"), [nodes]);
  const [positions, setPositions] = useState<Record<string, Point>>(() => buildInitialPositions(nodes));
  const dragStartRef = useRef<Record<string, Point>>({});

  useEffect(() => {
    setPositions(buildInitialPositions(nodes));
  }, [layoutKey]);

  const connections = useMemo(() => {
    return nodes.slice(0, -1).map((node, index) => {
      const nextNode = nodes[index + 1];
      const start = positions[node.id];
      const end = positions[nextNode.id];

      if (!start || !end) {
        return null;
      }

      return {
        id: `${node.id}-${nextNode.id}`,
        path: buildConnectionPath(start, end),
      };
    }).filter(Boolean) as Array<{ id: string; path: string }>;
  }, [nodes, positions]);

  const canvasSize = useMemo(() => {
    const allPoints = Object.values(positions);
    const maxX = allPoints.length ? Math.max(...allPoints.map((point) => point.x)) : 0;
    const maxY = allPoints.length ? Math.max(...allPoints.map((point) => point.y)) : 0;

    return {
      width: Math.max(900, maxX + NODE_WIDTH + 80),
      height: Math.max(500, maxY + NODE_HEIGHT + 80),
    };
  }, [positions]);

  const readyCount = nodes.filter((node) => node.calculated).length;

  return (
    <div className="relative w-full overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface)] p-4 backdrop-blur [border:var(--border-default)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Workflow canvas
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            Drag nodes to inspect the project flow before generating the final report.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShadBadge
            variant="outline"
            className="rounded-full border-emerald-400/40 bg-emerald-400/10 text-emerald-400"
          >
            Active
          </ShadBadge>
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            {selectedCount} selected
          </span>
        </div>
      </div>

      <div className="relative h-[500px] overflow-auto rounded-xl bg-[var(--color-surface-secondary)] [border:var(--border-default)]">
        <div
          className="relative"
          style={{ width: canvasSize.width, height: canvasSize.height }}
        >
          <svg
            className="pointer-events-none absolute left-0 top-0"
            width={canvasSize.width}
            height={canvasSize.height}
            viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
            aria-hidden="true"
          >
            {connections.map((connection) => (
              <path
                key={connection.id}
                d={connection.path}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="8 6"
                className="text-[var(--color-text-muted)] opacity-40"
              />
            ))}
          </svg>

          {nodes.map((node, index) => {
            const phasePresentation =
              phasePresentationMap[node.phaseId] ?? phasePresentationMap.phase1;
            const position = positions[node.id] ?? { x: 0, y: 0 };
            const StatusIcon = phasePresentation.Icon;

            return (
              <motion.div
                key={node.id}
                drag
                dragMomentum={false}
                dragConstraints={{ left: 0, top: 0, right: 100000, bottom: 100000 }}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                whileHover={{ scale: 1.02 }}
                whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                style={{
                  position: "absolute",
                  width: NODE_WIDTH,
                  x: position.x,
                  y: position.y,
                }}
                onDragStart={() => {
                  dragStartRef.current[node.id] = position;
                }}
                onDrag={(_, info: PanInfo) => {
                  const start = dragStartRef.current[node.id] ?? position;

                  flushSync(() => {
                    setPositions((current) => ({
                      ...current,
                      [node.id]: {
                        x: Math.max(0, start.x + info.offset.x),
                        y: Math.max(0, start.y + info.offset.y),
                      },
                    }));
                  });
                }}
                onDragEnd={(_, info: PanInfo) => {
                  const start = dragStartRef.current[node.id] ?? position;
                  setPositions((current) => ({
                    ...current,
                    [node.id]: {
                      x: Math.max(0, start.x + info.offset.x),
                      y: Math.max(0, start.y + info.offset.y),
                    },
                  }));
                  delete dragStartRef.current[node.id];
                }}
              >
                <Card
                  className={cn(
                    "rounded-xl bg-[var(--color-surface)] p-3 backdrop-blur-sm shadow-[0_12px_24px_rgba(15,23,42,0.08)]",
                    node.calculated ? phasePresentation.borderClass : "border-white/10"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        phasePresentation.iconClass
                      )}
                    >
                      <StatusIcon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <ShadBadge
                            variant="outline"
                            className={cn("rounded-full text-[10px]", phasePresentation.badgeClass)}
                          >
                            {node.phaseShortLabel}
                          </ShadBadge>
                          <h3 className="mt-2 truncate text-sm font-semibold text-[var(--color-text)]">
                            {node.name}
                          </h3>
                        </div>

                        <Checkbox
                          checked={node.selected}
                          onChange={(event) => onToggle(node.id, event.target.checked)}
                          aria-label={`Include ${node.name}`}
                        />
                      </div>

                      <p className="mt-2 min-h-[28px] text-[10px] leading-4 text-[var(--color-text-muted)]">
                        {node.statusLine}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                          <ArrowRight className="h-2.5 w-2.5" />
                          <span className={node.calculated ? phasePresentation.labelClass : ""}>
                            {node.calculated ? "Ready" : "Pending"}
                          </span>
                        </div>

                        <Link
                          href={node.href}
                          className="font-semibold text-[var(--color-brand)] hover:text-[var(--color-brand-dark)]"
                        >
                          Open →
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-[var(--color-surface-secondary)] px-4 py-2.5 [border:var(--border-default)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          {nodes.length} Nodes · {connections.length} Connections · {readyCount} Ready ·{" "}
          {selectedCount} Selected
        </p>
      </div>
    </div>
  );
}
