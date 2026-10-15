import type { ReactNode } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { LayoutContext } from '../components/Layout/Layout';
import { TaskList } from '../components/TaskList/TaskList';
import type { Tarefa } from '../types/Tarefa';
import './Tasks/Tasks.css';

type TaskPageProps = {
  titulo: string;
  chamada: string;
  descricao: string;
  tarefas: Tarefa[];
  carregando: boolean;
  erro: string;
  aoExcluir: (id: string) => Promise<void>;
  aoAlternarConclusao: (tarefa: Tarefa) => Promise<void>;
  acao?: ReactNode;
};

export function TaskPage({ titulo, chamada, descricao, tarefas, carregando, erro, aoExcluir, aoAlternarConclusao, acao }: Readonly<TaskPageProps>) {
  const { editarTaskModal } = useOutletContext<LayoutContext>();
  const [parametros] = useSearchParams();
  const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const busca = normalizar(parametros.get('q')?.trim() ?? '');
  const visiveis = busca ? tarefas.filter((tarefa) => normalizar(`${tarefa.titulo} ${tarefa.descricao} ${tarefa.projeto}`).includes(busca)) : tarefas;

  return (
    <section className="tasks-page" aria-labelledby="titulo-pagina">
      <div className="tasks-page__heading">
        <div>
          <p className="page-eyebrow">{chamada}</p>
          <h1 id="titulo-pagina">{titulo}</h1>
          <p className="tasks-page__description">{descricao}</p>
        </div>
        {acao}
      </div>
      {erro && <p className="tasks-page__error" role="alert"><AlertCircle size={20} aria-hidden="true" />{erro}</p>}
      {carregando && <p className="tasks-page__loading" role="status"><LoaderCircle size={20} aria-hidden="true" />Carregando tarefas...</p>}
      {visiveis.length > 0 ? (
        <TaskList tarefas={visiveis} aoExcluir={aoExcluir} aoEditar={editarTaskModal} aoAlternarConclusao={aoAlternarConclusao} />
      ) : !carregando && !erro && (busca ? (
        <div className="task-list__empty" role="status"><h2>Nenhuma tarefa encontrada</h2><p>Altere a busca para ver as tarefas desta página.</p></div>
      ) : <TaskList tarefas={visiveis} aoExcluir={aoExcluir} aoEditar={editarTaskModal} aoAlternarConclusao={aoAlternarConclusao} />)}
    </section>
  );
}
