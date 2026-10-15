import { useRef, useState } from 'react';
import { CalendarDays, Circle, CircleCheckBig, LoaderCircle, Pencil, Trash2 } from 'lucide-react';
import type { Prioridade, Tarefa } from '../../types/Tarefa';
import './TaskCard.css';

type TaskCardProps = { tarefa: Tarefa; aoExcluir: (id: string) => Promise<void>; aoEditar: (tarefa: Tarefa) => void; aoAlternarConclusao: (tarefa: Tarefa) => Promise<void> };

const prioridades: Record<Prioridade, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };

export function TaskCard({ tarefa, aoExcluir, aoEditar, aoAlternarConclusao }: Readonly<TaskCardProps>) {
  const [excluindo, setExcluindo] = useState(false);
  const exclusaoEmAndamento = useRef(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erroConclusao, setErroConclusao] = useState('');
  const ocupado = excluindo || atualizando;
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

  async function alternarConclusao() {
    if (!tarefa._id || exclusaoEmAndamento.current) return;
    exclusaoEmAndamento.current = true;
    setAtualizando(true);
    setErroConclusao('');
    try {
      await aoAlternarConclusao(tarefa);
    } catch {
      setErroConclusao('Não foi possível confirmar a mudança de conclusão. Confira o aviso da página antes de tentar novamente.');
    } finally {
      exclusaoEmAndamento.current = false;
      setAtualizando(false);
    }
  }

  return (
    <article className={`task-card${tarefa.concluida ? ' task-card--completed' : ''}`} aria-busy={ocupado}>
      <button type="button" className="task-card__check"
        onClick={() => void alternarConclusao()} disabled={ocupado || !tarefa._id}
        aria-label={`${tarefa.concluida ? 'Reabrir' : 'Concluir'} tarefa: ${tarefa.titulo}`}
        aria-pressed={tarefa.concluida}>
        <Status size={22} aria-hidden="true" />
        <span className="sr-only">{tarefa.concluida ? 'Concluída' : 'Pendente'}</span>
      </button>
      <div className="task-card__content">
        <div className="task-card__header">
          <h2>{tarefa.titulo}</h2>
          <div className="task-card__actions">
            <button
              type="button" onClick={() => aoEditar(tarefa)}
              disabled={!tarefa._id || ocupado} aria-label={`Editar tarefa: ${tarefa.titulo}`}
              title={!tarefa._id ? 'A tarefa ainda não tem um identificador para edição.' : 'Editar tarefa'}
            ><Pencil size={17} aria-hidden="true" /><span className="sr-only">Editar</span></button>
            <button
              type="button" onClick={() => void excluir()}
              disabled={ocupado || !tarefa._id} aria-label={`Excluir tarefa: ${tarefa.titulo}`}
              title={!tarefa._id ? 'A tarefa ainda não tem um identificador para exclusão.' : 'Excluir tarefa'}
            >
              {excluindo ? <LoaderCircle className="task-card__spinner" size={17} aria-hidden="true" /> : <Trash2 size={17} aria-hidden="true" />}
              <span className="sr-only">{excluindo ? 'Excluindo...' : 'Excluir'}</span>
            </button>
          </div>
        </div>
        {erroConclusao && <p role="alert">{erroConclusao}</p>}
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
