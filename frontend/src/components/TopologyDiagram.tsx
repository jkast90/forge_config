import { useState, useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type { Device } from '@core';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

interface DiagramProps {
  spines: Device[];
  leaves: Device[];
  externals?: Device[];
  patchPanels?: Device[];
  gpuNodes?: Device[];
  mgmtSwitches?: Device[];
}

export interface TopologyDiagramViewerHandle {
  exportSvg: () => void;
}

/** Interactive diagram viewer with zoom and pan controls */
export const TopologyDiagramViewer = forwardRef<TopologyDiagramViewerHandle, DiagramProps>(function TopologyDiagramViewer({ spines, leaves, externals = [], patchPanels = [], gpuNodes = [], mgmtSwitches = [] }, ref) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleExportSvg = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    clone.style.backgroundColor = '#1a1a2e';
    const svgString = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fabric-diagram.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  useImperativeHandle(ref, () => ({ exportSvg: handleExportSvg }), [handleExportSvg]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const handleFitView = () => {
    if (!containerRef.current) return;
    const nodeW = 140;
    const hGap = 20;
    const maxCount = Math.max(spines.length, leaves.length, externals.length, patchPanels.length, gpuNodes.length);
    const mgmtExtra = mgmtSwitches.length > 0 ? 180 : 0;
    const svgW = maxCount * (nodeW + hGap) - hGap + 40 + mgmtExtra;
    const containerW = containerRef.current.clientWidth - 32;
    const fitZoom = Math.min(containerW / svgW, 2);
    setZoom(Math.max(fitZoom, 0.25));
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.min(Math.max(z + delta, 0.25), 4));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const up = () => setDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [dragging]);

  return (
    <div className="topo-diagram-viewer">
      <div className="topo-diagram-toolbar">
        <IconButton variant="secondary" size="sm" onClick={handleZoomOut} title="Zoom out">
          <Icon name="remove" size={16} />
        </IconButton>
        <span className="topo-zoom-label">{Math.round(zoom * 100)}%</span>
        <IconButton variant="secondary" size="sm" onClick={handleZoomIn} title="Zoom in">
          <Icon name="add" size={16} />
        </IconButton>
        <IconButton variant="secondary" size="sm" onClick={handleFitView} title="Fit to view">
          <Icon name="fit_screen" size={16} />
        </IconButton>
        <IconButton variant="secondary" size="sm" onClick={handleZoomReset} title="Reset view">
          <Icon name="center_focus_strong" size={16} />
        </IconButton>
      </div>
      <div
        ref={containerRef}
        className={`topo-diagram-canvas${dragging ? ' topo-dragging' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            display: 'inline-block',
          }}
        >
          <TopologyDiagram ref={svgRef} spines={spines} leaves={leaves} externals={externals} patchPanels={patchPanels} gpuNodes={gpuNodes} mgmtSwitches={mgmtSwitches} />
        </div>
      </div>
    </div>
  );
});

/** SVG network diagram showing CLOS spine-leaf topology with dual links, optional external tier, patch panel layer, GPU nodes, and management switches */
export const TopologyDiagram = forwardRef<SVGSVGElement, DiagramProps>(function TopologyDiagram({ spines, leaves, externals = [], patchPanels = [], gpuNodes = [], mgmtSwitches = [] }, ref) {
  const nodeW = 140;
  const nodeH = 48;
  const ppNodeH = 32; // Shorter height for patch panels (passive devices)
  const gpuNodeH = 40; // Slightly shorter for GPU nodes
  const hGap = 20;
  const linksPerPair = 2;
  const linkSpacing = 6;
  const ifLabelH = 9;
  const ifBlockPad = 4;
  const padX = 20;
  const padY = 20;
  const hasExternals = externals.length > 0;
  const hasPatchPanels = patchPanels.length > 0;
  const hasGpuNodes = gpuNodes.length > 0;
  const hasMgmt = mgmtSwitches.length > 0;
  const mgmtNodeW = 120; // Slightly narrower for mgmt switches
  const mgmtNodeH = 40;
  const mgmtVGap = 12; // Vertical gap between stacked mgmt switches
  const mgmtColumnW = hasMgmt ? mgmtNodeW + 40 : 0; // Extra right margin for mgmt column

  // Interface counts for spacing
  const spineDownIfCount = leaves.length * linksPerPair;
  const spineUpIfCount = hasExternals ? externals.length * linksPerPair : 0;
  const leafIfCount = spines.length * linksPerPair;
  const extIfCount = hasExternals ? spines.length * linksPerPair : 0;

  const spineDownIfBlockH = spineDownIfCount * ifLabelH + ifBlockPad;
  const spineUpIfBlockH = spineUpIfCount > 0 ? spineUpIfCount * ifLabelH + ifBlockPad : 0;
  const leafIfBlockH = leafIfCount * ifLabelH + ifBlockPad;
  const extIfBlockH = extIfCount > 0 ? extIfCount * ifLabelH + ifBlockPad : 0;

  // Vertical gaps between tiers
  const ppGap = hasPatchPanels ? 30 : 0; // Gap above and below patch panel tier
  const spineToNextGap = 40 + spineDownIfBlockH;
  const leafFromPrevGap = 40 + leafIfBlockH;
  const spineLeafGap = hasPatchPanels
    ? spineToNextGap + ppGap + ppNodeH + ppGap + leafFromPrevGap
    : 40 + spineDownIfBlockH + leafIfBlockH;
  const extSpineGap = hasExternals ? 40 + extIfBlockH + spineUpIfBlockH : 0;
  const leafGpuGap = hasGpuNodes ? 60 : 0;

  const maxCount = Math.max(spines.length, leaves.length, externals.length, patchPanels.length, gpuNodes.length);
  const fabricW = maxCount * (nodeW + hGap) - hGap + padX * 2;
  const totalW = fabricW + mgmtColumnW;

  // Y positions for each tier (external at top, spine, patch panels, leaf, GPU at bottom)
  const extY = padY;
  const spineY = hasExternals ? extY + nodeH + extSpineGap : padY;
  const ppY = spineY + nodeH + spineToNextGap + ppGap;
  const leafY = spineY + nodeH + spineLeafGap;
  const gpuY = leafY + nodeH + leafGpuGap;

  // Management switches stacked vertically on the right side
  const mgmtStackH = hasMgmt ? mgmtSwitches.length * (mgmtNodeH + mgmtVGap) - mgmtVGap : 0;
  const mgmtX = fabricW + 20;
  const mgmtStartY = spineY + (leafY + nodeH - spineY - mgmtStackH) / 2; // Vertically centered between spine and leaf
  const mgmtPositions = mgmtSwitches.map((_, i) => ({ x: mgmtX, y: mgmtStartY + i * (mgmtNodeH + mgmtVGap) }));

  const fabricBottomY = hasGpuNodes ? gpuY + gpuNodeH : leafY + nodeH;
  const mgmtBottomY = hasMgmt ? mgmtStartY + mgmtStackH : 0;
  const totalH = Math.max(fabricBottomY, mgmtBottomY) + padY;

  // Center each tier horizontally within the fabric area (excluding mgmt column)
  const tierStartX = (count: number) => padX + (fabricW - padX * 2 - (count * (nodeW + hGap) - hGap)) / 2;
  const extStartX = tierStartX(externals.length);
  const spineStartX = tierStartX(spines.length);
  const ppStartX = tierStartX(patchPanels.length);
  const leafStartX = tierStartX(leaves.length);
  const gpuStartX = tierStartX(gpuNodes.length);

  const extPositions = externals.map((_, i) => ({ x: extStartX + i * (nodeW + hGap), y: extY }));
  const spinePositions = spines.map((_, i) => ({ x: spineStartX + i * (nodeW + hGap), y: spineY }));
  const ppPositions = patchPanels.map((_, i) => ({ x: ppStartX + i * (nodeW + hGap), y: ppY }));
  const leafPositions = leaves.map((_, i) => ({ x: leafStartX + i * (nodeW + hGap), y: leafY }));
  const gpuPositions = gpuNodes.map((_, i) => ({ x: gpuStartX + i * (nodeW + hGap), y: gpuY }));

  // Map each GPU node to its parent leaf (round-robin striping, matching backend logic)
  const gpuToLeaf: number[] = gpuNodes.map((_, gi) => leaves.length > 0 ? gi % leaves.length : -1);

  const statusColor = (d: Device) =>
    d.status === 'online' ? 'var(--color-success, #22c55e)' : d.status === 'provisioning' ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-muted, #888)';

  const ifPrefix = (d: Device) => d.vendor === 'FRR' ? 'eth' : 'Eth';
  const ifIndex: Record<number, number> = {};
  const nextIf = (d: Device) => {
    ifIndex[d.id] = (ifIndex[d.id] || 0) + 1;
    return `${ifPrefix(d)}${ifIndex[d.id]}`;
  };

  type IfLabel = { name: string; peer: string };

  // External interface labels (downward, toward spines)
  const extIfs: IfLabel[][] = externals.map(() => []);
  // Spine uplink interface labels (upward, toward externals)
  const spineUpIfs: IfLabel[][] = spines.map(() => []);
  // Spine downlink interface labels (downward, toward leaves)
  const spineDownIfs: IfLabel[][] = spines.map(() => []);
  // Leaf interface labels (upward, toward spines)
  const leafIfs: IfLabel[][] = leaves.map(() => []);

  // Build uplink links: external <-> spine
  const uplinkData: { ei: number; si: number; link: number }[] = [];
  for (let ei = 0; ei < externals.length; ei++) {
    for (let si = 0; si < spines.length; si++) {
      for (let link = 0; link < linksPerPair; link++) {
        extIfs[ei].push({ name: nextIf(externals[ei]), peer: spines[si].hostname || spines[si].mac?.slice(-8) || String(spines[si].id) });
        spineUpIfs[si].push({ name: nextIf(spines[si]), peer: externals[ei].hostname || externals[ei].mac?.slice(-8) || String(externals[ei].id) });
        uplinkData.push({ ei, si, link });
      }
    }
  }

  // Build fabric links: spine <-> leaf
  const linkData: { si: number; li: number; link: number }[] = [];
  for (let si = 0; si < spines.length; si++) {
    for (let li = 0; li < leaves.length; li++) {
      for (let link = 0; link < linksPerPair; link++) {
        spineDownIfs[si].push({ name: nextIf(spines[si]), peer: leaves[li].hostname || leaves[li].mac?.slice(-8) || String(leaves[li].id) });
        leafIfs[li].push({ name: nextIf(leaves[li]), peer: spines[si].hostname || spines[si].mac?.slice(-8) || String(spines[si].id) });
        linkData.push({ si, li, link });
      }
    }
  }

  const renderNode = (d: Device, pos: { x: number; y: number }, opts?: { borderColor?: string; height?: number; width?: number; dashed?: boolean }) => {
    const h = opts?.height || nodeH;
    const w = opts?.width || nodeW;
    return (
      <g key={d.id}>
        <rect
          x={pos.x} y={pos.y} width={w} height={h} rx={6}
          fill="var(--color-bg-primary, #1a1a2e)"
          stroke={opts?.borderColor || statusColor(d)}
          strokeWidth={opts?.dashed ? 1.5 : 2}
          strokeDasharray={opts?.dashed ? '4 2' : undefined}
        />
        <text x={pos.x + w / 2} y={pos.y + (h < 40 ? h / 2 + 4 : 18)} textAnchor="middle" fill="var(--color-text, #e0e0e0)" fontSize={h < 40 ? 10 : 12} fontWeight={600}>
          {d.hostname || d.mac?.slice(-8) || String(d.id)}
        </text>
        {h >= 40 && (
          <text x={pos.x + w / 2} y={pos.y + 34} textAnchor="middle" fill="var(--color-text-muted, #888)" fontSize={10}>
            {d.ip || '—'}
          </text>
        )}
        {!opts?.dashed && <circle cx={pos.x + 10} cy={pos.y + 10} r={4} fill={statusColor(d)} />}
      </g>
    );
  };

  const renderIfLabelsBelow = (pos: { x: number; y: number }, labels: IfLabel[]) =>
    labels.map((ifl, j) => (
      <text
        key={j}
        x={pos.x + nodeW / 2}
        y={pos.y + nodeH + ifBlockPad + (j + 1) * ifLabelH}
        textAnchor="middle"
        fill="var(--color-text-muted, #888)"
        fontSize={7}
        opacity={0.7}
      >
        {ifl.name} → {ifl.peer}
      </text>
    ));

  const renderIfLabelsAbove = (pos: { x: number; y: number }, labels: IfLabel[]) =>
    labels.map((ifl, j) => (
      <text
        key={j}
        x={pos.x + nodeW / 2}
        y={pos.y - ifBlockPad - (labels.length - 1 - j) * ifLabelH}
        textAnchor="middle"
        fill="var(--color-text-muted, #888)"
        fontSize={7}
        opacity={0.7}
      >
        {ifl.name} → {ifl.peer}
      </text>
    ));

  // For patch panels: compute a midpoint X that routes through the nearest panel
  const ppMidX = (spineX: number, leafX: number, _si: number, _li: number, linkOffset: number) => {
    if (!hasPatchPanels) return null;
    // Find the nearest patch panel horizontally to the midpoint of spine-leaf
    const mid = (spineX + leafX) / 2;
    let bestPp = 0;
    let bestDist = Infinity;
    for (let pi = 0; pi < ppPositions.length; pi++) {
      const dist = Math.abs(ppPositions[pi].x + nodeW / 2 - mid);
      if (dist < bestDist) { bestDist = dist; bestPp = pi; }
    }
    return ppPositions[bestPp].x + nodeW / 2 + linkOffset;
  };

  return (
    <svg ref={ref} width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="topo-diagram-svg">
      {/* Uplink lines: external <-> spine */}
      {uplinkData.map(({ ei, si, link }) => {
        const ep = extPositions[ei];
        const sp = spinePositions[si];
        const off = (link - (linksPerPair - 1) / 2) * linkSpacing;
        return (
          <line
            key={`uplink-${ei}-${si}-${link}`}
            x1={ep.x + nodeW / 2 + off} y1={ep.y + nodeH}
            x2={sp.x + nodeW / 2 + off} y2={sp.y}
            stroke="var(--color-accent-purple, #a855f7)"
            strokeWidth={1.5}
            opacity={0.5}
            strokeDasharray="6 3"
          />
        );
      })}

      {/* Fabric links: spine <-> leaf (routing through patch panels if present) */}
      {linkData.map(({ si, li, link }) => {
        const sp = spinePositions[si];
        const lp = leafPositions[li];
        const off = (link - (linksPerPair - 1) / 2) * linkSpacing;
        const spX = sp.x + nodeW / 2 + off;
        const lpX = lp.x + nodeW / 2 + off;

        if (hasPatchPanels) {
          const mx = ppMidX(sp.x, lp.x, si, li, off)!;
          return (
            <g key={`link-${si}-${li}-${link}`}>
              {/* Spine → Patch Panel */}
              <line
                x1={spX} y1={sp.y + nodeH}
                x2={mx} y2={ppY}
                stroke="var(--color-border, #444)"
                strokeWidth={1.5}
                opacity={0.4}
              />
              {/* Patch Panel → Leaf */}
              <line
                x1={mx} y1={ppY + ppNodeH}
                x2={lpX} y2={lp.y}
                stroke="var(--color-border, #444)"
                strokeWidth={1.5}
                opacity={0.4}
              />
            </g>
          );
        }

        return (
          <line
            key={`link-${si}-${li}-${link}`}
            x1={spX} y1={sp.y + nodeH}
            x2={lpX} y2={lp.y}
            stroke="var(--color-border, #444)"
            strokeWidth={1.5}
            opacity={0.4}
          />
        );
      })}

      {/* External nodes + interface labels below */}
      {externals.map((d, i) => (
        <g key={`ext-${d.id}`}>
          {renderNode(d, extPositions[i], { borderColor: 'var(--color-accent-purple, #a855f7)' })}
          {renderIfLabelsBelow(extPositions[i], extIfs[i])}
        </g>
      ))}

      {/* Spine nodes + uplink interface labels above + downlink interface labels below */}
      {spines.map((d, i) => (
        <g key={`spine-${d.id}`}>
          {renderNode(d, spinePositions[i])}
          {spineUpIfs[i].length > 0 && renderIfLabelsAbove(spinePositions[i], spineUpIfs[i])}
          {renderIfLabelsBelow(spinePositions[i], spineDownIfs[i])}
        </g>
      ))}

      {/* Patch panel nodes */}
      {patchPanels.map((d, i) => (
        <g key={`pp-${d.id}`}>
          {renderNode(d, ppPositions[i], { borderColor: 'var(--color-warning, #f59e0b)', height: ppNodeH, dashed: true })}
        </g>
      ))}

      {/* Leaf nodes + interface labels above */}
      {leaves.map((d, i) => (
        <g key={`leaf-${d.id}`}>
          {renderNode(d, leafPositions[i])}
          {renderIfLabelsAbove(leafPositions[i], leafIfs[i])}
        </g>
      ))}

      {/* GPU uplink lines: leaf <-> GPU node (2 links per pair) */}
      {gpuNodes.map((_, gi) => {
        const li = gpuToLeaf[gi];
        if (li < 0) return null;
        const gp = gpuPositions[gi];
        const lp = leafPositions[li];
        return Array.from({ length: linksPerPair }, (__, link) => {
          const off = (link - (linksPerPair - 1) / 2) * linkSpacing;
          return (
            <line
              key={`gpu-link-${gi}-${link}`}
              x1={lp.x + nodeW / 2 + off} y1={lp.y + nodeH}
              x2={gp.x + nodeW / 2 + off} y2={gp.y}
              stroke="var(--color-accent-green, #22c55e)"
              strokeWidth={1.5}
              opacity={0.45}
            />
          );
        });
      })}

      {/* GPU nodes */}
      {gpuNodes.map((d, i) => (
        <g key={`gpu-${d.id}`}>
          {renderNode(d, gpuPositions[i], { borderColor: 'var(--color-accent-green, #22c55e)', height: gpuNodeH })}
        </g>
      ))}

      {/* Tier labels */}
      {hasExternals && (
        <text x={8} y={extY + nodeH / 2 + 4} fill="var(--color-accent-purple, #a855f7)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${extY + nodeH / 2})`} textAnchor="middle">
          EXTERNAL
        </text>
      )}
      <text x={8} y={spineY + nodeH / 2 + 4} fill="var(--color-text-muted, #888)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${spineY + nodeH / 2})`} textAnchor="middle">
        SPINE
      </text>
      {hasPatchPanels && (
        <text x={8} y={ppY + ppNodeH / 2 + 4} fill="var(--color-warning, #f59e0b)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${ppY + ppNodeH / 2})`} textAnchor="middle">
          PATCH
        </text>
      )}
      <text x={8} y={leafY + nodeH / 2 + 4} fill="var(--color-text-muted, #888)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${leafY + nodeH / 2})`} textAnchor="middle">
        LEAF
      </text>
      {hasGpuNodes && (
        <text x={8} y={gpuY + gpuNodeH / 2 + 4} fill="var(--color-accent-green, #22c55e)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${gpuY + gpuNodeH / 2})`} textAnchor="middle">
          GPU
        </text>
      )}

      {/* Management switches — stacked vertically on the right */}
      {hasMgmt && (
        <>
          {/* Dashed management lines from spines/leaves to mgmt column */}
          {spines.map((_, si) => mgmtSwitches.map((_, mi) => (
            <line
              key={`mgmt-spine-${si}-${mi}`}
              x1={spinePositions[si].x + nodeW} y1={spinePositions[si].y + nodeH / 2}
              x2={mgmtPositions[mi].x} y2={mgmtPositions[mi].y + mgmtNodeH / 2}
              stroke="var(--color-text-muted, #888)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.2}
            />
          )))}
          {leaves.map((_, li) => mgmtSwitches.map((_, mi) => (
            <line
              key={`mgmt-leaf-${li}-${mi}`}
              x1={leafPositions[li].x + nodeW} y1={leafPositions[li].y + nodeH / 2}
              x2={mgmtPositions[mi].x} y2={mgmtPositions[mi].y + mgmtNodeH / 2}
              stroke="var(--color-text-muted, #888)"
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.2}
            />
          )))}
          {mgmtSwitches.map((d, i) => (
            <g key={`mgmt-${d.id}`}>
              {renderNode(d, mgmtPositions[i], { borderColor: 'var(--color-accent-blue, #3b82f6)', height: mgmtNodeH, width: mgmtNodeW })}
            </g>
          ))}
          <text
            x={mgmtX + mgmtNodeW / 2}
            y={mgmtStartY - 10}
            fill="var(--color-accent-blue, #3b82f6)"
            fontSize={9}
            fontWeight={600}
            textAnchor="middle"
          >
            MGMT
          </text>
        </>
      )}
    </svg>
  );
});
