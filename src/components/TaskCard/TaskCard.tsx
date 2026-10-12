import { useRef, useState } from 'react';
import { CalendarDays, Circle, CircleCheckBig, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import type { Prioridade, Tarefa } from '../../types/Tarefa';
import './TaskCard.css';

type TaskCardProps = { tarefa: Tarefa; aoExcluir: (id: string) => Promise<void>; aoEditar: (tarefa: Tarefa) => void };

const prioridades: Record<Prioridade, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export function TaskCard({ tarefa, aoExcluir, aoEditar }: Readonly<TaskCardProps>) {
  const [excluindo, setExcluindo] = useState(false);
  const exclusaoEmAndamento = useRef(false);
  const Status = tarefa.concluida ? CircleCheckBig : Circle;

  async function excluir() {
    if (!tarefa._id || exclusaoEmAndamento.current) return;
    exclusaoEmAndamento.current = true;
    setExcluindo(true);
    try {
      // O contexto mantém o registro e informa o erro se a API falhar.
      await aoExcluir(tarefa._id);
    } finally {
      exclusaoEmAndamento.current = false;
      setExcluindo(false);
    }
  }

  return (
    <article className={`task-card${tarefa.concluida ? ' task-card--completed' : ''}`} aria-busy={excluindo}>
      <span className="task-card__check">
        <Status size={22} aria-hidden="true" />
        <span className="sr-only">{tarefa.concluida ? 'Concluída' : 'Pendente'}</span>
      </span>
      <div className="task-card__content">
        <div className="task-card__header">
          <h2>{tarefa.titulo}</h2>
          <div className="task-card__actions">
            <button
              type="button" onClick={() => aoEditar(tarefa)}
              disabled={!tarefa._id || excluindo} aria-label={`Editar tarefa: ${tarefa.titulo}`}
              title={!tarefa._id ? 'A tarefa ainda não tem um identificador para edição.' : 'Editar tarefa'}
            ><Pencil size={17} aria-hidden="true" /><span className="sr-only">Editar</span></button>
            <button
              type="button" onClick={() => void excluir()}
              disabled={excluindo || !tarefa._id} aria-label={`Excluir tarefa: ${tarefa.titulo}`}
              title={!tarefa._id ? 'A tarefa ainda não tem um identificador para exclusão.' : 'Excluir tarefa'}
            >
              {excluindo ? <LoaderCircle className="task-card__spinner" size={17} aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
              <span className="sr-only">{excluindo ? 'Excluindo...' : 'Excluir'}</span>
            </button>
          </div>
        </div>
        <p>{tarefa.descricao || 'Sem descrição.'}</p>
        <div className="task-card__meta">
          <span><CalendarDays size={15} aria-hidden="true" />{tarefa.data ? <time dateTime={tarefa.data}>{tarefa.data.split('-').reverse().join('/')}</time> : 'Sem prazo'}</span>
          <span>{tarefa.projeto || 'Sem projeto'}</span>
          <span>Prioridade {prioridades[tarefa.prioridade]}</span>
        </div>
      </div>
    </article>
  );
}
