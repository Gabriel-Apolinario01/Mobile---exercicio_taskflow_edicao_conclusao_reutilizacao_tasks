import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { NovaTarefa, Prioridade, Tarefa } from '../../types/Tarefa';
import './TaskForm.css';

type TaskFormProps = {
  tarefaInicial?: Tarefa | null;
  aoSalvar: (tarefa: NovaTarefa) => Promise<void>;
  aoCancelar: () => void;
};

const estadoInicial: NovaTarefa = {
  titulo: '', descricao: '', data: '', prioridade: 'medium', projeto: '', concluida: false,
};

function obterEstadoInicial(tarefa?: Tarefa | null): NovaTarefa {
  if (!tarefa) return estadoInicial;
  const { titulo, descricao, data, prioridade, projeto, concluida } = tarefa;
  return { titulo, descricao, data, prioridade, projeto, concluida };
}

export function TaskForm({ tarefaInicial, aoSalvar, aoCancelar }: Readonly<TaskFormProps>) {
  const editando = Boolean(tarefaInicial);
  const [formulario, setFormulario] = useState<NovaTarefa>(() => obterEstadoInicial(tarefaInicial));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [tituloInvalido, setTituloInvalido] = useState(false);
  const envioEmAndamento = useRef(false);
  const tituloRef = useRef<HTMLInputElement>(null);
  const id = useId();

  function alterarCampo<K extends keyof NovaTarefa>(campo: K, valor: NovaTarefa[K]) {
    setFormulario((atual) => ({ ...atual, [campo]: valor }));
    if (campo === 'titulo') setTituloInvalido(false);
    setErro('');
  }

  async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (envioEmAndamento.current) return;

    const titulo = formulario.titulo.trim();
    if (!titulo) {
      setTituloInvalido(true);
      setErro('Informe um título para a tarefa.');
      tituloRef.current?.focus();
      return;
    }

    envioEmAndamento.current = true;
    setSalvando(true);
    setErro('');
    try {
      await aoSalvar({ ...formulario, titulo, projeto: formulario.projeto.trim() });
      setFormulario(estadoInicial);
    } catch (causa) {
      setErro(causa instanceof Error && causa.message
        ? causa.message : 'Não foi possível salvar a tarefa. Tente novamente.');
    } finally {
      envioEmAndamento.current = false;
      setSalvando(false);
    }
  }

  return (
    <form className="task-form" onSubmit={enviarFormulario} aria-busy={salvando}>
      <h2>{editando ? 'Editar tarefa' : 'Nova tarefa'}</h2>

      <fieldset className="task-form__fields" disabled={salvando}>
        <legend className="task-form__sr-only">{editando ? 'Dados da tarefa' : 'Dados da nova tarefa'}</legend>
        <label htmlFor={`${id}-titulo`}>Título <span aria-hidden="true">*</span></label>
        <input
          ref={tituloRef} id={`${id}-titulo`} name="titulo" required maxLength={100}
          value={formulario.titulo} placeholder="Ex.: Revisar proposta comercial"
          onChange={(evento) => alterarCampo('titulo', evento.target.value)}
          aria-invalid={tituloInvalido || undefined}
          aria-describedby={tituloInvalido ? `${id}-erro` : undefined}
        />

        <label htmlFor={`${id}-descricao`}>Descrição <span className="task-form__optional">Opcional</span></label>
        <textarea
          id={`${id}-descricao`} name="descricao" rows={3} maxLength={400}
          value={formulario.descricao} placeholder="Adicione contexto ou observações"
          onChange={(evento) => alterarCampo('descricao', evento.target.value)}
          aria-describedby={`${id}-contador`}
        />
        <span className="task-form__counter" id={`${id}-contador`}>{formulario.descricao.length}/400 caracteres</span>

        <div className="task-form__row">
          <div className="task-form__field">
            <label htmlFor={`${id}-data`}>Prazo <span className="task-form__optional">Opcional</span></label>
            <input
              id={`${id}-data`} name="data" type="date" value={formulario.data}
              onChange={(evento) => alterarCampo('data', evento.target.value)}
            />
          </div>
          <div className="task-form__field">
            <label htmlFor={`${id}-prioridade`}>Prioridade</label>
            <select
              id={`${id}-prioridade`} name="prioridade" value={formulario.prioridade}
              onChange={(evento) => alterarCampo('prioridade', evento.target.value as Prioridade)}
            >
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>
        </div>

        <label htmlFor={`${id}-projeto`}>Projeto <span className="task-form__optional">Opcional</span></label>
        <input
          id={`${id}-projeto`} name="projeto" value={formulario.projeto}
          placeholder="Ex.: Projeto Atlas"
          onChange={(evento) => alterarCampo('projeto', evento.target.value)}
        />
      </fieldset>

      {erro && <p className="task-form__error" role="alert" id={`${id}-erro`}><AlertCircle size={18} aria-hidden="true" />{erro}</p>}
      <div className="task-form__actions">
        <button className="task-form__cancel" type="button" onClick={aoCancelar} disabled={salvando}>Cancelar</button>
        <button className="task-form__submit" type="submit" disabled={salvando}>
          {salvando && <LoaderCircle className="task-form__spinner" size={17} aria-hidden="true" />}
          {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar tarefa'}
        </button>
      </div>
      <span className="task-form__sr-only" role="status">{salvando ? 'Salvando tarefa. Aguarde a conclusão.' : ''}</span>
    </form>
  );
}
