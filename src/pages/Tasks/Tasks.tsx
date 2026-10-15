import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from '../../components/Layout/Layout';
import { useTarefas } from '../../contexts/TarefasContext';
import type { Tarefa } from '../../types/Tarefa';
import { TaskPage } from '../TaskPage';
import { dataLocal } from '../dataLocal';

export type VisaoTarefas = 'tarefas' | 'hoje' | 'proximas' | 'concluidas';
const apresentacao = {
  tarefas: { titulo: 'Todas as tarefas', chamada: 'VISÃO GERAL', descricao: 'Todas as tarefas ainda não concluídas.' },
  hoje: { titulo: 'Hoje', chamada: 'FOCO DO DIA', descricao: 'Concentre-se no que precisa avançar agora.' },
  proximas: { titulo: 'Próximas', chamada: 'OLHANDO ADIANTE', descricao: 'Um pouco de planejamento para os próximos dias.' },
  concluidas: { titulo: 'Concluídas', chamada: 'CAMINHO PERCORRIDO', descricao: 'Cada tarefa finalizada é um passo adiante.' },
};

export function Tasks({ visao = 'tarefas' }: Readonly<{ visao?: VisaoTarefas }>) {
  const { tarefas, carregando, erro, removerTarefa, editarTarefa } = useTarefas();
  const { abrirTaskModal } = useOutletContext<LayoutContext>();
  const hoje = dataLocal();
  const selecionadas = tarefas.filter((tarefa) => {
    if (visao === 'concluidas') return tarefa.concluida;
    if (tarefa.concluida) return false;
    if (visao === 'hoje') return tarefa.data === hoje;
    if (visao === 'proximas') return tarefa.data > hoje;
    return true;
  });

  async function alternarConclusao(tarefa: Tarefa) {
    // Reutiliza a atualização do contexto, que persiste antes de mudar a coleção.
    await editarTarefa({ ...tarefa, concluida: !tarefa.concluida });
  }

  return (
    <TaskPage
      {...apresentacao[visao]}
      tarefas={selecionadas} carregando={carregando} erro={erro} aoExcluir={removerTarefa}
      aoAlternarConclusao={alternarConclusao}
      acao={<button type="button" onClick={abrirTaskModal}>Nova tarefa</button>}
    />
  );
}
