import { useState, useCallback, useEffect, useRef } from 'react';
import type { Device } from '@core';
import { IconButton } from './IconButton';
import { Icon } from './Icon';

interface DiagramProps {
  spines: Device[];
  leaves: Device[];
  externals?: Device[];
}

/** Interactive diagram viewer with zoom and pan controls */
export function TopologyDiagramViewer({ spines, leaves, externals = [] }: DiagramProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleZoomReset = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const handleFitView = () => {
    if (!containerRef.current) return;
    const nodeW = 140;
    const hGap = 20;
    const maxCount = Math.max(spines.length, leaves.length, externals.length);
    const svgW = maxCount * (nodeW + hGap) - hGap + 40;
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
          <TopologyDiagram spines={spines} leaves={leaves} externals={externals} />
        </div>
      </div>
    </div>
  );
}

/** SVG network diagram showing CLOS spine-leaf topology with dual links and optional external tier */
export function TopologyDiagram({ spines, leaves, externals = [] }: DiagramProps) {
  const nodeW = 140;
  const nodeH = 48;
  const hGap = 20;
  const linksPerPair = 2;
  const linkSpacing = 6;
  const ifLabelH = 9;
  const ifBlockPad = 4;
  const padX = 20;
  const padY = 20;
  const hasExternals = externals.length > 0;

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
  const spineLeafGap = 40 + spineDownIfBlockH + leafIfBlockH;
  const extSpineGap = hasExternals ? 40 + extIfBlockH + spineUpIfBlockH : 0;

  const maxCount = Math.max(spines.length, leaves.length, externals.length);
  const totalW = maxCount * (nodeW + hGap) - hGap + padX * 2;

  // Y positions for each tier (external at top, spine in middle, leaf at bottom)
  const extY = padY;
  const spineY = hasExternals ? extY + nodeH + extSpineGap : padY;
  const leafY = spineY + nodeH + spineLeafGap;
  const totalH = leafY + nodeH + padY;

  // Center each tier horizontally
  const tierStartX = (count: number) => padX + (totalW - padX * 2 - (count * (nodeW + hGap) - hGap)) / 2;
  const extStartX = tierStartX(externals.length);
  const spineStartX = tierStartX(spines.length);
  const leafStartX = tierStartX(leaves.length);

  const extPositions = externals.map((_, i) => ({ x: extStartX + i * (nodeW + hGap), y: extY }));
  const spinePositions = spines.map((_, i) => ({ x: spineStartX + i * (nodeW + hGap), y: spineY }));
  const leafPositions = leaves.map((_, i) => ({ x: leafStartX + i * (nodeW + hGap), y: leafY }));

  const statusColor = (d: Device) =>
    d.status === 'online' ? 'var(--color-success, #22c55e)' : d.status === 'provisioning' ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-muted, #888)';

  const ifPrefix = (d: Device) => d.vendor === 'frr' ? 'eth' : 'Eth';
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

  const renderNode = (d: Device, pos: { x: number; y: number }, borderColor?: string) => (
    <g key={d.id}>
      <rect x={pos.x} y={pos.y} width={nodeW} height={nodeH} rx={6} fill="var(--color-bg-primary, #1a1a2e)" stroke={borderColor || statusColor(d)} strokeWidth={2} />
      <text x={pos.x + nodeW / 2} y={pos.y + 18} textAnchor="middle" fill="var(--color-text, #e0e0e0)" fontSize={12} fontWeight={600}>
        {d.hostname || d.mac?.slice(-8) || String(d.id)}
      </text>
      <text x={pos.x + nodeW / 2} y={pos.y + 34} textAnchor="middle" fill="var(--color-text-muted, #888)" fontSize={10}>
        {d.ip || '—'}
      </text>
      <circle cx={pos.x + 10} cy={pos.y + 10} r={4} fill={statusColor(d)} />
    </g>
  );

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

  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="topo-diagram-svg">
      {/* Uplink lines: external <-> spine */}
      {uplinkData.map(({ ei, si, link }) => {
        const ep = extPositions[ei];
        const sp = spinePositions[si];
        const offset = (link - (linksPerPair - 1) / 2) * linkSpacing;
        return (
          <line
            key={`uplink-${ei}-${si}-${link}`}
            x1={ep.x + nodeW / 2 + offset} y1={ep.y + nodeH}
            x2={sp.x + nodeW / 2 + offset} y2={sp.y}
            stroke="var(--color-accent-purple, #a855f7)"
            strokeWidth={1.5}
            opacity={0.5}
            strokeDasharray="6 3"
          />
        );
      })}

      {/* Fabric links: spine <-> leaf */}
      {linkData.map(({ si, li, link }) => {
        const sp = spinePositions[si];
        const lp = leafPositions[li];
        const offset = (link - (linksPerPair - 1) / 2) * linkSpacing;
        return (
          <line
            key={`link-${si}-${li}-${link}`}
            x1={sp.x + nodeW / 2 + offset} y1={sp.y + nodeH}
            x2={lp.x + nodeW / 2 + offset} y2={lp.y}
            stroke="var(--color-border, #444)"
            strokeWidth={1.5}
            opacity={0.4}
          />
        );
      })}

      {/* External nodes + interface labels below */}
      {externals.map((d, i) => (
        <g key={`ext-${d.id}`}>
          {renderNode(d, extPositions[i], 'var(--color-accent-purple, #a855f7)')}
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

      {/* Leaf nodes + interface labels above */}
      {leaves.map((d, i) => (
        <g key={`leaf-${d.id}`}>
          {renderNode(d, leafPositions[i])}
          {renderIfLabelsAbove(leafPositions[i], leafIfs[i])}
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
      <text x={8} y={leafY + nodeH / 2 + 4} fill="var(--color-text-muted, #888)" fontSize={9} fontWeight={600} transform={`rotate(-90, 8, ${leafY + nodeH / 2})`} textAnchor="middle">
        LEAF
      </text>
    </svg>
  );
}
