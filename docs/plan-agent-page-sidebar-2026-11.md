# Página do agente + barra lateral: plano (2026-11-11)

Track da skill visant-design: **várias telas** (página do agente com 4 abas, barra lateral). Primeiro o padrão, depois cada tela.
"Antes": screenshots em dark, 1440×900 (Perfil, Canais e skills, Ferramentas, Memória, barra lateral).

## Trabalho de cada superfície

| Superfície | Quem chega | Pra quê | Número que move | Craft |
|---|---|---|---|---|
| Página do agente | dono/admin | ajustar quem o agente é e até onde vai | tempo até configurar; agentes com acesso certo | sober (work) |
| Barra lateral | todo mundo, o tempo todo | achar a conversa/agente certo | cliques até a conversa | alive (sinal de "esperando você") |
| Rodapé (Missões + uso) | dono, nos primeiros dias | próximo passo + quanto gastou | missões completas | alive |

## Diagnóstico (maior primeiro)

1. **A página "pula" entre abas.** As abas mudam de x (361 → 366 px) e a coluna muda de largura, porque a barra de rolagem aparece e some. Na próxima aba, nada está onde estava.
2. **Card em toda seção, com um parágrafo de explicação em cada.** "Muda na hora, sem precisar salvar" aparece **6 vezes**. Tem mais texto explicando os controles do que controles.
3. **Dois jeitos de salvar sem aviso.** Perfil precisa de "Salvar" (botão fixo no topo, sempre aceso). As outras 3 abas salvam na hora. O botão aceso sem mudança nenhuma engana.
4. **O card da direita se repete igual nas 4 abas.** Avatar grande, nome, @handle e papel repetem o cabeçalho e os campos do Perfil. Ali só "uso do mês", motor e modelo são informação.
5. **Aparência ocupa meia tela:** 9 cores e 23 rostos sempre abertos, pra uma escolha que se faz uma vez.
6. **Controles binários como segmentado:** Web (Desligada/Ligada) e Wiki (Lê/Sem acesso) são um interruptor. "Canais" usa pílula com borda, checkbox e laranja, três sinais pra um estado só.
7. **Cabeçalho:** "Arquivar" (ação sem volta fácil) fica entre "Abrir DM" e "Salvar", no mesmo peso.
8. **Barra lateral:** o rodapé usa 3 andares: o card de Missões, uma linha só pro anel de uso e 3 itens de menu. Agentes e DMs não agrupam; canais já agrupam (`channelLayout`).

## Padrão (vale pras 4 abas)

- Largura fixa, com a barra de rolagem sempre reservada (`scrollbar-gutter: stable`), então as abas e a coluna não se mexem.
- **Seção = título + controle**, sem card em volta e sem parágrafo. A explicação vira uma linha curta embaixo do controle **só quando ela muda a decisão**. "Muda na hora" sai e vira um "Salvo" discreto que aparece ao lado do controle.
- **Um jeito de salvar:** tudo salva na hora, o Perfil também (nome, papel e instruções, com espera curta após parar de digitar e um "Salvo ✓"). O botão "Salvar" sai do topo.
- Binário = `Toggle` (o compartilhado, agora em `ui.tsx`). Três ou mais opções = segmentado.
- Cabeçalho: avatar + nome + @handle à esquerda, e "Abrir DM" como única ação primária. "Arquivar" vai pro menu "⋯".

## Direções (escolha uma por bloco)

### A. Estrutura da página do agente

**A1 (recomendo). Abas iguais, sem o card repetido, com a identidade no cabeçalho**
```
┌───────────────────────────────────────────────────────────────┐
│ [▣] Félix  @felix · Web-dev Clientes     uso ▮▮▯ 24k/2mi  [Abrir DM] ⋯ │
│  Perfil   Canais e skills   Ferramentas   Memória              │
├───────────────────────────────────────────────────────────────┤
│ Identidade                                                     │
│ [▣ trocar]  Nome [Félix      ]  @handle [felix ]               │
│             Papel [Web-dev Clientes                 ]          │
│ Instruções                                         Salvo ✓     │
│ ┌───────────────────────────────────────────────────────────┐ │
│ │ ...                                                       │ │
│ └───────────────────────────────────────────────────────────┘ │
│ Modelo   [Claude Code · Sonnet ▾]   Esforço [ média ▾ ]        │
└───────────────────────────────────────────────────────────────┘
```
Avatar + cor viram um popover em "trocar". O uso do mês vai pro cabeçalho como barra fina, visível em todas as abas.

**A2. Uma página só com índice à esquerda** (rolagem contínua, sem abas). Bom pra ler tudo de uma vez, mas Ferramentas é longa e empurra Memória pra baixo.

**A3. Ajustes estilo macOS:** rótulo à esquerda, controle à direita, linhas finas. Mais denso e mais "configurações" do que "pessoa".

### B. Grupos na barra lateral

**B1 (recomendo). O mesmo modelo dos canais, estendido pra Agentes e DMs, com ícone.** Cada grupo tem nome + ícone (do conjunto de ícones do app, sem emoji) e recolhe; o estado fica no mesmo `folded`. Pra montar: arrastar, ou "Mover para ▸ grupo" e "Novo grupo com este" no menu do item, como já é nos canais. `ChannelLayout` vira `SidebarLayout` com `icon?`, e entram `agentLayout` e `dmLayout` nas configurações. Um grupo recolhido mostra o "esperando você" de dentro.
```
 AGENTES                        +
 ▾ ◇ Visant                      
     Félix      Web-dev Clientes
     Ageu       Engenharia
 ▸ ◫ Comercial  ·2              
     Bia        Assistente
```
**B2. Só pastas manuais em Agentes**, com DMs seguindo os grupos dos agentes automaticamente. Menos trabalho de arrumar, menos controle.

### C. Rodapé (Missões + uso)

**C1 (recomendo). Um andar só.** `[anel de uso] [Missões 4/6 ▾] [⚙]`: Missões vira um botão com anel de progresso, e um clique abre o card (recolhido, ele lembra). Conectores e Configurações viram ícones com tooltip na mesma linha. Ganha uns 90 px pra lista.
```
 ─────────────────────────────────
 (◔) uso   (◕) Missões 4/6 ▾   ⚇  ⚙
```
**C2. O card de Missões com um chevron pra recolher** no lugar, e o resto igual. Mexe menos, ganha menos espaço.

## Ordem de execução
1. Componentes: `Toggle` (feito), `SaveState` ("Salvo ✓"), `SectionHead`, popover de avatar, `SidebarLayout` (+ testes do `arrange` com ícone).
2. Página do agente aba por aba, com screenshots antes/depois de cada uma em 1440 e 1100, dark e light.
3. Barra lateral: grupos de agentes e DMs, depois o rodapé.
4. check.mjs + stroke-scan, testes afetados; mostro os pares antes/depois antes de dar por feito.

## Como medir
Cliques até configurar um agente novo (hoje ~8 na aba Ferramentas); texto explicativo na página do agente (hoje ~6 parágrafos repetidos, meta: zero repetido); altura útil da lista lateral (+~90 px).
