import { v4 as uuidv4 } from 'uuid';

class GraphGenerator {
  constructor() {
    this.nodeTypes = {
      'service':  { color: '#667eea' },
      'api':      { color: '#764ba2' },
      'database': { color: '#f093fb' },
      'external': { color: '#43e97b' },
      'component':{ color: '#06b6d4' },
      'queue':    { color: '#4facfe' },
      'gateway':  { color: '#f59e0b' },
      'frontend': { color: '#ec4899' },
      'module':   { color: '#06b6d4' },
      'cache':    { color: '#84cc16' },
      'default':  { color: '#6b7280' },
    };

    this.edgeColors = {
      calls:       '#667eea',
      uses:        '#667eea',
      stores:      '#f093fb',
      publishes:   '#4facfe',
      subscribes:  '#4facfe',
      depends_on:  '#764ba2',
      default:     '#6b7280',
    };

    this.techPatterns = [
      { pattern: /kenan|billing|cse|rating|invoice/i,       tech: ['Java', 'Oracle DB', 'SOAP'] },
      { pattern: /ecom|e-com|ecommerce/i,                    tech: ['React', 'Node.js', 'REST'] },
      { pattern: /esom/i,                                    tech: ['Java', 'PostgreSQL', 'Kafka'] },
      { pattern: /mongo/i,                                   tech: ['MongoDB', 'NoSQL'] },
      { pattern: /redis|cache/i,                             tech: ['Redis', 'In-Memory'] },
      { pattern: /rabbit|amqp|activemq/i,                    tech: ['RabbitMQ', 'AMQP'] },
      { pattern: /kafka/i,                                   tech: ['Kafka', 'Event Stream'] },
      { pattern: /postgres|postgresql/i,                     tech: ['PostgreSQL', 'SQL'] },
      { pattern: /oracle/i,                                  tech: ['Oracle DB', 'SQL'] },
      { pattern: /gateway/i,                                 tech: ['Nginx', 'REST', 'gRPC'] },
      { pattern: /frontend|portal|ui|web/i,                  tech: ['React', 'TypeScript'] },
      { pattern: /auth|oauth|jwt|ldap/i,                     tech: ['OAuth2', 'JWT'] },
      { pattern: /notification|email|sms|notify/i,           tech: ['Node.js', 'SMTP'] },
      { pattern: /order|checkout|cart/i,                     tech: ['Java', 'REST'] },
      { pattern: /customer|profile|crm/i,                    tech: ['Java', 'Oracle DB'] },
      { pattern: /catalog|product/i,                         tech: ['Java', 'Elasticsearch'] },
      { pattern: /provisioning|provision/i,                  tech: ['Java', 'SOAP'] },
      { pattern: /cdn|content.*delivery/i,                   tech: ['CDN', 'HTTP'] },
    ];

    this.defaultTechByType = {
      service:  ['Java', 'REST'],
      api:      ['REST', 'JSON'],
      database: ['SQL'],
      queue:    ['AMQP'],
      gateway:  ['Nginx', 'REST'],
      frontend: ['React'],
      external: ['REST'],
      module:   ['Java'],
      cache:    ['Redis'],
      default:  ['REST'],
    };

    this.descriptionPatterns = [
      { pattern: /billing|invoice|cdr|rating/i,      desc: 'Handles billing, CDR rating and invoice generation' },
      { pattern: /auth|login|oauth|jwt/i,            desc: 'Manages authentication and authorisation' },
      { pattern: /gateway/i,                         desc: 'Routes and proxies requests between services' },
      { pattern: /frontend|portal|ui|web/i,          desc: 'User-facing web application layer' },
      { pattern: /notification|email|sms/i,          desc: 'Sends notifications via email and SMS channels' },
      { pattern: /mongo/i,                           desc: 'Persistent document store' },
      { pattern: /redis|cache/i,                     desc: 'In-memory caching and session store' },
      { pattern: /rabbit|kafka|queue|activemq/i,     desc: 'Asynchronous message broker for event streaming' },
      { pattern: /order|checkout/i,                  desc: 'Manages order lifecycle and fulfilment' },
      { pattern: /customer|profile|crm/i,            desc: 'Customer data management and CRM' },
      { pattern: /catalog|product/i,                 desc: 'Product and service catalog management' },
      { pattern: /provisioning|provision/i,          desc: 'Service provisioning and activation' },
      { pattern: /log|monitor|metric/i,              desc: 'Logging, monitoring and observability' },
      { pattern: /search|elastic/i,                  desc: 'Full-text search and indexing service' },
      { pattern: /payment/i,                         desc: 'Payment processing and settlement' },
      { pattern: /cdn|content.*delivery/i,           desc: 'Content delivery and static asset distribution' },
    ];
  }

  // ─── Inference helpers ────────────────────────────────────────────────────

  inferDescription(name, type) {
    for (const { pattern, desc } of this.descriptionPatterns) {
      if (pattern.test(name)) return desc;
    }
    const byType = {
      service:  'Core business service',
      api:      'API service layer',
      database: 'Data persistence layer',
      queue:    'Asynchronous message queue',
      gateway:  'API gateway and traffic routing',
      frontend: 'Frontend web application',
      external: 'External third-party integration',
      module:   'Application module',
      cache:    'Caching layer',
    };
    return byType[type] || 'System component';
  }

  inferTech(name, type) {
    for (const { pattern, tech } of this.techPatterns) {
      if (pattern.test(name)) return tech;
    }
    return this.defaultTechByType[type] || ['REST'];
  }

  // ─── Type inference from node name ────────────────────────────────────────

  inferTypeFromName(name) {
    const n = name.toLowerCase();
    if (/\b(db|database|mongo|oracle|postgres|mysql|dynamo|store|repository|datastore|cluster)\b/.test(n)) return 'database';
    if (/\b(queue|mq|rabbit|kafka|activemq|sqs|topic|broker|event.?bus|message.?bus)\b/.test(n)) return 'queue';
    if (/\b(cache|redis|memcache|hazelcast)\b/.test(n)) return 'cache';
    if (/\b(gateway|proxy|load.?balan|nginx|haproxy|ingress|router|api.?manager)\b/.test(n)) return 'gateway';
    if (/\b(frontend|portal|ui|web.?app|spa|client.?app|browser|dashboard)\b/.test(n)) return 'frontend';
    if (/\b(external|third.?party|partner|vendor|payment|stripe|paypal|telco)\b/.test(n)) return 'external';
    if (/\b(api|rest.?api|graphql|grpc|endpoint)\b/.test(n)) return 'api';
    return 'service';
  }

  // ─── Entity extraction from LLM answer text ───────────────────────────────

  extractEntitiesFromText(text) {
    const candidates = new Set();

    // 1. Bold markdown: **Name** — LLM strongly highlights key components this way
    for (const m of text.matchAll(/\*\*([^*]{2,40})\*\*/g)) {
      candidates.add(m[1].trim());
    }

    // 2. Well-known Singtel / industry system names (always include if present)
    const knownSystems = [
      'ECOM', 'Kenan', 'ESOM', 'MongoDB', 'RabbitMQ', 'Redis', 'Kafka',
      'PostgreSQL', 'MySQL', 'Oracle', 'Elasticsearch', 'ActiveMQ', 'Nginx',
      'Zookeeper', 'Prometheus', 'Grafana', 'Kibana', 'Logstash',
    ];
    knownSystems.forEach(sys => {
      if (new RegExp(`\\b${sys}\\b`, 'i').test(text)) candidates.add(sys);
    });

    // 3. "Foo Service", "Foo API", "Foo Database", "Foo Gateway", "Foo Engine" …
    for (const m of text.matchAll(/\b([A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,2})\s+(?:Service|API|Database|DB|Gateway|Engine|Module|Queue|Cache|Store|Layer|System|Platform|Hub|Manager)\b/g)) {
      candidates.add(m[0].trim());
    }

    // 4. ALLCAPS abbreviations (2-7 chars), excluding common noise
    const NOISE = new Set([
      'API','REST','HTTP','HTTPS','TCP','UDP','JSON','XML','JWT','SSH','TLS',
      'SSL','THE','AND','FOR','WITH','FROM','USE','NOT','ARE','HAS','ALL',
      'AWS','GCP','CDN','IAM','NAT','DNS','VPC','ELB','KMS','SQS','SNS',
      'ECS','EKS','ECR','RDS','SLA','SLO','PII','MFA','OTP','URL','URI',
      'UML','DAO','DTO','ORM','DDL','DML','ETL','EAI','SOA','BFF','SPA',
      'PWA','MVP','RAG','LLM','NLP','SQL','DBA','CI','CD','WEB','NEW',
    ]);
    for (const m of text.matchAll(/\b([A-Z]{2,7})\b/g)) {
      if (!NOISE.has(m[1])) candidates.add(m[1]);
    }

    // Clean + deduplicate
    return [...candidates]
      .map(c => c.trim())
      .filter(c => c.length >= 2 && c.length <= 50 && !/^[0-9]+$/.test(c));
  }

  // ─── Relationship extraction from sentence structure ──────────────────────

  extractRelationshipsFromText(text, nodeNames) {
    const relationships = [];
    const edgeSeen = new Set();

    const verbLabels = [
      { pattern: /\bcalls?\b/i,            label: 'calls',       type: 'calls' },
      { pattern: /\binvokes?\b/i,           label: 'invokes',     type: 'calls' },
      { pattern: /\bsends?\b/i,             label: 'sends',       type: 'calls' },
      { pattern: /\broutes?\b/i,            label: 'routes',      type: 'calls' },
      { pattern: /\bforwards?\b/i,          label: 'forwards',    type: 'calls' },
      { pattern: /\bcommunicates?\b/i,      label: 'communicates',type: 'calls' },
      { pattern: /\bconnects?\b/i,          label: 'connects',    type: 'calls' },
      { pattern: /\bintegrates?\b/i,        label: 'integrates',  type: 'uses' },
      { pattern: /\buses?\b/i,              label: 'uses',        type: 'uses' },
      { pattern: /\bdepends?\s+on\b/i,      label: 'depends on',  type: 'depends_on' },
      { pattern: /\bqueries?\b/i,           label: 'queries',     type: 'stores' },
      { pattern: /\breads?\b/i,             label: 'reads',       type: 'stores' },
      { pattern: /\bwrites?\b/i,            label: 'writes',      type: 'stores' },
      { pattern: /\bstores?\b/i,            label: 'stores',      type: 'stores' },
      { pattern: /\bfetches?\b/i,           label: 'fetches',     type: 'stores' },
      { pattern: /\bpersists?\b/i,          label: 'persists',    type: 'stores' },
      { pattern: /\bpublishes?\b/i,         label: 'publishes',   type: 'publishes' },
      { pattern: /\bsubscribes?\b/i,        label: 'subscribes',  type: 'subscribes' },
      { pattern: /\bconsumes?\b/i,          label: 'consumes',    type: 'subscribes' },
      { pattern: /[→\-]>/,                  label: 'calls',       type: 'calls' },
    ];

    // Split text into sentences first — each sentence is a unit of meaning
    const sentences = text.split(/(?<=[.!?\n])\s+/);
    const sortedNames = [...nodeNames].sort((a, b) => b.length - a.length);

    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();

      // Find which nodes appear in this sentence and in what position
      const occurrences = [];
      for (const name of sortedNames) {
        const idx = sentLower.indexOf(name.toLowerCase());
        if (idx !== -1) {
          // Prevent overlapping matches (e.g. "Kenan" matching inside "Kenan Billing")
          const overlaps = occurrences.some(o => Math.abs(o.idx - idx) < Math.max(o.name.length, name.length));
          if (!overlaps) occurrences.push({ name, idx });
        }
      }

      // Sort by position in sentence (subject before object = direction)
      occurrences.sort((a, b) => a.idx - b.idx);
      if (occurrences.length < 2) continue;

      // For each consecutive pair, extract the verb between them as edge label
      for (let p = 0; p < occurrences.length - 1; p++) {
        const src = occurrences[p];
        const tgt = occurrences[p + 1];
        const key = `${src.name}|${tgt.name}`;
        if (edgeSeen.has(key)) continue;

        // Text between the two entity mentions
        const between = sentence.slice(src.idx + src.name.length, tgt.idx);
        let label = 'connects';
        let type  = 'calls';

        for (const vl of verbLabels) {
          // Check "between" first; fall back to full sentence for context
          if (vl.pattern.test(between) || (between.length < 8 && vl.pattern.test(sentence))) {
            label = vl.label;
            type  = vl.type;
            break;
          }
        }

        edgeSeen.add(key);
        relationships.push({ from: src.name, to: tgt.name, type, label });
      }
    }

    return relationships;
  }

  // ─── Layered layout (Frontend→Gateway→Service→DB/Queue) ──────────────────

  layoutLayered(nodes) {
    const TYPE_TO_LAYER = {
      external: 0, frontend: 0,
      gateway:  1, api:      1,
      service:  2, module:   2,
      database: 3, queue:    3, cache: 3,
    };
    const LAYER_Y  = { 0: 40, 1: 220, 2: 400, 3: 580 };
    const HORIZ    = 260;

    const layers = {};
    nodes.forEach(n => {
      const lay = TYPE_TO_LAYER[n.data.type] ?? 2;
      (layers[lay] = layers[lay] || []).push(n);
    });

    Object.entries(layers).forEach(([layKey, layNodes]) => {
      const yPos   = LAYER_Y[parseInt(layKey)] ?? 40 + parseInt(layKey) * 180;
      const totalW = (layNodes.length - 1) * HORIZ;
      const xStart = Math.max(60, 520 - totalW / 2);
      layNodes.forEach((n, i) => { n.position = { x: xStart + i * HORIZ, y: yPos }; });
    });

    return nodes;
  }

  // ─── Strategy 3: build fully from LLM answer text ────────────────────────

  buildFromAnswer(answer, title = 'Architecture View') {
    const rawNames = this.extractEntitiesFromText(answer);
    if (rawNames.length < 2) return null;

    const uniqueNames = this._deduplicateNames(rawNames);
    if (uniqueNames.length < 2) return null;

    // Build nodes
    const idMap = new Map();
    const nodes = uniqueNames.map((name, i) => {
      const type  = this.inferTypeFromName(name);
      const color = (this.nodeTypes[type] || this.nodeTypes.default).color;
      const nodeId = `ans-${i}`;
      idMap.set(name.toLowerCase(), nodeId);
      // Also register first word for partial matching
      const firstWord = name.toLowerCase().split(/\s+/)[0];
      if (!idMap.has(firstWord)) idMap.set(firstWord, nodeId);

      return {
        id: nodeId, type: 'custom', position: { x: 0, y: 0 },
        data: {
          label: name, type, color, status: 'active', owner: null, layer: null,
          description: this.inferDescription(name, type),
          tech:        this.inferTech(name, type),
          graphTitle:  title,
        },
      };
    });

    // Apply layered layout
    this.layoutLayered(nodes);

    // Extract relationships from the answer text
    const relTexts = this.extractRelationshipsFromText(answer, uniqueNames);
    const edgeSeen = new Set();
    const edges = [];

    relTexts.forEach((rel, idx) => {
      const srcId = this._resolveNodeId(idMap, rel.from);
      const tgtId = this._resolveNodeId(idMap, rel.to);
      if (!srcId || !tgtId || srcId === tgtId) return;
      const key = `${srcId}|${tgtId}`;
      if (edgeSeen.has(key)) return;
      edgeSeen.add(key);

      const color    = this.edgeColors[rel.type] || this.edgeColors.default;
      const animated = ['calls', 'publishes', 'subscribes'].includes(rel.type);
      edges.push({
        id: `are-${idx}`, source: srcId, target: tgtId,
        animated, label: rel.label,
        markerEnd: { type: 'arrowclosed' },
        style: { stroke: color },
        labelStyle:          { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
        labelBgStyle:        { fill: '#1a1a1a', fillOpacity: 0.9 },
        labelBgPadding:      [6, 3],
        labelBgBorderRadius: 4,
      });
    });

    // Fallback: connect layer-adjacent nodes if no edges found
    if (edges.length === 0 && nodes.length > 1) {
      const TYPE_TO_LAYER = { external: 0, frontend: 0, gateway: 1, api: 1, service: 2, module: 2, database: 3, queue: 3, cache: 3 };
      const sorted = [...nodes].sort((a, b) => (TYPE_TO_LAYER[a.data.type] ?? 2) - (TYPE_TO_LAYER[b.data.type] ?? 2));
      for (let i = 0; i < sorted.length - 1; i++) {
        const la = TYPE_TO_LAYER[sorted[i].data.type] ?? 2;
        const lb = TYPE_TO_LAYER[sorted[i + 1].data.type] ?? 2;
        if (lb >= la) {
          edges.push({
            id: `afl-${i}`, source: sorted[i].id, target: sorted[i + 1].id,
            animated: false,
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#6b7280' },
            labelStyle:          { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
            labelBgStyle:        { fill: '#1a1a1a', fillOpacity: 0.9 },
            labelBgPadding:      [6, 3],
            labelBgBorderRadius: 4,
          });
        }
      }
    }

    return { nodes, edges, metadata: { title, componentCount: nodes.length, edgeCount: edges.length } };
  }

  _deduplicateNames(names) {
    // Prefer longer names over abbreviations they contain
    const sorted = [...new Set(names)].sort((a, b) => b.length - a.length);
    const result = [];
    for (const name of sorted) {
      const lower = name.toLowerCase();
      const isDupe = result.some(r => {
        const rl = r.toLowerCase();
        return rl.includes(lower) || lower.includes(rl);
      });
      if (!isDupe) result.push(name);
      if (result.length >= 14) break;
    }
    return result;
  }



  /**
   * Build a ReactFlow graph from the structured component/relationship data
   * extracted by Qwen2.5-VL from an architecture image.
   *
   * @param {Array}  components    - [{name, type, layer}]
   * @param {Array}  relationships - [{from, to, type, label}]
   * @param {string} title         - human-readable title
   */
  buildFromArchStructure(components, relationships, title = 'Architecture View') {
    const nodes = [];
    const edges = [];
    const idMap = new Map(); // normalised name → nodeId

    // Group by layer for horizontal lane layout
    const layerMap = new Map();
    components.forEach(c => {
      const layer = c.layer || 'General';
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer).push(c);
    });

    const VERT_SPACING  = 200;
    const HORIZ_SPACING = 270;

    Array.from(layerMap.keys()).forEach((layerName, layerIdx) => {
      const layerComps = layerMap.get(layerName);
      const yPos       = 60 + layerIdx * VERT_SPACING;
      const totalW     = (layerComps.length - 1) * HORIZ_SPACING;
      const xStart     = Math.max(80, 500 - totalW / 2);

      layerComps.forEach((comp, i) => {
        const nodeId   = `an-${layerIdx}-${i}`;
        const typeConf = this.nodeTypes[comp.type] || this.nodeTypes.default;

        // Register several name variants for edge resolution
        const lower = comp.name.toLowerCase();
        idMap.set(lower, nodeId);
        const firstWord = lower.split(/[\s-_]+/)[0];
        if (!idMap.has(firstWord)) idMap.set(firstWord, nodeId);

        nodes.push({
          id:       nodeId,
          type:     'custom',
          position: { x: xStart + i * HORIZ_SPACING, y: yPos },
          data: {
            label:       comp.name,
            type:        comp.type   || 'service',
            layer:       comp.layer  || null,
            description: this.inferDescription(comp.name, comp.type),
            tech:        this.inferTech(comp.name, comp.type),
            owner:       null,
            status:      'active',
            color:       typeConf.color,
            graphTitle:  title,
          },
        });
      });
    });

    // Build edges
    relationships.forEach((rel, idx) => {
      const fromId = this._resolveNodeId(idMap, rel.from);
      const toId   = this._resolveNodeId(idMap, rel.to);

      if (fromId && toId && fromId !== toId) {
        const edgeType = (rel.type || 'calls').toLowerCase();
        const color    = this.edgeColors[edgeType] || this.edgeColors.default;
        const animated = ['calls', 'publishes', 'subscribes', 'uses'].includes(edgeType);

        edges.push({
          id:                 `ae-${idx}`,
          source:             fromId,
          target:             toId,
          animated,
          label:              rel.label || edgeType.replace(/_/g, ' '),
          markerEnd:          { type: 'arrowclosed' },
          style:              { stroke: color },
          labelStyle:         { fill: '#ffffff', fontWeight: 500, fontSize: 11 },
          labelBgStyle:       { fill: '#1a1a1a', fillOpacity: 0.9 },
          labelBgPadding:     [6, 3],
          labelBgBorderRadius: 4,
        });
      }
    });

    return {
      nodes,
      edges,
      metadata: { title, componentCount: nodes.length, edgeCount: edges.length },
    };
  }

  _resolveNodeId(idMap, name) {
    if (!name) return null;
    const lower = name.toLowerCase();
    if (idMap.has(lower)) return idMap.get(lower);
    // Partial / prefix match
    for (const [key, id] of idMap.entries()) {
      if (key.startsWith(lower) || lower.startsWith(key)) return id;
    }
    return null;
  }

  determineNodeType(name) {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('api') || lowerName.includes('endpoint')) {
      return 'api';
    } else if (lowerName.includes('db') || lowerName.includes('database')) {
      return 'database';
    } else if (lowerName.includes('external') || lowerName.includes('third-party')) {
      return 'external';
    } else if (lowerName.includes('service')) {
      return 'service';
    } else if (lowerName.includes('component') || lowerName.includes('module')) {
      return 'component';
    }
    
    return 'default';
  }

  extractRelationships(text) {
    const relationships = [];
    
    const patterns = [
      /(\w+)\s+(?:depends on|requires|uses|calls|connects to|integrates with)\s+(\w+)/gi,
      /(\w+)\s+→\s+(\w+)/g,
      /(\w+)\s+->\s+(\w+)/g
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        relationships.push({
          from: match[1],
          to: match[2],
          type: 'depends'
        });
      }
    }

    return relationships;
  }

  generateGraph(components, answer, sources = []) {
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    components.forEach((component, index) => {
      const type = this.determineNodeType(component);
      const typeConfig = this.nodeTypes[type] || this.nodeTypes.default;
      
      const node = {
        id: `node-${index}`,
        type: 'custom',
        data: {
          label: component,
          type: type,
          description: `${type.charAt(0).toUpperCase() + type.slice(1)} component`,
          color: typeConfig.color,
          icon: typeConfig.icon
        },
        position: this.calculatePosition(index, components.length)
      };

      nodes.push(node);
      nodeMap.set(component.toLowerCase(), node.id);
    });

    const relationships = this.extractRelationships(answer);
    
    relationships.forEach((rel, index) => {
      const fromId = nodeMap.get(rel.from.toLowerCase());
      const toId = nodeMap.get(rel.to.toLowerCase());
      
      if (fromId && toId && fromId !== toId) {
        edges.push({
          id: `edge-${index}`,
          source: fromId,
          target: toId,
          type: 'smoothstep',
          animated: true,
          label: rel.type
        });
      }
    });

    if (edges.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length - 1; i++) {
        edges.push({
          id: `edge-${i}`,
          source: nodes[i].id,
          target: nodes[i + 1].id,
          type: 'smoothstep',
          animated: false
        });
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        componentCount: components.length,
        relationshipCount: edges.length,
        sources: sources.map(s => ({
          source: s.source,
          title: s.title,
          id: s.sourceId
        }))
      }
    };
  }

  calculatePosition(index, total) {
    const radius = Math.max(200, total * 40);
    const angle = (2 * Math.PI * index) / total;
    
    return {
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle)
    };
  }

  generateGraphFromSources(sources) {
    const nodes = [];
    const edges = [];
    const issueMap = new Map();

    sources.forEach((source, index) => {
      if (source.source === 'jira' && source.sourceId) {
        const node = {
          id: source.sourceId,
          type: 'custom',
          data: {
            label: source.sourceId,
            type: 'service',
            description: source.title || 'Jira Issue',
            color: this.nodeTypes.service.color,
            icon: this.nodeTypes.service.icon
          },
          position: this.calculatePosition(index, sources.length)
        };

        nodes.push(node);
        issueMap.set(source.sourceId, node);
      }
    });

    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `edge-${i}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        type: 'smoothstep'
      });
    }

    return { nodes, edges, metadata: { sourceCount: sources.length } };
  }
}

export default GraphGenerator;
