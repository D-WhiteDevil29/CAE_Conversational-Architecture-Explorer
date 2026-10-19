import { useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, CheckCircle2, FileJson, Image, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NODE_COLORS, NODE_TYPES } from '@/config/constants';
import { CustomNode } from './CustomNode';
import { toPng } from 'html-to-image';

// Sample initial data
const initialNodes = [
  {
    id: '1',
    type: 'custom',
    position: { x: 250, y: 25 },
    data: {
      label: 'ECOM Service',
      type: NODE_TYPES.SERVICE,
      status: 'active',
      owner: 'Team Alpha',
      lastDeploy: '2 hours ago',
    },
  },
  {
    id: '2',
    type: 'custom',
    position: { x: 100, y: 150 },
    data: {
      label: 'Kenan Billing API',
      type: NODE_TYPES.API,
      status: 'active',
      owner: 'Team Beta',
      lastDeploy: '1 day ago',
    },
  },
  {
    id: '3',
    type: 'custom',
    position: { x: 400, y: 150 },
    data: {
      label: 'ESOM Gateway',
      type: NODE_TYPES.SERVICE,
      status: 'warning',
      owner: 'Team Gamma',
      lastDeploy: '3 days ago',
    },
  },
  {
    id: '4',
    type: 'custom',
    position: { x: 250, y: 300 },
    data: {
      label: 'MongoDB Cluster',
      type: NODE_TYPES.DATABASE,
      status: 'active',
      owner: 'DBA Team',
    },
  },
  {
    id: '5',
    type: 'custom',
    position: { x: 550, y: 200 },
    data: {
      label: 'Message Queue',
      type: NODE_TYPES.QUEUE,
      status: 'active',
      owner: 'Platform Team',
    },
  },
];

const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
    label: 'API Call',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#667eea' },
    labelStyle: { fill: '#ffffff', fontWeight: 500, fontSize: 12 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
  },
  {
    id: 'e1-3',
    source: '1',
    target: '3',
    animated: true,
    label: 'Request',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#764ba2' },
    labelStyle: { fill: '#ffffff', fontWeight: 500, fontSize: 12 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
  },
  {
    id: 'e2-4',
    source: '2',
    target: '4',
    label: 'Read/Write',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#f093fb' },
    labelStyle: { fill: '#ffffff', fontWeight: 500, fontSize: 12 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    label: 'Query',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#f093fb' },
    labelStyle: { fill: '#ffffff', fontWeight: 500, fontSize: 12 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
  },
  {
    id: 'e3-5',
    source: '3',
    target: '5',
    animated: true,
    label: 'Publish',
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#4facfe' },
    labelStyle: { fill: '#ffffff', fontWeight: 500, fontSize: 12 },
    labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.9 },
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 4,
  },
];

const nodeTypes = {
  custom: CustomNode,
};

export function DependencyGraph({ graphData }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [downloadType, setDownloadType] = useState('');
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [graphTitle, setGraphTitle] = useState('Architecture Dependency Graph');
  const graphRef = useRef(null);
  const rfInstanceRef = useRef(null);

  const onInit = useCallback((instance) => {
    rfInstanceRef.current = instance;
  }, []);

  useEffect(() => {
    if (graphData && graphData.nodes && graphData.edges) {
      if (graphData.metadata?.title) {
        setGraphTitle(graphData.metadata.title);
      } else if (graphData.nodes[0]?.data?.graphTitle) {
        setGraphTitle(graphData.nodes[0].data.graphTitle);
      }

      setNodes(graphData.nodes);

      const enhancedEdges = graphData.edges.map(edge => ({
        ...edge,
        type: edge.type || 'smoothstep',
        labelStyle: edge.labelStyle || { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
        labelBgStyle: edge.labelBgStyle || { fill: '#1a1a1a', fillOpacity: 0.9 },
        labelBgPadding: edge.labelBgPadding || [6, 3],
        labelBgBorderRadius: edge.labelBgBorderRadius || 4,
      }));

      setEdges(enhancedEdges);

      // Re-fit after React has applied the new nodes/edges
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.25, duration: 400 });
      }, 80);
    }
  }, [graphData, setNodes, setEdges]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDownloadMenu && !event.target.closest('.download-menu-container')) {
        setShowDownloadMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDownloadMenu]);

  const handleDownloadJSON = () => {
    const graphData = {
      nodes: nodes.map(node => ({
        id: node.id,
        label: node.data.label,
        type: node.data.type,
        owner: node.data.owner,
        status: node.data.status,
        position: node.position,
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
      })),
      exportedAt: new Date().toISOString(),
      systemName: 'Singtel Architecture - CAE',
    };

    const blob = new Blob([JSON.stringify(graphData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `architecture-graph-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setDownloadType('JSON');
    setDownloadSuccess(true);
    setShowDownloadMenu(false);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleDownloadPNG = async () => {
    try {
      const reactFlowWrapper = document.querySelector('.react-flow');
      
      if (!reactFlowWrapper) {
        console.error('React Flow element not found');
        return;
      }

      const attribution = document.querySelector('.react-flow__attribution');
      if (attribution) {
        attribution.style.display = 'none';
      }

      const controls = document.querySelector('.react-flow__controls');
      const minimap = document.querySelector('.react-flow__minimap');
      
      if (controls) controls.style.display = 'none';
      if (minimap) minimap.style.display = 'none';

      const nodeTextElements = reactFlowWrapper.querySelectorAll('.react-flow__node p');
      const originalColors = [];
      
      nodeTextElements.forEach((element) => {
        originalColors.push({
          element,
          color: element.style.color || '',
        });
        element.style.color = '#ffffff';
      });

      const dataUrl = await toPng(reactFlowWrapper, {
        backgroundColor: '#0a0a0a',
        quality: 1,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          transform: 'none',
        },
      });

      originalColors.forEach(({ element, color }) => {
        element.style.color = color;
      });

      if (attribution) attribution.style.display = '';
      if (controls) controls.style.display = '';
      if (minimap) minimap.style.display = '';

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `architecture-graph-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadType('PNG');
      setDownloadSuccess(true);
      setShowDownloadMenu(false);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (error) {
      console.error('Error downloading PNG:', error);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-background to-purple-950/10">
      {/* Graph Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 border-b border-border/40 glass-effect relative z-20"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">{graphTitle}</h2>
            <p className="text-xs text-muted-foreground">
              Interactive map — click any node to explore
            </p>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <Badge variant="outline">
              {nodes.length} Services
            </Badge>
            <Badge variant="outline">
              {edges.length} Dependencies
            </Badge>
            
            {/* Download Button with Dropdown */}
            <div className="relative download-menu-container z-50">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDownloadMenu(!showDownloadMenu);
                }}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown className="h-3 w-3" />
              </Button>

              {/* Download Menu */}
              <AnimatePresence>
                {showDownloadMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 z-[100] min-w-[180px] glass-effect border border-border/40 rounded-lg overflow-hidden shadow-xl pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-1.5 space-y-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownloadPNG();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent/80 transition-colors cursor-pointer text-left pointer-events-auto"
                      >
                        <Image className="h-4 w-4 text-purple-500 flex-shrink-0" />
                        <span className="font-medium">Export as PNG</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownloadJSON();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent/80 transition-colors cursor-pointer text-left pointer-events-auto"
                      >
                        <FileJson className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="font-medium">Export as JSON</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Download Success Notification */}
            <AnimatePresence>
              {downloadSuccess && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="absolute right-0 top-full mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-500 text-sm whitespace-nowrap"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{downloadType} downloaded successfully!</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Graph Container */}
      <div className="flex-1 relative w-full" style={{ minHeight: '500px' }}>
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            onInit={onInit}
            fitView
            fitViewOptions={{ padding: 0.25 }}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            minZoom={0.15}
            maxZoom={2}
            className="bg-transparent"
          >
          <Background
            color="#667eea"
            gap={20}
            size={1}
            variant="dots"
          />
          <Controls
            className="glass-effect border border-border/40 rounded-lg overflow-hidden"
          />
          <MiniMap
            className="glass-effect border border-border/40 rounded-lg overflow-hidden"
            nodeColor={(node) => NODE_COLORS[node.data.type] || '#667eea'}
            maskColor="rgba(0, 0, 0, 0.5)"
          />
          </ReactFlow>
        </div>

        {/* Node Details Panel */}
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-4 w-72"
          >
            <Card className="glass-effect border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <span className="text-sm font-bold truncate pr-2">{selectedNode.data.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={() => setSelectedNode(null)}
                  >
                    ×
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-0">
                {/* Type + Status row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs capitalize" style={{ borderColor: NODE_COLORS[selectedNode.data.type] + '60', color: NODE_COLORS[selectedNode.data.type] }}>
                    {selectedNode.data.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      selectedNode.data.status === 'active'
                        ? 'border-green-500/40 text-green-500'
                        : selectedNode.data.status === 'inactive'
                        ? 'border-gray-500/40 text-gray-400'
                        : 'border-yellow-500/40 text-yellow-500'
                    }`}
                  >
                    ● {selectedNode.data.status || 'active'}
                  </Badge>
                </div>

                {/* Layer */}
                {selectedNode.data.layer && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Layer</p>
                    <p className="text-xs font-medium">{selectedNode.data.layer}</p>
                  </div>
                )}

                {/* Description */}
                {selectedNode.data.description && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Description</p>
                    <p className="text-xs leading-snug">{selectedNode.data.description}</p>
                  </div>
                )}

                {/* Tech stack */}
                {Array.isArray(selectedNode.data.tech) && selectedNode.data.tech.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tech Stack</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.data.tech.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full border font-medium"
                          style={{
                            color: NODE_COLORS[selectedNode.data.type] || '#667eea',
                            borderColor: (NODE_COLORS[selectedNode.data.type] || '#667eea') + '50',
                            backgroundColor: (NODE_COLORS[selectedNode.data.type] || '#667eea') + '15',
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Owner */}
                {selectedNode.data.owner && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Owner</span>
                    <span className="text-xs font-medium">{selectedNode.data.owner}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-4 left-4"
        >
          <Card className="glass-effect border-border/40">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-semibold mb-2">Legend</p>
              <div className="space-y-1.5">
                {Object.entries(NODE_COLORS).map(([type, color]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs capitalize">{type}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
