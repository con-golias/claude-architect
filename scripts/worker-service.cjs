// @bun @bun-cjs
(function(exports, require, module, __filename, __dirname) {var F1=Object.create;var{getPrototypeOf:x1,defineProperty:mZ,getOwnPropertyNames:k1}=Object;var q1=Object.prototype.hasOwnProperty;function D1(Z){return this[Z]}var R1,C1,N1=(Z,$,J)=>{var K=Z!=null&&typeof Z==="object";if(K){var W=$?R1??=new WeakMap:C1??=new WeakMap,Q=W.get(Z);if(Q)return Q}J=Z!=null?F1(x1(Z)):{};let Y=$||!Z||!Z.__esModule?mZ(J,"default",{value:Z,enumerable:!0}):J;for(let H of k1(Z))if(!q1.call(Y,H))mZ(Y,H,{get:D1.bind(Z,H),enumerable:!0});if(K)W.set(Z,Y);return Y};var S1=(Z)=>Z;function I1(Z,$){this[Z]=S1.bind(null,$)}var a=(Z,$)=>{for(var J in $)mZ(Z,J,{get:$[J],enumerable:!0,configurable:!0,set:I1.bind($,J)})};var L=(Z,$)=>()=>(Z&&($=Z(Z=0)),$);function LZ(){return process.env.CLAUDE_PLUGIN_ROOT||y.resolve(__dirname,"..","..")}function I(){return process.env.CLAUDE_PROJECT_PATH||process.cwd()}function v1(){let Z=y.join(nZ.homedir(),y1);if(!AZ.existsSync(Z))AZ.mkdirSync(Z,{recursive:!0});return Z}function oZ(){return y.join(v1(),"architect.sqlite")}function t(){return y.join(LZ(),"rules")}function pZ(){return y.join(LZ(),"templates")}function _(Z){return y.normalize(Z).replace(/\\/g,"/")}function b(Z,$){let J=!1,K=!1,W=!1;for(let Q=0;Q<$&&Q<Z.length;Q++){if(Q>0&&Z[Q-1]==="\\")continue;let Y=Z[Q];if(Y==='"'&&!J&&!W)K=!K;else if(Y==="'"&&!K&&!W)J=!J;else if(Y==="`"&&!K&&!J)W=!W}return J||K||W}function E(Z,$){let J=new Bun.Glob(Z);return Array.from(J.scanSync({cwd:$,dot:!1}))}var nZ,y,AZ,__dirname="C:\\Users\\golia\\Desktop\\Projects\\claude-architect\\src\\utils",y1=".claude-architect";var M=L(()=>{nZ=require("os"),y=require("path"),AZ=require("fs")});function MZ(Z,$,J){if(rZ[Z]<rZ[f1])return;let K={timestamp:new Date().toISOString(),level:Z,service:"claude-architect",message:$,...J};process.stderr.write(JSON.stringify(K)+`
`)}var rZ,f1,A;var v=L(()=>{rZ={debug:0,info:1,warn:2,error:3},f1=process.env.ARCHITECT_LOG_LEVEL||"info";A={debug:(Z,$)=>MZ("debug",Z,$),info:(Z,$)=>MZ("info",Z,$),warn:(Z,$)=>MZ("warn",Z,$),error:(Z,$)=>MZ("error",Z,$)}});function aZ(Z){Z.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);let $=Z.query("SELECT version FROM schema_migrations ORDER BY version").all().map((J)=>J.version);for(let J of g1){if($.includes(J.version))continue;Z.run("BEGIN TRANSACTION");try{J.up(Z),Z.query("INSERT INTO schema_migrations (version, description, applied_at) VALUES (?, ?, ?)").run(J.version,J.description,Date.now()),Z.run("COMMIT")}catch(K){throw Z.run("ROLLBACK"),Error(`Migration ${J.version} failed: ${K.message}`)}}}var g1;var tZ=L(()=>{g1=[{version:1,description:"Core schema \u2014 projects, decisions, violations, sessions",up:(Z)=>{Z.run(`
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
      `)}},{version:2,description:"Performance indexes",up:(Z)=>{Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_project ON violations(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_resolved ON violations(resolved)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_severity ON violations(severity)"),Z.run("CREATE INDEX IF NOT EXISTS idx_violations_rule ON violations(rule_id)"),Z.run("CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id, started_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_changes_project ON structural_changes(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_snapshots_project ON compliance_snapshots(project_id, created_at DESC)"),Z.run("CREATE INDEX IF NOT EXISTS idx_rule_metrics_rule ON rule_metrics(rule_id)")}},{version:3,description:"Per-project manual rule configuration",up:(Z)=>{Z.run("ALTER TABLE projects ADD COLUMN enabled_manual_rules TEXT DEFAULT '[]'")}}]});function j1(Z){Z.run("PRAGMA journal_mode = WAL"),Z.run("PRAGMA synchronous = NORMAL"),Z.run("PRAGMA foreign_keys = ON"),Z.run("PRAGMA temp_store = MEMORY"),Z.run("PRAGMA mmap_size = 268435456"),Z.run("PRAGMA cache_size = 10000")}function k(Z){if(f)return f;let $=Z||oZ();return A.info("Opening database",{path:$}),f=new eZ.Database($,{create:!0}),j1(f),aZ(f),A.info("Database ready",{path:$}),f}function e(){if(f)f.close(),f=null,A.info("Database closed")}var eZ,f=null;var h=L(()=>{M();v();tZ();eZ=require("bun:sqlite")});function TZ(Z,$){let J=Date.now(),K=_($.path),W=Z.query("SELECT * FROM projects WHERE path = ?").get(K);if(W)return Z.query("UPDATE projects SET name = ?, tech_stack = ?, architecture_pattern = ?, updated_at = ? WHERE id = ?").run($.name,$.tech_stack??W.tech_stack,$.architecture_pattern??W.architecture_pattern,J,W.id),{...W,name:$.name,enabled_manual_rules:W.enabled_manual_rules??"[]",updated_at:J};return Z.query(`INSERT INTO projects (id, name, path, tech_stack, architecture_pattern, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`).run($.id,$.name,K,$.tech_stack??null,$.architecture_pattern??"clean",J,J),{id:$.id,name:$.name,path:K,tech_stack:$.tech_stack??null,architecture_pattern:$.architecture_pattern??"clean",enabled_manual_rules:"[]",created_at:J,updated_at:J}}function T(Z,$){return Z.query("SELECT * FROM projects WHERE path = ?").get(_($))}function dZ(Z,$){return Z.query("SELECT * FROM projects WHERE id = ?").get($)}function wZ(Z){return Z.query("SELECT * FROM projects ORDER BY updated_at DESC").all()}function EZ(Z,$){let J=Z.query("SELECT enabled_manual_rules FROM projects WHERE id = ?").get($);if(!J?.enabled_manual_rules)return[];try{let K=JSON.parse(J.enabled_manual_rules);return Array.isArray(K)?K:[]}catch{return[]}}function Z0(Z,$,J){let K=Date.now();Z.query("UPDATE projects SET enabled_manual_rules = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(J),K,$)}var D=L(()=>{M()});function FZ(Z,$){let K=Z.query(`INSERT INTO compliance_snapshots
       (project_id, session_id, overall_score, scores_by_category,
        total_features, total_files, total_violations,
        violations_by_severity, violations_by_rule, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.overallScore,JSON.stringify($.scoresByCategory),$.totalFeatures,$.totalFiles,$.totalViolations,JSON.stringify($.violationsBySeverity),JSON.stringify($.violationsByRule),Date.now());return Number(K.lastInsertRowid)}function xZ(Z,$){return Z.query("SELECT * FROM compliance_snapshots WHERE project_id = ? ORDER BY created_at DESC LIMIT 1").get($)}function kZ(Z,$,J=20){return Z.query(`SELECT * FROM compliance_snapshots WHERE project_id = ?
       ORDER BY created_at DESC LIMIT ?`).all($,J).reverse()}function ZZ(Z,$){let J=Z.query(`SELECT overall_score FROM compliance_snapshots
       WHERE project_id = ? ORDER BY created_at DESC LIMIT 5`).all($);if(J.length<2)return"stable";let K=J[0].overall_score,W=J[J.length-1].overall_score,Q=K-W;if(Q>3)return"improving";if(Q<-3)return"declining";return"stable"}function h1(Z){let $=_(Z).split("/");if($.includes("domain"))return"domain";if($.includes("application"))return"application";if($.includes("infrastructure"))return"infrastructure";return"unknown"}function u1(Z){let $=_(Z).match(/src\/features\/([^/]+)\//);return $?$[1]:null}function m1(Z){let $=[];for(let J of b1){let K=new RegExp(J.source,J.flags),W;while((W=K.exec(Z))!==null)$.push(W[1])}return $}function p1(Z){return Z.startsWith(".")}function J0(Z){let $=[],J=$Z.join(Z,"src");if(!qZ.existsSync(J))return{violations:[],filesScanned:0};let K=l1(J),W=0;for(let Q of K){W++;let Y=_($Z.relative(Z,Q)),H=h1(Y),X=u1(Y);if(H==="unknown")continue;let U;try{U=qZ.readFileSync(Q,"utf-8")}catch{continue}let G=m1(U);for(let O of G){if(!p1(O))continue;let B=d1(Y,O,H,X);if(B)$.push({...B,filePath:Y})}}return{violations:$,filesScanned:W}}function d1(Z,$,J,K){let W=_($);if(J==="domain"){if(W.includes("/application/")||W.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Domain layer imports from ${W.includes("/application/")?"application":"infrastructure"} layer: "${$}"`,suggestion:"Move the dependency to a port interface in domain/ and implement it in infrastructure/"}}if(J==="application"){if(W.includes("/infrastructure/"))return{ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",description:`Application layer imports from infrastructure layer: "${$}"`,suggestion:"Define a port interface in domain/ and inject the infrastructure implementation"}}if(K&&W.includes("/features/")){let Q=W.match(/features\/([^/]+)\//);if(Q&&Q[1]!==K)return{ruleId:"01-architecture",ruleName:"Cross-Feature Isolation",severity:"warning",category:"dependency",description:`Direct import from feature "${Q[1]}": "${$}"`,suggestion:"Use shared contracts in src/shared/contracts/ or domain events instead"}}return null}function l1(Z){let $=[],J=E("**/*.{ts,tsx,js,jsx}",Z);for(let K of J)if(!K.includes("node_modules")&&!K.includes(".test.")&&!K.includes(".spec."))$.push($Z.join(Z,K));return $}var qZ,$Z,b1;var K0=L(()=>{M();qZ=require("fs"),$Z=require("path"),b1=[/import\s+.*from\s+['"](.+)['"]/g,/import\s*\(\s*['"](.+)['"]\s*\)/g,/require\s*\(\s*['"](.+)['"]\s*\)/g]});function Q0(Z){let $=[],J=[],K=q.join(Z,"src","features");if(!F.existsSync(K))return{violations:[],filesScanned:0,features:[]};let W=F.readdirSync(K).filter((H)=>{let X=q.join(K,H);return F.statSync(X).isDirectory()&&!H.startsWith(".")}),Q=[];for(let H of W){let X=q.join(K,H),U=c1(X,H,$,Q);J.push(U)}if(Q.length>0)$.push({ruleId:"06-documentation",ruleName:"Feature README",severity:"info",category:"docs",description:`${Q.length} feature(s) missing README.md: ${Q.join(", ")}`,suggestion:"Run /architect-scaffold to generate README.md from template"});if(!F.existsSync(q.join(Z,"tsconfig.json")))$.push({ruleId:"03-quality",ruleName:"TypeScript Config",severity:"warning",category:"quality",filePath:"project root",description:"Missing tsconfig.json",suggestion:"Add TypeScript compiler configuration"});if(!F.existsSync(q.join(Z,"PROJECT_MAP.md")))$.push({ruleId:"06-documentation",ruleName:"PROJECT_MAP Required",severity:"warning",category:"docs",description:"Missing PROJECT_MAP.md at project root",suggestion:"Run /architect-init to generate PROJECT_MAP.md"});let Y=q.join(Z,"src","shared");if(F.existsSync(Y))i1(Y,Z,$);return{violations:$,filesScanned:W.length,features:J}}function c1(Z,$,J,K){let W=F.existsSync(q.join(Z,"domain")),Q=F.existsSync(q.join(Z,"application")),Y=F.existsSync(q.join(Z,"infrastructure")),H=F.existsSync(q.join(Z,"README.md")),X=F.existsSync(q.join(Z,"__tests__"))||s1(Z),U=W0.filter((O)=>!F.existsSync(q.join(Z,O)));if(U.length===W0.length)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:_(`src/features/${$}/`),description:"Flat structure \u2014 no clean architecture layers",suggestion:"Scaffold domain/application/infrastructure directories"});else if(U.length>0)J.push({ruleId:"01-architecture",ruleName:"Feature Structure",severity:"warning",category:"structure",filePath:_(`src/features/${$}/`),description:`Missing ${U.join(", ")} layer${U.length>1?"s":""}`,suggestion:`Add ${U.map((O)=>O+"/").join(", ")} with repository adapters`});if(!H)K.push($);if($!==$.toLowerCase()||$.includes("_"))J.push({ruleId:"15-code-style",ruleName:"Naming Convention",severity:"info",category:"structure",filePath:_(`src/features/${$}/`),description:`Feature directory "${$}" should use kebab-case`,suggestion:`Rename to "${n1($)}"`});let G=0;if(!W)G++;if(!Q)G++;if(!Y)G++;if(!H)G++;return{name:$,path:_(`src/features/${$}/`),hasReadme:H,hasDomain:W,hasApplication:Q,hasInfrastructure:Y,hasTests:X,violationCount:G}}function s1(Z){try{return E("**/*.{test,spec}.{ts,tsx,js,jsx}",Z).length>0}catch{return!1}}function i1(Z,$,J){try{let K=E("**/*.{ts,tsx,js,jsx}",Z);for(let W of K){if(W.includes("node_modules"))continue;let Y=(W.split("/").pop()||"").replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/,"");if(/^[A-Z]/.test(Y)&&!Y.includes("."))continue}}catch{}}function n1(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}var F,q,W0;var Y0=L(()=>{M();F=require("fs"),q=require("path"),W0=["domain","application","infrastructure"]});function G0(Z){let $=[],J=JZ.join(Z,"src"),K=0;try{let W=E("**/*.{ts,tsx,js,jsx,py}",J);for(let Q of W){if(r1.some((G)=>Q.includes(G)))continue;K++;let Y=JZ.join(J,Q),H=_(JZ.relative(Z,Y)),X;try{X=H0.readFileSync(Y,"utf-8")}catch{continue}let U=X.split(`
`);for(let G of o1){let O=new RegExp(G.pattern.source,G.pattern.flags),B;while((B=O.exec(X))!==null){let V=X.substring(0,B.index).split(`
`).length,z=U[V-1]?.trim()||"";if(z.startsWith("//")||z.startsWith("*"))continue;let x=B.index-X.lastIndexOf(`
`,B.index-1)-1;if(b(z,x))continue;$.push({ruleId:"02-security",ruleName:G.name,severity:G.severity,category:"security",filePath:H,lineNumber:V,description:G.description,suggestion:G.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var H0,JZ,o1,r1;var X0=L(()=>{M();H0=require("fs"),JZ=require("path"),o1=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected",suggestion:"Move to environment variable: process.env.API_KEY or use a secrets manager"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected",suggestion:"Move to environment variable or secrets manager. Never commit secrets to source code"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string concatenation/template literals",suggestion:"Use parameterized queries or prepared statements instead of string interpolation"},{name:"SQL Concatenation (plus operator)",pattern:/(?:query|exec|execute)\s*\(\s*['"].*['"]\s*\+\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"critical",description:"SQL query built with string concatenation using user input",suggestion:"Use parameterized queries: db.query('SELECT * FROM x WHERE id = ?', [id])"},{name:"Dangerous innerHTML",pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{.*__html.*\}\s*\}/gi,severity:"warning",description:"Use of dangerouslySetInnerHTML \u2014 potential XSS vulnerability",suggestion:"Sanitize content with DOMPurify before rendering, or use safe alternatives"},{name:"innerHTML Assignment",pattern:/\.innerHTML\s*=\s*(?!['"]<)/gi,severity:"warning",description:"Direct innerHTML assignment with dynamic content \u2014 XSS risk",suggestion:"Use textContent for text, or sanitize HTML before assigning to innerHTML"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability",suggestion:"Never use eval(). Use JSON.parse() for data, or safer alternatives for dynamic code"},{name:"Disabled HTTPS Verification",pattern:/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0['"]?|rejectUnauthorized\s*:\s*false/gi,severity:"critical",description:"TLS/SSL certificate verification is disabled",suggestion:"Never disable certificate verification in production. Fix the certificate issue instead"},{name:"Wildcard CORS",pattern:/(?:cors|Access-Control-Allow-Origin)\s*[:=]\s*['"]?\*['"]?/gi,severity:"warning",description:"CORS allows all origins (*) \u2014 overly permissive",suggestion:"Configure CORS with explicit origin allowlist instead of wildcard"},{name:"Console.log in Production",pattern:/console\.(log|debug|trace)\s*\(/g,severity:"info",description:"console.log found \u2014 use structured logging in production",suggestion:"Replace with structured logger (e.g., winston, pino) for production code"}],r1=["node_modules",".test.",".spec.","__tests__",".d.ts",".min.js","dist/","build/","coverage/"]});function O0(Z){let $=[],J=N.join(Z,"src");if(!KZ.existsSync(J))return{violations:[],filesScanned:0};let K=0,W=[];try{let Q=E("**/*.{ts,tsx,js,jsx}",J);for(let Y of Q){if(Y.includes("node_modules")||Y.includes(".d.ts")||Y.includes("dist/"))continue;K++;let H=N.join(J,Y),X=_(N.relative(Z,H)),U;try{U=KZ.readFileSync(H,"utf-8")}catch{continue}let G=U.split(`
`);if(G.length>U0)$.push({ruleId:"15-code-style",ruleName:"File Size Limit",severity:"warning",category:"quality",filePath:X,description:`File has ${G.length} lines (max ${U0})`,suggestion:"Split into smaller focused modules. Extract helper functions or sub-components."});if(a1(U,X,$),t1(U,X,$),!Y.includes(".test.")&&!Y.includes(".spec.")&&!Y.includes("__tests__")&&Z4(U)){if(!e1(H))W.push(X)}}}catch{}if(W.length>0){let Q=K-W.length;$.push({ruleId:"03-testing",ruleName:"Test Coverage",severity:"info",category:"quality",description:`No test files found (${Q} of ${K} source files have tests)`,suggestion:`Create test files for: ${W.map((Y)=>N.basename(Y)).join(", ")}`})}return{violations:$,filesScanned:K}}function a1(Z,$,J){let K=/^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"]/gm,W;while((W=K.exec(Z))!==null){let Q=Z.substring(0,W.index).split(`
`).length,Y=W[1].split(",").map((X)=>X.trim().split(" as ").pop().trim()).filter(Boolean),H=Z.substring(W.index+W[0].length);for(let X of Y)if(!new RegExp(`\\b${X}\\b`).test(H))J.push({ruleId:"03-quality",ruleName:"Unused Import",severity:"warning",category:"quality",filePath:$,lineNumber:Q,description:`Unused import ${X}`,suggestion:"Remove the import"})}}function t1(Z,$,J){let K=Z.split(`
`),W=0,Q=0;for(let Y=0;Y<K.length;Y++){let H=K[Y].trim();if(H.startsWith("//")&&!H.startsWith("///")&&!H.startsWith("// @")){if(W===0)Q=Y+1;W++}else{if(W>=5)J.push({ruleId:"15-code-style",ruleName:"Commented-Out Code",severity:"info",category:"quality",filePath:$,lineNumber:Q,description:`${W} consecutive commented lines \u2014 likely commented-out code`,suggestion:"Remove commented-out code. Use version control to recover old code."});W=0}}}function e1(Z){let $=N.dirname(Z),J=N.basename(Z),K=[".test.ts",".test.tsx",".spec.ts",".spec.tsx",".test.js",".spec.js"],W=J.replace(/\.(ts|tsx|js|jsx)$/,"");return K.some((Q)=>KZ.existsSync(N.join($,W+Q)))}function Z4(Z){return/^export\s+/m.test(Z)}var KZ,N,U0=200;var B0=L(()=>{M();KZ=require("fs"),N=require("path")});function z0(Z){let $=[],J=S.join(Z,"src"),K=0;try{let W=E("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(J4.some((G)=>Q.includes(G)))continue;K++;let Y=S.join(J,Q),H=_(S.relative(Z,Y)),X;try{X=j.readFileSync(Y,"utf-8")}catch{continue}let U=X.split(`
`);for(let G of $4){let O=new RegExp(G.pattern.source,G.pattern.flags),B;while((B=O.exec(X))!==null){let V=X.substring(0,B.index).split(`
`).length,z=U[V-1]?.trim()||"";if(z.startsWith("//")||z.startsWith("*"))continue;let x=B.index-X.lastIndexOf(`
`,B.index-1)-1;if(b(z,x))continue;$.push({ruleId:G.ruleId,ruleName:G.name,severity:G.severity,category:"security",filePath:H,lineNumber:V,description:G.description,suggestion:G.suggestion})}}}}catch{}return K4(Z,$),{violations:$,filesScanned:K}}function K4(Z,$){if(!(j.existsSync(S.join(Z,"package-lock.json"))||j.existsSync(S.join(Z,"bun.lockb"))||j.existsSync(S.join(Z,"yarn.lock"))||j.existsSync(S.join(Z,"pnpm-lock.yaml")))&&j.existsSync(S.join(Z,"package.json")))$.push({ruleId:"30-supply-chain-security",ruleName:"Missing Lock File",severity:"warning",category:"security",description:"No lock file found \u2014 dependency versions are not pinned",suggestion:"Run npm install / bun install to generate a lock file and commit it"});try{let W=j.readFileSync(S.join(Z,"package.json"),"utf-8").match(/"[^"]+"\s*:\s*"(\*|latest)"/g);if(W&&W.length>0)$.push({ruleId:"30-supply-chain-security",ruleName:"Unpinned Dependencies",severity:"warning",category:"security",description:`${W.length} dependency(ies) use wildcard (*) or "latest" version`,suggestion:"Pin all dependencies to specific versions or version ranges"})}catch{}}var j,S,$4,J4;var V0=L(()=>{M();j=require("fs"),S=require("path"),$4=[{name:"Path Traversal",pattern:/(?:readFile|writeFile|createReadStream|open|access)\w*\s*\([^)]*(?:req\.|params\.|query\.|body\.)/gi,severity:"critical",ruleId:"17-owasp-top-ten",description:"User input used directly in file system operation \u2014 path traversal risk (A01)",suggestion:"Validate and sanitize file paths. Use path.resolve() and verify the result is within allowed directory"},{name:"SSRF Risk",pattern:/(?:fetch|axios|http\.get|https\.get|request)\s*\(\s*(?:req\.|params\.|query\.|body\.|`\$\{)/gi,severity:"critical",ruleId:"17-owasp-top-ten",description:"User input used in outbound HTTP request \u2014 SSRF risk (A10)",suggestion:"Validate URLs against an allowlist of trusted domains before making requests"},{name:"Mass Assignment",pattern:/(?:create|update|insert|save|findOneAnd|updateOne)\s*\(\s*(?:\.\.\.\s*req\.body|req\.body\b)/gi,severity:"warning",ruleId:"17-owasp-top-ten",description:"Request body spread directly into database operation \u2014 mass assignment risk (A01)",suggestion:"Explicitly pick allowed fields instead of spreading req.body directly"},{name:"Insecure Deserialization",pattern:/(?:JSON\.parse|deserialize|unserialize|pickle\.loads)\s*\(\s*(?:req\.|params\.|body\.|query\.)/gi,severity:"warning",ruleId:"17-owasp-top-ten",description:"Untrusted input passed to deserialization \u2014 injection risk (A08)",suggestion:"Validate and sanitize input before deserialization. Use schema validation (Zod, Joi)"},{name:"Missing Rate Limiting",pattern:/router\.(post|put|patch|delete)\s*\(\s*['"][^'"]*(?:login|auth|register|password|reset|token|signup)/gi,severity:"info",ruleId:"17-owasp-top-ten",description:"Sensitive endpoint without apparent rate limiting (A07)",suggestion:"Add rate limiting middleware to authentication and sensitive endpoints"}],J4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function A0(Z){let $=[],J=WZ.join(Z,"src"),K=0;try{let W=E("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(Q4.some((G)=>Q.includes(G)))continue;K++;let Y=WZ.join(J,Q),H=_(WZ.relative(Z,Y)),X;try{X=_0.readFileSync(Y,"utf-8")}catch{continue}let U=X.split(`
`);for(let G of W4){let O=new RegExp(G.pattern.source,G.pattern.flags),B;while((B=O.exec(X))!==null){let V=X.substring(0,B.index).split(`
`).length,z=U[V-1]?.trim()||"";if(z.startsWith("//")||z.startsWith("*"))continue;let x=B.index-X.lastIndexOf(`
`,B.index-1)-1;if(b(z,x))continue;$.push({ruleId:"18-data-privacy",ruleName:G.name,severity:G.severity,category:"security",filePath:H,lineNumber:V,description:G.description,suggestion:G.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var _0,WZ,W4,Q4;var L0=L(()=>{M();_0=require("fs"),WZ=require("path"),W4=[{name:"PII in Logs",pattern:/(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*(?:email|ssn|social.?security|credit.?card|phone.?number|passport|national.?id)/gi,severity:"critical",description:"Potentially logging PII (email, SSN, credit card, phone) \u2014 GDPR/privacy violation",suggestion:"Mask or redact PII before logging. Use a structured logger with PII sanitization"},{name:"PII in URL Params",pattern:/(?:url|href|redirect|location|navigate)\s*(?:=|\+=|:)\s*[`'"][^`'"]*\$\{[^}]*(?:email|password|ssn|token|secret)/gi,severity:"warning",description:"Sensitive data included in URL parameters \u2014 visible in logs, history, and referrers",suggestion:"Send sensitive data in request body or headers, never in URL query parameters"},{name:"Unencrypted PII Storage",pattern:/(?:localStorage|sessionStorage|cookie|setCookie)\s*(?:\.\w+\s*\(|\[)[^)]*(?:password|ssn|credit.?card|social.?security)/gi,severity:"critical",description:"Sensitive data stored in browser storage without encryption",suggestion:"Never store passwords, SSN, or credit cards in localStorage/cookies. Use encrypted server-side sessions"},{name:"Email Regex in Log",pattern:/(?:console\.\w+|logger\.\w+|log\.\w+)\s*\([^)]*[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,severity:"warning",description:"Hardcoded email address found in logging statement",suggestion:"Remove email addresses from log statements to protect privacy"}],Q4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function T0(Z){let $=[],J=QZ.join(Z,"src"),K=0;try{let W=E("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(H4.some((U)=>Q.includes(U)))continue;K++;let Y=QZ.join(J,Q),H=_(QZ.relative(Z,Y)),X;try{X=M0.readFileSync(Y,"utf-8")}catch{continue}for(let U of Y4){let G=new RegExp(U.pattern.source,U.pattern.flags),O;while((O=G.exec(X))!==null){let B=X.substring(0,O.index).split(`
`).length,V=X.split(`
`)[B-1]?.trim()||"";if(V.startsWith("//")||V.startsWith("*"))continue;$.push({ruleId:"20-concurrency",ruleName:U.name,severity:U.severity,category:"quality",filePath:H,lineNumber:B,description:U.description,suggestion:U.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var M0,QZ,Y4,H4;var w0=L(()=>{M();M0=require("fs"),QZ=require("path"),Y4=[{name:"Missing Await",pattern:/(?:^|\n)\s*(?!return\b)(?!await\b)(?!const\b)(?!let\b)(?!var\b)(?!if\b)(?!throw\b)\w+\.\b(?:save|update|delete|create|insert|remove|destroy|findOne|findMany)\s*\(/gm,severity:"info",description:"Async database operation may be missing await",suggestion:"Add await before async operations to ensure proper execution order"},{name:"Promise.all Without Catch",pattern:/Promise\.all\s*\([^)]+\)\s*(?!\.catch|\.then\([^,]+,[^)]+\))(?:\s*;|\s*$)/gm,severity:"warning",description:"Promise.all without error handling \u2014 one rejection crashes all",suggestion:"Use Promise.allSettled() or add .catch() / try-catch around Promise.all"},{name:"Shared Mutable State",pattern:/^(?:export\s+)?let\s+\w+\s*(?::\s*(?:Map|Set|Array|Record|object|\{)|\s*=\s*(?:new\s+(?:Map|Set)|(?:\[|\{)))/gm,severity:"warning",description:"Module-level mutable collection \u2014 potential race condition in concurrent access",suggestion:"Use const with immutable patterns, or isolate state in a class instance"},{name:"Timer Without Cleanup",pattern:/(?:setInterval|setTimeout)\s*\([^)]+\)\s*;?\s*(?:\n|$)(?!.*(?:clearInterval|clearTimeout|\.unref))/gm,severity:"info",description:"Timer created without storing reference for cleanup",suggestion:"Store timer reference and clear it in cleanup/dispose: const timer = setInterval(...); // clearInterval(timer)"},{name:"Async Void Function",pattern:/(?:addEventListener|on\w+)\s*\(\s*['"][^'"]+['"]\s*,\s*async\s/g,severity:"info",description:"Async event handler \u2014 errors may be silently swallowed",suggestion:"Wrap async event handlers in try-catch to prevent unhandled rejections"}],H4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function F0(Z){let $=[],J=YZ.join(Z,"src"),K=0;try{let W=E("**/*.{tsx,jsx,html,vue}",J);for(let Q of W){if(X4.some((G)=>Q.includes(G)))continue;K++;let Y=YZ.join(J,Q),H=_(YZ.relative(Z,Y)),X;try{X=E0.readFileSync(Y,"utf-8")}catch{continue}let U=X.split(`
`);for(let G of G4){let O=new RegExp(G.pattern.source,G.pattern.flags),B;while((B=O.exec(X))!==null){let V=X.substring(0,B.index).split(`
`).length,z=U[V-1]?.trim()||"";if(z.startsWith("//")||z.startsWith("*")||z.startsWith("{/*"))continue;$.push({ruleId:"22-accessibility",ruleName:G.name,severity:G.severity,category:"quality",filePath:H,lineNumber:V,description:G.description,suggestion:G.suggestion})}}}}catch{}return{violations:$,filesScanned:K}}var E0,YZ,G4,X4;var x0=L(()=>{M();E0=require("fs"),YZ=require("path"),G4=[{name:"Image Without Alt",pattern:/<img\s(?![^>]*\balt\s*=)[^>]*>/gi,severity:"warning",description:"Image element without alt attribute \u2014 screen readers cannot describe it",suggestion:'Add alt="descriptive text" or alt="" for decorative images'},{name:"Click Without Keyboard",pattern:/onClick\s*=\s*\{(?![^}]*(?:onKeyDown|onKeyUp|onKeyPress|role))/gi,severity:"warning",description:"Click handler without keyboard event \u2014 not accessible via keyboard navigation",suggestion:"Add onKeyDown handler and role='button' for non-button clickable elements"},{name:"Interactive Without ARIA",pattern:/<(?:div|span)\s+(?=[^>]*onClick)[^>]*(?<!aria-label\s*=\s*"[^"]*")[^>]*>/gi,severity:"info",description:"Interactive div/span without aria-label \u2014 purpose unclear to assistive technology",suggestion:"Add aria-label or use semantic HTML elements (button, a) instead"},{name:"Input Without Label",pattern:/<input\s(?![^>]*(?:aria-label|aria-labelledby|id\s*=\s*"[^"]*"))[^>]*>/gi,severity:"warning",description:"Form input without associated label or aria-label",suggestion:'Add <label htmlFor="id"> or aria-label attribute to the input'},{name:"Missing Lang Attribute",pattern:/<html\s(?![^>]*\blang\s*=)[^>]*>/gi,severity:"warning",description:"HTML element missing lang attribute \u2014 affects screen reader pronunciation",suggestion:'Add lang="en" (or appropriate language code) to the <html> element'},{name:"AutoFocus Usage",pattern:/\bautoFocus\b|\bautofocus\b/gi,severity:"info",description:"autoFocus can disorient screen reader users and break navigation flow",suggestion:"Avoid autoFocus. Manage focus programmatically only when necessary"}],X4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function GZ(Z,$,J,K,W,Q,Y){return{ruleId:Z,ruleName:$,severity:J,category:"quality",filePath:K,lineNumber:Y,description:W,suggestion:Q}}function R0(Z){let $=[],J=HZ.join(Z,"src"),K=0;try{let W=E("**/*.{ts,tsx,js,jsx}",J);for(let Q of W){if(O4.some((G)=>Q.includes(G)))continue;K++;let Y=HZ.join(J,Q),H=_(HZ.relative(Z,Y)),X;try{X=D0.readFileSync(Y,"utf-8")}catch{continue}let U=X.split(`
`);B4(U,H,$),z4(X,H,$),V4(U,H,$),_4(X,U,H,$),A4(U,H,$)}}catch{}return{violations:$,filesScanned:K}}function B4(Z,$,J){let K=0,W=0,Q=0;for(let Y=0;Y<Z.length;Y++){let H=Z[Y].trim();if(H.startsWith("//")||H.startsWith("*"))continue;for(let X of H)if(X==="{"){if(K++,K>W)W=K,Q=Y+1}else if(X==="}")K=Math.max(0,K-1)}if(W>k0)J.push(GZ("26-advanced-code-quality","Deep Nesting","warning",$,`Nesting depth of ${W} exceeds maximum of ${k0}`,"Extract nested logic into helper functions or use early returns to reduce nesting",Q))}function z4(Z,$,J){let K=/(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=]+=>)|\w+\s*\([^)]*\)\s*(?::\s*\w+\s*)?\{)/g,W;while((W=K.exec(Z))!==null){let Q=W[0].indexOf("(");if(Q===-1)continue;let Y=Z.substring(W.index+Q),H=L4(Y);if(H<=1)continue;let U=Y.substring(1,H).split(",").filter((G)=>G.trim().length>0).length;if(U>q0){let G=Z.substring(0,W.index).split(`
`).length;J.push(GZ("26-advanced-code-quality","Long Parameter List","info",$,`Function has ${U} parameters (max ${q0})`,"Group related parameters into an options object",G))}}}function V4(Z,$,J){let K=0;for(let W of Z)if(/\b(?:TODO|FIXME|HACK|XXX)\b/i.test(W))K++;if(K>U4)J.push(GZ("26-advanced-code-quality","TODO Density","info",$,`${K} TODO/FIXME/HACK comments \u2014 indicates accumulated technical debt`,"Address or create tickets for TODO items. Remove resolved TODOs"))}function _4(Z,$,J,K){let W=[{pattern:/(?:https?:\/\/(?!localhost|127\.0\.0\.1|example\.com)[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-z]{2,})/g,name:"Hardcoded URL"},{pattern:/(?:port|PORT)\s*[:=]\s*(\d{4,5})\b/g,name:"Hardcoded Port"},{pattern:/['"](\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!\.0\.1)['"]/g,name:"Hardcoded IP"}];for(let{pattern:Q,name:Y}of W){let H=new RegExp(Q.source,Q.flags),X;while((X=H.exec(Z))!==null){let U=Z.substring(0,X.index).split(`
`).length,G=$[U-1]?.trim()||"";if(G.startsWith("//")||G.startsWith("*"))continue;K.push(GZ("29-configuration-hygiene",Y,"info",J,`${Y} detected \u2014 should be in configuration/environment variable`,"Move to environment variable or configuration file",U))}}}function A4(Z,$,J){let K=new Set(["0","1","-1","2","100","1000","200","201","400","401","403","404","500"]),W=0;for(let Q=0;Q<Z.length;Q++){let Y=Z[Q].trim();if(Y.startsWith("//")||Y.startsWith("*")||Y.startsWith("import"))continue;if(/(?:const|let|var)\s+\w+\s*=\s*-?\d+\s*;/.test(Y))continue;let H=Y.match(/(?<![a-zA-Z_$.])\b(\d{3,})\b(?!["'`])/g);if(H){for(let X of H)if(!K.has(X))W++}}if(W>3)J.push(GZ("26-advanced-code-quality","Magic Numbers","info",$,`${W} magic numbers found \u2014 extract to named constants`,"Define meaningful constants: const MAX_RETRIES = 3; const TIMEOUT_MS = 5000;"))}function L4(Z){let $=0;for(let J=0;J<Z.length;J++)if(Z[J]==="(")$++;else if(Z[J]===")"){if($--,$===0)return J}return-1}var D0,HZ,k0=4,q0=4,U4=5,O4;var C0=L(()=>{M();D0=require("fs"),HZ=require("path"),O4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function S0(Z){let $=[],J=XZ.join(Z,"src"),K=0;try{let W=E("**/*.{ts,js}",J);for(let Q of W){if(M4.some((G)=>Q.includes(G)))continue;let Y=XZ.join(J,Q),H=_(XZ.relative(Z,Y)),X;try{X=N0.readFileSync(Y,"utf-8")}catch{continue}if(!T4(X,Q))continue;K++;let U=X.split(`
`);w4(X,U,H,$),E4(X,U,H,$),F4(X,H,$),x4(X,U,H,$)}}catch{}return{violations:$,filesScanned:K}}function T4(Z,$){let J=/(?:route|controller|handler|endpoint|api)/i.test($),K=/router\.\w+\s*\(|app\.\w+\s*\(|@(?:Get|Post|Put|Delete|Patch)\b/i.test(Z);return J||K}function w4(Z,$,J,K){let W=/(?:router|app)\.\w+\s*\(\s*['"]([^'"]+)['"]/g,Q;while((Q=W.exec(Z))!==null){let H=Q[1].split("/").filter((X)=>X&&!X.startsWith(":"));for(let X of H)if(X!==X.toLowerCase()||X.includes("_")){let U=Z.substring(0,Q.index).split(`
`).length;K.push({ruleId:"28-advanced-api-patterns",ruleName:"Route Naming",severity:"info",category:"structure",filePath:J,lineNumber:U,description:`Route path segment "${X}" should use kebab-case`,suggestion:`Rename to "${X.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/_/g,"-").toLowerCase()}"`});break}}}function E4(Z,$,J,K){let W=/(?:router|app)\.(post|put|patch)\s*\(\s*['"]([^'"]+)['"]/g,Q;while((Q=W.exec(Z))!==null){let Y=Q[1],H=Q[2],X=Z.substring(0,Q.index).split(`
`).length,U=$.slice(X-1,X+30).join(`
`);if(!/(?:validate|schema|zod|joi|yup|ajv|\.parse\(|\.safeParse\(|typeof\s+\w+\s*!==|if\s*\(\s*!\w+)/i.test(U))K.push({ruleId:"28-advanced-api-patterns",ruleName:"Missing Input Validation",severity:"warning",category:"structure",filePath:J,lineNumber:X,description:`${Y.toUpperCase()} ${H} \u2014 no input validation detected`,suggestion:"Add request body validation using Zod, Joi, or manual type checks"})}}function F4(Z,$,J){if(!/(?:router|app)\.\w+\s*\(/g.test(Z))return;let W=/try\s*\{/.test(Z),Q=/err(?:or)?\s*(?:,\s*req|:\s*Error)/i.test(Z),Y=/\.status\s*\(\s*(?:4\d{2}|5\d{2})\s*\)/.test(Z);if(!W&&!Q&&!Y)J.push({ruleId:"28-advanced-api-patterns",ruleName:"Missing Error Handling",severity:"warning",category:"structure",filePath:$,description:"Route file has no error handling (no try-catch, error middleware, or error responses)",suggestion:"Add try-catch blocks or error middleware to handle failures gracefully"})}function x4(Z,$,J,K){let W=Z.match(/res\.json\s*\(/g),Q=Z.match(/res\.send\s*\(/g);if(W&&Q){let Y=W.length,H=Q.length;if(Y>0&&H>0&&Math.min(Y,H)>1)K.push({ruleId:"28-advanced-api-patterns",ruleName:"Inconsistent Response Format",severity:"info",category:"structure",filePath:J,description:`Mixed response methods: ${Y} res.json() and ${H} res.send()`,suggestion:"Use res.json() consistently for API endpoints"})}}var N0,XZ,M4;var I0=L(()=>{M();N0=require("fs"),XZ=require("path"),M4=["node_modules",".test.",".spec.","__tests__",".d.ts","dist/","build/","coverage/"]});function v0(Z){if(Z.length===0)return 100;let $=0;for(let J of Z){let K=k4[J.category]??0.15,W=y0[J.severity]??1;$+=W*K}return Math.max(0,Math.round(100-$))}function f0(Z){let $=["dependency","structure","security","quality","docs"],J={};for(let K of $){let W=Z.filter((Y)=>Y.category===K),Q=0;for(let Y of W)Q+=y0[Y.severity]??1;J[K]=Math.max(0,Math.round(100-Q))}return J}function DZ(Z){let $={critical:0,warning:0,info:0};for(let J of Z)$[J.severity]=($[J.severity]??0)+1;return $}function RZ(Z){let $={};for(let J of Z)$[J.ruleId]=($[J.ruleId]??0)+1;return $}var k4,y0;var CZ=L(()=>{k4={dependency:0.25,structure:0.2,security:0.25,quality:0.2,docs:0.1},y0={critical:10,warning:3,info:1}});function sZ(Z,$){let J=[],K=NZ.basename($);if(/\.(test|spec)\./i.test(K)||!/\.(ts|tsx|js|jsx)$/i.test(K))return J;let W;try{W=g0.readFileSync($,"utf-8")}catch{return J}let Q=_(NZ.relative(Z,$)),Y=W.split(`
`);if(Y.length>200)J.push({ruleId:"15-code-style",ruleName:"File Too Long",severity:"warning",category:"quality",filePath:Q,description:`File has ${Y.length} lines (limit: 200)`,suggestion:"Split into smaller, focused modules"});for(let U of q4){let G=new RegExp(U.pattern.source,U.pattern.flags),O;while((O=G.exec(W))!==null){let B=W.substring(0,O.index).split(`
`).length,V=Y[B-1]?.trim()||"";if(V.startsWith("//")||V.startsWith("*"))continue;let z=O.index-W.lastIndexOf(`
`,O.index-1)-1;if(b(V,z))continue;J.push({ruleId:"02-security",ruleName:U.name,severity:U.severity,category:"security",filePath:Q,lineNumber:B,description:U.description})}}let X=_(Q).match(/\/(?:domain|application|infrastructure)\//);if(X){let U=X[0].replace(/\//g,""),G=D4[U];if(G)for(let O of Y){let B=O.match(/(?:import|from)\s+['"]([^'"]+)['"]/);if(!B)continue;let V=B[1];for(let z of G)if(V.includes(`/${z}/`)||V.includes(`\\${z}\\`)){J.push({ruleId:"01-architecture",ruleName:"Dependency Direction",severity:"critical",category:"dependency",filePath:Q,description:`${U} layer imports from ${z} (forbidden)`,suggestion:`Define a port interface in ${U}/ and implement in ${z}/`});break}}}return J}var g0,NZ,q4,D4;var j0=L(()=>{M();g0=require("fs"),NZ=require("path"),q4=[{name:"Hardcoded API Key",pattern:/(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{10,}['"]/gi,severity:"critical",description:"Potential hardcoded API key detected"},{name:"Hardcoded Secret",pattern:/(?:secret|password|passwd|token|auth_token|access_token|private_key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,severity:"critical",description:"Potential hardcoded secret/password detected"},{name:"SQL String Concatenation",pattern:/(?:query|sql|exec|execute|raw|stmt|statement)\s*(?:=|:\s*|\()\s*[`'"].*\$\{.*\}.*[`'"]/gi,severity:"critical",description:"Potential SQL injection via string interpolation"},{name:"eval() Usage",pattern:/\beval\s*\(/gi,severity:"critical",description:"Use of eval() \u2014 code injection vulnerability"}],D4={domain:["infrastructure","application"],application:["infrastructure"]}});function SZ(Z,$={}){let J=Date.now();A.info("Starting validation",{projectPath:Z});let K=[],W=[],Q=0;if(UZ("dependency",$.categories)){let U=J0(Z);K.push(...U.violations),Q+=U.filesScanned}if(UZ("structure",$.categories)){let U=Q0(Z);K.push(...U.violations),W=U.features;let G=S0(Z);K.push(...G.violations),Q=Math.max(Q,G.filesScanned)}if(UZ("security",$.categories)){let U=G0(Z);K.push(...U.violations),Q=Math.max(Q,U.filesScanned);let G=z0(Z);K.push(...G.violations);let O=A0(Z);K.push(...O.violations)}if(UZ("quality",$.categories)||UZ("docs",$.categories)){let U=O0(Z);K.push(...U.violations),Q=Math.max(Q,U.filesScanned);let G=T0(Z);K.push(...G.violations);let O=F0(Z);K.push(...O.violations);let B=R0(Z);K.push(...B.violations)}if($.severity){let U={critical:0,warning:1,info:2},G=U[$.severity];K=K.filter((O)=>U[O.severity]<=G)}let Y=v0(K),H=f0(K),X=Date.now()-J;return A.info("Validation complete",{projectPath:Z,score:Y,violations:K.length,duration:X}),{overallScore:Y,scoresByCategory:H,totalFeatures:W.length,totalFiles:Q,violations:K,featureMap:W,trend:"stable",timestamp:Date.now()}}function UZ(Z,$){if(!$||$.length===0)return!0;return $.includes(Z)}var IZ=L(()=>{K0();Y0();X0();B0();V0();L0();w0();x0();C0();I0();CZ();v();j0()});function h0(Z,$){let K=Z.query(`INSERT INTO decisions
       (project_id, session_id, title, status, context, decision, alternatives,
        consequences_positive, consequences_negative, tags, created_at)
     VALUES (?, ?, ?, 'accepted', ?, ?, ?, ?, ?, ?, ?)`).run($.projectId,$.sessionId??null,$.title,$.context??null,$.decision,$.alternatives?JSON.stringify($.alternatives):null,$.consequencesPositive?JSON.stringify($.consequencesPositive):null,$.consequencesNegative?JSON.stringify($.consequencesNegative):null,$.tags?JSON.stringify($.tags):null,Date.now());return Number(K.lastInsertRowid)}function vZ(Z,$){return Z.query("SELECT * FROM decisions WHERE id = ?").get($)}function m(Z,$,J={}){let K=["project_id = ?"],W=[$];if(J.query){K.push("(title LIKE ? OR decision LIKE ? OR context LIKE ?)");let X=`%${J.query}%`;W.push(X,X,X)}if(J.status)K.push("status = ?"),W.push(J.status);let Q=Math.min(J.limit??20,100),Y=J.offset??0,H=`
    SELECT * FROM decisions
    WHERE ${K.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;return W.push(Q,Y),Z.query(H).all(...W)}function OZ(Z,$,J=5){return Z.query("SELECT * FROM decisions WHERE project_id = ? ORDER BY created_at DESC LIMIT ?").all($,J)}function u0(Z,$){let K=Z.query(`INSERT INTO violations
       (project_id, session_id, rule_id, rule_name, severity, category,
        file_path, line_number, description, suggestion, resolved, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`).run($.projectId,$.sessionId??null,$.ruleId,$.ruleName,$.severity,$.category,$.filePath??null,$.lineNumber??null,$.description,$.suggestion??null,Date.now());return Number(K.lastInsertRowid)}function fZ(Z,$,J={}){let K=["project_id = ?","resolved = 0"],W=[$];if(J.severity)K.push("severity = ?"),W.push(J.severity);if(J.category)K.push("category = ?"),W.push(J.category);if(J.ruleId)K.push("rule_id = ?"),W.push(J.ruleId);let Q=Math.min(J.limit??50,200);return W.push(Q),Z.query(`SELECT * FROM violations WHERE ${K.join(" AND ")}
       ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC
       LIMIT ?`).all(...W)}function m0(Z,$,J="manual"){Z.query("UPDATE violations SET resolved = 1, resolved_at = ?, resolved_by = ? WHERE id = ?").run(Date.now(),J,$)}function p(Z,$){let J=Z.query(`SELECT severity, COUNT(*) as count FROM violations
       WHERE project_id = ? AND resolved = 0
       GROUP BY severity`).all($),K={critical:0,warning:0,info:0};for(let W of J)if(W.severity in K)K[W.severity]=W.count;return K}function BZ(Z,$,J={}){let K=["project_id = ?"],W=[$];if(J.query){K.push("(description LIKE ? OR file_path LIKE ? OR rule_name LIKE ?)");let Y=`%${J.query}%`;W.push(Y,Y,Y)}if(J.resolved!==void 0)K.push("resolved = ?"),W.push(J.resolved?1:0);let Q=Math.min(J.limit??20,100);return W.push(Q,J.offset??0),Z.query(`SELECT * FROM violations WHERE ${K.join(" AND ")}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...W)}function d0(Z,$,J,K){Z.query(`INSERT OR IGNORE INTO sessions
       (id, project_id, started_at, compliance_score_before, decisions_made, violations_found, violations_resolved)
     VALUES (?, ?, ?, ?, 0, 0, 0)`).run($,J,Date.now(),K??null)}function l0(Z,$,J){Z.query(`UPDATE sessions SET
       completed_at = ?,
       summary = ?,
       features_added = ?,
       files_changed = ?,
       decisions_made = ?,
       violations_found = ?,
       violations_resolved = ?,
       compliance_score_after = ?
     WHERE id = ?`).run(Date.now(),J.summary??null,J.featuresAdded?JSON.stringify(J.featuresAdded):null,J.filesChanged?JSON.stringify(J.filesChanged):null,J.decisionsMade??0,J.violationsFound??0,J.violationsResolved??0,J.complianceScoreAfter??null,$)}function c0(Z,$){return Z.query("SELECT * FROM sessions WHERE id = ?").get($)}function gZ(Z,$,J=10){return Z.query("SELECT * FROM sessions WHERE project_id = ? ORDER BY started_at DESC LIMIT ?").all($,J)}function n(Z,$){return Z.query("SELECT COUNT(*) as count FROM sessions WHERE project_id = ?").get($)?.count??0}function s0(Z,$,J=null){let K=Date.now(),W=Z.query("SELECT * FROM rule_metrics WHERE rule_id = ? AND project_id IS ?").get($,J);if(W)Z.query(`UPDATE rule_metrics SET
         total_violations = total_violations + 1,
         last_violation_at = ?,
         updated_at = ?
       WHERE id = ?`).run(K,K,W.id);else Z.query(`INSERT INTO rule_metrics
         (project_id, rule_id, total_violations, resolved_violations,
          ignored_violations, last_violation_at, updated_at)
       VALUES (?, ?, 1, 0, 0, ?, ?)`).run(J,$,K,K)}function i0(Z,$=null){return Z.query(`SELECT * FROM rule_metrics WHERE project_id IS ?
       ORDER BY total_violations DESC`).all($)}function n0(Z,$){let K=Z.query(`INSERT INTO improvement_suggestions
       (project_id, rule_id, suggestion_type, title, reasoning, evidence, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).run($.projectId??null,$.ruleId??null,$.suggestionType,$.title,$.reasoning,$.evidence?JSON.stringify($.evidence):null,Date.now());return Number(K.lastInsertRowid)}function d(Z,$=null){if($)return Z.query(`SELECT * FROM improvement_suggestions
         WHERE (project_id = ? OR project_id IS NULL) AND status = 'pending'
         ORDER BY created_at DESC`).all($);return Z.query(`SELECT * FROM improvement_suggestions
       WHERE status = 'pending' ORDER BY created_at DESC`).all()}function bZ(){return{workerPort:parseInt(process.env.ARCHITECT_PORT||"37778",10),logLevel:process.env.ARCHITECT_LOG_LEVEL||"info",databasePath:process.env.ARCHITECT_DB_PATH||"",pluginRoot:process.env.CLAUDE_PLUGIN_ROOT||process.cwd(),improvementMinSessions:parseInt(process.env.ARCHITECT_IMPROVEMENT_MIN_SESSIONS||"5",10)}}var K1={};a(K1,{default:()=>J1});async function J1(){let Z=I(),$=k(),J=T($,Z);if(!J){let U=$1.basename(Z);J=TZ($,{id:crypto.randomUUID(),name:U,path:Z}),A.info("New project registered",{name:U,path:Z})}let K=process.env.CLAUDE_SESSION_ID||crypto.randomUUID(),W=xZ($,J.id);d0($,K,J.id,W?.overall_score);let Q=p($,J.id),Y=ZZ($,J.id),H=OZ($,J.id,3),X=[];if(X.push("# [claude-architect] project context"),X.push(`Project: ${J.name} (${J.path})`),W)X.push(`Compliance Score: ${W.overall_score}/100 (${Y})`);if(Q.critical>0||Q.warning>0)X.push(`Open Violations: ${Q.critical} critical, ${Q.warning} warning, ${Q.info} info`);if(H.length>0){X.push(`
Recent Decisions:`);for(let U of H)X.push(`- [${U.status}] ${U.title}`)}process.stdout.write(X.join(`
`))}var $1;var W1=L(()=>{h();D();v();M();$1=require("path")});var Y1={};a(Y1,{default:()=>Q1});async function Q1(){let Z=I(),$=k(),J=T($,Z);if(!J){process.stdout.write("Success");return}let K=fZ($,J.id,{limit:5});if(K.length===0){process.stdout.write("Success");return}let W=[];W.push("# [claude-architect] active warnings");for(let Q of K)W.push(`- [${Q.severity}] ${Q.description}${Q.file_path?` (${Q.file_path})`:""}`);process.stdout.write(W.join(`
`))}var H1=L(()=>{h();D();M()});var X1={};a(X1,{default:()=>G1});async function G1(){let Z=I(),$=k(),J=T($,Z);if(!J){process.stdout.write("Success");return}let K=process.env.TOOL_INPUT_FILE_PATH||"";if(!K){process.stdout.write("Success");return}let W=sZ(Z,K);if(W.length===0){process.stdout.write("Success");return}let Q=process.env.CLAUDE_SESSION_ID;for(let H of W)u0($,{projectId:J.id,sessionId:Q,ruleId:H.ruleId,ruleName:H.ruleName,severity:H.severity,category:H.category,filePath:H.filePath,lineNumber:H.lineNumber,description:H.description,suggestion:H.suggestion}),s0($,H.ruleId,J.id);let Y=[];Y.push("# [claude-architect] violations detected");for(let H of W)Y.push(`- [${H.severity}] ${H.description}${H.suggestion?` \u2192 ${H.suggestion}`:""}`);process.stdout.write(Y.join(`
`))}var U1=L(()=>{h();D();IZ();M()});var z1={};a(z1,{default:()=>B1});async function B1(){let Z=I(),$=k(),J=T($,Z);if(!J){process.stdout.write("Success");return}let K=process.env.CLAUDE_SESSION_ID;try{let W=SZ(Z,{severity:"warning"});if(FZ($,{projectId:J.id,sessionId:K??void 0,overallScore:W.overallScore,scoresByCategory:W.scoresByCategory,totalFeatures:W.totalFeatures,totalFiles:W.totalFiles,totalViolations:W.violations.length,violationsBySeverity:DZ(W.violations),violationsByRule:RZ(W.violations)}),K){let Q=c0($,K),Y=p($,J.id),H=Y.critical+Y.warning+Y.info,X=b4(Z),U=m($,J.id,{limit:100}),G=Q?.started_at??0,O=U.filter((V)=>V.created_at>=G),B=h4({projectName:J.name,scoreBefore:Q?.compliance_score_before??null,scoreAfter:W.overallScore,violations:W.violations,filesChanged:X,decisionsCount:O.length,totalViolations:H});l0($,K,{summary:B,complianceScoreAfter:W.overallScore,filesChanged:X,decisionsMade:O.length,violationsFound:H})}A.info("Session summarized",{project:J.name,score:W.overallScore})}catch(W){A.error("Summarization failed",{error:W.message})}process.stdout.write("Success")}function b4(Z){try{let $=O1.spawnSync("git",["status","--short"],{cwd:Z,encoding:"utf-8",timeout:5000});if(!$.stdout)return[];return $.stdout.split(`
`).filter((J)=>J.trim()).map((J)=>J.substring(3).trim())}catch{return[]}}function h4(Z){let $=[];if(Z.scoreBefore!==null&&Z.scoreBefore!==Z.scoreAfter){let W=Z.scoreAfter-Z.scoreBefore,Q=W>0?"improved":"decreased";$.push(`Architecture compliance ${Q} from ${Z.scoreBefore} to ${Z.scoreAfter} (${W>0?"+":""}${W}).`)}else $.push(`Architecture compliance score: ${Z.scoreAfter}/100.`);if(Z.filesChanged.length>0)if(Z.filesChanged.length<=3)$.push(`Modified: ${Z.filesChanged.join(", ")}.`);else $.push(`${Z.filesChanged.length} files modified, including ${Z.filesChanged.slice(0,2).join(", ")} and ${Z.filesChanged.length-2} more.`);let J=Z.violations.filter((W)=>W.severity==="critical"),K=Z.violations.filter((W)=>W.severity==="warning");if(J.length>0)$.push(`${J.length} critical issue${J.length>1?"s":""} detected: ${J.map((W)=>W.description).slice(0,2).join("; ")}.`);if(K.length>0)$.push(`${K.length} warning${K.length>1?"s":""} remaining.`);if(Z.totalViolations===0)$.push("No open violations \u2014 project is fully compliant.");if(Z.decisionsCount>0)$.push(`${Z.decisionsCount} architectural decision${Z.decisionsCount>1?"s":""} recorded.`);return $.join(" ")}var O1;var V1=L(()=>{h();D();IZ();CZ();v();M();O1=require("child_process")});function _1(Z,$,J=5){let K=$?n(Z,$):0;if($&&K<J)return{suggestions:[],analysisMetadata:{totalRules:0,totalSessions:K,analyzedAt:Date.now()}};let W=i0(Z,$),Q=[];for(let G of W){if(G.total_violations>10){let O=G.ignored_violations/G.total_violations;if(O>0.5)Q.push({ruleId:G.rule_id,type:"relax",title:`Rule "${G.rule_id}" is frequently ignored`,reasoning:`${Math.round(O*100)}% of violations for this rule are ignored (${G.ignored_violations}/${G.total_violations}). The rule may be too strict or irrelevant for this project.`,evidence:{totalViolations:G.total_violations,resolvedViolations:G.resolved_violations,ignoredViolations:G.ignored_violations,ignoreRate:Math.round(O*100)}})}if(G.avg_resolution_time_ms!==null&&G.avg_resolution_time_ms<300000&&G.resolved_violations>5)Q.push({ruleId:G.rule_id,type:"add",title:`Auto-fix candidate: "${G.rule_id}"`,reasoning:`Violations for this rule are resolved quickly (avg ${Math.round(G.avg_resolution_time_ms/1000)}s). Consider adding auto-fix support.`,evidence:{avgResolutionTimeSec:Math.round(G.avg_resolution_time_ms/1000),resolvedCount:G.resolved_violations}});if($&&K>0){let O=G.total_violations/K;if(O>3)Q.push({ruleId:G.rule_id,type:"split",title:`Rule "${G.rule_id}" triggers too frequently`,reasoning:`This rule triggers ${O.toFixed(1)} times per session on average. Consider splitting into more specific sub-rules or adding examples.`,evidence:{violationsPerSession:O.toFixed(1),totalSessions:K,totalViolations:G.total_violations}})}}let Y=new Set(W.map((G)=>G.rule_id)),H=["01-architecture","02-security","03-testing","04-api-design","05-database","06-documentation","07-performance","08-error-handling","09-git-workflow","10-frontend","11-auth-patterns","12-monitoring","13-environment","14-dependency-management","15-code-style","16-ci-cd","17-owasp-top-ten","18-data-privacy","19-resilience-patterns","20-concurrency","22-accessibility","26-advanced-code-quality","28-advanced-api-patterns","29-configuration-hygiene","30-supply-chain-security"];if(K>=J){for(let G of H)if(!Y.has(G))Q.push({ruleId:G,type:"remove",title:`Rule "${G}" never triggered`,reasoning:`This rule has never produced a violation across ${K} sessions. It may be too obvious or not applicable to this project \u2014 consider removing to save tokens.`,evidence:{totalSessions:K,totalViolations:0}})}let X=d(Z,$),U=new Set(X.map((G)=>G.title));for(let G of Q)if(!U.has(G.title))n0(Z,{projectId:$??void 0,ruleId:G.ruleId,suggestionType:G.type,title:G.title,reasoning:G.reasoning,evidence:G.evidence});return A.info("Self-improvement analysis complete",{projectId:$,suggestionsGenerated:Q.length,sessionCount:K}),{suggestions:Q,analysisMetadata:{totalRules:W.length,totalSessions:K,analyzedAt:Date.now()}}}var A1=L(()=>{v()});var M1={};a(M1,{default:()=>L1});async function L1(){let Z=I(),$=k(),J=T($,Z);if(J){let K=bZ(),W=n($,J.id);if(W>=K.improvementMinSessions)try{_1($,J.id,K.improvementMinSessions),A.info("Self-improvement analysis completed",{project:J.name,sessions:W})}catch(Q){A.error("Self-improvement analysis failed",{error:Q.message})}}e(),process.stdout.write("Success")}var T1=L(()=>{h();D();A1();v();M()});var uZ=N1(require("express")),w1=require("path"),E1=require("fs");h();var e0=require("express");D();M();var g=require("fs"),s=require("path");var P1=/^---\n([\s\S]*?)\n---\n?/;function lZ(Z){let $=Z.match(P1);if(!$)return{metadata:{mode:"auto",paths:[]},body:Z};let J=$[1],K=Z.slice($[0].length),W={mode:"auto",paths:[]};for(let Q of J.split(`
`)){let Y=Q.trim();if(!Y||Y.startsWith("#"))continue;let H=Y.match(/^(\w+):\s*(.*)$/);if(H){let[,X,U]=H;if(X==="mode")W.mode=U.trim()==="manual"?"manual":"auto";else if(X==="paths")continue;else W[X]=U.trim()}else if(Y.startsWith("- ")){let X=Y.slice(2).replace(/^["']|["']$/g,"").trim();if(X)W.paths.push(X)}}return{metadata:W,body:K}}function cZ(Z){return lZ(Z).metadata.mode}function $0(Z,$){Z.get("/api/projects",(J,K)=>{K.json(wZ($))}),Z.post("/api/projects",(J,K)=>{let{id:W,name:Q,path:Y,tech_stack:H}=J.body;if(!W||!Q||!Y){K.status(400).json({error:"id, name, and path are required"});return}if(typeof W!=="string"||typeof Q!=="string"||typeof Y!=="string"){K.status(400).json({error:"id, name, and path must be strings"});return}let X=TZ($,{id:W,name:Q,path:Y,tech_stack:H});K.status(201).json(X)}),Z.get("/api/projects/:id/rules",(J,K)=>{let W=dZ($,J.params.id);if(!W){K.status(404).json({error:"Project not found"});return}let Q=t();if(!g.existsSync(Q)){K.json({autoRules:[],manualRules:[],enabledManualRules:[]});return}let Y=[],H=[];for(let U of g.readdirSync(Q).filter((G)=>G.endsWith(".md")).sort()){let G=s.basename(U,".md"),O=g.readFileSync(s.join(Q,U),"utf-8"),B=cZ(O),V={id:G,name:G.replace(/^\d+-/,"").replace(/-/g," ")};if(B==="manual")H.push(V);else Y.push(V)}let X=EZ($,W.id);K.json({autoRules:Y,manualRules:H,enabledManualRules:X})}),Z.post("/api/projects/:id/rules",(J,K)=>{let W=dZ($,J.params.id);if(!W){K.status(404).json({error:"Project not found"});return}let{enabled:Q}=J.body;if(!Array.isArray(Q)){K.status(400).json({error:"enabled must be an array of rule IDs"});return}let Y=t(),H=new Set;if(g.existsSync(Y))for(let U of g.readdirSync(Y).filter((G)=>G.endsWith(".md"))){let G=s.basename(U,".md"),O=g.readFileSync(s.join(Y,U),"utf-8");if(cZ(O)==="manual")H.add(G)}let X=Q.filter((U)=>typeof U==="string"&&H.has(U));Z0($,W.id,X),K.json({enabledManualRules:X})})}D();IZ();CZ();v();var u=require("fs"),R=require("path");function P0(Z){let{projectPath:$,featureName:J,description:K="TODO: Describe this feature",withTests:W=!0}=Z,Q=g4(J),Y=j4(J),H=R.join($,"src","features",Q);if(u.existsSync(H))throw Error(`Feature directory already exists: ${H}`);let X=[],U=[],G=["domain/entities","domain/value-objects","domain/ports","domain/events","domain/services","application/use-cases","application/dtos","application/mappers","infrastructure/controllers","infrastructure/repositories","infrastructure/adapters","infrastructure/config"];if(W)G.push("__tests__/integration","__tests__/e2e");for(let VZ of G){let _Z=R.join(H,VZ);u.mkdirSync(_Z,{recursive:!0}),X.push(`src/features/${Q}/${VZ}`)}let O=R4(Y,K);P(R.join(H,"domain","entities",`${Y}.ts`),O),U.push(`src/features/${Q}/domain/entities/${Y}.ts`);let B=C4(Y);P(R.join(H,"domain","ports",`${Y}Repository.ts`),B),U.push(`src/features/${Q}/domain/ports/${Y}Repository.ts`);let V=N4(Y);P(R.join(H,"application","dtos",`${Y}Dto.ts`),V),U.push(`src/features/${Q}/application/dtos/${Y}Dto.ts`);let z=S4(Y);P(R.join(H,"application","use-cases",`Create${Y}UseCase.ts`),z),U.push(`src/features/${Q}/application/use-cases/Create${Y}UseCase.ts`);let x=I4(Y);P(R.join(H,"application","mappers",`${Y}Mapper.ts`),x),U.push(`src/features/${Q}/application/mappers/${Y}Mapper.ts`);let o=y4(Y);P(R.join(H,"infrastructure","controllers",`${Y}Controller.ts`),o),U.push(`src/features/${Q}/infrastructure/controllers/${Y}Controller.ts`);let w=v4(Y);P(R.join(H,"infrastructure","repositories",`${Y}RepositoryImpl.ts`),w),U.push(`src/features/${Q}/infrastructure/repositories/${Y}RepositoryImpl.ts`);let r=f4(Q,Y,K);P(R.join(H,"README.md"),r),U.push(`src/features/${Q}/README.md`);let zZ=["domain/value-objects","domain/events","domain/services","infrastructure/adapters","infrastructure/config"];if(W)zZ.push("__tests__/integration","__tests__/e2e");for(let VZ of zZ){let _Z=R.join(H,VZ,".gitkeep");if(!u.existsSync(_Z))P(_Z,"")}return A.info("Feature scaffold generated",{feature:Q,files:U.length,dirs:X.length}),{createdFiles:U,createdDirs:X,featurePath:H}}function P(Z,$){u.writeFileSync(Z,$,"utf-8")}function R4(Z,$){return`/**
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
`}function C4(Z){return`/**
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
`}function N4(Z){return`/**
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
`}function S4(Z){return`/**
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
`}function I4(Z){return`/**
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
`}function y4(Z){return`/**
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
`}function v4(Z){return`/**
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
`}function f4(Z,$,J){return`# Feature: ${$}

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
`}function g4(Z){return Z.replace(/([a-z])([A-Z])/g,"$1-$2").replace(/[_\s]+/g,"-").toLowerCase()}function j4(Z){return Z.replace(/[-_\s]+(.)/g,($,J)=>J.toUpperCase()).replace(/^(.)/,($,J)=>J.toUpperCase())}M();var i=require("fs"),yZ=require("path");D();function b0(Z,$){Z.get("/api/check",(J,K)=>{let W=J.query.project_path;if(!W||typeof W!=="string"){K.status(400).json({error:"project_path query parameter required"});return}let Q=J.query.categories?J.query.categories.split(","):void 0,Y=J.query.severity,H=SZ(W,{categories:Q,severity:Y}),X=T($,W);if(X)FZ($,{projectId:X.id,overallScore:H.overallScore,scoresByCategory:H.scoresByCategory,totalFeatures:H.totalFeatures,totalFiles:H.totalFiles,totalViolations:H.violations.length,violationsBySeverity:DZ(H.violations),violationsByRule:RZ(H.violations)});K.json(H)}),Z.post("/api/scaffold",(J,K)=>{let{project_path:W,feature_name:Q,description:Y,with_tests:H}=J.body;if(!W||!Q){K.status(400).json({error:"project_path and feature_name are required"});return}if(typeof W!=="string"||typeof Q!=="string"){K.status(400).json({error:"project_path and feature_name must be strings"});return}try{let X=P0({projectPath:W,featureName:Q,description:typeof Y==="string"?Y:void 0,withTests:H!==!1});K.status(201).json(X)}catch(X){K.status(409).json({error:X.message})}}),Z.get("/api/rules",(J,K)=>{let W=J.query.file_path,Q=J.query.category,Y=J.query.project_path,H=t();if(!i.existsSync(H)){K.json({rules:[],message:"Rules directory not found"});return}let X=[];if(Y){let O=T($,Y);if(O)X=EZ($,O.id)}let U=i.readdirSync(H).filter((O)=>O.endsWith(".md")).sort(),G=[];for(let O of U){let B=yZ.basename(O,".md");if(Q&&!B.includes(Q))continue;let V=i.readFileSync(yZ.join(H,O),"utf-8"),{metadata:z,body:x}=lZ(V);if(z.mode==="manual"){if(!X.includes(B))continue}if(W&&z.paths.length>0){let o=W.replace(/\\/g,"/");if(!z.paths.some((r)=>{let zZ=r.replace(/\*\*/g,".*").replace(/\*/g,"[^/]*");return new RegExp(zZ).test(o)}))continue}G.push({id:B,name:B.replace(/^\d+-/,"").replace(/-/g," "),mode:z.mode,content:x})}K.json({rules:G})})}D();function p0(Z,$){Z.get("/api/search",(J,K)=>{let W=J.query.query,Q=J.query.project_path,Y=J.query.type,H=Math.min(parseInt(J.query.limit)||20,100),U=(Q?T($,Q):null)?.id,G=[];if(!Y||Y==="decisions"){if(U){let O=m($,U,{query:W,limit:H});for(let B of O)G.push({id:B.id,type:"decision",title:B.title,status:B.status,created_at:B.created_at,extra:B.tags||""})}}if(!Y||Y==="violations"){if(U){let O=BZ($,U,{query:W,limit:H});for(let B of O)G.push({id:B.id,type:"violation",title:`[${B.severity}] ${B.description}`,status:B.resolved?"resolved":"open",created_at:B.created_at,extra:B.rule_id})}}G.sort((O,B)=>B.created_at-O.created_at),K.json(G.slice(0,H))}),Z.get("/api/timeline",(J,K)=>{let W=parseInt(J.query.anchor),Q=J.query.query,Y=J.query.project_path,H=parseInt(J.query.depth_before)||5,X=parseInt(J.query.depth_after)||5,G=(Y?T($,Y):null)?.id;if(!G){K.status(404).json({events:[],message:"Project not found"});return}let O=[],B=m($,G,{query:Q,limit:100});for(let w of B)O.push({id:w.id,type:"decision",title:w.title,status:w.status,created_at:w.created_at,extra:w.tags||""});let V=BZ($,G,{limit:100});for(let w of V)O.push({id:w.id,type:"violation",title:`[${w.severity}] ${w.description}`,status:w.resolved?"resolved":"open",created_at:w.created_at,extra:w.rule_id});O.sort((w,r)=>w.created_at-r.created_at);let z=-1;if(!isNaN(W))z=O.findIndex((w)=>w.id===W);else if(Q)z=O.findIndex((w)=>w.title.toLowerCase().includes(Q.toLowerCase()));if(z===-1)z=O.length-1;let x=Math.max(0,z-H),o=Math.min(O.length,z+X+1);K.json({events:O.slice(x,o),anchorIndex:z-x,total:O.length})}),Z.post("/api/details/batch",(J,K)=>{let{ids:W,type:Q}=J.body;if(!Array.isArray(W)||!Q){K.status(400).json({error:"ids (array) and type (string) are required"});return}if(typeof Q!=="string"||!["decisions","violations","changes"].includes(Q)){K.status(400).json({error:'type must be "decisions", "violations", or "changes"'});return}if(W.length>50){K.status(400).json({error:"Maximum 50 IDs per request"});return}let Y=[];if(Q==="decisions")for(let H of W){let X=vZ($,Number(H));if(X)Y.push(X)}else if(Q==="violations")for(let H of W){let X=$.query("SELECT * FROM violations WHERE id = ?").get(Number(H));if(X)Y.push(X)}else if(Q==="changes")for(let H of W){let X=$.query("SELECT * FROM structural_changes WHERE id = ?").get(Number(H));if(X)Y.push(X)}K.json(Y)})}D();function o0(Z,$){Z.get("/api/decisions",(J,K)=>{let W=J.query.project_id,Q=J.query.project_path,Y=W;if(!Y&&Q)Y=T($,Q)?.id??"";if(!Y){K.status(400).json({error:"project_id or project_path required"});return}let H=m($,Y,{query:J.query.query,status:J.query.status,limit:J.query.limit?parseInt(J.query.limit):void 0});K.json(H)}),Z.get("/api/decisions/:id",(J,K)=>{let W=parseInt(J.params.id);if(isNaN(W)){K.status(400).json({error:"Invalid decision ID"});return}let Q=vZ($,W);if(!Q){K.status(404).json({error:"Decision not found"});return}K.json(Q)}),Z.post("/api/decisions",(J,K)=>{let{projectId:W,project_path:Q,title:Y,context:H,decision:X,alternatives:U,tags:G}=J.body,O=W;if(!O&&Q)O=T($,Q)?.id;if(!O||!Y||!X){K.status(400).json({error:"projectId (or project_path), title, and decision required"});return}if(typeof Y!=="string"||typeof X!=="string"){K.status(400).json({error:"title and decision must be strings"});return}let B=h0($,{projectId:O,title:Y,context:typeof H==="string"?H:void 0,decision:X,alternatives:Array.isArray(U)?U:void 0,tags:Array.isArray(G)?G:void 0});K.status(201).json({id:B})}),Z.get("/api/violations",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}let Q=BZ($,W,{query:J.query.query,resolved:J.query.resolved==="true"?!0:J.query.resolved==="false"?!1:void 0,limit:J.query.limit?parseInt(J.query.limit):void 0});K.json(Q)}),Z.patch("/api/violations/:id",(J,K)=>{let W=parseInt(J.params.id);if(isNaN(W)){K.status(400).json({error:"Invalid violation ID"});return}let{resolved_by:Q}=J.body;m0($,W,typeof Q==="string"?Q:"manual"),K.json({success:!0})}),Z.get("/api/sessions",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}K.json(gZ($,W))}),Z.get("/api/compliance/snapshots",(J,K)=>{let W=J.query.project_id;if(!W){K.status(400).json({error:"project_id required"});return}K.json(kZ($,W))}),Z.get("/api/improvements",(J,K)=>{let W=J.query.project_id||null,Q=J.query.project_path;if(!W&&Q)W=T($,Q)?.id??null;K.json(d($,W))})}D();function r0(Z,$){Z.get("/api/status",(J,K)=>{let W=J.query.project_path;if(!W){K.status(400).json({error:"project_path required"});return}let Q=T($,W);if(!Q){K.json({registered:!1,message:"Project not registered. Run /architect-init first."});return}let Y=xZ($,Q.id),H=ZZ($,Q.id),X=p($,Q.id),U=OZ($,Q.id,5),G=n($,Q.id),O=d($,Q.id);K.json({project:Q,complianceScore:Y?.overall_score??null,trend:H,violations:X,recentDecisions:U,sessionCount:G,suggestions:O.length,lastChecked:Y?.created_at??null})}),Z.get("/dashboard/data",(J,K)=>{let W=J.query.project_path,Q=W?T($,W):null;if(!Q){let V=wZ($);K.json({projects:V,selectedProject:null});return}let Y=kZ($,Q.id,20),H=fZ($,Q.id,{limit:50}),X=OZ($,Q.id,10),U=ZZ($,Q.id),G=p($,Q.id),O=d($,Q.id),B=gZ($,Q.id,20);K.json({project:Q,scoreHistory:Y,violations:H,recentDecisions:X,trend:U,violationCounts:G,suggestions:O,sessions:B})}),Z.get("/api/health",(J,K)=>{K.json({status:"healthy",service:"claude-architect",timestamp:new Date().toISOString()})})}M();var c=require("fs"),l=require("path");function a0(Z){Z.get("/api/templates",($,J)=>{let K=pZ();if(!c.existsSync(K)){J.json({templates:[]});return}let Q=c.readdirSync(K).filter((Y)=>Y.endsWith(".md")).sort().map((Y)=>({id:l.basename(Y,".md"),name:l.basename(Y,".md").replace(/-TEMPLATE$/,"").replace(/-/g," "),filename:Y}));J.json({templates:Q})}),Z.get("/api/templates/:name",($,J)=>{let K=pZ(),W=$.params.name;if(W.includes("..")||W.includes("/")||W.includes("\\")){J.status(400).json({error:"Invalid template name"});return}let Q=W.endsWith(".md")?W:`${W}.md`,Y=l.join(K,Q);if(!c.existsSync(Y)){J.status(404).json({error:"Template not found"});return}let H=c.readFileSync(Y,"utf-8");J.json({id:l.basename(Y,".md"),name:l.basename(Y,".md").replace(/-TEMPLATE$/,"").replace(/-/g," "),content:H})})}var jZ=require("fs"),iZ=require("child_process"),PZ=require("path"),P4=new Set(["node_modules",".git",".bun","coverage",".turbo",".cache","__pycache__","dist",".next"]);function t0(Z){Z.get("/api/structure",($,J)=>{let K=$.query.project_path;if(!K||typeof K!=="string"){J.status(400).json({error:"project_path query parameter required"});return}function W(Y,H){if(H>6)return null;try{let X=jZ.readdirSync(Y,{withFileTypes:!0}),U=[],G=0,O=0;for(let B of X){if(P4.has(B.name))continue;let V=PZ.join(Y,B.name);if(B.isDirectory()){let z=W(V,H+1);if(z)U.push(z),G+=z.size,O+=z.fileCount}else if(B.isFile())try{let z=jZ.statSync(V),x=B.name.includes(".")?B.name.split(".").pop()||"":"";U.push({name:B.name,type:"file",size:z.size,ext:x}),G+=z.size,O++}catch{}}return U.sort((B,V)=>{if(B.type==="dir"&&V.type!=="dir")return-1;if(B.type!=="dir"&&V.type==="dir")return 1;return B.name.localeCompare(V.name)}),{name:PZ.basename(Y),type:"dir",size:G,fileCount:O,children:U}}catch{return null}}let Q=W(K,0);if(!Q){J.status(404).json({error:"Project directory not found"});return}J.json(Q)}),Z.get("/api/git-activity",($,J)=>{let K=$.query.project_path;if(!K||typeof K!=="string"){J.status(400).json({error:"project_path required"});return}try{let Q=iZ.spawnSync("git",["log","--format=%H%x09%at%x09%s","--name-status","-n","30"],{cwd:K,encoding:"utf-8",timeout:5000}).stdout||"",Y=[],H=null;for(let X of Q.split(`
`)){let U=X.trim();if(!U)continue;let G=U.match(/^([a-f0-9]{40})\t(\d+)\t(.*)$/);if(G){if(H)Y.push(H);H={hash:G[1].substring(0,8),timestamp:parseInt(G[2])*1000,subject:G[3],files:[]}}else if(H&&/^[AMDRC]\t/.test(X)){let O=X.split("\t");H.files.push({status:O[0],path:O.slice(1).join("\t")})}}if(H)Y.push(H);try{let U=(iZ.spawnSync("git",["status","--short"],{cwd:K,encoding:"utf-8",timeout:3000}).stdout||"").split(`
`).filter((G)=>G.trim());if(U.length>0){let G=U.map((O)=>({status:O.substring(0,2).trim()||"M",path:O.substring(3).trim()}));Y.unshift({hash:"working",timestamp:Date.now(),subject:`${G.length} uncommitted change${G.length!==1?"s":""}`,files:G})}}catch{}J.json(Y)}catch{J.json([])}})}function Z1(Z){let $=k(),J=e0.Router();$0(J,$),b0(J,$),p0(J,$),o0(J,$),r0(J,$),a0(J),t0(J),Z.use(J)}h();v();M();var u4=bZ(),hZ=u4.workerPort;function m4(){let Z=uZ.default();Z.use(uZ.default.json({limit:"1mb"})),Z.use((K,W,Q)=>{let Y=K.headers.origin,H=[`http://localhost:${hZ}`,`http://127.0.0.1:${hZ}`];if(Y&&H.includes(Y))W.header("Access-Control-Allow-Origin",Y);if(W.header("Access-Control-Allow-Methods","GET, POST, PATCH, DELETE"),W.header("Access-Control-Allow-Headers","Content-Type"),K.method==="OPTIONS"){W.sendStatus(204);return}Q()});let $=w1.join(LZ(),"ui");if(E1.existsSync($))Z.use(uZ.default.static($));Z1(Z),Z.use((K,W,Q,Y)=>{A.error("Unhandled route error",{error:K.message,stack:K.stack}),Q.status(500).json({error:"Internal server error"})}),k();let J=Z.listen(hZ,()=>{A.info(`Worker server started on port ${hZ}`),process.stdout.write("Success")});process.on("SIGTERM",()=>{A.info("Shutting down worker server"),J.close(()=>e())}),process.on("SIGINT",()=>{J.close(()=>e())})}async function p4(Z){let $;switch(Z){case"session-init":$=await Promise.resolve().then(() => (W1(),K1));break;case"context":$=await Promise.resolve().then(() => (H1(),Y1));break;case"post-change":$=await Promise.resolve().then(() => (U1(),X1));break;case"summarize":$=await Promise.resolve().then(() => (V1(),z1));break;case"session-complete":$=await Promise.resolve().then(() => (T1(),M1));break;default:A.error(`Unknown hook handler: ${Z}`),process.exit(1);return}await $.default()}(async()=>{let Z=process.argv[2];if(Z==="start")m4();else if(Z==="hook"){let $=process.argv[3];try{await p4($)}catch(J){A.error(`Hook handler "${$}" failed`,{error:J.message}),process.exit(1)}}else A.error(`Unknown command: ${Z}`),process.exit(1)})();})

//# debugId=8DAA43A396D25F3364756E2164756E21
