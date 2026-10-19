// src/components/architecture/ArchitectureFlow.jsx
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Globe, 
  Server, 
  Cpu,
  Sparkles,
  Eye,
  Database 
} from 'lucide-react';

const nodes = [
  { 
    id: 'user', 
    label: 'User', 
    icon: MessageSquare, 
    color: '#3b82f6', 
    description: 'Sends queries and uploads documents / images', 
    position: { x: 40, y: 265 }, 
    tech: ['React UI', 'Voice'] 
  },
  { 
    id: 'frontend', 
    label: 'Frontend', 
    icon: Globe, 
    color: '#14b8a6', 
    description: 'React 18 + Tailwind + ReactFlow', 
    position: { x: 340, y: 80 }, 
    tech: ['Vite', 'Framer Motion'] 
  },
  { 
    id: 'backend', 
    label: 'Backend', 
    icon: Server, 
    color: '#6366f1', 
    description: 'Node.js + Express REST API', 
    position: { x: 340, y: 430 }, 
    tech: ['Multer', 'LangChain'] 
  },
  { 
    id: 'llama', 
    label: 'LLaMA 3.1 8B', 
    icon: Cpu, 
    color: '#10b981', 
    description: 'Local text model — generates raw RAG draft', 
    position: { x: 720, y: 80 }, 
    tech: ['llama-server', 'GGUF', 'HTTP API'] 
  },
  { 
    id: 'gemini', 
    label: 'Gemini 2.5 Flash', 
    icon: Sparkles, 
    color: '#8b5cf6', 
    description: 'Polishes draft into rich Markdown response', 
    position: { x: 1080, y: 80 }, 
    tech: ['Google AI', 'Paraphraser', 'Fallback: localMD'] 
  },
  { 
    id: 'qwen', 
    label: 'Qwen2.5-VL', 
    icon: Eye, 
    color: '#f59e0b', 
    description: 'Vision model for architecture image analysis', 
    position: { x: 720, y: 430 }, 
    tech: ['llama-mtmd-cli', 'Image → JSON'] 
  },
  { 
    id: 'rag', 
    label: 'Hybrid RAG', 
    icon: Database, 
    color: '#06b6d4', 
    description: 'TF-IDF vector store + Serper web search', 
    position: { x: 1080, y: 430 }, 
    tech: ['MemoryVectorStore', 'Serper'] 
  },
];

// Paths — card width ≈ 260, height ≈ 140
// Node centres (approx): user(170,335) frontend(470,150) backend(470,500)
//   llama(850,150) gemini(1210,150) qwen(850,500) rag(1210,500)
const connections = [
  // User ↔ Frontend
  { from: 'user',     to: 'frontend', label: 'query / file',       path: 'M 300 310 C 340 310 340 150 340 150' },
  // Frontend ↔ Backend (request down, response up)
  { from: 'frontend', to: 'backend',  label: 'HTTP REST',          path: 'M 460 220 L 460 430' },
  // Backend → RAG (retrieve context chunks)
  { from: 'backend',  to: 'rag',      label: 'retrieve context',   path: 'M 600 510 L 1080 510' },
  // RAG → LLaMA (inject context into prompt)
  { from: 'rag',      to: 'llama',    label: 'context chunks',     path: 'M 1200 430 L 1200 350 L 850 350 L 850 220' },
  // LLaMA → Gemini (raw draft for polishing)
  { from: 'llama',    to: 'gemini',   label: 'raw draft',          path: 'M 980 150 L 1080 150' },
  // Gemini → Backend (polished Markdown response)
  { from: 'gemini',   to: 'backend',  label: 'polished response',  path: 'M 1200 220 L 1200 370 L 600 370 L 600 430' },
  // Backend → Qwen (vision path — image bytes)
  { from: 'backend',  to: 'qwen',     label: 'image query',        path: 'M 600 470 L 720 470' },
  // Qwen → Backend (structured analysis)
  { from: 'qwen',     to: 'backend',  label: 'vision analysis',    path: 'M 720 490 L 600 490' },
  // Backend → Frontend (final answer)
  { from: 'backend',  to: 'frontend', label: 'response',           path: 'M 440 430 L 440 220' },
];

export function ArchitectureFlow() {
  return (
    <div className="h-full w-full bg-[#f8fafc] dark:bg-background overflow-auto p-10">
      <div className="max-w-[1500px] mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">
            CAE System Architecture
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">End-to-End Data Flow • Text &amp; Vision Processing • Multimodel Pipeline</p>
        </div>

        <div className="relative h-[740px] mx-auto" style={{ width: '1420px' }}>
          {/* Light Dotted Background */}
          <div className="absolute inset-0 bg-[radial-gradient(#94a3b830_1px,transparent_1px)] bg-[length:24px_24px]" />

          {/* SVG Connections */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>

            {connections.map((conn, index) => (
              <g key={index}>
                {/* Base Path */}
                <path
                  d={conn.path}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#arrowhead)"
                />

                {/* Animated Flow */}
                <motion.path
                  d={conn.path}
                  fill="none"
                  stroke="#14b8a6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="12 10"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: -100 }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: "linear",
                    delay: index * 0.12,
                  }}
                />

                {/* Moving Dot */}
                <motion.circle r="4.5" fill="#14b8a6">
                  <animateMotion
                    dur={`${2.6 + index * 0.18}s`}
                    repeatCount="indefinite"
                    path={conn.path}
                    rotate="auto"
                  />
                </motion.circle>
              </g>
            ))}
          </svg>

          {/* Nodes */}
          {nodes.map((node, idx) => {
            const Icon = node.icon;
            return (
              <motion.div
                key={node.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.08 }}
                whileHover={{ y: -4 }}
                className="absolute group z-10"
                style={{ left: node.position.x, top: node.position.y }}
              >
                <div className="w-64 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-sm hover:shadow-md transition-all p-5">
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${node.color}15`, color: node.color }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg text-slate-900 dark:text-white leading-tight">{node.label}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{node.description}</p>
                    </div>
                  </div>

                  {/* Tech Tags */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {node.tech.map((tech, i) => (
                      <span 
                        key={i}
                        className="text-[10px] px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-mono"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hover Popup */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-3 translate-y-[-100%] opacity-0 group-hover:opacity-100 pointer-events-none z-50 w-80 transition-all">
                  <div className="bg-white dark:bg-popover border border-slate-200 dark:border-border rounded-xl p-6 shadow-xl text-sm">
                    <p className="font-medium text-teal-600 dark:text-teal-400 mb-3">How it works</p>
                    <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                      {node.id === 'llama'   && "LLaMA 3.1 8B runs locally via the llama-server binary (already compiled). The server starts on port 8081 and serves an OpenAI-compatible HTTP API. It receives the RAG-enriched prompt and returns a raw draft response."}
                      {node.id === 'gemini'  && "Gemini 2.5 Flash receives the raw draft from LLaMA and rewrites it into polished, well-structured Markdown — bolding system names, adding headers, and cleaning artifacts. Falls back to gemini-2.0-flash → gemini-1.5-flash → local formatter if unavailable."}
                      {node.id === 'qwen'    && "Qwen2.5-VL processes architecture diagram images via the llama-mtmd-cli binary. Extracts components, layers & relationships → outputs structured JSON used for graph generation."}
                      {node.id === 'rag'     && "Hybrid RAG: TF-IDF embeddings + MemoryVectorStore retrieve the most relevant context chunks. If relevance < 20%, falls back to Serper Google search for external context."}
                      {node.id === 'frontend' && "React 18 frontend with smooth animations, interactive dependency graph using ReactFlow, real-time chat interface, and admin panel for document ingestion."}
                      {node.id === 'backend' && "Express.js server manages API routes, file uploads (Multer), document ingestion pipeline, and coordinates between the RAG engine, LLaMA draft generator, Gemini polisher, and Qwen vision model."}
                      {node.id === 'user'    && "Users interact via chat, upload files/documents, and explore architecture through multiple views (Chat, Split, Graph). Images trigger the Qwen vision path; text queries use the LLaMA → Gemini pipeline."}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Model Zone Highlight — covers all AI model nodes */}
          <motion.div
            className="absolute border border-teal-300 dark:border-teal-700 rounded-2xl pointer-events-none"
            style={{ left: 660, top: 42, width: 726, height: 540 }}
            animate={{ borderColor: ['#14b8a640', '#5eead460', '#14b8a640'] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <div className="absolute bg-white dark:bg-slate-900 px-4 py-1 text-xs font-medium border border-teal-200 dark:border-teal-800 rounded-full text-teal-700 dark:text-teal-400"
            style={{ left: 700, top: 22 }}>
            LLaMA 3.1 8B (Draft) • Gemini 2.5 Flash (Polish) • Qwen2.5-VL (Vision) • Hybrid RAG
          </div>

          {/* Text Pipeline Label */}
          <div className="absolute text-[10px] font-semibold text-green-600 dark:text-green-400 tracking-widest uppercase"
            style={{ left: 720, top: 54 }}>
            ── Text Pipeline ──────────────────────────────────────
          </div>
          {/* Vision Pipeline Label */}
          <div className="absolute text-[10px] font-semibold text-amber-600 dark:text-amber-400 tracking-widest uppercase"
            style={{ left: 720, top: 410 }}>
            ── Vision Pipeline ─────────
          </div>
        </div>

        {/* Pipeline Legend */}
        <div className="mt-10 flex flex-wrap justify-center gap-6 text-xs text-slate-500 dark:text-slate-400">
          {[
            { color: '#10b981', label: 'LLaMA 3.1 8B — raw draft via llama-server HTTP' },
            { color: '#8b5cf6', label: 'Gemini 2.5 Flash — Markdown polisher (with 3-tier fallback)' },
            { color: '#f59e0b', label: 'Qwen2.5-VL — vision & diagram analysis' },
            { color: '#06b6d4', label: 'Hybrid RAG — vector store + web search' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}