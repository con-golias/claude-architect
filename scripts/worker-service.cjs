// @bun @bun-cjs
(function(exports, require, module, __filename, __dirname) {var pZ=Object.create;var{getPrototypeOf:lZ,defineProperty:KZ,getOwnPropertyNames:dZ}=Object;var cZ=Object.prototype.hasOwnProperty;function iZ(Z){return this[Z]}var nZ,sZ,oZ=(Z,$,J)=>{var W=Z!=null&&typeof Z==="object";if(W){var K=$?nZ??=new WeakMap:sZ??=new WeakMap,X=K.get(Z);if(X)return X}J=Z!=null?pZ(lZ(Z)):{};let H=$||!Z||!Z.__esModule?KZ(J,"default",{value:Z,enumerable:!0}):J;for(let Q of dZ(Z))if(!cZ.call(H,Q))KZ(H,Q,{get:iZ.bind(Z,Q),enumerable:!0});if(W)K.set(Z,H);return H};var o=oZ(require("express")),mZ=require("path"),uZ=require("fs");var PZ=require("express");var GZ=require("bun:sqlite");var XZ=require("os"),D=require("path"),m=require("fs"),__dirname="C:\\Users\\golia\\Desktop\\Projects\\claude-architect\\src\\utils",rZ=".claude-architect";function a(){return process.env.CLAUDE_PLUGIN_ROOT||D.resolve(__dirname,"..","..")}function aZ(){let Z=D.join(XZ.homedir(),rZ);if(!m.existsSync(Z))m.mkdirSync(Z,{recursive:!0});return Z}function HZ(){return D.join(aZ(),"architect.sqlite")}function QZ(){return D.join(a(),"rules")}function z(Z){return D.normalize(Z).replace(/\\/g,"/")}function F(Z,$){let J=new Bun.Glob(Z);return Array.from(J.scanSync({cwd:$,dot:!1}))}var YZ={debug:0,info:1,warn:2,error:3},tZ=process.env.ARCHITECT_LOG_LEVEL||"info";function u(Z,$,J){if(YZ[Z]<YZ[tZ])return;let W={timestamp:new Date().toISOString(),level:Z,service:"claude-architect",message:$,...J};process.stderr.write(JSON.stringify(W)+`
`)}var A={debug:(Z,$)=>u("debug",Z,$),info:(Z,$)=>u("info",Z,$),warn:(Z,$)=>u("warn",Z,$),error:(Z,$)=>u("error",Z,$)};var eZ=[{version:1,description:"Core schema \u2014 projects, decisions, violations, sessions",up:(Z)=>{Z.run(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          path TEXT NOT NULL UNIQUE,
          tech_stack TEXT,
          architecture_pattern TEXT DEFAULT 'clean',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS decisions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          title TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'accepted',
          context TEXT,
          decision TEXT NOT NULL,
          alternatives TEXT,
          consequences_positive TEXT,
          consequences_negative TEXT,
          superseded_by INTEGER,
          tags TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS violations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          severity TEXT NOT NULL,
          category TEXT NOT NULL,
          file_path TEXT,
          line_number INTEGER,
          description TEXT NOT NULL,
          suggestion TEXT,
          resolved INTEGER NOT NULL DEFAULT 0,
          resolved_at INTEGER,
          resolved_by TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          started_at INTEGER NOT NULL,
          completed_at INTEGER,
          summary TEXT,
          features_added TEXT,
          files_changed TEXT,
          decisions_made INTEGER NOT NULL DEFAULT 0,
          violations_found INTEGER NOT NULL DEFAULT 0,
          violations_resolved INTEGER NOT NULL DEFAULT 0,
          compliance_score_before REAL,
          compliance_score_after REAL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS structural_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          change_type TEXT NOT NULL,
          entity_name TEXT NOT NULL,
          description TEXT NOT NULL,
          details TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS rule_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT NOT NULL,
          total_violations INTEGER NOT NULL DEFAULT 0,
          resolved_violations INTEGER NOT NULL DEFAULT 0,
          ignored_violations INTEGER NOT NULL DEFAULT 0,
          avg_resolution_time_ms INTEGER,
          last_violation_at INTEGER,
          updated_at INTEGER NOT NULL
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS improvement_suggestions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT,
          rule_id TEXT,
          suggestion_type TEXT NOT NULL,
          title TEXT NOT NULL,
          reasoning TEXT NOT NULL,
          evidence TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          applied_at INTEGER,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `),Z.run(`
        CREATE TABLE IF NOT EXISTS compliance_snapshots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id TEXT NOT NULL,
          session_id TEXT,
          overall_score REAL NOT NULL,
          scores_by_category TEXT NOT NULL,
          total_features INTEGER,
          total_files INTEGER,
          total_violations INTEGER,
          violations_by_severity TEXT,
          violations_by_rule TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id)
        )
      `)}},{version:2,description:"Performance indexes",up:(Z)=>{Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)"),Z.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)")}}];function UZ(Z){Z.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);let $=Z.query("SELECT version FROM schema_migrations ORDER BY version").all().map((J)=>J.version);for(let J of eZ){if($.includes(J.version))continue;Z.run("BEGIN TRANSACTION");try{J.up(Z),Z.query("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(J.version,J.description,Date.now()),Z.run("COMMIT")}catch(W){throw Z.run("ROLLBACK"),Error(`Migration ${J.version} failed: ${W.message}`)}}}var k=null;function Z0(Z){Z.run("PRAGMA journal_mode = WAL"),Z.run("PRAGMA synchronous = NORMAL"),Z.run("PRAGMA foreign_keys = ON"),Z.run("PRAGMA temp_store = MEMORY"),Z.run("PRAGMA mmap_size = 268435456"),Z.run("PRAGMA cache_size = 10000")}function p(Z){if(k)return k;let $=Z||HZ();return A.info("Opening database",{path:$}),k=new GZ.Database($,{create:!0}),Z0(k),UZ(k),A.info("Database ready",{path:$}),k}function t(){if(k)k.close(),k=null,A.info("Database closed")}function OZ(Z,$){let J=Date.now(),W=Z.query("SELECT * FROM projects WHERE path = ?").get($.path);if(W)return Z.query("UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?").run($.name,$.tech_stack??W.tech_stack,$.architecture_pattern??W.architecture_pattern,J,W.id),{...W,name:$.name,updated_at:J};return Z.query(`INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run($.id,$.name,$.path,$.tech_stack??null,$.architecture_pattern??"clean",J,J),{id:$.id,name:$.name,path:$.path,tech_stack:$.tech_stack??null,architecture_pattern:$.architecture_pattern??"clean",created_at:J,updated_at:J}}function E(Z,$){return Z.query("SELECT * FROM projects WHERE path = ?").get($)}function l(Z){return Z.query("SELECT * FROM projects ORDER BY updated_at DESC").all()}function MZ(Z,$){Z.get("/api/projects",(J,W)=>{W.json(l($))}),Z.post("/api/projects",(J,W)=>{let{id:K,name:X,path:H,tech_stack:Q}=J.body;if(!K||!X||!H){W.status(400).json({error:"id, name, and path are required"});return}if(typeof K!=="string"||typeof X!=="string"||typeof H!=="string"){W.status(400).json({error:"id, name, and path must be strings"});return}let Y=OZ($,{id:K,name:X,path:H,tech_stack:Q});W.status(201).json(Y)})}function BZ(Z,$){let W=Z.query(`INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.overallScore,JSON.stringify($.scoresByCategory),$.totalFeatures,$.totalFiles,$.totalViolations,JSON.stringify($.violationsBySeverity),JSON.stringify($.violationsByRule),Date.now());return Number(W.lastInsertRowid)}function zZ(Z,$){return Z.query("SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get($)}function d(Z,$,J=20){return Z.query(`SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`).all($,J).reverse()}function e(Z,$){let J=Z.query(`SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`).all($);if(J.length<2)return"stable";let W=J[0].overall_score,K=J[J.length-1].overall_score,X=W-K;if(X>3)return"improving";if(X<-3)return"declining";return"stable"}var c=require("fs"),y=require("path");var $0=[/import\s+.*from\s+['"](.+)['"]/g,/import\s*\(\s*['"](.+)['"]\s*\)/g,/require\s*\(\s*['"](.+)['"]\s*\)/g];function J0(Z){let $=z(Z).split("/");if($.includes("domain"))return"domain";if($.includes("application"))return"application";if($.includes("infrastructure"))return"infrastructure";return"unknown"}function W0(Z){let $=z(Z).match(/src\/features\/([^/]+)\//);return $?$[1]:null}function K0(Z){let $=[];for(let J of $0){let W=new RegExp(J.source,J.flags),K;while((K=W.exec(Z))!==null)$.push(K[1])}return $}function X0(Z){return Z.startsWith(".")}function AZ(Z){let $=[],J=y.join(Z,"src");if(!c.existsSync(J))return{violations:[],filesScanned:0};let W=Q0(J),K=0;for(let X of W){K++;let H=z(y.relative(Z,X)),Q=J0(H),Y=W0(H);if(Q==="unknown")continue;let U;try{U=c.readFileSync(X,"utf-8")}catch{continue}let O=K0(U);for(let G of O){if(!X0(G))continue;let M=H0(H,G,Q,Y);if(M)$.push({...M,filePath:H})}}return{violations:$,filesScanned:K}}function H0(Z,$,J,W){let K=z($);if(J==="domain"){if(K.includes("/application/")||K.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Domain layer imports from ${K.includes("/application/")?"application":"infrastructure"} layer: "${$}"`,suggestion:"Move the dependency to a port interface in domain/ and implement it in infrastructure/"}}if(J==="application"){if(K.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Application layer imports from infrastructure layer: "${$}"`,suggestion:"Define a port interface in domain/ and inject the infrastructure implementation"}}if(W&&K.includes("/features/")){let X=K.match(/features\/([^/]+)\//);if(X&&X[1]!==W)return{ruleId:"01-architecture",ruleName:"Cross-Feature Isolation",severity:"warning",category:"dependency",description:`Direct import from feature "${X[1]}": "${$}"`,suggestion:"Use shared contracts in src/shared/contracts/ or domain events instead"}}return null}function Q0(Z){let $=[],J=F("**/*.{ts,tsx,js,jsx}",Z);for(let W of J)if(!W.includes("node_modules")&&!W.includes(".test.")&&!W.includes(".spec."))$.push(y.join(Z,W));return $}var V=require("fs"),L=require("path");var Y0=["domain","application","infrastructure"];function VZ(Z){let $=[],J=[],W=L.join(Z,"src","features");if(!V.existsSync(W))return{violations:[],filesScanned:0,features:[]};let K=V.readdirSync(W).filter((H)=>{let Q=L.join(W,H);return V.statSync(Q).isDirectory()&&!H.startsWith(".")});for(let H of K){let Q=L.join(W,H),Y=U0(Q,H,$);J.push(Y)}if(!V.existsSync(L.join(Z,"PROJECT_MAP.md")))$.push({ruleId:"06-documentation",ruleName:"PROJECT_MAP Required",severity:"warning",category:"docs",description:"Missing PROJECT_MAP.md at project root",suggestion:"Run /architect-init to generate PROJECT_MAP.md"});let X=L.join(Z,"src","shared");if(V.existsSync(X))O0(X,Z,$);return{violations:$,filesScanned:K.length,features:J}}function U0(Z,$,J){let W=V.existsSync(L.join(Z,"domain")),K=V.existsSync(L.join(Z,"application")),X=V.existsSync(L.join(Z,"infrastructure")),H=V.existsSync(L.join(Z,"README.md")),Q=V.existsSync(L.join(Z,"__tests__"))||G0(Z);for(let U of Y0)if(!V.existsSync(L.join(Z,U)))J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:z(`src/features/${$}/`),description:`Feature "${$}" is missing ${U}/ directory`,suggestion:`Create src/features/${$}/${U}/ directory`});if(!H)J.push({ruleId:"06-documentation",ruleName:"Feature README",severity:"info",category:"docs",filePath:z(`src/features/${$}/`),description:`Feature "${$}" is missing README.md`,suggestion:"Run /architect-scaffold to generate README.md from template"});if($!==$.toLowerCase()||$.includes("_"))J.push({ruleId:"15-code-style",ruleName:"Naming Convention",severity:"info",category:"structure",filePath:z(`src/features/${$}/`),description:`Feature directory "${$}" should use kebab-case`,suggestion:`Rename to "${M0($)}"`});let Y=0;if(!W)Y++;if(!K)Y++;if(!X)Y++;if(!H)Y++;return{name:$,path:z(`src/features/${$}/`),hasReadme:H,hasDomain:W,hasApplication:K,hasInfrastructure:X,hasTests:Q,violationCount:Y}}function G0(Z){try{return F("**/*.{test,spec}.{ts,tsx,js,jsx}",Z).length>0}catch{return!1}}function O0(Z,$,J){try{let W=F("**/*.{ts,tsx,js,jsx}",Z);for(let K of W){if(K.includes("node_modules"))continue;let H=(K.split("/").pop()||"").replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/,"");if(/^[A-Z]/.test(H)&&!H.includes("."))continue}}catch{}}function M0(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}var _Z=require("fs"),I=require("path");var B0=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected",suggestion:"Move to environment variable: process.env.API_KEY or use a secrets manager"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected",suggestion:"Move to environment variable or secrets manager. Never commit secrets to source code"},{name:"SQL String Concatenation",pattern:/(?:query|exec|execute|raw)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/gi,severity:"critical",description:"Potential SQL injection via string concatenation/template literals",suggestion:"Use parameterized queries or prepared statements instead of string interpolation"},{name:"SQL Concatenation (plus operator)",pattern:/(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"critical",description:"SQL query built with string concatenation using user input",suggestion:"Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])"},{name:"Dangerous innerHTML",pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,severity:"warning",description:"Use of dangerouslySetInnerHTML \u2014 potential XSS vulnerability",suggestion:"Sanitize content with DOMPurify before rendering, or use safe alternatives"},{name:"innerHTML Assignment",pattern:/\.innerHTML\s*=\s*(?!['"]<)/gi,severity:"warning",description:"Direct innerHTML assignment with dynamic content \u2014 XSS risk",suggestion:"Use textContent for text, or sanitize HTML before assigning to innerHTML"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability",suggestion:"Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code"},{name:"Disabled HTTPS Verification",pattern:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,severity:"critical",description:"TLS/SSL certificate verification is disabled",suggestion:"Never disable certificate verification in production. Fix the certificate issue instead"},{name:"Wildcard CORS",pattern:/(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,severity:"warning",description:"CORS allows all origins (*) \u2014 overly permissive",suggestion:"Configure CORS with explicit origin allowlist instead of wildcard"},{name:"Console.log in Production",pattern:/console\.(log|debug|trace)\s*\(/g,severity:"info",description:"console.log found \u2014 use structured logging in production",suggestion:"Replace with structured logger (e.g., winston, pino) for production code"}],z0=["node_modules",".test.",".spec.","__tests__",".d.ts",".min.js","dist/","build/","coverage/"];function LZ(Z){let $=[],J=I.join(Z,"src"),W=0;try{let K=F("**/*.{ts,tsx,js,jsx,py}",J);for(let X of K){if(z0.some((O)=>X.includes(O)))continue;W++;let H=I.join(J,X),Q=z(I.relative(Z,H)),Y;try{Y=_Z.readFileSync(H,"utf-8")}catch{continue}let U=Y.split(`
`);for(let O of B0){let G=new RegExp(O.pattern.source,O.pattern.flags),M;while((M=G.exec(Y))!==null){let R=Y.substring(0,M.index).split(`
`).length,_=U[R-1]?.trim()||"";if(_.startsWith("//")||_.startsWith("*"))continue;$.push({ruleId:"02-security",ruleName:O.name,severity:O.severity,category:"security",filePath:Q,lineNumber:R,description:O.description,suggestion:O.suggestion})}}}}catch{}return{violations:$,filesScanned:W}}var v=require("fs"),w=require("path");var TZ=200;function EZ(Z){let $=[],J=w.join(Z,"src");if(!v.existsSync(J))return{violations:[],filesScanned:0};let W=0;try{let K=F("**/*.{ts,tsx,js,jsx}",J);for(let X of K){if(X.includes("node_modules")||X.includes(".d.ts")||X.includes("dist/"))continue;W++;let H=w.join(J,X),Q=z(w.relative(Z,H)),Y;try{Y=v.readFileSync(H,"utf-8")}catch{continue}let U=Y.split(`
`);if(U.length>TZ)$.push({ruleId:"15-code-style",ruleName:"File Size Limit",severity:"warning",category:"quality",filePath:Q,description:`File has ${U.length} lines (max ${TZ})`,suggestion:"Split into smaller focused modules. Extract helper functions or sub-components."});if(A0(Y,Q,$),V0(Y,Q,$),!X.includes(".test.")&&!X.includes(".spec.")&&!X.includes("__tests__")&&T0(Y))_0(H,Q,$);L0(Y,Q,$)}}catch{}return{violations:$,filesScanned:W}}function A0(Z,$,J){let W=/\/\/\s*TODO(?!\s*\(?\s*[A-Z]+-\d+)/g,K;while((K=W.exec(Z))!==null){let X=Z.substring(0,K.index).split(`
`).length;J.push({ruleId:"15-code-style",ruleName:"TODO Without Ticket",severity:"info",category:"quality",filePath:$,lineNumber:X,description:"TODO comment without issue/ticket reference",suggestion:"Add a ticket reference: // TODO(JIRA-123): description"})}}function V0(Z,$,J){let W=Z.split(`
`),K=0,X=0;for(let H=0;H<W.length;H++){let Q=W[H].trim();if(Q.startsWith("//")&&!Q.startsWith("///")&&!Q.startsWith("// @")){if(K===0)X=H+1;K++}else{if(K>=5)J.push({ruleId:"15-code-style",ruleName:"Commented-Out Code",severity:"info",category:"quality",filePath:$,lineNumber:X,description:`${K} consecutive commented lines \u2014 likely commented-out code`,suggestion:"Remove commented-out code. Use version control to recover old code."});K=0}}}function _0(Z,$,J){let W=w.dirname(Z),K=w.basename(Z),X=[".test.ts",".test.tsx",".spec.ts",".spec.tsx",".test.js",".spec.js"],H=K.replace(/\.(ts|tsx|js|jsx)$/,"");if(!X.some((Y)=>v.existsSync(w.join(W,H+Y))))J.push({ruleId:"03-testing",ruleName:"Missing Test File",severity:"info",category:"quality",filePath:$,description:`No test file found for "${K}"`,suggestion:`Create ${H}.test.ts alongside this file`})}function L0(Z,$,J){let W=/^export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/gm,K;while((K=W.exec(Z))!==null){let X=Z.substring(0,K.index).split(`
`).length,H=Z.substring(0,K.index).split(`
`),Q=H[H.length-2]?.trim()||"";if(!Q.endsWith("*/")&&!Q.startsWith("*"))J.push({ruleId:"06-documentation",ruleName:"Missing Documentation",severity:"info",category:"docs",filePath:$,lineNumber:X,description:`Exported "${K[1]}" has no JSDoc/doc comment`,suggestion:"Add a doc comment with @param, @returns, @throws as applicable"})}}function T0(Z){return/^export\s+/m.test(Z)}var E0={dependency:0.3,structure:0.3,security:0.25,quality:0.2,docs:0.1},wZ={critical:10,warning:3,info:1};function FZ(Z){if(Z.length===0)return 100;let $=0;for(let J of Z){let W=E0[J.category]??0.15,K=wZ[J.severity]??1;$+=K*W}return Math.max(0,Math.round(100-$))}function kZ(Z){let $=["dependency","structure","security","quality","docs"],J={};for(let W of $){let K=Z.filter((H)=>H.category===W),X=0;for(let H of K)X+=wZ[H.severity]??1;J[W]=Math.max(0,Math.round(100-X))}return J}function CZ(Z){let $={critical:0,warning:0,info:0};for(let J of Z)$[J.severity]=($[J.severity]??0)+1;return $}function RZ(Z){let $={};for(let J of Z)$[J.ruleId]=($[J.ruleId]??0)+1;return $}function xZ(Z,$={}){let J=Date.now();A.info("Starting validation",{projectPath:Z});let W=[],K=[],X=0;if(f("dependency",$.categories)){let U=AZ(Z);W.push(...U.violations),X+=U.filesScanned}if(f("structure",$.categories)){let U=VZ(Z);W.push(...U.violations),K=U.features}if(f("security",$.categories)){let U=LZ(Z);W.push(...U.violations),X=Math.max(X,U.filesScanned)}if(f("quality",$.categories)||f("docs",$.categories)){let U=EZ(Z);W.push(...U.violations),X=Math.max(X,U.filesScanned)}if($.severity){let U={critical:0,warning:1,info:2},O=U[$.severity];W=W.filter((G)=>U[G.severity]<=O)}let H=FZ(W),Q=kZ(W),Y=Date.now()-J;return A.info("Validation complete",{projectPath:Z,score:H,violations:W.length,duration:Y}),{overallScore:H,scoresByCategory:Q,totalFeatures:K.length,totalFiles:X,violations:W,featureMap:K,trend:"stable",timestamp:Date.now()}}function f(Z,$){if(!$||$.length===0)return!0;return $.includes(Z)}var S=require("fs"),T=require("path");function DZ(Z){let{projectPath:$,featureName:J,description:W="TODO: Describe this feature",withTests:K=!0}=Z,X=q0(J),H=N0(J),Q=T.join($,"src","features",X);if(S.existsSync(Q))throw Error(`Feature directory already exists: ${Q}`);let Y=[],U=[],O=["domain/entities","domain/value-objects","domain/ports","domain/events","domain/services","application/use-cases","application/dtos","application/mappers","infrastructure/controllers","infrastructure/repositories","infrastructure/adapters","infrastructure/config"];if(K)O.push("__tests__/integration","__tests__/e2e");for(let b of O){let h=T.join(Q,b);S.mkdirSync(h,{recursive:!0}),Y.push(`src/features/${X}/${b}`)}let G=w0(H,W);C(T.join(Q,"domain","entities",`${H}.ts`),G),U.push(`src/features/${X}/domain/entities/${H}.ts`);let M=F0(H);C(T.join(Q,"domain","ports",`${H}Repository.ts`),M),U.push(`src/features/${X}/domain/ports/${H}Repository.ts`);let R=k0(H);C(T.join(Q,"application","dtos",`${H}Dto.ts`),R),U.push(`src/features/${X}/application/dtos/${H}Dto.ts`);let _=C0(H);C(T.join(Q,"application","use-cases",`Create${H}UseCase.ts`),_),U.push(`src/features/${X}/application/use-cases/Create${H}UseCase.ts`);let x=R0(H);C(T.join(Q,"application","mappers",`${H}Mapper.ts`),x),U.push(`src/features/${X}/application/mappers/${H}Mapper.ts`);let N=x0(H);C(T.join(Q,"infrastructure","controllers",`${H}Controller.ts`),N),U.push(`src/features/${X}/infrastructure/controllers/${H}Controller.ts`);let B=D0(H);C(T.join(Q,"infrastructure","repositories",`${H}RepositoryImpl.ts`),B),U.push(`src/features/${X}/infrastructure/repositories/${H}RepositoryImpl.ts`);let r=S0(X,H,W);C(T.join(Q,"README.md"),r),U.push(`src/features/${X}/README.md`);let WZ=["domain/value-objects","domain/events","domain/services","infrastructure/adapters","infrastructure/config"];if(K)WZ.push("__tests__/integration","__tests__/e2e");for(let b of WZ){let h=T.join(Q,b,".gitkeep");if(!S.existsSync(h))C(h,"")}return A.info("Feature scaffold generated",{feature:X,files:U.length,dirs:Y.length}),{createdFiles:U,createdDirs:Y,featurePath:Q}}function C(Z,$){S.writeFileSync(Z,$,"utf-8")}function w0(Z,$){return`/**
 * ${Z} entity \u2014 ${$}
 *
 * @module ${Z}
 */

export interface ${Z}Props {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ${Z} domain entity.
 * Contains business logic and invariants.
 */
export class ${Z} {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  constructor(props: ${Z}Props) {
    this.id = props.id;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }
}
`}function F0(Z){return`/**
 * ${Z} repository port (interface).
 * Implemented in infrastructure layer.
 *
 * @module ${Z}Repository
 */

import type { ${Z} } from "../entities/${Z}";

/**
 * Repository interface for ${Z} persistence.
 * Domain defines the contract, infrastructure provides the implementation.
 */
export interface ${Z}Repository {
  /** Find a ${Z} by its unique ID */
  findById(id: string): Promise<${Z} | null>;

  /** Persist a new or updated ${Z} */
  save(entity: ${Z}): Promise<void>;

  /** Remove a ${Z} by ID */
  delete(id: string): Promise<void>;
}
`}function k0(Z){return`/**
 * ${Z} Data Transfer Objects.
 * Used for input/output at application layer boundaries.
 *
 * @module ${Z}Dto
 */

/** Input DTO for creating a ${Z} */
export interface Create${Z}Input {
  // TODO: Define input fields
}

/** Output DTO for ${Z} responses */
export interface ${Z}Output {
  id: string;
  createdAt: string;
  updatedAt: string;
}
`}function C0(Z){return`/**
 * Create${Z} use case.
 * Orchestrates domain objects to create a new ${Z}.
 *
 * @module Create${Z}UseCase
 */

import type { ${Z}Repository } from "../../domain/ports/${Z}Repository";
import type { Create${Z}Input, ${Z}Output } from "../dtos/${Z}Dto";
import { ${Z} } from "../../domain/entities/${Z}";
import { ${Z}Mapper } from "../mappers/${Z}Mapper";

/**
 * Use case: Create a new ${Z}.
 *
 * @param input - Creation input data
 * @param repository - ${Z} repository (injected)
 * @returns Created ${Z} output DTO
 */
export async function create${Z}(
  input: Create${Z}Input,
  repository: ${Z}Repository
): Promise<${Z}Output> {
  const entity = new ${Z}({
    id: crypto.randomUUID(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await repository.save(entity);

  return ${Z}Mapper.toOutput(entity);
}
`}function R0(Z){return`/**
 * ${Z} mapper \u2014 converts between domain entities and DTOs.
 *
 * @module ${Z}Mapper
 */

import type { ${Z} } from "../../domain/entities/${Z}";
import type { ${Z}Output } from "../dtos/${Z}Dto";

/**
 * Maps ${Z} entities to/from DTOs.
 */
export class ${Z}Mapper {
  /**
   * Convert domain entity to output DTO.
   *
   * @param entity - Domain entity
   * @returns Output DTO
   */
  static toOutput(entity: ${Z}): ${Z}Output {
    return {
      id: entity.id,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
`}function x0(Z){return`/**
 * ${Z} HTTP controller.
 * Thin translation layer \u2014 delegates to use cases.
 *
 * @module ${Z}Controller
 */

// TODO: Import framework-specific types (Express, Fastify, etc.)
// TODO: Import use cases from application layer
// TODO: Import repository implementation for dependency injection

/**
 * ${Z} controller handles HTTP requests.
 * Controllers do ONLY: parse request \u2192 call use case \u2192 format response.
 */
export class ${Z}Controller {
  // TODO: Implement HTTP handlers
  // constructor(private repository: ${Z}Repository) {}
  //
  // async create(req: Request, res: Response): Promise<void> {
  //   const input = req.body;
  //   const result = await create${Z}(input, this.repository);
  //   res.status(201).json({ data: result });
  // }
}
`}function D0(Z){return`/**
 * ${Z} repository implementation.
 * Implements the domain port using actual database operations.
 *
 * @module ${Z}RepositoryImpl
 */

import type { ${Z} } from "../../domain/entities/${Z}";
import type { ${Z}Repository } from "../../domain/ports/${Z}Repository";

/**
 * Database implementation of ${Z}Repository port.
 */
export class ${Z}RepositoryImpl implements ${Z}Repository {
  /**
   * Find ${Z} by ID.
   *
   * @param id - Entity ID
   * @returns Entity or null if not found
   */
  async findById(id: string): Promise<${Z} | null> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Save ${Z} to database.
   *
   * @param entity - Entity to persist
   */
  async save(entity: ${Z}): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }

  /**
   * Delete ${Z} by ID.
   *
   * @param id - Entity ID to delete
   */
  async delete(id: string): Promise<void> {
    // TODO: Implement with actual database query
    throw new Error("Not implemented");
  }
}
`}function S0(Z,$,J){return`# Feature: ${$}

## Purpose
${J}

## Public API

### Exports
| Export | Type | Description |
|--------|------|-------------|
| \`${$}\` | class | ${$} domain entity |
| \`Create${$}UseCase\` | function | Creates a new ${$} |
| \`${$}Output\` | interface | Output DTO |

### API Endpoints (if applicable)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/${Z} | Create new ${$} |
| GET | /api/v1/${Z}/:id | Get ${$} by ID |

## Dependencies

### Internal
- None (new feature)

### External
- None yet

### Forbidden Dependencies
- NEVER import from other features' internal code directly

## Data Flow
\`\`\`
Controller \u2192 Validate Input \u2192 Use Case \u2192 Domain Entity \u2192 Repository Port \u2192 Database
\`\`\`

## Testing
\`\`\`bash
# Unit tests
bun test -- --filter=${Z}

# Integration tests
bun run test:integration -- --filter=${Z}
\`\`\`
`}function q0(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}function N0(Z){return Z.replace(/[-_\s]+(.)/g,($,J)=>J.toUpperCase()).replace(/^(.)/,($,J)=>J.toUpperCase())}var q=require("fs"),i=require("path");function SZ(Z,$){Z.get("/api/check",(J,W)=>{let K=J.query.project_path;if(!K||typeof K!=="string"){W.status(400).json({error:"project_path query parameter required"});return}let X=J.query.categories?J.query.categories.split(","):void 0,H=J.query.severity,Q=xZ(K,{categories:X,severity:H}),Y=E($,K);if(Y)BZ($,{projectId:Y.id,overallScore:Q.overallScore,scoresByCategory:Q.scoresByCategory,totalFeatures:Q.totalFeatures,totalFiles:Q.totalFiles,totalViolations:Q.violations.length,violationsBySeverity:CZ(Q.violations),violationsByRule:RZ(Q.violations)});W.json(Q)}),Z.post("/api/scaffold",(J,W)=>{let{project_path:K,feature_name:X,description:H,with_tests:Q}=J.body;if(!K||!X){W.status(400).json({error:"project_path and feature_name are required"});return}if(typeof K!=="string"||typeof X!=="string"){W.status(400).json({error:"project_path and feature_name must be strings"});return}try{let Y=DZ({projectPath:K,featureName:X,description:typeof H==="string"?H:void 0,withTests:Q!==!1});W.status(201).json(Y)}catch(Y){W.status(409).json({error:Y.message})}}),Z.get("/api/rules",(J,W)=>{let K=J.query.file_path,X=J.query.category,H=QZ();if(!q.existsSync(H)){W.json({rules:[],message:"Rules directory not found"});return}let Q=q.readdirSync(H).filter((U)=>U.endsWith(".md")).sort(),Y=[];for(let U of Q){let O=i.basename(U,".md");if(X&&!O.includes(X))continue;let G=q.readFileSync(i.join(H,U),"utf-8");if(K){let M=G.match(/^---\s*\npaths:\s*\n([\s\S]*?)---/m);if(M){if(!M[1].split(`
`).map((x)=>x.replace(/^\s*-\s*/,"").trim()).filter(Boolean).some((x)=>{let N=x.replace(/\*\*/g,".*").replace(/\*/g,"[^/]*");return new RegExp(N).test(K)}))continue}}Y.push({id:O,name:O.replace(/^\d+-/,"").replace(/-/g," "),content:G})}W.json({rules:Y})})}function qZ(Z,$){let W=Z.query(`INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.title,$.context??null,$.decision,$.alternatives?JSON.stringify($.alternatives):null,$.consequencesPositive?JSON.stringify($.consequencesPositive):null,$.consequencesNegative?JSON.stringify($.consequencesNegative):null,$.tags?JSON.stringify($.tags):null,Date.now());return Number(W.lastInsertRowid)}function n(Z,$){return Z.query("SELECT * FROM decisions WHERE id = ?").get($)}function g(Z,$,J={}){let W=["project_id = ?"],K=[$];if(J.query){W.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");let Y=`%${J.query}%`;K.push(Y,Y,Y)}if(J.status)W.push("status = ?"),K.push(J.status);let X=Math.min(J.limit??20,100),H=J.offset??0,Q=`
    SELECT * FROM decisions
    WHERE ${W.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;return K.push(X,H),Z.query(Q).all(...K)}function ZZ(Z,$,J=5){return Z.query("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all($,J)}function NZ(Z,$,J={}){let W=["project_id = ?","resolved = 0"],K=[$];if(J.severity)W.push("severity = ?"),K.push(J.severity);if(J.category)W.push("category = ?"),K.push(J.category);if(J.ruleId)W.push("rule_id = ?"),K.push(J.ruleId);let X=Math.min(J.limit??50,200);return K.push(X),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`).all(...K)}function yZ(Z,$,J="manual"){Z.query("UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?").run(Date.now(),J,$)}function $Z(Z,$){let J=Z.query(`SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`).all($),W={critical:0,warning:0,info:0};for(let K of J)if(K.severity in W)W[K.severity]=K.count;return W}function j(Z,$,J={}){let W=["project_id = ?"],K=[$];if(J.query){W.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");let H=`%${J.query}%`;K.push(H,H,H)}if(J.resolved!==void 0)W.push("resolved = ?"),K.push(J.resolved?1:0);let X=Math.min(J.limit??20,100);return K.push(X,J.offset??0),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...K)}function IZ(Z,$){Z.get("/api/search",(J,W)=>{let K=J.query.query,X=J.query.project_path,H=J.query.type,Q=Math.min(parseInt(J.query.limit)||20,100),U=(X?E($,X):null)?.id,O=[];if(!H||H==="decisions"){if(U){let G=g($,U,{query:K,limit:Q});for(let M of G)O.push({id:M.id,type:"decision",title:M.title,status:M.status,created_at:M.created_at,extra:M.tags||""})}}if(!H||H==="violations"){if(U){let G=j($,U,{query:K,limit:Q});for(let M of G)O.push({id:M.id,type:"violation",title:`[${M.severity}] ${M.description}`,status:M.resolved?"resolved":"open",created_at:M.created_at,extra:M.rule_id})}}O.sort((G,M)=>M.created_at-G.created_at),W.json(O.slice(0,Q))}),Z.get("/api/timeline",(J,W)=>{let K=parseInt(J.query.anchor),X=J.query.query,H=J.query.project_path,Q=parseInt(J.query.depth_before)||5,Y=parseInt(J.query.depth_after)||5,O=(H?E($,H):null)?.id;if(!O){W.json({events:[],message:"Project not found"});return}let G=[],M=g($,O,{query:X,limit:100});for(let B of M)G.push({id:B.id,type:"decision",title:B.title,status:B.status,created_at:B.created_at,extra:B.tags||""});let R=j($,O,{limit:100});for(let B of R)G.push({id:B.id,type:"violation",title:`[${B.severity}] ${B.description}`,status:B.resolved?"resolved":"open",created_at:B.created_at,extra:B.rule_id});G.sort((B,r)=>B.created_at-r.created_at);let _=-1;if(!isNaN(K))_=G.findIndex((B)=>B.id===K);else if(X)_=G.findIndex((B)=>B.title.toLowerCase().includes(X.toLowerCase()));if(_===-1)_=G.length-1;let x=Math.max(0,_-Q),N=Math.min(G.length,_+Y+1);W.json({events:G.slice(x,N),anchorIndex:_-x,total:G.length})}),Z.post("/api/details/batch",(J,W)=>{let{ids:K,type:X}=J.body;if(!Array.isArray(K)||!X){W.status(400).json({error:"ids (array) and type (string) are required"});return}if(typeof X!=="string"||!["decisions","violations","changes"].includes(X)){W.status(400).json({error:'type must be "decisions", "violations", or "changes"'});return}if(K.length>50){W.status(400).json({error:"Maximum 50 IDs per request"});return}let H=[];if(X==="decisions")for(let Q of K){let Y=n($,Number(Q));if(Y)H.push(Y)}else if(X==="violations")for(let Q of K){let Y=$.query("SELECT * FROM violations WHERE id = ?").get(Number(Q));if(Y)H.push(Y)}else if(X==="changes")for(let Q of K){let Y=$.query("SELECT * FROM structural_changes WHERE id = ?").get(Number(Q));if(Y)H.push(Y)}W.json(H)})}function vZ(Z,$,J=10){return Z.query("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all($,J)}function fZ(Z,$){return Z.query("SELECT COUNT(*) as count FROM sessions WHERE project_id = ?").get($)?.count??0}function P(Z,$=null){if($)return Z.query(`SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`).all($);return Z.query(`SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`).all()}function gZ(Z,$){Z.get("/api/decisions",(J,W)=>{let K=J.query.project_id,X=J.query.project_path,H=K;if(!H&&X)H=E($,X)?.id??"";if(!H){W.status(400).json({error:"project_id or project_path required"});return}let Q=g($,H,{query:J.query.query,status:J.query.status,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(Q)}),Z.get("/api/decisions/:id",(J,W)=>{let K=parseInt(J.params.id);if(isNaN(K)){W.status(400).json({error:"Invalid decision ID"});return}let X=n($,K);if(!X){W.status(404).json({error:"Decision not found"});return}W.json(X)}),Z.post("/api/decisions",(J,W)=>{let{projectId:K,project_path:X,title:H,context:Q,decision:Y,alternatives:U,tags:O}=J.body,G=K;if(!G&&X)G=E($,X)?.id;if(!G||!H||!Y){W.status(400).json({error:"projectId (or project_path), title, and decision required"});return}if(typeof H!=="string"||typeof Y!=="string"){W.status(400).json({error:"title and decision must be strings"});return}let M=qZ($,{projectId:G,title:H,context:typeof Q==="string"?Q:void 0,decision:Y,alternatives:Array.isArray(U)?U:void 0,tags:Array.isArray(O)?O:void 0});W.status(201).json({id:M})}),Z.get("/api/violations",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}let X=j($,K,{query:J.query.query,resolved:J.query.resolved==="true"?!0:J.query.resolved==="false"?!1:void 0,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(X)}),Z.patch("/api/violations/:id",(J,W)=>{let K=parseInt(J.params.id);if(isNaN(K)){W.status(400).json({error:"Invalid violation ID"});return}let{resolved_by:X}=J.body;yZ($,K,typeof X==="string"?X:"manual"),W.json({success:!0})}),Z.get("/api/sessions",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}W.json(vZ($,K))}),Z.get("/api/compliance/snapshots",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}W.json(d($,K))}),Z.get("/api/improvements",(J,W)=>{let K=J.query.project_id||null;W.json(P($,K))})}function jZ(Z,$){Z.get("/api/status",(J,W)=>{let K=J.query.project_path;if(!K){W.status(400).json({error:"project_path required"});return}let X=E($,K);if(!X){W.json({registered:!1,message:"Project not registered. Run /architect-init first."});return}let H=zZ($,X.id),Q=e($,X.id),Y=$Z($,X.id),U=ZZ($,X.id,5),O=fZ($,X.id),G=P($,X.id);W.json({project:X,complianceScore:H?.overall_score??null,trend:Q,violations:Y,recentDecisions:U,sessionCount:O,suggestions:G.length,lastChecked:H?.created_at??null})}),Z.get("/dashboard/data",(J,W)=>{let K=J.query.project_path,X=K?E($,K):null;if(!X){let M=l($);W.json({projects:M,selectedProject:null});return}let H=d($,X.id,20),Q=NZ($,X.id,{limit:50}),Y=ZZ($,X.id,10),U=e($,X.id),O=$Z($,X.id),G=P($,X.id);W.json({project:X,scoreHistory:H,violations:Q,recentDecisions:Y,trend:U,violationCounts:O,suggestions:G})}),Z.get("/api/health",(J,W)=>{W.json({status:"healthy",service:"claude-architect",timestamp:new Date().toISOString()})})}function bZ(Z){let $=p(),J=PZ.Router();MZ(J,$),SZ(J,$),IZ(J,$),gZ(J,$),jZ(J,$),Z.use(J)}function hZ(){return{workerPort:parseInt(process.env.ARCHITECT_PORT||"37778",10),logLevel:process.env.ARCHITECT_LOG_LEVEL||"info",databasePath:process.env.ARCHITECT_DB_PATH||"",pluginRoot:process.env.CLAUDE_PLUGIN_ROOT||process.cwd(),improvementMinSessions:parseInt(process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS||"5",10)}}var y0=hZ(),s=y0.workerPort;function I0(){let Z=o.default();Z.use(o.default.json({limit:"1mb"})),Z.use((W,K,X)=>{let H=W.headers.origin,Q=[`http://localhost:${s}`,`http://127.0.0.1:${s}`];if(H&&Q.includes(H))K.header("Access-Control-Allow-Origin",H);if(K.header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE"),K.header("Access-Control-Allow-Headers","Content-Type"),W.method==="OPTIONS"){K.sendStatus(204);return}X()});let $=mZ.join(a(),"ui");if(uZ.existsSync($))Z.use(o.default.static($));bZ(Z),p();let J=Z.listen(s,()=>{A.info(`Worker server started on port ${s}`),process.stdout.write("Success")});process.on("SIGTERM",()=>{A.info("Shutting down worker server"),J.close(),t()}),process.on("SIGINT",()=>{J.close(),t()})}var JZ=process.argv[2];if(JZ==="start")I0();else if(JZ==="hook"){let Z=process.argv[3];import(`../../cli/handlers/${Z}`).then(($)=>$.default?.()).catch(($)=>{A.error(`Hook handler "${Z}" failed`,{error:$.message}),process.stdout.write("Success")})}else A.error(`Unknown command: ${JZ}`),process.exit(1);})

//# debugId=68077E56A1AD3D1464756E2164756E21
