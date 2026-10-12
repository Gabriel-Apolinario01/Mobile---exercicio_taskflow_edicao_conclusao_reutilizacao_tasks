import type { Tarefa } from '../../types/Tarefa';
import { TaskCard } from '../TaskCard/TaskCard';
import './TaskList.css';

type TaskListProps = { tarefas: Tarefa[]; aoExcluir: (id: string) => Promise<void>; aoEditar: (tarefa: Tarefa) => void };

export function TaskList({ tarefas, aoExcluir, aoEditar }: Readonly<TaskListProps>) {
  if (tarefas.length === 0) {
    return (
      <div className="task-list__empty" role="status">
        <h2>Nada por aqui</h2>
        <p>Crie uma nova tarefa ou altere os filtros para continuar.</p>
      </div>
    );
  }

  return (
    <ul className="task-list" aria-label="Lista de tarefas">
      {tarefas.map((tarefa) => <li key={tarefa._id}><TaskCard tarefa={tarefa} aoExcluir={aoExcluir} aoEditar={aoEditar} /></li>)}
    </ul>
  );
}
