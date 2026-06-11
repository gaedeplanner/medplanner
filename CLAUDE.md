# MEDPlanner 2026

Planner de estudos de medicina (MEDCURSO 2026) do Lucas. App de **arquivo único**: todo o HTML/CSS/JS está em `index.html` (~220KB), sem build/instalação.

## Sobre o usuário
- Lucas é estudante de medicina, **não é programador**. Fale em português simples, explique passo a passo, sem jargão técnico.
- Ele descreve o que quer em linguagem natural; você implementa e publica.

## Como publicar mudanças (fluxo padrão)
1. Edite `index.html`.
2. Valide a sintaxe do JS: `node -e "const fs=require('fs');const html=fs.readFileSync('index.html','utf8');const m=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/);new Function(m[1]);console.log('OK')"`.
3. `git add index.html` → commit → `git push`.
4. O site atualiza em ~1 min: **https://gaedeplanner.github.io/medplanner/** (GitHub Pages, branch main, raiz).
5. Avise o Lucas para recarregar com Ctrl+Shift+R (cache).

## Arquitetura
- **Dados**: localStorage, com sync na nuvem via Firebase (projeto `medcurso---ga`, plano gratuito Spark).
  - Auth por e-mail/senha; Firestore `users/{uid}` guarda os dados como campos (1 doc por usuário).
  - Regras do Firestore restringem leitura/escrita ao próprio uid.
  - No fim do `<script>`: `CLOUD_KEYS` lista as chaves do localStorage sincronizadas; `localStorage.setItem` é interceptado para dar push (debounce ~800ms); `onSnapshot` aplica mudanças remotas em tempo real (guards `applyingRemote`/`cloudReady`).
  - Nuvem é a fonte da verdade quando o doc existe; se não existe, dados locais sobem como base.
- **Login**: persistência `SESSION` (pede senha ao reabrir a janela — **preferência explícita do Lucas, não mudar**). O login chama `enterApp()` direto no `.then()` do sign-in, sem esperar `onAuthStateChanged` (que trava em `file://`). Firestore usa `experimentalForceLongPolling`.
- **PDFs (Resumos/Slides)**: ficam no **Google Drive do Lucas**; o planner guarda só o link. NÃO usar Firebase Storage (exige plano pago em projetos novos) nem subir PDFs neste repo (é público e os slides MEDCURSO têm copyright). Links antigos `file:///` mostram aviso via `legacyFileLinkWarn()`.
- **UI**: abas via `TAB_FN` (mapa aba→função de render), tema com CSS variables (`:root` / `[data-dark]`), Chart.js via CDN.

## Regras deste repositório
- O repo é **PÚBLICO**. O `.gitignore` libera apenas `index.html` e `CLAUDE.md` — **nunca** commitar outros arquivos (dados pessoais, transcripts, PDFs).
- Existe uma cópia local `MEDPlanner.html` no PC principal (espelho do index.html); se ela existir na máquina, mantenha as duas iguais após editar.

## Testar localmente sem login
Sirva por HTTP (não file://) e, no console do navegador:
`document.getElementById('login-screen').style.display='none';document.getElementById('app-root').classList.add('ready');renderDashboard();`
