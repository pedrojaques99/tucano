# PRs para o Tucano original (eduwxyz/tucano)

Os branches `pr/*` estão no fork `pedrojaques99/tucano`. Cada um foi montado sobre o `main` do upstream (Release 0.2.28) e compila sozinho (`tsc` sem erros). Os conflitos com o upstream foram resolvidos mantendo os dois lados:
- a migração `delegations` (#371) antes da nossa `more_reserves`;
- o `startReply` (#358) com o freio pendurado no resultado;
- instruções longas preservadas (#364);
- limite 0 = sem limite (#351);
- o motor Hermes nos testes.

Para abrir um PR, use o link "comparar": ele já aponta do fork para o `main` do upstream.

## Independentes (qualquer ordem)

| Branch | Commits | O quê | Comparar |
|---|---:|---|---|
| `pr/opencode-title` | 2 | O OpenCode deixa de fazer a chamada de título a cada turno | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/opencode-title) |
| `pr/polish` | 3 | Tucano dormindo no tema escuro, texto das ferramentas sensíveis, polimentos | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/polish) |
| `pr/server-401-page` | 1 | Página bilíngue com estilo para quem abre o servidor sem login | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/server-401-page) |

## Pilha (nesta ordem; cada um inclui os anteriores)

| # | Branch | Novos | O quê | Comparar |
|---:|---|---:|---|---|
| 1 | `pr/reserve-chain` | 3 | Um agente segue respondendo por uma corrente de reservas | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/reserve-chain) |
| 2 | `pr/narrow-screens` | 5 | Aprovações, abas, rotina, ferramentas e comandos cabem no celular | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/narrow-screens) |
| 3 | `pr/first-run` | 3 | Primeiro uso mais calmo, dock de uso, árvore de skills, agentes de outros bots | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/first-run) |
| 4 | `pr/figma-and-agent-page` | 1 | Figma pelo Claude Code; página do agente, sidebar e chat mais limpos | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/figma-and-agent-page) |
| 5 | `pr/node` | 4 | O Tucano de um servidor alcança este computador como nó | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/node) |
| 6 | `pr/collab` | 1 | Agentes passam a vez, repasses voltam, o roteador cai para regras | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/collab) |
| 7 | `pr/brakes` | 1 | Freio de alerta repetido, retomada após o limite do plano, uso por pessoa | [abrir](https://github.com/eduwxyz/tucano/compare/main...pedrojaques99:tucano:pr/brakes) |

Os PRs 1 e 2 também aplicam sozinhos sobre o `main`. Quando um PR da pilha for aceito, o seguinte mostra só os commits dele.

## O que ficou de fora (só faz sentido no fork)

- Atualizações vindas do fork `pedrojaques99` (`0c30a86`).
- Build do Mac e do Linux disparado por push em `visant/build` (`790fa00`, `8a4acf3`).
- Os merges dos branches `fix/*`.

## Testes

Nos arquivos afetados, 141 testes passam. Quatro falhas já existem no `main` do upstream e não vêm destes PRs: `db-queries` (isTransaction) e 3 em `workspace-data`. Os testes nossos foram ajustados ao novo desenho da sidebar (Configurações, Conectores e Uso agora ficam no rodapé) e ao motor Hermes.

## Refazer depois de o upstream andar

O branch `pr/stack` guarda a história linear resolvida. Para atualizar:
1. `git rebase origin/main pr/stack`;
2. recortar os branches pelas mesmas fatias desta tabela.
