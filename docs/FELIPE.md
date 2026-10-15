# Felipe: formulário e modal de criação

Branch: `codex/felipe`. A contribuição de TaskForm e TaskModal foi concluída e integrada pelo PR #1, merge `21db979`. Leonardo já conectou o modal à interface pelo PR #2. Os roteiros abaixo ficam como registro da divisão original; não são tarefas ainda pendentes.

## Implementação disponível em 08/10/2026

Os seis arquivos descritos neste roteiro estão implementados nesta branch. O formulário controla os campos, valida o título, bloqueia envio duplicado e preserva o preenchimento em falhas. O modal aguarda `adicionarTarefa`, fecha somente após sucesso e trata X, Cancelar, Escape, foco e bloqueio do fundo.

O modal usa um portal para `document.body`, mantendo o overlay fora do root da aplicação. Enquanto aberto, aplica `inert` aos elementos de fundo e impede rolagem, restaurando os valores anteriores na limpeza do efeito. Os componentes mantêm as props combinadas; não foi necessário alterar Layout, Header, Sidebar ou App.

Foram acrescentados 21 testes: 9 do formulário e 12 do modal, utilizando o contexto real e simulando apenas o serviço HTTP nos testes de integração. A prévia temporária no navegador confirmou sucesso, falha e nova tentativa, foco circular, Escape e layout com rolagem interna em 390px. Ela não faz parte dos arquivos publicados.

A ligação dos três botões ao modal foi concluída por Leonardo. Os commits `ab00158`, `45d53b6` e `d0a9e39` estão associados à conta `Felipenar-x` no GitHub. A validação da versão integrada está em [VALIDACAO.md](VALIDACAO.md).

As seções abaixo preservam o roteiro e os critérios da contribuição para revisão do grupo.

## Começar

Você precisa ter acesso de colaborador ao repositório e usar sua própria conta GitHub. Caso falte acesso, envie seu usuário GitHub ao Gabriel para receber o convite.

```bash
git clone https://github.com/Gabriel-Apolinario01/exercicio_taskflow_git_github.git
cd exercicio_taskflow_git_github
git switch main
git pull --ff-only origin main
git switch -c codex/felipe
npm ci
```

Se já clonou, pule o clone. Se a branch já existe, use `git switch codex/felipe`. Confira `git config user.name` e `git config user.email`; eles devem identificar você. O README explica o `.env` e `npm run dev`.

## Seus arquivos

```text
src/components/TaskForm/TaskForm.tsx
src/components/TaskForm/TaskForm.css
src/components/TaskForm/TaskForm.test.tsx
src/components/TaskModal/TaskModal.tsx
src/components/TaskModal/TaskModal.css
src/components/TaskModal/TaskModal.test.tsx
```

Os testes são úteis aqui para garantir que um POST com falha não feche o modal nem apague o formulário. Vitest, Testing Library e user-event já estão instalados.

## TaskForm

Exporte `TaskForm` como função nomeada. Receba `aoSalvar: (tarefa: NovaTarefa) => Promise<void>` e `aoCancelar: () => void`. Importe `NovaTarefa` e `Prioridade` do arquivo comum de tipos, sem recriar uma interface diferente.

Implemente um formulário controlado com `useState`, contendo:

| Campo | Regra |
| --- | --- |
| Título | Obrigatório, máximo de 100 caracteres; rejeitar somente espaços. |
| Descrição | Textarea, máximo de 400 caracteres. |
| Prazo | `input type="date"`, pode ficar vazio. |
| Prioridade | Select: Alta/`high`, Média/`medium`, Baixa/`low`; inicial `medium`. |
| Projeto | Input de texto, pode ficar vazio. |
| Concluída | Enviar `false` na criação; não precisa de campo visual. |

Use `label` associado a cada campo, `preventDefault()` na submissão e atualização imutável do estado. “Cancelar” tem `type="button"`; “Criar tarefa” tem `type="submit"`.

Na submissão, valide o título, ative `salvando` e aguarde `aoSalvar`. Durante o envio, bloqueie submissões repetidas e mostre “Salvando...”. Em `catch`, apresente a mensagem em uma região de erro e mantenha os valores. Em `finally`, libere o envio. Só limpe os campos depois do sucesso. A rejeição de `aoSalvar` precisa ser tratada para não gerar uma Promise sem tratamento.

TaskForm não importa Axios, tarefaService ou TarefasContext. Ele coleta dados e chama a função recebida.

## TaskModal

Exporte `TaskModal` como função nomeada. Props: `aberto: boolean` e `aoFechar: () => void`.

1. Use `useTarefas()` para obter `adicionarTarefa`.
2. Quando `aberto` for falso, retorne `null`; nenhum overlay invisível deve permanecer.
3. Reutilize TaskForm. Sua função `salvarTarefa` deve executar `await adicionarTarefa(novaTarefa)` e somente depois chamar `aoFechar()`.
4. Se a criação falhar, deixe a rejeição chegar ao `catch` do formulário; não feche a janela.
5. Faça o botão X e “Cancelar” chamarem o fechamento. Enquanto uma criação estiver em andamento, impeça fechamento que descarte o formulário antes da resposta; o modal pode controlar localmente esse estado de envio.
6. Use overlay com `position: fixed`, `inset: 0`, `z-index` e fundo semitransparente. O painel deve ter largura máxima de 640px, altura limitada à viewport e rolagem interna. A interface de trás não pode receber cliques.
7. Identifique a janela com `role="dialog"`, `aria-modal="true"` e nome acessível. Direcione o foco para o modal, mantenha Tab/Shift+Tab dentro dele e devolva o foco ao botão de origem ao fechar. Escape pode cancelar quando não estiver salvando. Bloqueie a rolagem de fundo enquanto aberto e restaure-a na limpeza do efeito.
8. Hooks ficam antes dos retornos condicionais. Efeitos devem limpar listeners e restaurar alterações quando a janela fechar ou o componente desmontar.

Os itens de teclado completam a instrução da aula de manter a interação dentro da janela. Não aplique `pointer-events: none` no formulário; seus campos precisam continuar interativos.

Não crie outro provider e não altere App, Layout, Header ou Sidebar para a entrega da sua parte: Leonardo fará essa ligação. Para desenvolver antes dela, use testes renderizando TaskModal dentro de TarefasProvider com o serviço simulado; se usar uma tela temporária local, não a inclua no commit. Para uma conferência visual com API real, a ligação final será feita na integração.

## Commits por etapas reais

Exemplos de mensagens, depois de concluir cada etapa:

```text
implementa TaskForm controlado com validacao e envio assincrono
implementa TaskModal com criacao pelo contexto
adiciona controle de foco e bloqueio da interface no modal
verifica falha de cadastro sem fechar ou limpar formulario
```

Exemplo de publicação do formulário:

```bash
git status
git diff
git add src/components/TaskForm
git commit -m "implementa TaskForm controlado com validacao e envio assincrono"
git push -u origin codex/felipe
```

Depois publique também os commits do modal e dos testes. Não agrupe etapas inventadas apenas para aumentar a quantidade de commits.

## Conferência antes de avisar ao Gabriel

- `npm run check` passa.
- Título vazio ou somente espaços não envia requisição.
- Envio inclui os seis campos e nunca gera `_id` no cliente.
- Clique repetido enquanto salva não gera cadastros duplicados.
- Sucesso fecha o modal e o contexto atualiza a coleção.
- Falha mantém janela e campos, exibe erro e permite tentar novamente.
- X, Cancelar e Escape funcionam fora do envio; janela fechada não intercepta cliques.
- Fundo fica bloqueado; campos continuam interativos; foco fica no modal e retorna ao gatilho.
- Painel cabe em uma tela de celular e pode rolar internamente.

Envie ao Gabriel o nome `codex/felipe` e o que testou. Gabriel fará o merge antes de Leonardo concluir a ligação visual.

Base do professor: aula 06, seção 7.1 (formulário); continuação, seções 5 e 6 (TaskModal e overlay); slides de CSS e formulários acessíveis.

TaskForm passou a aceitar `tarefaInicial?: Tarefa | null`, alternando
os textos e o botão entre criação e edição. TaskModal passou a aceitar
`tarefa?: Tarefa | null` e delega para `editarTarefa` do contexto
quando existe registro selecionado, preservando o mesmo `_id` no PUT.
Testes de edição foram acrescentados em `TaskForm.test.tsx` (5 novos)
e `TaskModal.test.tsx` (7 novos), elevando o total da suíte para 82.
Lint, testes e build permanecem aprovados via `npm run check`.