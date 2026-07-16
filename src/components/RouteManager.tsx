
import React, { useState } from 'react';
import { Route, Receiver } from '../types';
import { Plus, Trash2, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Settings, GitBranch, AlertCircle, RefreshCw, HelpCircle } from 'lucide-react';

interface RouteManagerProps {
  route: Route;
  receivers: Receiver[];
  onChange: (route: Route) => void;
}

export default function RouteManager({ route, receivers, onChange }: RouteManagerProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('root');
  const [collapsedRoutes, setCollapsedRoutes] = useState<Record<string, boolean>>({});

  // Flatten helper to easily navigate and find routes by ID
  const findRouteAndParent = (
    current: Route,
    targetId: string,
    parent: Route | null = null
  ): { route: Route; parent: Route | null } | null => {
    if (current.id === targetId) return { route: current, parent };
    if (current.routes) {
      for (const sub of current.routes) {
        const found = findRouteAndParent(sub, targetId, current);
        if (found) return found;
      }
    }
    return null;
  };

  const getSelectedRoute = (): Route | null => {
    const result = findRouteAndParent(route, selectedRouteId);
    return result ? result.route : null;
  };

  const activeRoute = getSelectedRoute();

  const handleUpdateActiveRoute = (updatedFields: Partial<Route>) => {
    if (!activeRoute) return;

    const deepUpdate = (current: Route): Route => {
      if (current.id === selectedRouteId) {
        return { ...current, ...updatedFields };
      }
      if (current.routes) {
        return {
          ...current,
          routes: current.routes.map(deepUpdate),
        };
      }
      return current;
    };

    const newRoot = deepUpdate(route);
    onChange(newRoot);
  };

  // Toggle Collapse
  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedRoutes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Add Route
  const handleAddSubRoute = (parentId: string) => {
    const newRoute: Route = {
      id: `route-${Date.now()}`,
      receiver: receivers[0]?.name || 'default-receiver',
      matchers: ['severity="warning"'],
    };

    const deepAdd = (current: Route): Route => {
      if (current.id === parentId) {
        return {
          ...current,
          routes: [...(current.routes || []), newRoute],
        };
      }
      if (current.routes) {
        return {
          ...current,
          routes: current.routes.map(deepAdd),
        };
      }
      return current;
    };

    const newRoot = deepAdd(route);
    onChange(newRoot);
    setSelectedRouteId(newRoute.id);
  };

  // Delete Route
  const handleDeleteRoute = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'root') {
      alert("Cannot delete the root route.");
      return;
    }

    if (confirm("Are you sure you want to delete this route and all its sub-routes?")) {
      const deepDelete = (current: Route): Route => {
        if (current.routes) {
          const filtered = current.routes.filter(r => r.id !== id);
          return {
            ...current,
            routes: filtered.map(deepDelete),
          };
        }
        return current;
      };

      const newRoot = deepDelete(route);
      onChange(newRoot);
      setSelectedRouteId('root');
    }
  };

  // Move Route Up/Down
  const handleMoveRoute = (id: string, direction: 'up' | 'down') => {
    const findParentAndIndex = (
      current: Route,
      targetId: string
    ): { parent: Route; index: number } | null => {
      if (current.routes) {
        const idx = current.routes.findIndex(r => r.id === targetId);
        if (idx !== -1) return { parent: current, index: idx };
        for (const sub of current.routes) {
          const found = findParentAndIndex(sub, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parentInfo = findParentAndIndex(route, id);
    if (!parentInfo) return;

    const { parent, index } = parentInfo;
    const siblingCount = parent.routes?.length || 0;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === siblingCount - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;

    const deepSwap = (current: Route): Route => {
      if (current.id === parent.id && current.routes) {
        const list = [...current.routes];
        const temp = list[index];
        list[index] = list[newIndex];
        list[newIndex] = temp;
        return { ...current, routes: list };
      }
      if (current.routes) {
        return {
          ...current,
          routes: current.routes.map(deepSwap),
        };
      }
      return current;
    };

    onChange(deepSwap(route));
  };

  // Indent Route (Make it a child of the sibling above it)
  const handleIndentRoute = (id: string) => {
    const findParentAndIndex = (
      current: Route,
      targetId: string
    ): { parent: Route; index: number } | null => {
      if (current.routes) {
        const idx = current.routes.findIndex(r => r.id === targetId);
        if (idx !== -1) return { parent: current, index: idx };
        for (const sub of current.routes) {
          const found = findParentAndIndex(sub, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parentInfo = findParentAndIndex(route, id);
    if (!parentInfo || parentInfo.index === 0) return; // Need a sibling above to indent under

    const { parent, index } = parentInfo;
    const targetSibling = parent.routes![index - 1];

    const deepIndent = (current: Route): Route => {
      // Remove target from current level, insert into previous sibling's children
      if (current.id === parent.id && current.routes) {
        const targetRoute = current.routes[index];
        const updatedSibling = {
          ...targetSibling,
          routes: [...(targetSibling.routes || []), targetRoute]
        };
        const updatedList = current.routes.filter((_, i) => i !== index);
        updatedList[index - 1] = updatedSibling;
        return { ...current, routes: updatedList };
      }
      if (current.routes) {
        return {
          ...current,
          routes: current.routes.map(deepIndent),
        };
      }
      return current;
    };

    onChange(deepIndent(route));
  };

  // Outdent Route (Move up a level to be a sibling of its current parent)
  const handleOutdentRoute = (id: string) => {
    // We need target, its parent, and its grandparent
    const findFamily = (
      current: Route,
      targetId: string,
      parent: Route | null = null,
      grandparent: Route | null = null
    ): { target: Route; parent: Route; grandparent: Route } | null => {
      if (current.id === targetId && parent && grandparent) {
        return { target: current, parent, grandparent };
      }
      if (current.routes) {
        for (const sub of current.routes) {
          const found = findFamily(sub, targetId, current, parent);
          if (found) return found;
        }
      }
      return null;
    };

    const family = findFamily(route, id);
    if (!family) return; // Grandparent is required, so root's direct children cannot outdent

    const { target, parent, grandparent } = family;

    const deepOutdent = (current: Route): Route => {
      // Remove from parent
      if (current.id === parent.id && current.routes) {
        return {
          ...current,
          routes: current.routes.filter(r => r.id !== id)
        };
      }
      // Insert as sibling of parent in grandparent
      if (current.id === grandparent.id && current.routes) {
        const parentIdx = current.routes.findIndex(r => r.id === parent.id);
        const list = [...current.routes];
        list.splice(parentIdx + 1, 0, target);
        return {
          ...current,
          routes: list.map(deepOutdent)
        };
      }
      if (current.routes) {
        return {
          ...current,
          routes: current.routes.map(deepOutdent),
        };
      }
      return current;
    };

    onChange(deepOutdent(route));
  };

  // Render Indented Hierarchy Item
  const renderTreeNodes = (node: Route, depth: number = 0, index: number = 0, isLast: boolean = true) => {
    const isSelected = node.id === selectedRouteId;
    const isRoot = node.id === 'root';
    const hasChildren = node.routes && node.routes.length > 0;
    const isCollapsed = collapsedRoutes[node.id];

    return (
      <div key={node.id} className="flex flex-col">
        {/* Row */}
        <div
          onClick={() => setSelectedRouteId(node.id)}
          className={`group flex items-center justify-between p-2.5 rounded-lg border cursor-pointer select-none transition-all ${
            isSelected
              ? 'bg-blue-50 border-blue-200 text-blue-900 font-medium shadow-sm'
              : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
          }`}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {/* Collapse Arrow */}
            {hasChildren ? (
              <button
                onClick={(e) => toggleCollapse(node.id, e)}
                className="p-1 hover:bg-gray-100 rounded text-gray-400"
              >
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <div className="w-5.5 h-1" />
            )}

            <GitBranch className={`w-3.5 h-3.5 ${isRoot ? 'text-blue-500' : 'text-gray-400'}`} />
            
            <div className="flex flex-col truncate">
              <span className="text-[11px] font-bold tracking-tight text-gray-800 uppercase">
                {isRoot ? 'Root Route' : `Route #${index + 1}`}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 truncate font-normal">
                {!isRoot && node.matchers && node.matchers.length > 0 ? (
                  <span className="bg-amber-50 text-amber-800 px-1 py-0.2 rounded border border-amber-100 text-[9px] font-mono">
                    {node.matchers.join(', ')}
                  </span>
                ) : !isRoot ? (
                  <span className="text-gray-400 italic">No Matchers</span>
                ) : null}
                
                <span className="text-[10px] text-gray-400">→</span>
                <span className="bg-gray-100 text-gray-700 px-1 py-0.2 rounded text-[9px] font-semibold truncate max-w-[110px]">
                  {node.receiver}
                </span>
                
                {node.continue && (
                  <span className="bg-teal-50 text-teal-700 px-1 py-0.2 rounded text-[9px] font-medium border border-teal-100">
                    continue
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Controls */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            {!isRoot && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleMoveRoute(node.id, 'up'); }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="Move Up"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleMoveRoute(node.id, 'down'); }}
                  className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                  title="Move Down"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
                {depth > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOutdentRoute(node.id); }}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded text-[9px] font-bold"
                    title="Outdent (Move left)"
                  >
                    ←
                  </button>
                )}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleIndentRoute(node.id); }}
                    className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded text-[9px] font-bold"
                    title="Indent (Move right)"
                  >
                    →
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleAddSubRoute(node.id); }}
              className="p-1 text-blue-500 hover:bg-blue-50 rounded"
              title="Add Sub-Route"
            >
              <Plus className="w-3 h-3" />
            </button>
            {!isRoot && (
              <button
                type="button"
                onClick={(e) => handleDeleteRoute(node.id, e)}
                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                title="Delete Route"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Children Render */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col gap-1.5 mt-1">
            {node.routes!.map((sub, sIdx) => 
              renderTreeNodes(sub, depth + 1, sIdx, sIdx === node.routes!.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  // Helper to build recursive visual SVG flowchart data
  const buildSvgLayout = (node: Route, x: number = 100, y: number = 40, levelWidth: number = 220): { nodes: any[]; links: any[] } => {
    let nodesResult: any[] = [];
    let linksResult: any[] = [];

    // Current node summary representation
    const label = node.id === 'root' ? 'Root (Default)' : node.matchers?.join(', ') || 'Matcher';
    nodesResult.push({
      id: node.id,
      x,
      y,
      label,
      receiver: node.receiver,
      isRoot: node.id === 'root',
      continue: !!node.continue
    });

    if (node.routes && node.routes.length > 0) {
      const childCount = node.routes.length;
      const verticalSpacing = 70;
      const startY = y - ((childCount - 1) * verticalSpacing) / 2;

      node.routes.forEach((child, idx) => {
        const childX = x + levelWidth;
        const childY = startY + idx * verticalSpacing;

        // Draw bezier link
        linksResult.push({
          sourceId: node.id,
          targetId: child.id,
          sourceX: x + 150, // box width is 150
          sourceY: y,
          targetX: childX,
          targetY: childY
        });

        // Recurse children layout
        const subLayout = buildSvgLayout(child, childX, childY, levelWidth);
        nodesResult = [...nodesResult, ...subLayout.nodes];
        linksResult = [...linksResult, ...subLayout.links];
      });
    }

    return { nodes: nodesResult, links: linksResult };
  };

  const svgLayout = buildSvgLayout(route);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Route List pane */}
      <div className="xl:col-span-4 bg-white border border-gray-200 rounded-xl p-4 flex flex-col overflow-y-auto">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-sm flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-gray-500" />
            Route Hierarchy
          </span>
          <div className="text-[10px] text-gray-400">
            Click node to edit configuration
          </div>
        </div>

        <div className="flex-1 space-y-1.5 pr-1">
          {renderTreeNodes(route)}
        </div>
      </div>

      {/* Editor Detail and Visual Layout Pane */}
      <div className="xl:col-span-8 flex flex-col gap-6 overflow-hidden">
        {/* Node Editor Form */}
        {activeRoute ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shrink-0">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-100">
              <Settings className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-gray-800 text-xs uppercase tracking-wider">
                Editing Route: {activeRoute.id === 'root' ? 'ROOT DEFAULT' : activeRoute.id}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Receiver dropdown */}
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Target Receiver</label>
                <select
                  value={activeRoute.receiver}
                  onChange={(e) => handleUpdateActiveRoute({ receiver: e.target.value })}
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                >
                  {receivers.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>

              {/* Matchers (except root) */}
              {activeRoute.id !== 'root' && (
                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-medium text-gray-600">Matchers List</label>
                    <span className="text-[9px] text-gray-400 font-mono">Format: label="value"</span>
                  </div>
                  <input
                    type="text"
                    value={activeRoute.matchers?.join(', ') || ''}
                    onChange={(e) => {
                      const list = e.target.value.split(',').map(m => m.trim()).filter(m => m.length > 0);
                      handleUpdateActiveRoute({ matchers: list });
                    }}
                    placeholder='severity="critical", env="prod"'
                    className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              )}

              {/* Continue flag (except root) */}
              {activeRoute.id !== 'root' && (
                <div className="flex items-center pt-5">
                  <label className="inline-flex items-center text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!activeRoute.continue}
                      onChange={(e) => handleUpdateActiveRoute({ continue: e.target.checked })}
                      className="rounded text-blue-600 border-gray-300 focus:ring-blue-500 mr-2"
                    />
                    Continue Alert Matching
                    <HelpCircle className="w-3.5 h-3.5 text-gray-400 ml-1 inline" title="If enabled, alerts continue matching further sibling branches too." />
                  </label>
                </div>
              )}

              {/* Root route parameters */}
              {activeRoute.id === 'root' && (
                <div>
                  <label className="block text-[11px] font-medium text-gray-600 mb-1">Group By Labels</label>
                  <input
                    type="text"
                    value={activeRoute.group_by?.join(', ') || ''}
                    onChange={(e) => {
                      const list = e.target.value.split(',').map(m => m.trim()).filter(m => m.length > 0);
                      handleUpdateActiveRoute({ group_by: list });
                    }}
                    placeholder="alertname, cluster, service"
                    className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              )}

              {/* Timing parameters */}
              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Group Wait</label>
                <input
                  type="text"
                  value={activeRoute.group_wait || ''}
                  onChange={(e) => handleUpdateActiveRoute({ group_wait: e.target.value })}
                  placeholder="30s"
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Group Interval</label>
                <input
                  type="text"
                  value={activeRoute.group_interval || ''}
                  onChange={(e) => handleUpdateActiveRoute({ group_interval: e.target.value })}
                  placeholder="5m"
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-gray-600 mb-1">Repeat Interval</label>
                <input
                  type="text"
                  value={activeRoute.repeat_interval || ''}
                  onChange={(e) => handleUpdateActiveRoute({ repeat_interval: e.target.value })}
                  placeholder="12h"
                  className="w-full text-xs p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5 text-center text-xs text-gray-400">
            Select a route node to configure its routing parameters.
          </div>
        )}

        {/* Live Flowchart SVG representation */}
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl flex flex-col overflow-hidden relative">
          <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-tight text-gray-600 uppercase flex items-center gap-1">
              <GitBranch className="w-3.5 h-3.5 text-blue-500" />
              Live Routing Tree Flowchart
            </span>
            <span className="text-[9px] text-gray-400 font-mono">
              Visualizes how alerts propagate and hit notification groups
            </span>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-start min-h-[220px]">
            <svg
              className="mx-auto"
              width={Math.max(800, svgLayout.nodes.length * 90)}
              height={400}
              style={{ minHeight: '340px' }}
            >
              {/* Render paths */}
              {svgLayout.links.map((link, idx) => {
                // Bezier calculation
                const controlX = (link.sourceX + link.targetX) / 2;
                const pathData = `M ${link.sourceX} ${link.sourceY} C ${controlX} ${link.sourceY}, ${controlX} ${link.targetY}, ${link.targetX} ${link.targetY}`;
                return (
                  <path
                    key={`link-${idx}`}
                    d={pathData}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Render nodes */}
              {svgLayout.nodes.map((node) => {
                const isSelected = node.id === selectedRouteId;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y - 25})`}
                    onClick={() => setSelectedRouteId(node.id)}
                    className="cursor-pointer select-none group"
                  >
                    {/* Background Rect */}
                    <rect
                      width={170}
                      height={50}
                      rx={6}
                      fill={isSelected ? '#eff6ff' : '#ffffff'}
                      stroke={isSelected ? '#3b82f6' : '#e2e8f0'}
                      strokeWidth={isSelected ? 2 : 1}
                      className="transition-all duration-200 filter hover:drop-shadow-sm"
                    />

                    {/* Continuation indicator */}
                    {node.continue && (
                      <circle cx={170} cy={25} r={5} fill="#14b8a6" title="Continue Flag Enabled" />
                    )}

                    {/* Text values */}
                    <text
                      x={10}
                      y={18}
                      className={`text-[10px] font-bold ${node.isRoot ? 'fill-blue-600' : 'fill-gray-800'}`}
                    >
                      {node.isRoot ? 'ROOT DEFAULT' : node.label.length > 25 ? `${node.label.substring(0, 25)}...` : node.label}
                    </text>

                    <text
                      x={10}
                      y={36}
                      className="text-[9px] fill-gray-400 font-mono"
                    >
                      Target: {node.receiver}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
