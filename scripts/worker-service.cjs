// @bun @bun-cjs
(function(exports, require, module, __filename, __dirname) {var q0=Object.create;var{getPrototypeOf:S0,defineProperty:EZ,getOwnPropertyNames:N0}=Object;var y0=Object.prototype.hasOwnProperty;function I0(Z){return this[Z]}var v0,f0,P0=(Z,$,J)=>{var W=Z!=null&&typeof Z==="object";if(W){var K=$?v0??=new WeakMap:f0??=new WeakMap,X=K.get(Z);if(X)return X}J=Z!=null?q0(S0(Z)):{};let H=$||!Z||!Z.__esModule?EZ(J,"default",{value:Z,enumerable:!0}):J;for(let Q of N0(Z))if(!y0.call(H,Q))EZ(H,Q,{get:I0.bind(Z,Q),enumerable:!0});if(W)K.set(Z,H);return H};var j0=(Z)=>Z;function g0(Z,$){this[Z]=j0.bind(null,$)}var m=(Z,$)=>{for(var J in $)EZ(Z,J,{get:$[J],enumerable:!0,configurable:!0,set:g0.bind($,J)})};var L=(Z,$)=>()=>(Z&&($=Z(Z=0)),$);function wZ(){return process.env.CLAUDE_PLUGIN_ROOT||I.resolve(__dirname,"..","..")}function h0(){let Z=I.join(kZ.homedir(),b0);if(!e.existsSync(Z))e.mkdirSync(Z,{recursive:!0});return Z}function xZ(){return I.join(h0(),"architect.sqlite")}function RZ(){return I.join(wZ(),"rules")}function _(Z){return I.normalize(Z).replace(/\\/g,"/")}function q(Z,$){let J=new Bun.Glob(Z);return Array.from(J.scanSync({cwd:$,dot:!1}))}var kZ,I,e,__dirname="C:\\Users\\golia\\Desktop\\Projects\\claude-architect\\src\\utils",b0=".claude-architect";var C=L(()=>{kZ=require("os"),I=require("path"),e=require("fs")});function ZZ(Z,$,J){if(CZ[Z]<CZ[u0])return;let W={timestamp:new Date().toISOString(),level:Z,service:"claude-architect",message:$,...J};process.stderr.write(JSON.stringify(W)+`
`)}var CZ,u0,A;var S=L(()=>{CZ={debug:0,info:1,warn:2,error:3},u0=process.env.ARCHITECT_LOG_LEVEL||"info";A={debug:(Z,$)=>ZZ("debug",Z,$),info:(Z,$)=>ZZ("info",Z,$),warn:(Z,$)=>ZZ("warn",Z,$),error:(Z,$)=>ZZ("error",Z,$)}});function DZ(Z){Z.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);let $=Z.query("SELECT version FROM schema_migrations ORDER BY version").all().map((J)=>J.version);for(let J of m0){if($.includes(J.version))continue;Z.run("BEGIN TRANSACTION");try{J.up(Z),Z.query("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(J.version,J.description,Date.now()),Z.run("COMMIT")}catch(W){throw Z.run("ROLLBACK"),Error(`Migration ${J.version} failed: ${W.message}`)}}}var m0;var qZ=L(()=>{m0=[{version:1,description:"Core schema \u2014 projects, decisions, violations, sessions",up:(Z)=>{Z.run(`
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
      `)}},{version:2,description:"Performance indexes",up:(Z)=>{Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)"),Z.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)")}}]});function p0(Z){Z.run("PRAGMA journal_mode = WAL"),Z.run("PRAGMA synchronous = NORMAL"),Z.run("PRAGMA foreign_keys = ON"),Z.run("PRAGMA temp_store = MEMORY"),Z.run("PRAGMA mmap_size = 268435456"),Z.run("PRAGMA cache_size = 10000")}function E(Z){if(N)return N;let $=Z||xZ();return A.info("Opening database",{path:$}),N=new SZ.Database($,{create:!0}),p0(N),DZ(N),A.info("Database ready",{path:$}),N}function p(){if(N)N.close(),N=null,A.info("Database closed")}var SZ,N=null;var v=L(()=>{C();S();qZ();SZ=require("bun:sqlite")});function $Z(Z,$){let J=Date.now(),W=_($.path),K=Z.query("SELECT * FROM projects WHERE path = ?").get(W);if(K)return Z.query("UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?").run($.name,$.tech_stack??K.tech_stack,$.architecture_pattern??K.architecture_pattern,J,K.id),{...K,name:$.name,updated_at:J};return Z.query(`INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run($.id,$.name,W,$.tech_stack??null,$.architecture_pattern??"clean",J,J),{id:$.id,name:$.name,path:W,tech_stack:$.tech_stack??null,architecture_pattern:$.architecture_pattern??"clean",created_at:J,updated_at:J}}function z(Z,$){return Z.query("SELECT * FROM projects WHERE path = ?").get(_($))}function JZ(Z){return Z.query("SELECT * FROM projects ORDER BY updated_at DESC").all()}var x=L(()=>{C()});function WZ(Z,$){let W=Z.query(`INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.overallScore,JSON.stringify($.scoresByCategory),$.totalFeatures,$.totalFiles,$.totalViolations,JSON.stringify($.violationsBySeverity),JSON.stringify($.violationsByRule),Date.now());return Number(W.lastInsertRowid)}function KZ(Z,$){return Z.query("SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get($)}function XZ(Z,$,J=20){return Z.query(`SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`).all($,J).reverse()}function d(Z,$){let J=Z.query(`SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`).all($);if(J.length<2)return"stable";let W=J[0].overall_score,K=J[J.length-1].overall_score,X=W-K;if(X>3)return"improving";if(X<-3)return"declining";return"stable"}function l0(Z){let $=_(Z).split("/");if($.includes("domain"))return"domain";if($.includes("application"))return"application";if($.includes("infrastructure"))return"infrastructure";return"unknown"}function c0(Z){let $=_(Z).match(/src\/features\/([^/]+)\//);return $?$[1]:null}function n0(Z){let $=[];for(let J of d0){let W=new RegExp(J.source,J.flags),K;while((K=W.exec(Z))!==null)$.push(K[1])}return $}function i0(Z){return Z.startsWith(".")}function yZ(Z){let $=[],J=l.join(Z,"src");if(!HZ.existsSync(J))return{violations:[],filesScanned:0};let W=o0(J),K=0;for(let X of W){K++;let H=_(l.relative(Z,X)),Q=l0(H),Y=c0(H);if(Q==="unknown")continue;let U;try{U=HZ.readFileSync(X,"utf-8")}catch{continue}let G=n0(U);for(let O of G){if(!i0(O))continue;let M=s0(H,O,Q,Y);if(M)$.push({...M,filePath:H})}}return{violations:$,filesScanned:K}}function s0(Z,$,J,W){let K=_($);if(J==="domain"){if(K.includes("/application/")||K.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Domain layer imports from ${K.includes("/application/")?"application":"infrastructure"} layer: "${$}"`,suggestion:"Move the dependency to a port interface in domain/ and implement it in infrastructure/"}}if(J==="application"){if(K.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Application layer imports from infrastructure layer: "${$}"`,suggestion:"Define a port interface in domain/ and inject the infrastructure implementation"}}if(W&&K.includes("/features/")){let X=K.match(/features\/([^/]+)\//);if(X&&X[1]!==W)return{ruleId:"01-architecture",ruleName:"Cross-Feature Isolation",severity:"warning",category:"dependency",description:`Direct import from feature "${X[1]}": "${$}"`,suggestion:"Use shared contracts in src/shared/contracts/ or domain events instead"}}return null}function o0(Z){let $=[],J=q("**/*.{ts,tsx,js,jsx}",Z);for(let W of J)if(!W.includes("node_modules")&&!W.includes(".test.")&&!W.includes(".spec."))$.push(l.join(Z,W));return $}var HZ,l,d0;var IZ=L(()=>{C();HZ=require("fs"),l=require("path"),d0=[/import\s+.*from\s+['"](.+)['"]/g,/import\s*\(\s*['"](.+)['"]\s*\)/g,/require\s*\(\s*['"](.+)['"]\s*\)/g]});function vZ(Z){let $=[],J=[],W=F.join(Z,"src","features");if(!w.existsSync(W))return{violations:[],filesScanned:0,features:[]};let K=w.readdirSync(W).filter((H)=>{let Q=F.join(W,H);return w.statSync(Q).isDirectory()&&!H.startsWith(".")});for(let H of K){let Q=F.join(W,H),Y=a0(Q,H,$);J.push(Y)}if(!w.existsSync(F.join(Z,"PROJECT_MAP.md")))$.push({ruleId:"06-documentation",ruleName:"PROJECT_MAP Required",severity:"warning",category:"docs",description:"Missing PROJECT_MAP.md at project root",suggestion:"Run /architect-init to generate PROJECT_MAP.md"});let X=F.join(Z,"src","shared");if(w.existsSync(X))e0(X,Z,$);return{violations:$,filesScanned:K.length,features:J}}function a0(Z,$,J){let W=w.existsSync(F.join(Z,"domain")),K=w.existsSync(F.join(Z,"application")),X=w.existsSync(F.join(Z,"infrastructure")),H=w.existsSync(F.join(Z,"README.md")),Q=w.existsSync(F.join(Z,"__tests__"))||t0(Z);for(let U of r0)if(!w.existsSync(F.join(Z,U)))J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:_(`src/features/${$}/`),description:`Feature "${$}" is missing ${U}/ directory`,suggestion:`Create src/features/${$}/${U}/ directory`});if(!H)J.push({ruleId:"06-documentation",ruleName:"Feature README",severity:"info",category:"docs",filePath:_(`src/features/${$}/`),description:`Feature "${$}" is missing README.md`,suggestion:"Run /architect-scaffold to generate README.md from template"});if($!==$.toLowerCase()||$.includes("_"))J.push({ruleId:"15-code-style",ruleName:"Naming Convention",severity:"info",category:"structure",filePath:_(`src/features/${$}/`),description:`Feature directory "${$}" should use kebab-case`,suggestion:`Rename to "${Z1($)}"`});let Y=0;if(!W)Y++;if(!K)Y++;if(!X)Y++;if(!H)Y++;return{name:$,path:_(`src/features/${$}/`),hasReadme:H,hasDomain:W,hasApplication:K,hasInfrastructure:X,hasTests:Q,violationCount:Y}}function t0(Z){try{return q("**/*.{test,spec}.{ts,tsx,js,jsx}",Z).length>0}catch{return!1}}function e0(Z,$,J){try{let W=q("**/*.{ts,tsx,js,jsx}",Z);for(let K of W){if(K.includes("node_modules"))continue;let H=(K.split("/").pop()||"").replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/,"");if(/^[A-Z]/.test(H)&&!H.includes("."))continue}}catch{}}function Z1(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}var w,F,r0;var fZ=L(()=>{C();w=require("fs"),F=require("path"),r0=["domain","application","infrastructure"]});function jZ(Z){let $=[],J=c.join(Z,"src"),W=0;try{let K=q("**/*.{ts,tsx,js,jsx,py}",J);for(let X of K){if(J1.some((G)=>X.includes(G)))continue;W++;let H=c.join(J,X),Q=_(c.relative(Z,H)),Y;try{Y=PZ.readFileSync(H,"utf-8")}catch{continue}let U=Y.split(`
`);for(let G of $1){let O=new RegExp(G.pattern.source,G.pattern.flags),M;while((M=O.exec(Y))!==null){let T=Y.substring(0,M.index).split(`
`).length,V=U[T-1]?.trim()||"";if(V.startsWith("//")||V.startsWith("*"))continue;$.push({ruleId:"02-security",ruleName:G.name,severity:G.severity,category:"security",filePath:Q,lineNumber:T,description:G.description,suggestion:G.suggestion})}}}}catch{}return{violations:$,filesScanned:W}}var PZ,c,$1,J1;var gZ=L(()=>{C();PZ=require("fs"),c=require("path"),$1=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected",suggestion:"Move to environment variable: process.env.API_KEY or use a secrets manager"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected",suggestion:"Move to environment variable or secrets manager. Never commit secrets to source code"},{name:"SQL String Concatenation",pattern:/(?:query|exec|execute|raw)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/gi,severity:"critical",description:"Potential SQL injection via string concatenation/template literals",suggestion:"Use parameterized queries or prepared statements instead of string interpolation"},{name:"SQL Concatenation (plus operator)",pattern:/(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"critical",description:"SQL query built with string concatenation using user input",suggestion:"Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])"},{name:"Dangerous innerHTML",pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,severity:"warning",description:"Use of dangerouslySetInnerHTML \u2014 potential XSS vulnerability",suggestion:"Sanitize content with DOMPurify before rendering, or use safe alternatives"},{name:"innerHTML Assignment",pattern:/\.innerHTML\s*=\s*(?!['"]<)/gi,severity:"warning",description:"Direct innerHTML assignment with dynamic content \u2014 XSS risk",suggestion:"Use textContent for text, or sanitize HTML before assigning to innerHTML"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability",suggestion:"Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code"},{name:"Disabled HTTPS Verification",pattern:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,severity:"critical",description:"TLS/SSL certificate verification is disabled",suggestion:"Never disable certificate verification in production. Fix the certificate issue instead"},{name:"Wildcard CORS",pattern:/(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,severity:"warning",description:"CORS allows all origins (*) \u2014 overly permissive",suggestion:"Configure CORS with explicit origin allowlist instead of wildcard"},{name:"Console.log in Production",pattern:/console\.(log|debug|trace)\s*\(/g,severity:"info",description:"console.log found \u2014 use structured logging in production",suggestion:"Replace with structured logger (e.g., winston, pino) for production code"}],J1=["node_modules",".test.",".spec.","__tests__",".d.ts",".min.js","dist/","build/","coverage/"]});function hZ(Z){let $=[],J=D.join(Z,"src");if(!n.existsSync(J))return{violations:[],filesScanned:0};let W=0;try{let K=q("**/*.{ts,tsx,js,jsx}",J);for(let X of K){if(X.includes("node_modules")||X.includes(".d.ts")||X.includes("dist/"))continue;W++;let H=D.join(J,X),Q=_(D.relative(Z,H)),Y;try{Y=n.readFileSync(H,"utf-8")}catch{continue}let U=Y.split(`
`);if(U.length>bZ)$.push({ruleId:"15-code-style",ruleName:"File Size Limit",severity:"warning",category:"quality",filePath:Q,description:`File has ${U.length} lines (max ${bZ})`,suggestion:"Split into smaller focused modules. Extract helper functions or sub-components."});if(W1(Y,Q,$),K1(Y,Q,$),!X.includes(".test.")&&!X.includes(".spec.")&&!X.includes("__tests__")&&Q1(Y))X1(H,Q,$);H1(Y,Q,$)}}catch{}return{violations:$,filesScanned:W}}function W1(Z,$,J){let W=/\/\/\s*TODO(?!\s*\(?\s*[A-Z]+-\d+)/g,K;while((K=W.exec(Z))!==null){let X=Z.substring(0,K.index).split(`
`).length;J.push({ruleId:"15-code-style",ruleName:"TODO Without Ticket",severity:"info",category:"quality",filePath:$,lineNumber:X,description:"TODO comment without issue/ticket reference",suggestion:"Add a ticket reference: // TODO(JIRA-123): description"})}}function K1(Z,$,J){let W=Z.split(`
`),K=0,X=0;for(let H=0;H<W.length;H++){let Q=W[H].trim();if(Q.startsWith("//")&&!Q.startsWith("///")&&!Q.startsWith("// @")){if(K===0)X=H+1;K++}else{if(K>=5)J.push({ruleId:"15-code-style",ruleName:"Commented-Out Code",severity:"info",category:"quality",filePath:$,lineNumber:X,description:`${K} consecutive commented lines \u2014 likely commented-out code`,suggestion:"Remove commented-out code. Use version control to recover old code."});K=0}}}function X1(Z,$,J){let W=D.dirname(Z),K=D.basename(Z),X=[".test.ts",".test.tsx",".spec.ts",".spec.tsx",".test.js",".spec.js"],H=K.replace(/\.(ts|tsx|js|jsx)$/,"");if(!X.some((Y)=>n.existsSync(D.join(W,H+Y))))J.push({ruleId:"03-testing",ruleName:"Missing Test File",severity:"info",category:"quality",filePath:$,description:`No test file found for "${K}"`,suggestion:`Create ${H}.test.ts alongside this file`})}function H1(Z,$,J){let W=/^export\s+(?:async\s+)?(?:function|class|const|interface|type)\s+(\w+)/gm,K;while((K=W.exec(Z))!==null){let X=Z.substring(0,K.index).split(`
`).length,H=Z.substring(0,K.index).split(`
`),Q=H[H.length-2]?.trim()||"";if(!Q.endsWith("*/")&&!Q.startsWith("*"))J.push({ruleId:"06-documentation",ruleName:"Missing Documentation",severity:"info",category:"docs",filePath:$,lineNumber:X,description:`Exported "${K[1]}" has no JSDoc/doc comment`,suggestion:"Add a doc comment with @param, @returns, @throws as applicable"})}}function Q1(Z){return/^export\s+/m.test(Z)}var n,D,bZ=200;var uZ=L(()=>{C();n=require("fs"),D=require("path")});function pZ(Z){if(Z.length===0)return 100;let $=0;for(let J of Z){let W=Y1[J.category]??0.15,K=mZ[J.severity]??1;$+=K*W}return Math.max(0,Math.round(100-$))}function dZ(Z){let $=["dependency","structure","security","quality","docs"],J={};for(let W of $){let K=Z.filter((H)=>H.category===W),X=0;for(let H of K)X+=mZ[H.severity]??1;J[W]=Math.max(0,Math.round(100-X))}return J}function QZ(Z){let $={critical:0,warning:0,info:0};for(let J of Z)$[J.severity]=($[J.severity]??0)+1;return $}function YZ(Z){let $={};for(let J of Z)$[J.ruleId]=($[J.ruleId]??0)+1;return $}var Y1,mZ;var GZ=L(()=>{Y1={dependency:0.3,structure:0.3,security:0.25,quality:0.2,docs:0.1},mZ={critical:10,warning:3,info:1}});function OZ(Z,$={}){let J=Date.now();A.info("Starting validation",{projectPath:Z});let W=[],K=[],X=0;if(i("dependency",$.categories)){let U=yZ(Z);W.push(...U.violations),X+=U.filesScanned}if(i("structure",$.categories)){let U=vZ(Z);W.push(...U.violations),K=U.features}if(i("security",$.categories)){let U=jZ(Z);W.push(...U.violations),X=Math.max(X,U.filesScanned)}if(i("quality",$.categories)||i("docs",$.categories)){let U=hZ(Z);W.push(...U.violations),X=Math.max(X,U.filesScanned)}if($.severity){let U={critical:0,warning:1,info:2},G=U[$.severity];W=W.filter((O)=>U[O.severity]<=G)}let H=pZ(W),Q=dZ(W),Y=Date.now()-J;return A.info("Validation complete",{projectPath:Z,score:H,violations:W.length,duration:Y}),{overallScore:H,scoresByCategory:Q,totalFeatures:K.length,totalFiles:X,violations:W,featureMap:K,trend:"stable",timestamp:Date.now()}}function cZ(Z,$){let J=[],W=UZ.basename($);if(/\.(test|spec)\./i.test(W)||!/\.(ts|tsx|js|jsx)$/i.test(W))return J;let K;try{K=lZ.readFileSync($,"utf-8")}catch{return J}let X=_(UZ.relative(Z,$)),H=K.split(`
`);if(H.length>200)J.push({ruleId:"15-code-style",ruleName:"File Too Long",severity:"warning",category:"quality",filePath:X,description:`File has ${H.length} lines (limit: 200)`,suggestion:"Split into smaller, focused modules"});for(let U of G1){let G=new RegExp(U.pattern.source,U.pattern.flags),O;while((O=G.exec(K))!==null){let M=K.substring(0,O.index).split(`
`).length,T=H[M-1]?.trim()||"";if(T.startsWith("//")||T.startsWith("*"))continue;J.push({ruleId:"02-security",ruleName:U.name,severity:U.severity,category:"security",filePath:X,lineNumber:M,description:U.description})}}let Y=_(X).match(/\/(?:domain|application|infrastructure)\//);if(Y){let U=Y[0].replace(/\//g,""),G=U1[U];if(G)for(let O of H){let M=O.match(/(?:import|from)\s+['"]([^'"]+)['"]/);if(!M)continue;let T=M[1];for(let V of G)if(T.includes(`/${V}/`)||T.includes(`\\${V}\\`)){J.push({ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",filePath:X,description:`${U} layer imports from ${V} (forbidden)`,suggestion:`Define a port interface in ${U}/ and implement in ${V}/`});break}}}return J}function i(Z,$){if(!$||$.length===0)return!0;return $.includes(Z)}var lZ,UZ,G1,U1;var MZ=L(()=>{IZ();fZ();gZ();uZ();GZ();C();S();lZ=require("fs"),UZ=require("path");G1=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected"},{name:"SQL String Concatenation",pattern:/(?:query|exec|execute|raw)\s*\(\s*[`'"].*\$\{.*\}.*[`'"]\s*\)/gi,severity:"critical",description:"Potential SQL injection via string interpolation"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability"}],U1={domain:["infrastructure","application"],application:["infrastructure"]}});function sZ(Z,$){let W=Z.query(`INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.title,$.context??null,$.decision,$.alternatives?JSON.stringify($.alternatives):null,$.consequencesPositive?JSON.stringify($.consequencesPositive):null,$.consequencesNegative?JSON.stringify($.consequencesNegative):null,$.tags?JSON.stringify($.tags):null,Date.now());return Number(W.lastInsertRowid)}function BZ(Z,$){return Z.query("SELECT * FROM decisions WHERE id = ?").get($)}function s(Z,$,J={}){let W=["project_id = ?"],K=[$];if(J.query){W.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");let Y=`%${J.query}%`;K.push(Y,Y,Y)}if(J.status)W.push("status = ?"),K.push(J.status);let X=Math.min(J.limit??20,100),H=J.offset??0,Q=`
    SELECT * FROM decisions
    WHERE ${W.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;return K.push(X,H),Z.query(Q).all(...K)}function o(Z,$,J=5){return Z.query("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all($,J)}function oZ(Z,$){let W=Z.query(`INSERT INTO violations
       (project_id, session_id, rule_id, rule_name, severity, category,
        file_path, line_number, description, suggestion, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run($.projectId,$.sessionId??null,$.ruleId,$.ruleName,$.severity,$.category,$.filePath??null,$.lineNumber??null,$.description,$.suggestion??null,Date.now());return Number(W.lastInsertRowid)}function zZ(Z,$,J={}){let W=["project_id = ?","resolved = 0"],K=[$];if(J.severity)W.push("severity = ?"),K.push(J.severity);if(J.category)W.push("category = ?"),K.push(J.category);if(J.ruleId)W.push("rule_id = ?"),K.push(J.ruleId);let X=Math.min(J.limit??50,200);return K.push(X),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`).all(...K)}function rZ(Z,$,J="manual"){Z.query("UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?").run(Date.now(),J,$)}function j(Z,$){let J=Z.query(`SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`).all($),W={critical:0,warning:0,info:0};for(let K of J)if(K.severity in W)W[K.severity]=K.count;return W}function r(Z,$,J={}){let W=["project_id = ?"],K=[$];if(J.query){W.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");let H=`%${J.query}%`;K.push(H,H,H)}if(J.resolved!==void 0)W.push("resolved = ?"),K.push(J.resolved?1:0);let X=Math.min(J.limit??20,100);return K.push(X,J.offset??0),Z.query(`SELECT * FROM violations WHERE ${W.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...K)}function tZ(Z,$,J,W){Z.query(`INSERT OR IGNORE INTO sessions
       (id, project_id, started_at, compliance_score_before, decisions_made, violations_found, violations_resolved)
     VALUES (?, ?, ?, ?, 0, 0, 0)`).run($,J,Date.now(),W??null)}function eZ(Z,$,J){Z.query(`UPDATE sessions SET
       completed_at = ?,
       summary = ?,
       features_added = ?,
       files_changed = ?,
       decisions_made = ?,
       violations_found = ?,
       violations_resolved = ?,
       compliance_score_after = ?
     WHERE id = ?`).run(Date.now(),J.summary??null,J.featuresAdded?JSON.stringify(J.featuresAdded):null,J.filesChanged?JSON.stringify(J.filesChanged):null,J.decisionsMade??0,J.violationsFound??0,J.violationsResolved??0,J.complianceScoreAfter??null,$)}function Z0(Z,$,J=10){return Z.query("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all($,J)}function h(Z,$){return Z.query("SELECT COUNT(*) as count FROM sessions WHERE project_id = ?").get($)?.count??0}function $0(Z,$,J=null){let W=Date.now(),K=Z.query("SELECT * FROM rule_metrics WHERE rule_id = ? AND project_id IS ?").get($,J);if(K)Z.query(`UPDATE rule_metrics SET
         total_violations = total_violations + 1,
         last_violation_at = ?,
         updated_at = ?
       WHERE id = ?`).run(W,W,K.id);else Z.query(`INSERT INTO rule_metrics
         (project_id, rule_id, total_violations, resolved_violations,
          ignored_violations, last_violation_at, updated_at)
       VALUES (?, ?, 1, 0, 0, ?, ?)`).run(J,$,W,W)}function J0(Z,$=null){return Z.query(`SELECT * FROM rule_metrics WHERE project_id IS ?
       ORDER BY total_violations DESC`).all($)}function W0(Z,$){let W=Z.query(`INSERT INTO improvement_suggestions
       (project_id, rule_id, suggestion_type, title, reasoning, evidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run($.projectId??null,$.ruleId??null,$.suggestionType,$.title,$.reasoning,$.evidence?JSON.stringify($.evidence):null,Date.now());return Number(W.lastInsertRowid)}function g(Z,$=null){if($)return Z.query(`SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`).all($);return Z.query(`SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`).all()}function _Z(){return{workerPort:parseInt(process.env.ARCHITECT_PORT||"37778",10),logLevel:process.env.ARCHITECT_LOG_LEVEL||"info",databasePath:process.env.ARCHITECT_DB_PATH||"",pluginRoot:process.env.CLAUDE_PLUGIN_ROOT||process.cwd(),improvementMinSessions:parseInt(process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS||"5",10)}}var U0={};m(U0,{default:()=>G0});async function G0(){let Z=process.cwd(),$=E(),J=z($,Z);if(!J){let U=Y0.basename(Z);J=$Z($,{id:crypto.randomUUID(),name:U,path:Z}),A.info("New project registered",{name:U,path:Z})}let W=process.env.CLAUDE_SESSION_ID||crypto.randomUUID(),K=KZ($,J.id);tZ($,W,J.id,K?.overall_score);let X=j($,J.id),H=d($,J.id),Q=o($,J.id,3),Y=[];if(Y.push("# [claude-architect] project context"),Y.push(`Project: ${J.name} (${J.path})`),K)Y.push(`Compliance Score: ${K.overall_score}/100 (${H})`);if(X.critical>0||X.warning>0)Y.push(`Open Violations: ${X.critical} critical, ${X.warning} warning, ${X.info} info`);if(Q.length>0){Y.push(`
Recent Decisions:`);for(let U of Q)Y.push(`- [${U.status}] ${U.title}`)}process.stdout.write(Y.join(`
`))}var Y0;var O0=L(()=>{v();x();S();Y0=require("path")});var A0={};m(A0,{default:()=>M0});async function M0(){let Z=process.cwd(),$=E(),J=z($,Z);if(!J){process.stdout.write("Success");return}let W=zZ($,J.id,{limit:5});if(W.length===0){process.stdout.write("Success");return}let K=[];K.push("# [claude-architect] active warnings");for(let X of W)K.push(`- [${X.severity}] ${X.description}${X.file_path?` (${X.file_path})`:""}`);process.stdout.write(K.join(`
`))}var B0=L(()=>{v();x()});var _0={};m(_0,{default:()=>z0});async function z0(){let Z=process.cwd(),$=E(),J=z($,Z);if(!J){process.stdout.write("Success");return}let W=process.env.TOOL_INPUT_FILE_PATH||"";if(!W){process.stdout.write("Success");return}let K=cZ(Z,W);if(K.length===0){process.stdout.write("Success");return}let X=process.env.CLAUDE_SESSION_ID;for(let Q of K)oZ($,{projectId:J.id,sessionId:X,ruleId:Q.ruleId,ruleName:Q.ruleName,severity:Q.severity,category:Q.category,filePath:Q.filePath,lineNumber:Q.lineNumber,description:Q.description,suggestion:Q.suggestion}),$0($,Q.ruleId,J.id);let H=[];H.push("# [claude-architect] violations detected");for(let Q of K)H.push(`- [${Q.severity}] ${Q.description}${Q.suggestion?` \u2192 ${Q.suggestion}`:""}`);process.stdout.write(H.join(`
`))}var V0=L(()=>{v();x();MZ()});var T0={};m(T0,{default:()=>L0});async function L0(){let Z=process.cwd(),$=E(),J=z($,Z);if(!J){process.stdout.write("Success");return}let W=process.env.CLAUDE_SESSION_ID;try{let K=OZ(Z,{severity:"warning"});if(WZ($,{projectId:J.id,sessionId:W??void 0,overallScore:K.overallScore,scoresByCategory:K.scoresByCategory,totalFeatures:K.totalFeatures,totalFiles:K.totalFiles,totalViolations:K.violations.length,violationsBySeverity:QZ(K.violations),violationsByRule:YZ(K.violations)}),W){let X=j($,J.id);eZ($,W,{complianceScoreAfter:K.overallScore,violationsFound:X.critical+X.warning+X.info})}A.info("Session summarized",{project:J.name,score:K.overallScore})}catch(K){A.error("Summarization failed",{error:K.message})}process.stdout.write("Success")}var E0=L(()=>{v();x();MZ();GZ();S()});function w0(Z,$,J=5){let W=$?h(Z,$):0;if($&&W<J)return{suggestions:[],analysisMetadata:{totalRules:0,totalSessions:W,analyzedAt:Date.now()}};let K=J0(Z,$),X=[];for(let G of K){if(G.total_violations>10){let O=G.ignored_violations/G.total_violations;if(O>0.5)X.push({ruleId:G.rule_id,type:"relax",title:`Rule "${G.rule_id}" is frequently ignored`,reasoning:`${Math.round(O*100)}% of violations for this rule are ignored (${G.ignored_violations}/${G.total_violations}). The rule may be too strict or irrelevant for this project.`,evidence:{totalViolations:G.total_violations,resolvedViolations:G.resolved_violations,ignoredViolations:G.ignored_violations,ignoreRate:Math.round(O*100)}})}if(G.avg_resolution_time_ms!==null&&G.avg_resolution_time_ms<300000&&G.resolved_violations>5)X.push({ruleId:G.rule_id,type:"add",title:`Auto-fix candidate: "${G.rule_id}"`,reasoning:`Violations for this rule are resolved quickly (avg ${Math.round(G.avg_resolution_time_ms/1000)}s). Consider adding auto-fix support.`,evidence:{avgResolutionTimeSec:Math.round(G.avg_resolution_time_ms/1000),resolvedCount:G.resolved_violations}});if($&&W>0){let O=G.total_violations/W;if(O>3)X.push({ruleId:G.rule_id,type:"split",title:`Rule "${G.rule_id}" triggers too frequently`,reasoning:`This rule triggers ${O.toFixed(1)} times per session on average. Consider splitting into more specific sub-rules or adding examples.`,evidence:{violationsPerSession:O.toFixed(1),totalSessions:W,totalViolations:G.total_violations}})}}let H=new Set(K.map((G)=>G.rule_id)),Q=["01-architecture","02-security","03-testing","04-api-design","05-database","06-documentation","07-performance","08-error-handling","09-git-workflow","10-frontend","11-auth-patterns","12-monitoring","13-environment","14-dependency-management","15-code-style","16-ci-cd"];if(W>=J){for(let G of Q)if(!H.has(G))X.push({ruleId:G,type:"remove",title:`Rule "${G}" never triggered`,reasoning:`This rule has never produced a violation across ${W} sessions. It may be too obvious or not applicable to this project \u2014 consider removing to save tokens.`,evidence:{totalSessions:W,totalViolations:0}})}let Y=g(Z,$),U=new Set(Y.map((G)=>G.title));for(let G of X)if(!U.has(G.title))W0(Z,{projectId:$??void 0,ruleId:G.ruleId,suggestionType:G.type,title:G.title,reasoning:G.reasoning,evidence:G.evidence});return A.info("Self-improvement analysis complete",{projectId:$,suggestionsGenerated:X.length,sessionCount:W}),{suggestions:X,analysisMetadata:{totalRules:K.length,totalSessions:W,analyzedAt:Date.now()}}}var F0=L(()=>{S()});var x0={};m(x0,{default:()=>k0});async function k0(){let Z=process.cwd(),$=E(),J=z($,Z);if(J){let W=_Z(),K=h($,J.id);if(K>=W.improvementMinSessions)try{w0($,J.id,W.improvementMinSessions),A.info("Self-improvement analysis completed",{project:J.name,sessions:K})}catch(X){A.error("Self-improvement analysis failed",{error:X.message})}}p(),process.stdout.write("Success")}var R0=L(()=>{v();x();F0();S()});var LZ=P0(require("express")),C0=require("path"),D0=require("fs");v();var H0=require("express");x();function NZ(Z,$){Z.get("/api/projects",(J,W)=>{W.json(JZ($))}),Z.post("/api/projects",(J,W)=>{let{id:K,name:X,path:H,tech_stack:Q}=J.body;if(!K||!X||!H){W.status(400).json({error:"id, name, and path are required"});return}if(typeof K!=="string"||typeof X!=="string"||typeof H!=="string"){W.status(400).json({error:"id, name, and path must be strings"});return}let Y=$Z($,{id:K,name:X,path:H,tech_stack:Q});W.status(201).json(Y)})}x();MZ();GZ();S();var P=require("fs"),k=require("path");function nZ(Z){let{projectPath:$,featureName:J,description:W="TODO: Describe this feature",withTests:K=!0}=Z,X=T1(J),H=E1(J),Q=k.join($,"src","features",X);if(P.existsSync(Q))throw Error(`Feature directory already exists: ${Q}`);let Y=[],U=[],G=["domain/entities","domain/value-objects","domain/ports","domain/events","domain/services","application/use-cases","application/dtos","application/mappers","infrastructure/controllers","infrastructure/repositories","infrastructure/adapters","infrastructure/config"];if(K)G.push("__tests__/integration","__tests__/e2e");for(let a of G){let t=k.join(Q,a);P.mkdirSync(t,{recursive:!0}),Y.push(`src/features/${X}/${a}`)}let O=O1(H,W);y(k.join(Q,"domain","entities",`${H}.ts`),O),U.push(`src/features/${X}/domain/entities/${H}.ts`);let M=M1(H);y(k.join(Q,"domain","ports",`${H}Repository.ts`),M),U.push(`src/features/${X}/domain/ports/${H}Repository.ts`);let T=A1(H);y(k.join(Q,"application","dtos",`${H}Dto.ts`),T),U.push(`src/features/${X}/application/dtos/${H}Dto.ts`);let V=B1(H);y(k.join(Q,"application","use-cases",`Create${H}UseCase.ts`),V),U.push(`src/features/${X}/application/use-cases/Create${H}UseCase.ts`);let u=z1(H);y(k.join(Q,"application","mappers",`${H}Mapper.ts`),u),U.push(`src/features/${X}/application/mappers/${H}Mapper.ts`);let f=_1(H);y(k.join(Q,"infrastructure","controllers",`${H}Controller.ts`),f),U.push(`src/features/${X}/infrastructure/controllers/${H}Controller.ts`);let B=V1(H);y(k.join(Q,"infrastructure","repositories",`${H}RepositoryImpl.ts`),B),U.push(`src/features/${X}/infrastructure/repositories/${H}RepositoryImpl.ts`);let TZ=L1(X,H,W);y(k.join(Q,"README.md"),TZ),U.push(`src/features/${X}/README.md`);let FZ=["domain/value-objects","domain/events","domain/services","infrastructure/adapters","infrastructure/config"];if(K)FZ.push("__tests__/integration","__tests__/e2e");for(let a of FZ){let t=k.join(Q,a,".gitkeep");if(!P.existsSync(t))y(t,"")}return A.info("Feature scaffold generated",{feature:X,files:U.length,dirs:Y.length}),{createdFiles:U,createdDirs:Y,featurePath:Q}}function y(Z,$){P.writeFileSync(Z,$,"utf-8")}function O1(Z,$){return`/**
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
`}function M1(Z){return`/**
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
`}function A1(Z){return`/**
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
`}function B1(Z){return`/**
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
`}function z1(Z){return`/**
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
`}function _1(Z){return`/**
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
`}function V1(Z){return`/**
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
`}function L1(Z,$,J){return`# Feature: ${$}

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
`}function T1(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}function E1(Z){return Z.replace(/[-_\s]+(.)/g,($,J)=>J.toUpperCase()).replace(/^(.)/,($,J)=>J.toUpperCase())}C();var b=require("fs"),AZ=require("path");function iZ(Z,$){Z.get("/api/check",(J,W)=>{let K=J.query.project_path;if(!K||typeof K!=="string"){W.status(400).json({error:"project_path query parameter required"});return}let X=J.query.categories?J.query.categories.split(","):void 0,H=J.query.severity,Q=OZ(K,{categories:X,severity:H}),Y=z($,K);if(Y)WZ($,{projectId:Y.id,overallScore:Q.overallScore,scoresByCategory:Q.scoresByCategory,totalFeatures:Q.totalFeatures,totalFiles:Q.totalFiles,totalViolations:Q.violations.length,violationsBySeverity:QZ(Q.violations),violationsByRule:YZ(Q.violations)});W.json(Q)}),Z.post("/api/scaffold",(J,W)=>{let{project_path:K,feature_name:X,description:H,with_tests:Q}=J.body;if(!K||!X){W.status(400).json({error:"project_path and feature_name are required"});return}if(typeof K!=="string"||typeof X!=="string"){W.status(400).json({error:"project_path and feature_name must be strings"});return}try{let Y=nZ({projectPath:K,featureName:X,description:typeof H==="string"?H:void 0,withTests:Q!==!1});W.status(201).json(Y)}catch(Y){W.status(409).json({error:Y.message})}}),Z.get("/api/rules",(J,W)=>{let K=J.query.file_path,X=J.query.category,H=RZ();if(!b.existsSync(H)){W.json({rules:[],message:"Rules directory not found"});return}let Q=b.readdirSync(H).filter((U)=>U.endsWith(".md")).sort(),Y=[];for(let U of Q){let G=AZ.basename(U,".md");if(X&&!G.includes(X))continue;let O=b.readFileSync(AZ.join(H,U),"utf-8");if(K){let M=O.match(/^---\s*\npaths:\s*\n([\s\S]*?)---/m);if(M){let T=M[1].split(`
`).map((f)=>f.replace(/^\s*-\s*/,"").trim()).filter(Boolean),V=K.replace(/\\/g,"/");if(!T.some((f)=>{let B=f.replace(/\*\*/g,".*").replace(/\*/g,"[^/]*");return new RegExp(B).test(V)}))continue}}Y.push({id:G,name:G.replace(/^\d+-/,"").replace(/-/g," "),content:O})}W.json({rules:Y})})}x();function aZ(Z,$){Z.get("/api/search",(J,W)=>{let K=J.query.query,X=J.query.project_path,H=J.query.type,Q=Math.min(parseInt(J.query.limit)||20,100),U=(X?z($,X):null)?.id,G=[];if(!H||H==="decisions"){if(U){let O=s($,U,{query:K,limit:Q});for(let M of O)G.push({id:M.id,type:"decision",title:M.title,status:M.status,created_at:M.created_at,extra:M.tags||""})}}if(!H||H==="violations"){if(U){let O=r($,U,{query:K,limit:Q});for(let M of O)G.push({id:M.id,type:"violation",title:`[${M.severity}] ${M.description}`,status:M.resolved?"resolved":"open",created_at:M.created_at,extra:M.rule_id})}}G.sort((O,M)=>M.created_at-O.created_at),W.json(G.slice(0,Q))}),Z.get("/api/timeline",(J,W)=>{let K=parseInt(J.query.anchor),X=J.query.query,H=J.query.project_path,Q=parseInt(J.query.depth_before)||5,Y=parseInt(J.query.depth_after)||5,G=(H?z($,H):null)?.id;if(!G){W.status(404).json({events:[],message:"Project not found"});return}let O=[],M=s($,G,{query:X,limit:100});for(let B of M)O.push({id:B.id,type:"decision",title:B.title,status:B.status,created_at:B.created_at,extra:B.tags||""});let T=r($,G,{limit:100});for(let B of T)O.push({id:B.id,type:"violation",title:`[${B.severity}] ${B.description}`,status:B.resolved?"resolved":"open",created_at:B.created_at,extra:B.rule_id});O.sort((B,TZ)=>B.created_at-TZ.created_at);let V=-1;if(!isNaN(K))V=O.findIndex((B)=>B.id===K);else if(X)V=O.findIndex((B)=>B.title.toLowerCase().includes(X.toLowerCase()));if(V===-1)V=O.length-1;let u=Math.max(0,V-Q),f=Math.min(O.length,V+Y+1);W.json({events:O.slice(u,f),anchorIndex:V-u,total:O.length})}),Z.post("/api/details/batch",(J,W)=>{let{ids:K,type:X}=J.body;if(!Array.isArray(K)||!X){W.status(400).json({error:"ids (array) and type (string) are required"});return}if(typeof X!=="string"||!["decisions","violations","changes"].includes(X)){W.status(400).json({error:'type must be "decisions", "violations", or "changes"'});return}if(K.length>50){W.status(400).json({error:"Maximum 50 IDs per request"});return}let H=[];if(X==="decisions")for(let Q of K){let Y=BZ($,Number(Q));if(Y)H.push(Y)}else if(X==="violations")for(let Q of K){let Y=$.query("SELECT * FROM violations WHERE id = ?").get(Number(Q));if(Y)H.push(Y)}else if(X==="changes")for(let Q of K){let Y=$.query("SELECT * FROM structural_changes WHERE id = ?").get(Number(Q));if(Y)H.push(Y)}W.json(H)})}x();function K0(Z,$){Z.get("/api/decisions",(J,W)=>{let K=J.query.project_id,X=J.query.project_path,H=K;if(!H&&X)H=z($,X)?.id??"";if(!H){W.status(400).json({error:"project_id or project_path required"});return}let Q=s($,H,{query:J.query.query,status:J.query.status,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(Q)}),Z.get("/api/decisions/:id",(J,W)=>{let K=parseInt(J.params.id);if(isNaN(K)){W.status(400).json({error:"Invalid decision ID"});return}let X=BZ($,K);if(!X){W.status(404).json({error:"Decision not found"});return}W.json(X)}),Z.post("/api/decisions",(J,W)=>{let{projectId:K,project_path:X,title:H,context:Q,decision:Y,alternatives:U,tags:G}=J.body,O=K;if(!O&&X)O=z($,X)?.id;if(!O||!H||!Y){W.status(400).json({error:"projectId (or project_path), title, and decision required"});return}if(typeof H!=="string"||typeof Y!=="string"){W.status(400).json({error:"title and decision must be strings"});return}let M=sZ($,{projectId:O,title:H,context:typeof Q==="string"?Q:void 0,decision:Y,alternatives:Array.isArray(U)?U:void 0,tags:Array.isArray(G)?G:void 0});W.status(201).json({id:M})}),Z.get("/api/violations",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}let X=r($,K,{query:J.query.query,resolved:J.query.resolved==="true"?!0:J.query.resolved==="false"?!1:void 0,limit:J.query.limit?parseInt(J.query.limit):void 0});W.json(X)}),Z.patch("/api/violations/:id",(J,W)=>{let K=parseInt(J.params.id);if(isNaN(K)){W.status(400).json({error:"Invalid violation ID"});return}let{resolved_by:X}=J.body;rZ($,K,typeof X==="string"?X:"manual"),W.json({success:!0})}),Z.get("/api/sessions",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}W.json(Z0($,K))}),Z.get("/api/compliance/snapshots",(J,W)=>{let K=J.query.project_id;if(!K){W.status(400).json({error:"project_id required"});return}W.json(XZ($,K))}),Z.get("/api/improvements",(J,W)=>{let K=J.query.project_id||null;W.json(g($,K))})}x();function X0(Z,$){Z.get("/api/status",(J,W)=>{let K=J.query.project_path;if(!K){W.status(400).json({error:"project_path required"});return}let X=z($,K);if(!X){W.json({registered:!1,message:"Project not registered. Run /architect-init first."});return}let H=KZ($,X.id),Q=d($,X.id),Y=j($,X.id),U=o($,X.id,5),G=h($,X.id),O=g($,X.id);W.json({project:X,complianceScore:H?.overall_score??null,trend:Q,violations:Y,recentDecisions:U,sessionCount:G,suggestions:O.length,lastChecked:H?.created_at??null})}),Z.get("/dashboard/data",(J,W)=>{let K=J.query.project_path,X=K?z($,K):null;if(!X){let M=JZ($);W.json({projects:M,selectedProject:null});return}let H=XZ($,X.id,20),Q=zZ($,X.id,{limit:50}),Y=o($,X.id,10),U=d($,X.id),G=j($,X.id),O=g($,X.id);W.json({project:X,scoreHistory:H,violations:Q,recentDecisions:Y,trend:U,violationCounts:G,suggestions:O})}),Z.get("/api/health",(J,W)=>{W.json({status:"healthy",service:"claude-architect",timestamp:new Date().toISOString()})})}function Q0(Z){let $=E(),J=H0.Router();NZ(J,$),iZ(J,$),aZ(J,$),K0(J,$),X0(J,$),Z.use(J)}v();S();C();var w1=_Z(),VZ=w1.workerPort;function F1(){let Z=LZ.default();Z.use(LZ.default.json({limit:"1mb"})),Z.use((W,K,X)=>{let H=W.headers.origin,Q=[`http://localhost:${VZ}`,`http://127.0.0.1:${VZ}`];if(H&&Q.includes(H))K.header("Access-Control-Allow-Origin",H);if(K.header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE"),K.header("Access-Control-Allow-Headers","Content-Type"),W.method==="OPTIONS"){K.sendStatus(204);return}X()});let $=C0.join(wZ(),"ui");if(D0.existsSync($))Z.use(LZ.default.static($));Q0(Z),Z.use((W,K,X,H)=>{A.error("Unhandled route error",{error:W.message,stack:W.stack}),X.status(500).json({error:"Internal server error"})}),E();let J=Z.listen(VZ,()=>{A.info(`Worker server started on port ${VZ}`),process.stdout.write("Success")});process.on("SIGTERM",()=>{A.info("Shutting down worker server"),J.close(()=>p())}),process.on("SIGINT",()=>{J.close(()=>p())})}async function k1(Z){let $;switch(Z){case"session-init":$=await Promise.resolve().then(() => (O0(),U0));break;case"context":$=await Promise.resolve().then(() => (B0(),A0));break;case"post-change":$=await Promise.resolve().then(() => (V0(),_0));break;case"summarize":$=await Promise.resolve().then(() => (E0(),T0));break;case"session-complete":$=await Promise.resolve().then(() => (R0(),x0));break;default:A.error(`Unknown hook handler: ${Z}`),process.exit(1);return}await $.default()}(async()=>{let Z=process.argv[2];if(Z==="start")F1();else if(Z==="hook"){let $=process.argv[3];try{await k1($)}catch(J){A.error(`Hook handler "${$}" failed`,{error:J.message}),process.exit(1)}}else A.error(`Unknown command: ${Z}`),process.exit(1)})();})

//# debugId=DDF107B573E9C13664756E2164756E21
