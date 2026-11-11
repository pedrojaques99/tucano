# Redesenho de novembro de 2026: o que mudou e por quê

Registro das decisões de design de 11/11/2026 no fork da Visant (`visant/build`). Cada mudança diz o que era, o que ficou e qual problema resolve. As decisões de direção foram do dono; a execução seguiu as skills `visant-design` e `visant-killer`.

## A direção

| Decisão | Por quê |
|---|---|
| Brincalhão, mas sutil: no máximo uma marca de personalidade por tela | O incômodo era o "tom infantil exagerado", não a personalidade em si |
| O tucano como assinatura (logo e o Tuca quando fala) | Mantém a marca sem decorar a tela com ela |
| Tokens do app em todo lugar, sem tema paralelo | O onboarding parecia outro produto |
| Bricolage Grotesque nos títulos, Inter no corpo | É a fonte do tucano.sh; a Nunito arredondada lia como infantil |
| Laranja só onde se age | Um destaque em tudo é destaque em nada |

## 1. Primeiro uso (onboarding)

**Arquivos:** `Intro.tsx`, `Onboarding.tsx`, `Coach.tsx`, `Missions.tsx`, `Splash.tsx`, `Decisions.tsx`, `styles.css`.

| Antes | Depois | Por quê |
|---|---|---|
| Tema próprio `--i-*` (pêssego, teal, lilás) | `--i-*` viraram apelidos dos tokens do app | Um produto só; dark mode correto de graça |
| Blobs, robôs flutuando, chips falsos ("Pesquisei 12 fontes") | Removidos | Números inventados e decoração sem função são os sinais clássicos de "feito por IA" |
| Botões de 58px em pílula, peso 900, cantos de 26–34px | 42px, peso 650, `--radius`/`--radius-lg` | A escala inflada era a maior fonte do "infantil" |
| Abertura de 8s (floresta, helicóptero, som) | 1,4s: o tucano e o nome, só CSS | Ninguém espera 8s pra usar um app; o som saiu junto (`splash.mp3`) |
| Um caminho só, didático | Bifurcação: "Sou novo" ou "Já uso agentes" | Quem já usa não precisa de tour; o atalho liga `showAll`, esconde as missões e pula o tour |
| "Ver quais" listava nomes | Cada ferramenta e skill com sua caixa (`button[role=checkbox]`) | O app já se configura sozinho; agora dá pra escolher o que vem |
| Missões em cards coloridos com anel | Lista, mesma mecânica (a barra lateral ainda destrava) | Mantém o progresso, sem cara de jogo |
| Balão do tour preto, "TOUR · 1 DE 3", brilho laranja | Painel do app, contador discreto, contorno fino | Rótulo em caixa alta espaçada é um sinal de template |
| Card de perguntas com faixa laranja, barra tripla e opções em caixas | Uma superfície, opções em linhas, progresso só em texto | Era card dentro de card |
| Selo "NOVO" laranja na barra lateral | Um ponto de 6px | Era um estado muito intrusivo |
| Copy: "tirar das suas costas", "Opa…" | "O que você quer delegar primeiro?" | Tom adulto, sem perder o calor |

## 2. Componentes compartilhados (uma fonte de verdade)

- **`EngineMark` em `ui.tsx`**: o único jeito de mostrar um harness, com o logo oficial na cor da marca (`engine-logos.ts`). Antes só o onboarding tinha logos, numa cópia local.
- **`Select` aceita `icon` por opção**: o seletor de modelo mostra o logo na lista e no botão. A opção selecionada deixou de ser um bloco laranja cheio e virou um ✓ discreto.

## 3. Componentes novos

- **`UsageDock.tsx`**: um anel por harness no rodapé da barra lateral, com quanto resta da menor janela. Ao passar o mouse, aparecem todas as janelas que o CLI informa, com % restante e quando zera.
  - *Por quê:* o limite do plano é o que mais faz um agente parar, e só aparecia escondido em Uso e limites.
  - *Limite honesto:* só o Claude Code informa as janelas. Um harness sem dados não ganha anel, em vez de um número inventado.
  - *Também:* o parser do Claude passou a guardar as janelas extras que ele informar (por modelo).
- **Skills como árvore de arquivos**: pastas por origem do `SKILL.md` (suas skills, cada plugin, Codex, criadas aqui), pasta desenhada em outline, linha-guia e a receita ao lado.
  - *Por quê:* a lista longa com a descrição inteira de cada skill não escalava com 100+ skills.

## 4. Configurações › Modelos

**Arquivos:** `Pages.tsx` (`pane('modelos')`), `Harness.tsx`, `AgentModelsPanel.tsx`.

A ordem agora segue o modelo mental: o que você tem (Harnesses, Contas) → o que roda por trás (Bastidores) → o que cada agente usa.

| Antes | Depois | Por quê |
|---|---|---|
| A aba abria com o editor em lote | O editor em lote vem por último | É a ferramenta mais rara; o caso raro mandava na tela |
| 8 cards de harness, selecionado com borda laranja | Uma lista em dois grupos ("Neste computador", "Pra instalar") | Lista de um tipo só é linhas, não cards; a borda laranja usava destaque como moldura |
| "Falta entrar" dito 3 vezes por linha (subtítulo, tag, botão) | Um estado por linha: ponto + palavra | Dizer uma vez |
| Tags verdes "plano" e "provedores" | Texto neutro com ponto (verde só quando está em uso) | Forma de pagamento é categoria, não saúde |
| 5 botões cheios (Instalar ×3, Entrar ×2) | Botões secundários; "Testar" discreto | Uma lista de configurações não tem ação principal |
| Comando de instalação sempre à mostra | Aparece se o terminal não abrir, ou em "ver o comando" | Era a coisa mais chamativa da tela, para programas que você não usa |
| Roteador e Memória em dois cards | Um card, "Bastidores", com os dois trabalhos lado a lado | Mesmo padrão dos dois trabalhos no onboarding |
| Lote sempre aberto, com dois parágrafos de explicação | A barra de lote só aparece com agentes selecionados; "Salvar" só na linha alterada | Divulgação progressiva |
| Página com 2628px de altura | 1716px (−35%), sem estouro horizontal em 390px | |

Visual de referência: a página "Serviços" do Estúdio (linhas limpas, ponto de status, uma ação por linha).

## 4b. Segunda rodada: a alma de volta

O dono olhou o antes e depois e disse que a limpeza tinha passado do ponto: "perdeu a alma, ficou sem vida". Na aba Modelos, sobrou texto demais e faltaram cards e visuais. O que mudou, e por quê:

| O que | Como | Por quê |
|---|---|---|
| Tela inicial | Campo laranja com o tucano do ícone em escala grande (`ToucanHero.tsx`). O olho segue o mouse, pisca e inclina a cabeça enquanto você digita, e o tucano diz "Oi, Carol!" | A tela de abertura é core: precisa de um momento de marca, feito com o próprio ícone, não com decoração |
| Passos seguintes | O Tuca de 52px com o olho vivo (`TucaMark live`) e um sorriso quando o agente nasce | Um fio condutor da mesma vida, bem mais discreto |
| Construtor de agente | Canvas + deck: o agente grande num canvas na cor dele, parado; o deck ao lado muda a cada passo | O objeto que se está criando é o protagonista, não um card no canto |
| Fundo do canvas | Ondas de presença: anéis de 1px na cor do agente saindo do avatar, sumindo antes da borda | A grade de pontos é o fundo genérico de canvas de app de IA; a textura vem do assunto |
| Objetivos e missões | Um desenho SVG para cada um, no idioma do ícone (formas chapadas, tinta, laranja do bico, papel): `GoalArt.tsx`, `MissionArt` | Um ícone de biblioteca numa caixinha diz "lista"; um desenho diz "este produto" |
| Traços | Todo traço de interface com 1px; seleção pela cor (laranja a 55%), não pela espessura. `scripts/stroke-scan.mjs` falha se aparecer traço acima de 1px sem motivo escrito (`stroke-ok:`) | Contorno grosso é o sinal mais clássico de design feito por IA |
| Harnesses em uso | Cards com o logo (ou o anel do plano em volta dele), quantos agentes usam cada um e uma ação | Fatos desenhados no lugar de parágrafos |
| Bastidores | Os mesmos cards de trabalho do onboarding (`JobCard`, agora compartilhado) e um controle de 3 opções | Mesmo componente nos dois lugares; menos texto |

### Entrada de outros bots

A importação existia (OpenBot pelo export dele; Grok Bot pela skill de export do Tucano), mas estava escondida num card de Configurações. Agora:
- **`BotImport.tsx`:** uma porta única. Você escolhe a origem (OpenBot, Hermes, Grok Bot, Outro bot), lê o passo de cada uma e solta o .zip. Ela aparece na boas-vindas ("Vim de outro bot") e em Configurações › Geral › Time, sem uma segunda porta.
- **`readHermes`** (`core/agent-import.ts`): lê a pasta de um agente Hermes (`~/.hermes`). O `SOUL.md` vira as instruções; as skills e as memórias (`MEMORY.md`, `USER.md`) entram junto; config, chaves e tarefas agendadas ficam de fora. Tem testes em `test/agent-import.test.ts`.
- **OpenMaus e outros:** entram pelo caminho genérico, com a mesma skill de export.
- **Depois de importar pela boas-vindas:** você conecta a IA e o app abre na conversa com o primeiro agente importado, sem montar um agente novo.
- **O Tuca:** aprende essa porta pelo guia (`core/guide/backup.md`).

Essas regras viraram parte da skill (`~/.claude/skills/visant-design/references/soul.md`), para a próxima limpeza não repetir o erro.

## 5. Como verificar

- `node scripts/onboarding-gate.mjs <pasta>`: build, ~45 telas do primeiro uso (claro, escuro, inglês) e o scan de design. Falha se alguma tela der erro.
- `node scripts/screens-models.mjs <pasta>`: a aba Modelos de cima a baixo, em claro, escuro e 390px, com a medida de estouro.
- Testes novos: `test/usage-dock.test.ts`, `test/skill-tree.test.ts`, mais um teste em `onboarding-ui.test.tsx`. O teste do lote em `agent-models-ui.test.tsx` foi atualizado para o fluxo progressivo.
- A suíte ainda tem cerca de 103 falhas, que já existiam antes: `wiki*`, `team-round*` e `computer-card-ui` (`scrollIntoView` no jsdom). Compare a contagem, não persiga essas falhas.

## 6. O que ficou de fora (propostas, a decidir)

Saíram de duas análises de revenue-centric-design, uma combinada com o visant-killer e outra sem. As duas chegaram, cada uma por conta própria, ao mesmo problema número 1:

1. **A primeira mensagem faz o agente perguntar, não entregar.** As tarefas iniciais (`src/shared/onboarding.ts`, "Antes, me pergunta…") adiam o primeiro momento de valor. A proposta é o onboarding terminar numa tarefa entregue.
2. **A aprovação, o diferencial do Tucano, pode nunca aparecer no tour.** O balão de aprovação depende de o agente pedir algo (`Coach.tsx`); nas capturas, quem pede é o motor de teste.
3. **"Não assino nenhuma" é uma saída sem volta.** Nada traz a pessoa de volta depois de assinar.
4. **Rotinas, o que cria hábito, estão em 5º de 6 nas missões.**
5. **"Harnesses" é jargão.** No onboarding, o mesmo conceito se chama "Conectar a IA".
6. **Quem chega em Modelos porque bateu no limite não encontra o que fazer ali.** O widget de uso ajuda, mas não oferece uma troca rápida de modelo.

Os relatórios completos são temporários e ficaram fora do repo.

## Medir

- **Primeiro uso:** % que manda a primeira mensagem, tempo até a primeira resposta útil, quantos chegam à primeira aprovação, retenção em 7 dias separada entre "Sou novo" e "Já uso agentes", e cliques até o #geral no atalho (meta: 4 ou menos).
- **Modelos:** tempo para trocar o modelo de um agente e chamados sobre agente parado por cota.
